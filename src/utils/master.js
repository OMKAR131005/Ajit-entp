import { FALLBACK_LISTS } from "../constants/defaults";

export const EMPTY_MASTER = {
  brands: [],
  modelsByBrand: {},
  allModels: [],
  lists: FALLBACK_LISTS,
  loaded: false,
};

const lc = (s) => String(s ?? "").trim().toLowerCase();

// raw = response of getDeviceMaster: { devices: [{brand, model, ram_options, storage_options, colours}], lists: {...} }
export function buildMaster(raw) {
  const devices = raw?.devices || [];
  const modelsByBrand = {};
  const allModels = [];
  devices.forEach((d) => {
    (modelsByBrand[d.brand] = modelsByBrand[d.brand] || []).push({
      model: d.model,
      ram: d.ram_options || [],
      storage: d.storage_options || [],
      colours: d.colours || [],
    });
    allModels.push({ brand: d.brand, model: d.model });
  });
  const brands = Object.keys(modelsByBrand).sort((a, b) => a.localeCompare(b));
  const pickList = (k) => (raw?.lists?.[k]?.length ? raw.lists[k] : FALLBACK_LISTS[k]);
  return {
    brands,
    modelsByBrand,
    allModels,
    lists: { colours: pickList("colours"), ram: pickList("ram"), storage: pickList("storage") },
    loaded: devices.length > 0,
  };
}

export const findBrand = (master, text) => master.brands.find((b) => lc(b) === lc(text)) || null;

export function findModel(master, brand, text) {
  const key = findBrand(master, brand);
  if (!key) return null;
  return master.modelsByBrand[key].find((m) => lc(m.model) === lc(text)) || null;
}

// Choices for colour / RAM / storage: the model's own list if the Sheet has one, else the shared defaults.
export function specOptions(master, brand, model) {
  const m = findModel(master, brand, model);
  return {
    colours: m?.colours.length ? m.colours : master.lists.colours,
    ram: m?.ram.length ? m.ram : master.lists.ram,
    storage: m?.storage.length ? m.storage : master.lists.storage,
  };
}

export const ramApplies = (brand) => lc(brand) !== "apple"; // iPhone RAM isn't marketed, so it isn't asked
