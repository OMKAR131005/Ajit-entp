import { C } from "../../constants/colors";

export function StatTile({ label, value, tone }) {
  const color = tone || C.ink;

  return (
    <div
      style={{
        border: `1px solid ${C.line}`,
        borderRadius: 0,
        padding: "16px 18px",
        background: "#fff",
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          fontSize: 12.5,
          color: C.slate,
          fontWeight: 600,
          marginBottom: 6,
          letterSpacing: 0.2,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: "clamp(18px, 2.8vw, 26px)",
          fontWeight: 700,
          color,
          lineHeight: 1.15,
          whiteSpace: "normal",
          overflowWrap: "anywhere",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}