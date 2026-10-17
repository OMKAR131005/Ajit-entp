import { C } from "../../constants/colors";

export function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: `1px solid ${C.paperDim}`, fontSize: 13.5 }}>
      <span style={{ color: C.slate }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: "right" }}>{value}</span>
    </div>
  );
}