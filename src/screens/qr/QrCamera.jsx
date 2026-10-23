import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import { C } from "../../constants/colors";

// Opens the back camera and calls onScan(text) for every QR it reads.
export function QrCamera({ onScan }) {
  const videoRef = useRef(null);
  const onScanRef = useRef(onScan);
  const [error, setError] = useState("");

  useEffect(() => { onScanRef.current = onScan; });

  useEffect(() => {
    let cancelled = false;
    const scanner = new QrScanner(
      videoRef.current,
      (result) => onScanRef.current(result.data),
      { preferredCamera: "environment", maxScansPerSecond: 5, highlightScanRegion: true, returnDetailedScanResult: true },
    );
    scanner.start().catch((e) => {
      if (cancelled) return;
      const msg = String(e?.message || e);
      setError(
        /denied|notallowed|permission/i.test(msg)
          ? "Camera permission was denied. Allow camera access in your browser settings, or enter the code manually below."
          : "Could not start the camera. Enter the code manually below."
      );
    });
    return () => { cancelled = true; scanner.destroy(); };
  }, []);

  return (
    <div>
      <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", background: "#000", borderRadius: 10, overflow: "hidden" }}>
        <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      {error && (
        <div style={{ background: C.rustBg, color: C.rust, padding: 10, borderRadius: 8, fontSize: 13, marginTop: 10 }}>{error}</div>
      )}
    </div>
  );
}