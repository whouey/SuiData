// Receipt capture: open the phone camera, OCR the photo in-browser (tesseract),
// and hand the structured receipt to the listing step. Capture is theater — a
// slow/garbled read silently falls back to the cached known-good receipt.

import { useRef, useState } from "react";
import { ocrReceipt } from "../lib/ocr";
import { CACHED_RECEIPT, type Receipt } from "../lib/receipt";

type Phase = "idle" | "captured" | "scanning";

export function ScanReceipt({ onResult }: { onResult: (r: Receipt) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setImgUrl(URL.createObjectURL(f));
    setPhase("captured");
  }

  async function scan() {
    setPhase("scanning");
    setProgress(0);
    const src = file ?? "";
    const { receipt } = await ocrReceipt(src, setProgress);
    onResult(receipt);
  }

  return (
    <div className="screen">
      <div className="hint">
        <h2>Scan a receipt</h2>
        <p className="muted">
          Point your camera at the receipt. We turn it into a dataset agents pay
          for.
        </p>
      </div>

      {/* Secure-context camera: rear camera on phones. */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPick}
        hidden
      />

      <div className="scanframe">
        {imgUrl ? (
          <img src={imgUrl} alt="captured receipt" />
        ) : (
          <div className="scanframe__empty">
            <span className="cam">📷</span>
            <span className="muted tiny">no photo yet</span>
          </div>
        )}
        {phase === "scanning" && (
          <div className="scanframe__overlay">
            <div className="scanline" />
            <p>Scanning… {Math.round(progress * 100)}%</p>
          </div>
        )}
      </div>

      {phase === "idle" && (
        <>
          <button
            className="btn btn--lg"
            onClick={() => fileRef.current?.click()}
          >
            📷 Open camera
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => onResult(CACHED_RECEIPT)}
          >
            Use sample receipt
          </button>
        </>
      )}

      {phase === "captured" && (
        <>
          <button className="btn btn--lg" onClick={scan}>
            Extract data
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => fileRef.current?.click()}
          >
            Retake
          </button>
        </>
      )}

      {phase === "scanning" && (
        <p className="status">Reading the receipt on your phone…</p>
      )}
    </div>
  );
}
