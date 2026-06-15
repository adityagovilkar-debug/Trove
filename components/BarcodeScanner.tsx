"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { X } from "lucide-react";

// Webcam barcode scanner modal. Calls onDetect with the decoded value once,
// then closes. Gracefully reports if no camera/permission.
export function BarcodeScanner({
  onDetect,
  onClose,
}: {
  onDetect: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let controls: IScannerControls | undefined;
    let active = true;
    const reader = new BrowserMultiFormatReader();

    (async () => {
      try {
        controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (result) => {
            if (result && active) {
              active = false;
              controls?.stop();
              onDetect(result.getText());
            }
          },
        );
      } catch {
        setError(
          "Couldn't access the camera. Check browser permissions, or enter the barcode manually.",
        );
      }
    })();

    return () => {
      active = false;
      controls?.stop();
    };
  }, [onDetect]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border bg-surface">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-medium">Scan barcode</p>
          <button onClick={onClose} className="btn-ghost px-2 py-1.5">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative aspect-square bg-black">
          <video ref={videoRef} className="h-full w-full object-cover" />
          {!error && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-1/3 w-4/5 rounded-xl border-2 border-brand-400/80 shadow-[0_0_0_100vmax_rgba(0,0,0,0.35)]" />
            </div>
          )}
        </div>
        <p className="px-4 py-3 text-center text-xs text-text-muted">
          {error ?? "Point your camera at a product barcode."}
        </p>
      </div>
    </div>
  );
}
