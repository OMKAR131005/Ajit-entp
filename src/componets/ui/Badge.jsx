import { STATUS_META } from "../../constants/statusMeta";

export function Badge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.Pending;
  const { Icon } = meta;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        background: meta.bg, color: meta.fg,
        padding: "3px 10px", borderRadius: 20,
        fontSize: 12.5, fontWeight: 600,
      }}
    >
      <Icon size={12} strokeWidth={2.5} />
      {status}
    </span>
  );
}