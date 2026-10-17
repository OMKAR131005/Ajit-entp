import { useMemo } from "react";
import { Field } from "./Field";
import { SearchSelect } from "./SearchSelect";
import { ChipPicker } from "./ChipPicker";
import { findBrand, findModel, specOptions, ramApplies } from "../../utils/master";

const lc = (s) => String(s ?? "").trim().toLowerCase();

// Brand -> model -> colour -> RAM -> storage, all driven by the Devices / Lists tabs in the Sheet.
// value: { brand, model, colour, ram, rom }    onChange(patch) with any of those keys.
export function DeviceFields({ master, value, onChange, autoFocus }) {
  const brandKey = findBrand(master, value.brand);

  const modelOptions = useMemo(() => {
    if (brandKey) return master.modelsByBrand[brandKey].map((m) => m.model);
    if (!lc(value.brand)) return master.allModels.map((m) => ({ value: m.model, hint: m.brand, brand: m.brand }));
    return []; // a brand that isn't in the master: model is free text
  }, [master, brandKey, value.brand]);

  const spec = specOptions(master, value.brand, value.model);

  const changeBrand = (text) => {
    const patch = { brand: text };
    const next = findBrand(master, text);
    // Switching to a different known brand: drop a model that was picked from the old brand's list.
    if (next && next !== brandKey && brandKey && findModel(master, brandKey, value.model) && !findModel(master, next, value.model)) {
      patch.model = "";
    }
    onChange(patch);
  };

  const pickModel = (o) => onChange({ model: o.value, ...(o.brand ? { brand: o.brand } : {}) });

  return (
    <>
      <Field label="Device brand">
        <SearchSelect
          autoFocus={autoFocus}
          value={value.brand}
          onChange={changeBrand}
          options={master.brands}
          placeholder="Search or type brand"
        />
      </Field>

      <Field label="Device model" hint={!lc(value.brand) && master.allModels.length ? "Tip: you can search a model directly and the brand fills in." : undefined}>
        <SearchSelect
          value={value.model}
          onChange={(t) => onChange({ model: t })}
          onSelect={pickModel}
          options={modelOptions}
          placeholder={brandKey ? `Search ${brandKey} models` : "Search or type model"}
        />
      </Field>

      <Field label="Colour" hint="Pick from the list or type the exact colour.">
        <SearchSelect
          value={value.colour}
          onChange={(t) => onChange({ colour: t })}
          options={spec.colours}
          placeholder="Search or type colour"
        />
      </Field>

      {ramApplies(value.brand) && (
        <Field label="RAM">
          <ChipPicker options={spec.ram} value={value.ram} onChange={(o) => onChange({ ram: value.ram === o ? "" : o })} />
        </Field>
      )}

      <Field label="ROM (storage)">
        <ChipPicker options={spec.storage} value={value.rom} onChange={(o) => onChange({ rom: value.rom === o ? "" : o })} />
      </Field>
    </>
  );
}
