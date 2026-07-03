"use client";

// On-device Gemma (E2B, multimodal) via MediaPipe LLM Inference + WebGPU.
// Runs entirely in the browser — no server, no API key. Crucially this uses
// Gemma's VISION modality: the photo is handed to the model directly (the same
// thing Google's AI Edge Gallery does), instead of OCR-ing to text first and
// feeding it garbled characters. That's both faster (no Tesseract pass) and far
// more accurate, because the model sees the actual layout.
//
// Requires NEXT_PUBLIC_GEMMA_MODEL_URL to point at a *multimodal* Gemma .task
// web bundle (e.g. the litert-community gemma E2B-it web file) AND a WebGPU
// browser. Otherwise callers fall back to Tesseract OCR + the heuristic parsers.
//
// Docs: https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference/web_js

import type { NutritionResult } from "./nutritionParse";
import type { ReceiptItem } from "./receiptParse";

const MODEL_URL = process.env.NEXT_PUBLIC_GEMMA_MODEL_URL;
// Pin the WASM runtime to the installed JS version — an unversioned CDN path
// serves "latest", which can mismatch the bundled API and hang or fail.
const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@0.10.27/wasm";

export function gemmaConfigured(): boolean {
  return (
    !!MODEL_URL &&
    typeof navigator !== "undefined" &&
    "gpu" in navigator // WebGPU present
  );
}

// A prompt may mix text and an image. Keep a loose handle over the lazily
// imported runtime so we can pass the multimodal array form.
type ImagePrompt = Array<string | { imageSource: CanvasImageSource }>;
let llmPromise: Promise<{
  generateResponse: (p: string | ImagePrompt) => Promise<string>;
}> | null = null;

// Lazily create (and cache) the on-device model with vision enabled. The heavy
// MediaPipe runtime + model weights are only fetched the first time you scan.
function getModel(onProgress?: (msg: string) => void) {
  if (!llmPromise) {
    llmPromise = (async () => {
      onProgress?.("Loading on-device model…");
      const { FilesetResolver, LlmInference } = await import("@mediapipe/tasks-genai");
      const fileset = await FilesetResolver.forGenAiTasks(WASM_BASE);
      const llm = await LlmInference.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL! },
        maxTokens: 4096, // room for the image tokens + prompt + JSON output
        topK: 1,
        temperature: 0,
        maxNumImages: 1, // > 0 turns on the vision modality
      });
      return llm as unknown as {
        generateResponse: (p: string | ImagePrompt) => Promise<string>;
      };
    })();
  }
  return llmPromise;
}

// Downscale a captured photo before handing it to the model — phone photos are
// huge, and the vision encoder works at a modest resolution anyway. Smaller =
// faster and lighter on GPU memory.
async function prepareImage(file: Blob, maxDim = 1024): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas;
}

async function runVision(
  file: Blob,
  prompt: string,
  onProgress?: (msg: string) => void,
): Promise<string | null> {
  if (!gemmaConfigured()) return null;
  const llm = await getModel(onProgress);
  onProgress?.("Reading the photo…");
  const image = await prepareImage(file);
  return llm.generateResponse([prompt, { imageSource: image }]);
}

const NUTRITION_PROMPT = `You are reading a product's nutrition label in the image.
Return ONLY a compact JSON object using any of these numeric keys you can find,
omitting keys that are absent. Units: calories in kcal; protein_g, carbs_g,
sugar_g, fat_g, sat_fat_g, fiber_g in grams; sodium_mg in milligrams;
serving_size as a short string (e.g. "330 ml").
Keys: serving_size, servings_per_pack, calories, protein_g, carbs_g, sugar_g,
fat_g, sat_fat_g, fiber_g, sodium_mg.

JSON:`;

// Read a nutrition label from a photo with Gemma vision. Returns null when
// unavailable or no valid JSON (caller falls back to OCR + heuristic parser).
export async function parseNutritionImageWithGemma(
  file: Blob,
  onProgress?: (msg: string) => void,
): Promise<NutritionResult | null> {
  try {
    const reply = await runVision(file, NUTRITION_PROMPT, onProgress);
    if (!reply) return null;
    const match = reply.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const result: NutritionResult = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v == null || v === "") continue;
      (result as Record<string, string>)[k] = String(v).trim();
    }
    return result;
  } catch {
    return null;
  }
}

const RECEIPT_PROMPT = `You are reading a grocery receipt in the image.
Return ONLY a compact JSON array. Each element: {"name": string, "quantity": number|null, "price": number|null}.
- name: the product, cleaned up and title-cased (drop item codes).
- quantity: units purchased if shown, else null.
- price: the line total as a number, else null.
Ignore totals, tax, discounts, payment, and store/header/footer lines.

JSON:`;

// Read a grocery receipt from a photo with Gemma vision. Returns null when
// unavailable or no valid JSON (caller falls back to OCR + heuristic parser).
export async function parseReceiptImageWithGemma(
  file: Blob,
  onProgress?: (msg: string) => void,
): Promise<ReceiptItem[] | null> {
  try {
    const reply = await runVision(file, RECEIPT_PROMPT, onProgress);
    if (!reply) return null;
    const match = reply.match(/\[[\s\S]*\]/);
    if (!match) return null;
    const arr = JSON.parse(match[0]) as unknown;
    if (!Array.isArray(arr)) return null;
    return arr
      .map((r) => {
        const o = r as Record<string, unknown>;
        return {
          name: String(o.name ?? "").trim(),
          quantity: o.quantity != null && o.quantity !== "" ? Number(o.quantity) : null,
          price: o.price != null && o.price !== "" ? Number(o.price) : null,
        };
      })
      .filter((r) => r.name.length > 1);
  } catch {
    return null;
  }
}
