import { useState } from "react";
import { C } from "../../constants/colors";
import { STATUS_META } from "../../constants/statusMeta";
import { parseAccessories, joinAccessories } from "../../constants/accessories";
import { ModalShell } from "../../componets/ui/ModalShell";
import { Field } from "../../componets/ui/Field";
import { TextInput } from "../../componets/ui/TextInput";
import { TextArea } from "../../componets/ui/TextArea";
import { BigButton } from "../../componets/ui/Bigbutton";
import { DeviceFields } from "../../componets/ui/DeviceFields";
import { ImeiField } from "../../componets/ui/ImeiField";
import { AccessoriesPicker } from "../../componets/ui/AccessoriesPicker";
import { isValidImei } from "../../utils/imei";
import { fmtDateTime, inr } from "../../utils/formatters";

const COMMISSION_MULTIPLIER = 13; // same rule as the add-lead wizard

// Corrects any detail of an existing lead. Only fields that actually changed are sent.
export function EditLeadModal({ lead, customer, master, leads, onClose, onSave, flash }) {
  const [f, setF] = useState(() => ({
    leadId: lead.leadId,
    brand: lead.deviceBrand || "",
    model: lead.deviceModel || "",
    colour: lead.colour,
    ram: lead.ram,
    rom: lead.rom,
    imei: lead.imei1,
    accessories: parseAccessories(lead.accessories), // empty for old leads that never recorded it
    purchasePrice: String(lead.purchasePrice),
    commission: String(lead.commission),
    status: lead.status || "Completed",
    remarks: lead.remarks,
  }));
  const set = (patch) => setF((cur) => ({ ...cur, ...patch }));
  const [saving, setSaving] = useState(false);

  const commissionAmount = (Number(f.commission) || 0) * COMMISSION_MULTIPLIER;

  const buildChanges = () => {
    const c = {};
    const put = (key, next, prev) => { if (String(next) !== String(prev)) c[key] = next; };
    put("lead_id", f.leadId.trim(), lead.leadId);
    put("device_brand", f.brand.trim(), lead.deviceBrand);
    put("device_model", f.model.trim(), lead.deviceModel);
    put("colour", f.colour.trim(), lead.colour);
    put("ram", f.ram, lead.ram);
    put("rom", f.rom, lead.rom);
    put("imei1", f.imei, lead.imei1);
    put("accessories", joinAccessories(f.accessories), lead.accessories);
    if (Number(f.purchasePrice) !== lead.purchasePrice) {
      c.purchase_price = Number(f.purchasePrice);
      if (lead.expectedPrice === lead.purchasePrice) c.expected_price = Number(f.purchasePrice); // wizard keeps them equal
    }
    if (Number(f.commission) !== lead.commission || commissionAmount !== lead.commissionAmount) {
      c.commission = Number(f.commission);
      c.commission_amount = commissionAmount;
    }
    put("status", f.status, lead.status);
    put("remarks", f.remarks.trim(), lead.remarks);
    return c;
  };

  const handleSave = async () => {
    if (saving) return;
    if (!f.leadId.trim()) return flash("Lead ID is required.", "error");
    if (leads.some((l) => l.leadId !== lead.leadId && l.leadId.toLowerCase() === f.leadId.trim().toLowerCase())) {
      return flash("This Lead ID already exists — check with Cashify.", "error");
    }
    if (!f.brand.trim() || !f.model.trim()) return flash("Device brand and model are required.", "error");
    if (f.purchasePrice === "" || Number(f.purchasePrice) < 0 || isNaN(Number(f.purchasePrice))) return flash("Enter a valid purchase price.", "error");
    if (f.commission === "" || Number(f.commission) < 0 || isNaN(Number(f.commission))) return flash("Enter the commission number.", "error");
    if (f.imei && !isValidImei(f.imei)) return flash("IMEI must be a valid 15-digit number.", "error");

    const changes = buildChanges();
    if (Object.keys(changes).length === 0) { flash("No changes to save."); onClose(); return; }

    setSaving(true);
    try {
      await onSave(lead.leadId, changes);
      flash("Lead updated.");
      onClose();
    } catch {
      /* App already showed the error */
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title="Edit lead"
      subtitle={customer ? `${customer.name} · ${customer.id}` : lead.leadId}
      onClose={onClose}
    >
      <Field label="Lead ID">
        <TextInput value={f.leadId} onChange={(e) => set({ leadId: e.target.value })} />
      </Field>

      <DeviceFields
        master={master}
        value={{ brand: f.brand, model: f.model, colour: f.colour, ram: f.ram, rom: f.rom }}
        onChange={set}
      />

      <ImeiField value={f.imei} onChange={(v) => set({ imei: v })} leads={leads} currentLeadId={lead.leadId} flash={flash} />

      <Field label="Accessories provided">
        <AccessoriesPicker value={f.accessories} onChange={(a) => set({ accessories: a })} />
        {f.accessories.length === 0 && <div style={{ fontSize: 12, color: C.slate, marginTop: 5 }}>Not recorded for this older lead.</div>}
      </Field>

      <Field label="Purchase price">
        <TextInput inputMode="decimal" value={f.purchasePrice} onChange={(e) => set({ purchasePrice: e.target.value })} placeholder="₹" />
      </Field>

      <Field label="Commission" hint={`Commission amount (× ${COMMISSION_MULTIPLIER}): ${inr(commissionAmount)}`}>
        <TextInput inputMode="decimal" value={f.commission} onChange={(e) => set({ commission: e.target.value })} placeholder="Commission number" />
      </Field>

      <Field label="Status">
        <div style={{ display: "flex", gap: 8 }}>
          {["Completed", "Pending", "Cancelled"].map((s) => {
            const meta = STATUS_META[s];
            const active = f.status === s;
            return (
              <button key={s} type="button" onClick={() => set({ status: s })}
                style={{
                  flex: 1, padding: "10px 8px", borderRadius: 8, cursor: "pointer", fontSize: 13.5, fontWeight: 700,
                  border: `1.5px solid ${active ? meta.fg : C.line}`,
                  background: active ? meta.bg : "#fff", color: active ? meta.fg : C.ink2,
                }}>
                {s}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Remarks (optional)">
        <TextArea value={f.remarks} onChange={(e) => set({ remarks: e.target.value })} placeholder="Anything worth noting about this visit" />
      </Field>

      {lead.updatedAt && (
        <div style={{ fontSize: 12, color: C.slate, marginBottom: 14 }}>
          Last edited {fmtDateTime(lead.updatedAt)}{lead.updatedBy ? ` by ${lead.updatedBy}` : ""}.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <BigButton tone="ledger" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save changes"}</BigButton>
        <BigButton tone="outline" onClick={onClose} disabled={saving}>Cancel</BigButton>
      </div>
    </ModalShell>
  );
}
