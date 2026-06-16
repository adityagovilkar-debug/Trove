"use client";

import { useRef, useState } from "react";
import { ScanText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  parseNutritionText,
  countFilled,
  type NutritionResult,
} from "@/lib/nutritionParse";
import { gemmaConfigured, parseNutritionWithGemma } from "@/lib/gemma";

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

      // 2) Structure it: Gemma 4 on-device if configured, else heuristic.
      let parsed: NutritionResult | null = null;
      if (gemmaConfigured()) {
        setStatus("Understanding values…");
        parsed = await parseNutritionWithGemma(text, setStatus);
      }
      if (!parsed || countFilled(parsed) === 0) {
        parsed = parseNutritionText(text);
      }

      const n = countFilled(parsed);
      if (n === 0) {
        toast.message("Read the label, but found no nutrition values to fill.");
        return;
      }
      onResult(parsed);
      toast.success(`Filled ${n} field${n > 1 ? "s" : ""} from the label`);
    } catch {
      toast.error("Scan failed. You can still type the values in.");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
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
    </>
  );
}
