import { C } from "../../constants/colors";

export function BigButton({ children, onClick, icon: Icon, style, disabled, tone = "ink" }) {
  const tones = {
    ink: { bg: C.ink, fg: "#fff" },
    ledger: { bg: C.ledger, fg: "#fff" },
    outline: { bg: "transparent", fg: C.ink },
  };
  const t = tones[tone];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        background: t.bg, color: t.fg,
        border: tone === "outline" ? `1.5px solid ${C.ink}` : "none",
        borderRadius: 10, padding: "14px 18px",
        fontSize: 16, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1, width: "100%",
        fontFamily: "'IBM Plex Sans', sans-serif",
        ...style,
      }}
    >
      {Icon && <Icon size={18} strokeWidth={2.25} />}
      {children}
    </button>
  );
}