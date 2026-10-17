import { useState } from "react";
import { Check } from "lucide-react";
import { C } from "../../constants/colors";
import { getEncouragement } from "../../constants/encouragement";
import { inr } from "../../utils/formatters";

// Shown after a lead is saved: a little pat on the back plus today's running score.
export function SavedCelebration({ feName, leadId, customerName, todayCount, todayCommission }) {
  const [message] = useState(() => getEncouragement(feName, todayCount)); // picked once, stays put on re-render

  return (
    <div style={{ textAlign: "center", paddingTop: 30 }}>
      <style>{`
        @keyframes fl-pop { 0% { transform: scale(0.3); opacity: 0; } 60% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1); } }
        @keyframes fl-rise { 0% { transform: translateY(10px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
      `}</style>

      <div style={{
        width: 72, height: 72, borderRadius: "50%", background: C.ledgerBg, color: C.ledger,
        display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px",
        animation: "fl-pop 0.5s ease-out both",
      }}>
        <Check size={34} strokeWidth={3} />
      </div>

      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Lead saved</div>
      <div style={{ color: C.slate, fontSize: 14, marginBottom: 18 }}>{leadId} has been recorded for {customerName}.</div>

      <div style={{
        background: C.ledgerBg, color: C.ledger, borderRadius: 12, padding: "14px 16px", fontSize: 16, fontWeight: 600,
        lineHeight: 1.45, marginBottom: 16, animation: "fl-rise 0.5s 0.25s ease-out both",
      }}>
        {message}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 28, animation: "fl-rise 0.5s 0.4s ease-out both" }}>
        <div style={{ flex: 1, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 8px" }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700 }}>{todayCount}</div>
          <div style={{ fontSize: 12, color: C.slate, fontWeight: 600 }}>lead{todayCount !== 1 ? "s" : ""} today</div>
        </div>
        <div style={{ flex: 1, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 8px" }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700, color: C.amber }}>{inr(todayCommission)}</div>
          <div style={{ fontSize: 12, color: C.slate, fontWeight: 600 }}>commission today</div>
        </div>
      </div>
    </div>
  );
}
