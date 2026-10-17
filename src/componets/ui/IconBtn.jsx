import { C } from "../../constants/colors";

export function IconBtn({ onClick, Icon, label, tone }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 4, background: "none", border: `1px solid ${C.line}`,
      borderRadius: 6, padding: "5px 9px", fontSize: 12, cursor: "pointer", color: tone || C.ink2, fontWeight: 600,
    }}>
      {Icon && <Icon size={12} />}{label}
    </button>
  );
}