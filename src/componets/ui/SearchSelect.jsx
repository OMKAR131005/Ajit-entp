import { useMemo, useRef, useState } from "react";
import { C } from "../../constants/colors";
import { inputStyle } from "./inputStyle";

const lc = (s) => String(s ?? "").toLowerCase();

// Type to filter a long list, tap to pick. Anything typed that isn't in the list is kept as typed
// (so a phone that isn't in the master yet can still be recorded).
//
// options: string[] or { value, hint?, ...extra }[]   (hint is shown in grey next to the value)
// onChange(text): user typed          onSelect(option): user picked (defaults to onChange(option.value))
export function SearchSelect({
  value, onChange, onSelect, options, placeholder, disabled, autoFocus,
  maxResults = 40, customHint = "Not in the list — it will be saved as typed.", ...rest
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false); // false right after focusing, so an existing value doesn't hide the other choices
  const [active, setActive] = useState(0);
  const wrapRef = useRef(null);

  const opts = useMemo(() => (options || []).map((o) => (typeof o === "string" ? { value: o } : o)), [options]);

  const { items, total } = useMemo(() => {
    const tokens = typed ? lc(value).split(/\s+/).filter(Boolean) : [];
    const scored = [];
    opts.forEach((o) => {
      const hay = lc(o.value) + " " + lc(o.hint);
      if (!tokens.every((t) => hay.includes(t))) return;
      const starts = tokens.length > 0 && lc(o.value).startsWith(tokens[0]) ? 0 : 1;
      scored.push({ o, starts });
    });
    if (tokens.length) scored.sort((a, b) => a.starts - b.starts); // stable: keeps the Sheet's order within a group
    return { items: scored.slice(0, maxResults).map((s) => s.o), total: scored.length };
  }, [opts, value, typed, maxResults]);

  const exact = opts.find((o) => lc(o.value) === lc(value).trim());
  const isCustom = !!String(value || "").trim() && opts.length > 0 && !exact;

  const pick = (o) => {
    if (onSelect) onSelect(o); else onChange(o.value);
    setOpen(false);
    setTyped(false);
  };

  const onBlur = (e) => {
    if (wrapRef.current && wrapRef.current.contains(e.relatedTarget)) return;
    setOpen(false);
    setTyped(false);
    if (exact && exact.value !== value) onChange(exact.value); // "apple" -> "Apple"
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && open && items[active]) { e.preventDefault(); pick(items[active]); }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }} onBlur={onBlur}>
      <input
        {...rest}
        autoFocus={autoFocus}
        disabled={disabled}
        autoComplete="off"
        autoCorrect="off"
        role="combobox"
        aria-expanded={open}
        value={value || ""}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setTyped(false); setActive(0); }}
        onChange={(e) => { onChange(e.target.value); setTyped(true); setOpen(true); setActive(0); }}
        onKeyDown={onKeyDown}
        style={{ ...inputStyle, ...(disabled ? { background: C.paperDim, color: C.slate } : {}) }}
      />

      {open && !disabled && items.length > 0 && (
        <ul
          role="listbox"
          onMouseDown={(e) => e.preventDefault()} /* keep focus in the input so the tap registers */
          style={{
            position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)", zIndex: 60,
            maxHeight: 260, overflowY: "auto", margin: 0, padding: 4, listStyle: "none",
            background: "#fff", border: `1.5px solid ${C.line}`, borderRadius: 8,
            boxShadow: "0 8px 24px rgba(22,35,59,0.14)",
          }}
        >
          {items.map((o, i) => (
            <li
              key={o.value + "|" + (o.hint || "") + i}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(o)}
              style={{
                padding: "11px 12px", borderRadius: 6, cursor: "pointer", fontSize: 15.5,
                display: "flex", justifyContent: "space-between", gap: 10,
                background: i === active ? C.paperDim : "transparent",
                fontWeight: exact && exact.value === o.value ? 700 : 400,
              }}
            >
              <span>{o.value}</span>
              {o.hint && <span style={{ color: C.slate, fontSize: 12.5, alignSelf: "center" }}>{o.hint}</span>}
            </li>
          ))}
          {total > items.length && (
            <li style={{ padding: "8px 12px", color: C.slate, fontSize: 12.5 }}>
              {total - items.length} more — keep typing to narrow down
            </li>
          )}
        </ul>
      )}

      {isCustom && !open && <div style={{ fontSize: 12, color: C.amber, marginTop: 4 }}>{customHint}</div>}
    </div>
  );
}
