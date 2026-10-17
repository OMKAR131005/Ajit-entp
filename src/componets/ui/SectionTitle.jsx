import { C } from "../../constants/colors";

export function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: subtitle ? 4 : 0 }}>
        <Icon size={19} color={C.ink} />
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 19, fontWeight: 700 }}>{title}</div>
      </div>
      {subtitle && <div style={{ fontSize: 13, color: C.slate }}>{subtitle}</div>}
    </div>
  );
}