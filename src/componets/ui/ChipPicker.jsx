import { C } from "../../constants/colors";

// Tap-to-choose pills for short lists (RAM, storage). Tap the chosen one again to clear it.
// A value that isn't in the list (old data) is still shown, selected.
export function ChipPicker({ options, value, onChange, multi = false }) {
  const list = value && !multi && !options.includes(value) ? [value, ...options] : options;
  const isOn = (o) => (multi ? (value || []).includes(o) : value === o);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {list.map((o) => {
        const on = isOn(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o)}
            style={{
              padding: "10px 14px", borderRadius: 8, cursor: "pointer", fontSize: 14.5, fontWeight: 600,
              border: `1.5px solid ${on ? C.ink : C.line}`,
              background: on ? C.ink : "#fff", color: on ? "#fff" : C.ink2,
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
