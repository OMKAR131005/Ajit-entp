export const ACCESSORY_OPTIONS = ["All Kit", "Box", "Charger", "No accessories"];
export const DEFAULT_ACCESSORIES = ["No accessories"];

export const parseAccessories = (s) =>
  String(s || "").split(",").map((x) => x.trim()).filter((x) => ACCESSORY_OPTIONS.includes(x));

export const joinAccessories = (list) => (list || []).join(", ");

// "All Kit" and "No accessories" are exclusive; Box + Charger can be combined.
// Un-ticking the last item falls back to "No accessories".
export function toggleAccessory(current, item) {
  if (item === "All Kit" || item === "No accessories") {
    return current.length === 1 && current[0] === item ? ["No accessories"] : [item];
  }
  const base = current.filter((x) => x !== "All Kit" && x !== "No accessories");
  const next = base.includes(item) ? base.filter((x) => x !== item) : [...base, item];
  return next.length ? ACCESSORY_OPTIONS.filter((x) => next.includes(x)) : ["No accessories"];
}
