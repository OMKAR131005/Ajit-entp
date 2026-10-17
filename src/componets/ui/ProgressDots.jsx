import { C } from "../../constants/colors";

export function ProgressDots({ step, total }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          height: 4, flex: 1, borderRadius: 2,
          background: i <= step ? C.ink : C.line,
        }} />
      ))}
    </div>
  );
}