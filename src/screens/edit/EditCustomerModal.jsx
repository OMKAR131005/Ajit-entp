import { useState } from "react";
import { ModalShell } from "../../componets/ui/ModalShell";
import { Field } from "../../componets/ui/Field";
import { TextInput } from "../../componets/ui/TextInput";
import { TextArea } from "../../componets/ui/TextArea";
import { BigButton } from "../../componets/ui/Bigbutton";
import { last10 } from "../../utils/formatters";

// Fix a customer's name, mobile number or address.
export function EditCustomerModal({ customer, customers, onClose, onSave, flash }) {
  const [f, setF] = useState({ name: customer.name, mobile: customer.mobile, address: customer.address });
  const set = (patch) => setF((cur) => ({ ...cur, ...patch }));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (saving) return;
    if (!f.name.trim()) return flash("Customer name is required.", "error");
    if (!f.address.trim()) return flash("Address is required.", "error");
    if (last10(f.mobile).length !== 10) return flash("Enter a valid 10-digit mobile number.", "error");
    if (customers.some((c) => c.id !== customer.id && last10(c.mobile) === last10(f.mobile))) {
      return flash("Another customer already has this mobile number.", "error");
    }

    const changes = {};
    if (f.name.trim() !== customer.name) changes.name = f.name.trim();
    if (f.mobile.trim() !== customer.mobile) changes.mobile = f.mobile.trim();
    if (f.address.trim() !== customer.address) changes.address = f.address.trim();
    if (Object.keys(changes).length === 0) { flash("No changes to save."); onClose(); return; }

    setSaving(true);
    try {
      await onSave(customer.id, changes);
      flash("Customer updated.");
      onClose();
    } catch {
      /* App already showed the error */
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Edit customer" subtitle={customer.id} onClose={onClose}>
      <Field label="Customer name">
        <TextInput value={f.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field label="Mobile number">
        <TextInput inputMode="numeric" value={f.mobile} onChange={(e) => set({ mobile: e.target.value })} />
      </Field>
      <Field label="Pickup address">
        <TextArea value={f.address} onChange={(e) => set({ address: e.target.value })} />
      </Field>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <BigButton tone="ledger" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save changes"}</BigButton>
        <BigButton tone="outline" onClick={onClose} disabled={saving}>Cancel</BigButton>
      </div>
    </ModalShell>
  );
}
