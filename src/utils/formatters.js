export const pad5 = (n) => `CUST-${String(n).padStart(5, "0")}`;
export const digits = (s) => String(s ?? "").replace(/\D/g, "");
export const last10 = (s) => digits(s).slice(-10);
export const inr = (n) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");
export const todayISO = () => new Date().toISOString().slice(0, 10);

export const fmtDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

export const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export const isSameDay = (iso, day) => (iso || "").slice(0, 10) === day;

export const startOfWeek = () => {
  const d = new Date();
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};


// "Black · 8 GB / 256 GB" — whichever parts exist
export const specLine = (l) => {
  const mem = [l.ram, l.rom].filter(Boolean).join(" / ");
  return [l.colour, mem].filter(Boolean).join(" · ");
};
