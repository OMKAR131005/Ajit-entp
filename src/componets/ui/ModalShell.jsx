import { useEffect } from "react";
import { X } from "lucide-react";
import { C } from "../../constants/colors";

// Full-height sheet on phones, centred panel on desktop. The page behind doesn't scroll.
export function ModalShell({ title, subtitle, onClose, children }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(22,35,59,0.5)", overflowY: "auto" }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto", minHeight: "100%", background: C.paper, padding: "16px 18px 40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 13, color: C.slate, marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: `1px solid ${C.line}`, borderRadius: 8, padding: 7, cursor: "pointer", display: "flex", color: C.ink2, flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
