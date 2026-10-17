import { C } from "../../constants/colors";
import { ACCESSORY_OPTIONS, toggleAccessory } from "../../constants/accessories";

export function AccessoriesPicker({ value, onChange }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {ACCESSORY_OPTIONS.map((a) => {
        const on = value.includes(a);
        return (
          <button
            key={a}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(toggleAccessory(value, a))}
            style={{
              padding: "11px 15px", borderRadius: 8, cursor: "pointer", fontSize: 14.5, fontWeight: 600,
              border: `1.5px solid ${on ? C.ledger : C.line}`,
              background: on ? C.ledgerBg : "#fff", color: on ? C.ledger : C.ink2,
            }}
          >
            {on ? "✓ " : ""}{a}
          </button>
        );
      })}
    </div>
  );
}
