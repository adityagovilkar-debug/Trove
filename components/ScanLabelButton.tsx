"use client";

import { useEffect, useRef, useState } from "react";
import { ScanText, Loader2, Sparkles, Cpu } from "lucide-react";
import { toast } from "sonner";
import {
  parseNutritionText,
  countFilled,
  type NutritionResult,
} from "@/lib/nutritionParse";
import { gemmaConfigured, parseNutritionWithGemma } from "@/lib/gemma";
import { cn } from "@/lib/utils";

type Method = "gemma" | "heuristic";

// Captures a photo of a nutrition label (camera on mobile, file picker on
// desktop), OCRs it on-device with Tesseract.js, then structures the text with
// on-device Gemma 4 when available — otherwise a heuristic parser. Fully
// client-side; nothing leaves the device.
export function ScanLabelButton({
  onResult,
}: {
  onResult: (values: NutritionResult) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  // Whether smart (Gemma 4) parsing is available on this device. Computed in an
  // effect because it checks navigator.gpu (client-only).
  const [smart, setSmart] = useState(false);
  const [lastMethod, setLastMethod] = useState<Method | null>(null);

  useEffect(() => setSmart(gemmaConfigured()), []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;

    setBusy(true);
    try {
      // 1) On-device OCR
      setStatus("Reading label…");
      const Tesseract = (await import("tesseract.js")).default;
      const {
        data: { text },
      } = await Tesseract.recognize(file, "eng", {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text")
            setStatus(`Reading label… ${Math.round(m.progress * 100)}%`);
        },
      });

      if (!text.trim()) {
        toast.error("Couldn't read any text — try a clearer, closer photo.");
        return;
      }

      // 2) Structure it: Gemma 4 on-device if available, else heuristic.
      let parsed: NutritionResult | null = null;
      let method: Method = "heuristic";
      if (gemmaConfigured()) {
        setStatus("Understanding values…");
        const g = await parseNutritionWithGemma(text, setStatus);
        if (g && countFilled(g) > 0) {
          parsed = g;
          method = "gemma";
        }
      }
      if (!parsed || countFilled(parsed) === 0) {
        parsed = parseNutritionText(text);
        method = "heuristic";
      }

      const n = countFilled(parsed);
      setLastMethod(method);
      if (n === 0) {
        toast.message("Read the label, but found no nutrition values to fill.");
        return;
      }
      onResult(parsed);
      toast.success(
        `Filled ${n} field${n > 1 ? "s" : ""} · ${
          method === "gemma" ? "Gemma 4 on-device" : "basic parser"
        }`,
      );
    } catch {
      toast.error("Scan failed. You can still type the values in.");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  // Badge reflects what DID run after a scan, otherwise what's available.
  const badge = lastMethod
    ? lastMethod === "gemma"
      ? { text: "Parsed by Gemma 4", smart: true }
      : { text: "Parsed by basic parser", smart: false }
    : smart
      ? { text: "Smart parsing ready · Gemma 4", smart: true }
      : { text: "Basic parsing", smart: false };

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="btn-outline px-3 py-1.5 text-xs"
          title="Photograph the nutrition label to auto-fill"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ScanText className="h-4 w-4" />
          )}
          {busy ? status || "Scanning…" : "Scan label"}
        </button>

        <span
          className={cn(
            "chip ring-inset",
            badge.smart
              ? "bg-brand-100 text-brand-700 ring-brand-500/20 dark:bg-brand-900/30 dark:text-brand-300"
              : "bg-surface-2 text-text-muted ring-border",
          )}
          title={
            badge.smart
              ? "Nutrition text is structured by Gemma 4 running on-device (WebGPU)."
              : "Set NEXT_PUBLIC_GEMMA_MODEL_URL and use a WebGPU browser for Gemma 4. The built-in parser is used otherwise."
          }
        >
          {badge.smart ? (
            <Sparkles className="h-3 w-3" />
          ) : (
            <Cpu className="h-3 w-3" />
          )}
          {badge.text}
        </span>
      </div>
    </div>
  );
}
