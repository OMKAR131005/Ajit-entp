import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api } from "../sheetsApi";
import { C } from "../constants/colors";

export function CustomerDocuments({ customerId, onClose }) {
  const [st, setSt] = useState({ loading: true, error: null, docs: [] });

  useEffect(() => {
    let alive = true;
    api.getCustomerDocuments(customerId)
      .then((docs) => alive && setSt({ loading: false, error: null, docs }))
      .catch((e) => alive && setSt({ loading: false, error: e.message || "Could not load documents.", docs: [] }));
    return () => { alive = false; };
  }, [customerId]);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 10, width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto", padding: 16 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Documents · {customerId}</div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        {st.loading && <div style={{ color: C.slate }}>Loading…</div>}
        {st.error && <div style={{ color: C.rust }}>{st.error}</div>}
        {!st.loading && !st.error && st.docs.length === 0 && <div style={{ color: C.slate }}>No documents found.</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {st.docs.map((d) => (
            <div key={d.name} style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 12.5, color: C.slate, marginBottom: 6, wordBreak: "break-all" }}>{d.name}</div>
              {d.isPdf ? (
                <a href={d.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600, color: C.ink2 }}>Open PDF</a>
              ) : (
                <a href={d.url} target="_blank" rel="noreferrer">
                  <img src={d.url} alt={d.name} style={{ width: "100%", borderRadius: 6 }} />
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}