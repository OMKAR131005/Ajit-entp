import { C } from "../../constants/colors";

export function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: C.ink2, marginBottom: 6 }}>
        {label}
      </label>
      {children}
      {hint && <div style={{ fontSize: 12, color: C.slate, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}