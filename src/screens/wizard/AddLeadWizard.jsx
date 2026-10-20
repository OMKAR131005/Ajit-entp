import { useState } from "react";
import { ArrowLeft, Phone, UserPlus, History, Plus, Smartphone, ClipboardList, Wallet, Upload, PackageCheck } from "lucide-react";
import { api, fileToUpload } from "../../sheetsApi";
import { C } from "../../constants/colors";
import { STATUS_META } from "../../constants/statusMeta";
import { joinAccessories } from "../../constants/accessories";
import { Field } from "../../componets/ui/Field";
import { TextInput } from "../../componets/ui/TextInput";
import { TextArea } from "../../componets/ui/TextArea";
import { DeviceFields } from "../../componets/ui/DeviceFields";
import { ImeiField } from "../../componets/ui/ImeiField";
import { AccessoriesPicker } from "../../componets/ui/AccessoriesPicker";
import { BigButton } from "../../componets/ui/Bigbutton";
import { ProgressDots } from "../../componets/ui/ProgressDots";
import { SectionTitle } from "../../componets/ui/SectionTitle";
import { Row } from "../../componets/ui/Row";
import { last10, inr, todayISO, isSameDay } from "../../utils/formatters";
import { isValidImei } from "../../utils/imei";
import { ramApplies } from "../../utils/master";
import { STEPS } from "./InitialWizard";
import { SavedCelebration } from "./SavedCelebration";

// DeviceFields speaks in short names; the wizard state uses these keys.
const DEVICE_KEYS = { brand: "deviceBrand", model: "deviceModel", colour: "deviceColour", ram: "deviceRam", rom: "deviceRom" };

export function AddLeadWizard({ wizard, setWizard, fe, customers, leads, master, flash, onCancel, onDone, onFinishToDashboard }) {
  const w = wizard;
  const stepIndex = STEPS.indexOf(w.step);
  const set = (patch) => setWizard((cur) => ({ ...cur, ...patch }));
  const [submitting, setSubmitting] = useState(false);

  const findExisting = (mobile) => customers.find((c) => last10(c.mobile) === last10(mobile) && last10(mobile).length === 10);

  const goStep = (s) => set({ step: s });
  const goBack = () => {
    if (stepIndex > 0) goStep(STEPS[stepIndex - 1]);
  };

  const handleMobileNext = () => {
    if (last10(w.mobile).length !== 10) return flash("Enter a valid 10-digit mobile number.", "error");
    const existing = findExisting(w.mobile);
    set({ isNewCustomer: !existing, customerId: existing ? existing.id : null, step: "customer" });
  };

  // No DB call here anymore — customer creation is deferred to handleSave.
  const handleNewCustomerNext = () => {
    if (!w.customerDraft.name.trim()) return flash("Customer name is required.", "error");
    if (!w.customerDraft.address.trim()) return flash("Pickup address is required.", "error");
    set({ step: "device" });
  };

  const todayMine = leads.filter((l) => l.feUsername === fe.username && isSameDay(l.visitDate, todayISO()));
  const customer = customers.find((c) => c.id === w.customerId);
  const customerHistory = customer ? leads.filter((l) => l.customerId === customer.id) : [];

  const handleDeviceNext = () => {
    if (!w.deviceBrand.trim() || !w.deviceModel.trim()) return flash("Select device brand and model.", "error");
    if (!w.deviceColour.trim()) return flash("Select the device colour.", "error");
    if (ramApplies(w.deviceBrand) && !w.deviceRam) return flash("Select the RAM.", "error");
    if (!w.deviceRom) return flash("Select the ROM (storage).", "error");
    goStep("kit");
  };

  const handleKitNext = () => {
    if (w.imei && !isValidImei(w.imei)) return flash("IMEI must be a valid 15-digit number — or clear it.", "error");
    if (w.purchasePrice === "" || Number(w.purchasePrice) < 0) return flash("Enter a valid purchase price.", "error");
    goStep("leadid");
  };

  const handleLeadIdNext = () => {
    if (!w.leadId.trim()) return flash("Lead ID is required.", "error");
    if (leads.some((l) => l.leadId.toLowerCase() === w.leadId.trim().toLowerCase())) {
      return flash("This Lead ID already exists — check with Cashify.", "error");
    }
    goStep("commission");
  };

  const commissionAmount = (Number(w.commission) || 0) * 13;

  const handleCommissionNext = () => {
    if (w.commission === "" || Number(w.commission) < 0) return flash("Enter the commission number.", "error");
    goStep("idproof");
  };

  // Multi-select: clicking a type toggles it on/off (instead of replacing a single value).
  const toggleIdProofType = (t) => {
    const current = w.idProofTypes || [];
    if (current.includes(t)) {
      const filesByType = { ...(w.idProofFilesByType || {}) };
      delete filesByType[t];
      set({ idProofTypes: current.filter((x) => x !== t), idProofFilesByType: filesByType });
    } else {
      set({ idProofTypes: [...current, t] });
    }
  };

  // Files are kept per proof type, so each selected type can have its own set of documents.
  const handleFile = (type, e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    // Photos are shrunk before upload, so this only guards against huge originals.
    const oversized = files.find((f) => f.size > 15_000_000);
    if (oversized) return flash("Each image must be under 15 MB.", "error");
    const filesByType = { ...(w.idProofFilesByType || {}) };
    filesByType[type] = [...(filesByType[type] || []), ...files];
    set({ idProofFilesByType: filesByType });
  };

  // Single point of backend contact. ONE request does everything on the server:
  // creates the customer (if new), uploads the id proofs, saves the lead, updates the customer's id-proof fields.
  // If any part fails, the server undoes what it created, so tapping Save again never makes a duplicate.
  const handleSave = async () => {
    if (submitting) return; // already saving — ignore extra clicks
    setSubmitting(true);
    try {
      // Photos are shrunk in the browser first (keeps the request small and fast).
      const filesByType = w.idProofFilesByType || {};
      const files = await Promise.all(
        Object.keys(filesByType).flatMap((type) =>
          (filesByType[type] || []).map(async (file) => ({ type, file: await fileToUpload(file) }))
        )
      );

      const result = await api.submitLead({
        new_customer: w.isNewCustomer
          ? { name: w.customerDraft.name.trim(), mobile: w.mobile, address: w.customerDraft.address.trim() }
          : null,
        files,
        id_proof_types: w.idProofTypes || [],
        lead: {
          lead_id: w.leadId.trim(),
          customer_id: w.customerId,
          fe_username: fe.username,
          fe_name: fe.name,
          visit_date: new Date().toISOString(),
          device_brand: w.deviceBrand.trim(),
          device_model: w.deviceModel.trim(),
          colour: w.deviceColour.trim(),
          ram: ramApplies(w.deviceBrand) ? w.deviceRam : "",
          rom: w.deviceRom,
          imei1: w.imei,
          accessories: joinAccessories(w.accessories),
          expected_price: Number(w.purchasePrice),
          purchase_price: Number(w.purchasePrice),
          commission: Number(w.commission),
          commission_amount: commissionAmount,
          status: w.status,
          remarks: w.remarks.trim(),
          created_at: new Date().toISOString(),
        },
      });

      const customerId = result.customer.id;
      flash("Lead saved.");
      set({ isNewCustomer: false, step: "saved", customerId });
    } catch (e) {
      flash(e?.message || "Could not save lead — try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: C.paper, padding: "18px 18px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <button onClick={onCancel} style={{ background: "none", border: "none", color: C.slate, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 13.5, padding: 0 }}>
          <ArrowLeft size={16} /> Cancel
        </button>
        <div style={{ fontSize: 13, color: C.slate, fontWeight: 600 }}>
          {w.step !== "saved" && `Step ${Math.max(stepIndex, 0) + 1} of ${STEPS.length}`}
        </div>
      </div>
      {w.step !== "saved" && <ProgressDots step={stepIndex} total={STEPS.length} />}

      {w.step !== "mobile" && w.step !== "saved" && (
        <button
          onClick={goBack}
          style={{ background: "none", border: "none", color: C.slate, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 13.5, padding: "0 0 12px" }}
        >
          <ArrowLeft size={16} /> Back
        </button>
      )}

      {w.step === "mobile" && (
        <div>
          <SectionTitle icon={Phone} title="Customer mobile number" subtitle="We'll check if this customer already exists." />
          <Field label="Mobile number">
            <TextInput inputMode="numeric" autoFocus value={w.mobile}
              onChange={(e) => set({ mobile: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && handleMobileNext()}
              placeholder="10-digit mobile number" />
          </Field>
          <BigButton onClick={handleMobileNext}>Continue</BigButton>
        </div>
      )}

      {w.step === "customer" && w.isNewCustomer && (
        <div>
          <SectionTitle icon={UserPlus} title="New customer" subtitle="No record found for this number — enter their details." />
          <Field label="Customer name">
            <TextInput autoFocus value={w.customerDraft.name} onChange={(e) => set({ customerDraft: { ...w.customerDraft, name: e.target.value } })} placeholder="Full name" />
          </Field>
          <Field label="Pickup address">
            <TextArea value={w.customerDraft.address} onChange={(e) => set({ customerDraft: { ...w.customerDraft, address: e.target.value } })} placeholder="Address for pickup" />
          </Field>
          <BigButton onClick={handleNewCustomerNext}>Create customer &amp; continue</BigButton>
        </div>
      )}

      {w.step === "customer" && !w.isNewCustomer && customer && (
        <div>
          <div style={{ background: C.ledgerBg, color: C.ledger, padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700, marginBottom: 14, display: "inline-block" }}>
            Existing customer found
          </div>
          <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <Row label="Name" value={customer.name} />
            <Row label="Customer ID" value={customer.id} />
            <Row label="Mobile" value={customer.mobile} />
            <Row label="Address" value={customer.address} />
            <Row label="Previous visits" value={String(customerHistory.length)} />
            {customerHistory.length > 0 && (
              <Row label="Last device" value={`${customerHistory[customerHistory.length - 1].deviceBrand} ${customerHistory[customerHistory.length - 1].deviceModel}`} />
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <BigButton icon={Plus} onClick={() => goStep("device")}>Add new lead for this customer</BigButton>
            <BigButton tone="outline" icon={History} onClick={() => onDone(customer.id)}>View customer history</BigButton>
          </div>
        </div>
      )}

      {w.step === "device" && (
        <div>
          <SectionTitle icon={Smartphone} title="Device details" subtitle="Search or pick from the list — type it if it isn't there." />
          <DeviceFields
            autoFocus
            master={master}
            value={{ brand: w.deviceBrand, model: w.deviceModel, colour: w.deviceColour, ram: w.deviceRam, rom: w.deviceRom }}
            onChange={(p) => set(Object.fromEntries(Object.entries(p).map(([k, v]) => [DEVICE_KEYS[k], v])))}
          />
          <BigButton onClick={handleDeviceNext}>Continue</BigButton>
        </div>
      )}

      {w.step === "kit" && (
        <div>
          <SectionTitle icon={PackageCheck} title="IMEI, accessories & price" />
          <ImeiField value={w.imei} onChange={(v) => set({ imei: v })} leads={leads} flash={flash} />
          <Field label="Accessories provided">
            <AccessoriesPicker value={w.accessories} onChange={(a) => set({ accessories: a })} />
          </Field>
          <Field label="Purchase price">
            <TextInput inputMode="decimal" value={w.purchasePrice} onChange={(e) => set({ purchasePrice: e.target.value })} placeholder="₹" />
          </Field>
          <BigButton onClick={handleKitNext}>Continue</BigButton>
        </div>
      )}

      {w.step === "leadid" && (
        <div>
          <SectionTitle icon={ClipboardList} title="Lead ID" subtitle="Enter the Lead ID exactly as provided by Cashify." />
          <Field label="Lead ID">
            <TextInput autoFocus value={w.leadId} onChange={(e) => set({ leadId: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && handleLeadIdNext()} placeholder="e.g. CF12345678" />
          </Field>
          <BigButton onClick={handleLeadIdNext}>Continue</BigButton>
        </div>
      )}

      {w.step === "commission" && (
        <div>
          <SectionTitle icon={Wallet} title="Commission" subtitle="Purchase price has no effect on commission." />
          <Field label="Commission">
            <TextInput autoFocus inputMode="decimal" value={w.commission} onChange={(e) => set({ commission: e.target.value })} placeholder="Enter commission number" />
          </Field>
          <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, padding: 18, marginBottom: 18, textAlign: "center" }}>
            <div style={{ fontSize: 12.5, color: C.slate, fontWeight: 600, marginBottom: 4 }}>Commission amount (× 13)</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 32, fontWeight: 700, color: C.amber }}>{inr(commissionAmount)}</div>
          </div>
          <BigButton onClick={handleCommissionNext}>Continue</BigButton>
        </div>
      )}

      {w.step === "idproof" && (
        <div>
          <SectionTitle icon={ClipboardList} title="ID proof" subtitle="Optional — select one or more, and add documents for each." />
          <Field label="ID proof type (select all that apply)">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {["Driving Licence", "Aadhaar Card", "PAN Card", "Passport"].map((t) => {
                const selected = (w.idProofTypes || []).includes(t);
                return (
                  <button key={t} onClick={() => toggleIdProofType(t)}
                    style={{
                      textAlign: "left", padding: "12px 14px", borderRadius: 8, cursor: "pointer",
                      border: `1.5px solid ${selected ? C.ink : C.line}`,
                      background: selected ? C.paperDim : "#fff", fontSize: 15, fontWeight: 600,
                    }}>
                    {selected ? "✓ " : ""}{t}
                  </button>
                );
              })}
            </div>
          </Field>

          {(w.idProofTypes || []).map((t) => (
            <Field key={t} label={`Upload ${t} document(s)`}>
              <label style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                border: `1.5px dashed ${C.line}`, borderRadius: 8, padding: "16px", cursor: "pointer", color: C.slate,
              }}>
                <Upload size={16} />
                {(w.idProofFilesByType?.[t]?.length ?? 0) > 0
                  ? w.idProofFilesByType[t].map((f) => f.name).join(", ")
                  : "Choose image(s)"}
                <input type="file" accept="image/*" multiple onChange={(e) => handleFile(t, e)} style={{ display: "none" }} />
              </label>
            </Field>
          ))}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <BigButton onClick={() => goStep("finish")}>Continue</BigButton>
          </div>
        </div>
      )}

      {w.step === "finish" && (
        <div>
          <SectionTitle icon={ClipboardList} title="Status &amp; remarks" />
          <Field label="Status">
            <div style={{ display: "flex", gap: 8 }}>
              {["Completed", "Pending", "Cancelled"].map((s) => {
                const meta = STATUS_META[s];
                const active = w.status === s;
                return (
                  <button key={s} onClick={() => set({ status: s })}
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
            <TextArea value={w.remarks} onChange={(e) => set({ remarks: e.target.value })} placeholder="Anything worth noting about this visit" />
          </Field>

          <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, marginBottom: 18 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.slate, marginBottom: 10 }}>Review</div>
            <Row label="Customer" value={
              customer ? `${customer.name} (${customer.id})`
              : w.isNewCustomer ? `${w.customerDraft.name} (new)`
              : "—"
            } />
            <Row label="Device" value={`${w.deviceBrand} ${w.deviceModel}`} />
            <Row label="Colour" value={w.deviceColour || "—"} />
            {ramApplies(w.deviceBrand) && <Row label="RAM" value={w.deviceRam || "—"} />}
            <Row label="ROM (storage)" value={w.deviceRom || "—"} />
            <Row label="IMEI 1" value={w.imei || "Not captured"} />
            <Row label="Accessories" value={joinAccessories(w.accessories)} />
            <Row label="Lead ID" value={w.leadId} />
            <Row label="Purchase price" value={inr(w.purchasePrice)} />
            <Row label="Commission amount" value={inr(commissionAmount)} />
            <Row label="ID proof" value={(w.idProofTypes || []).length > 0 ? w.idProofTypes.join(", ") : "Not provided"} />
          </div>

          <BigButton tone="ledger" onClick={handleSave} disabled={submitting}>
            {submitting ? "Saving..." : "Save lead"}
          </BigButton>
        </div>
      )}

      {w.step === "saved" && (
        <div>
          <SavedCelebration
            feName={fe.name}
            leadId={w.leadId}
            customerName={customer?.name}
            todayCount={todayMine.length}
            todayCommission={todayMine.reduce((sum, l) => sum + (Number(l.commissionAmount) || 0), 0)}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <BigButton icon={History} tone="outline" onClick={() => onDone(w.customerId)}>View customer history</BigButton>
            <BigButton onClick={onFinishToDashboard}>Back to dashboard</BigButton>
          </div>
        </div>
      )}
    </div>
  );
}