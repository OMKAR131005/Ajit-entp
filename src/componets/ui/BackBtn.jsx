import { ArrowLeft } from "lucide-react";
import { C } from "../../constants/colors";

export function BackBtn({ onBack }) {
  return (
    <button onClick={onBack} style={{ background: "none", border: "none", color: C.slate, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13.5, padding: 0 }}>
      <ArrowLeft size={16} /> Back
    </button>
  );
}