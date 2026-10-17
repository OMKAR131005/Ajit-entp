import { useEffect, useRef, useState } from "react";
import { X, Zap } from "lucide-react";
import { C } from "../../constants/colors";
import { extractImei } from "../../utils/imei";

// Picks the IMEI that sits highest in the frame (IMEI 1 is printed above IMEI 2).
function topmostImei(results) {
  const found = results
    .map((r) => ({
      imei: extractImei(r.rawValue),
      y: r.boundingBox?.y ?? r.cornerPoints?.[0]?.y ?? 0,
    }))
    .filter((r) => r.imei)
    .sort((a, b) => a.y - b.y);
  return found.length ? found[0].imei : null;
}

// Uses the phone's built-in barcode detector where it exists (Chrome on Android),
// otherwise loads a small decoder on demand (iPhone Safari, desktop).
async function makeDecoder() {
  if (typeof window !== "undefined" && "BarcodeDetector" in window) {
    try {
      const supported = await window.BarcodeDetector.getSupportedFormats();
      const formats = ["code_128", "code_39", "code_93", "ean_13", "upc_a", "itf", "codabar", "qr_code"].filter((f) => supported.includes(f));
      if (formats.length) {
        const detector = new window.BarcodeDetector({ formats });
        return { decode: async (video) => topmostImei(await detector.detect(video)) };
      }
    } catch { /* fall through to the JS decoder */ }
  }

  const zx = await import("@zxing/library");
  const { MultiFormatReader, BarcodeFormat, DecodeHintType, HTMLCanvasElementLuminanceSource, HybridBinarizer, BinaryBitmap } = zx;
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93, BarcodeFormat.EAN_13,
    BarcodeFormat.UPC_A, BarcodeFormat.ITF, BarcodeFormat.CODABAR, BarcodeFormat.QR_CODE,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  const reader = new MultiFormatReader();
  reader.setHints(hints);

  const full = document.createElement("canvas");
  const top = document.createElement("canvas");
  const attempt = (canvas) => {
    try {
      return extractImei(reader.decode(new BinaryBitmap(new HybridBinarizer(new HTMLCanvasElementLuminanceSource(canvas)))).getText());
    } catch { return null; }
  };

  return {
    decode: async (video) => {
      const w = Math.min(video.videoWidth, 1280);
      const h = Math.round((video.videoHeight * w) / video.videoWidth);
      full.width = w; full.height = h;
      full.getContext("2d", { willReadFrequently: true }).drawImage(video, 0, 0, w, h);
      // Top half first, so when two IMEI barcodes are in view we return IMEI 1.
      top.width = w; top.height = Math.floor(h / 2);
      top.getContext("2d", { willReadFrequently: true }).drawImage(full, 0, 0, w, top.height, 0, 0, w, top.height);
      return attempt(top) || attempt(full);
    },
  };
}

export function BarcodeScanner({ onDetect, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const cbRef = useRef({ onDetect, onClose });
  cbRef.current = { onDetect, onClose };
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Starting camera…");
  const [torch, setTorch] = useState({ supported: false, on: false });

  useEffect(() => {
    let stopped = false;
    let timer = 0;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("The camera isn't available in this browser. Type the IMEI instead.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;

        const video = videoRef.current;
        video.srcObject = stream;
        await video.play().catch(() => {});

        const track = stream.getVideoTracks()[0];
        if (track?.getCapabilities?.().torch) setTorch({ supported: true, on: false });

        const decoder = await makeDecoder();
        if (stopped) return;
        setStatus("Point the camera at the IMEI barcode");

        const tick = async () => {
          if (stopped) return;
          try {
            if (video.readyState >= 2 && video.videoWidth) {
              const imei = await decoder.decode(video);
              if (imei) {
                stopped = true;
                navigator.vibrate?.(80);
                cbRef.current.onDetect(imei);
                return;
              }
            }
          } catch { /* a bad frame — try the next one */ }
          timer = setTimeout(tick, 150);
        };
        tick();
      } catch (e) {
        setError(
          e && e.name === "NotAllowedError"
            ? "Camera permission was denied. Allow camera access in your browser settings, or type the IMEI instead."
            : "Could not start the camera. Type the IMEI instead."
        );
      }
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torch.on;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorch({ supported: true, on: next });
    } catch { /* not supported after all */ }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "#000", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", color: "#fff" }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Scan IMEI barcode</div>
        <div style={{ display: "flex", gap: 8 }}>
          {torch.supported && (
            <button onClick={toggleTorch} aria-label="Toggle flashlight" style={{ background: torch.on ? C.amber : "rgba(255,255,255,0.18)", border: "none", color: "#fff", borderRadius: 8, padding: "8px 10px", cursor: "pointer", display: "flex" }}>
              <Zap size={18} />
            </button>
          )}
          <button onClick={onClose} aria-label="Close scanner" style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", borderRadius: 8, padding: "8px 10px", cursor: "pointer", display: "flex" }}>
            <X size={18} />
          </button>
        </div>
      </div>

      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        <video ref={videoRef} playsInline muted autoPlay style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        {!error && (
          <div style={{
            position: "absolute", left: "8%", right: "8%", top: "34%", height: "20%",
            border: "3px solid rgba(255,255,255,0.9)", borderRadius: 12,
            boxShadow: "0 0 0 100vmax rgba(0,0,0,0.45)",
          }} />
        )}
      </div>

      <div style={{ padding: "16px 18px 26px", color: "#fff", textAlign: "center", fontSize: 14, lineHeight: 1.5 }}>
        {error ? (
          <>
            <div style={{ marginBottom: 14 }}>{error}</div>
            <button onClick={onClose} style={{ background: "#fff", color: C.ink, border: "none", borderRadius: 10, padding: "12px 22px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
              Type IMEI instead
            </button>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 600 }}>{status}</div>
            <div style={{ opacity: 0.75, marginTop: 4 }}>
              On the phone, dial <b>*#06#</b> to show the IMEI barcode — or scan the label on the box. Hold steady and keep the barcode inside the frame.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
