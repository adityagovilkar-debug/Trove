"use client";

// On-device Gemma 4 (E2B) text parsing via MediaPipe LLM Inference + WebGPU.
// Runs entirely in the browser — no server, no API key, works offline once the
// model is cached. This is an OPT-IN upgrade over the heuristic parser:
// it only activates when NEXT_PUBLIC_GEMMA_MODEL_URL points to a LiteRT/.task
// web bundle (e.g. the litert-community/gemma-4-E2B-it-litert-lm int4 web file)
// AND the device exposes WebGPU. Otherwise callers fall back to lib/nutritionParse.
//
// Docs: https://developers.google.com/edge/mediapipe/solutions/genai/llm_inference/web_js

import type { NutritionResult } from "./nutritionParse";

const MODEL_URL = process.env.NEXT_PUBLIC_GEMMA_MODEL_URL;
const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai/wasm";

export function gemmaConfigured(): boolean {
  return (
    !!MODEL_URL &&
    typeof navigator !== "undefined" &&
    "gpu" in navigator // WebGPU present
  );
}

// LlmInference type is loaded lazily; keep a loose handle.
let llmPromise: Promise<{ generateResponse: (p: string) => Promise<string> }> | null =
  null;

// Lazily create (and cache) the on-device model. The heavy MediaPipe runtime
// and the model weights are only fetched the first time the user scans.
function getModel(onProgress?: (msg: string) => void) {
  if (!llmPromise) {
    llmPromise = (async () => {
      onProgress?.("Loading on-device model…");
      const { FilesetResolver, LlmInference } = await import(
        "@mediapipe/tasks-genai"
      );
      const fileset = await FilesetResolver.forGenAiTasks(WASM_BASE);
      const llm = await LlmInference.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL! },
        maxTokens: 512,
        topK: 1,
        temperature: 0,
      });
      return llm as unknown as {
        generateResponse: (p: string) => Promise<string>;
      };
    })();
  }
  return llmPromise;
}

const PROMPT = (text: string) =>
  `You extract nutrition facts from a product label.
Return ONLY a compact JSON object using any of these numeric keys you can find,
omitting keys that are absent. Units: calories in kcal; protein_g, carbs_g,
sugar_g, fat_g, sat_fat_g, fiber_g in grams; sodium_mg in milligrams;
serving_size as a short string (e.g. "330 ml").
Keys: serving_size, servings_per_pack, calories, protein_g, carbs_g, sugar_g,
fat_g, sat_fat_g, fiber_g, sodium_mg.

Label text:
"""${text}"""

JSON:`;

// Parse with Gemma; returns null if unavailable or it produced no valid JSON
// (caller then uses the heuristic parser).
export async function parseNutritionWithGemma(
  rawText: string,
  onProgress?: (msg: string) => void,
): Promise<NutritionResult | null> {
  if (!gemmaConfigured()) return null;
  try {
    const llm = await getModel(onProgress);
    onProgress?.("Reading values…");
    const reply = await llm.generateResponse(PROMPT(rawText));
    const match = reply.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    // Coerce everything to trimmed strings so it slots into the form fields.
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
