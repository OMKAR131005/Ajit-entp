import { useState, useMemo } from "react";
import { Download, Pencil } from "lucide-react";
import { C } from "../../constants/colors";
import { Field } from "../../componets/ui/Field";
import { TextInput } from "../../componets/ui/TextInput";
import { Select } from "../../componets/ui/Select";
import { Badge } from "../../componets/ui/Badge";
import { todayISO, startOfWeek, fmtDate, inr, specLine } from "../../utils/formatters";

export function AdminLeadsFilters({ customers, leads, fes, flash, onOpenCustomer, onEditLead }) {
  const [datePreset, setDatePreset] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [exec, setExec] = useState("all");
  const [status, setStatus] = useState("all");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");

  const custById = (id) => customers.find((c) => c.id === id);

  const filtered = useMemo(() => {
    const now = new Date();
    let from = null, to = null;
    if (datePreset === "today") { from = todayISO(); to = todayISO(); }
    else if (datePreset === "yesterday") {
      const y = new Date(); y.setDate(y.getDate() - 1);
      from = y.toISOString().slice(0, 10); to = from;
    } else if (datePreset === "week") { from = startOfWeek().toISOString().slice(0, 10); to = todayISO(); }
    else if (datePreset === "month") {
      const m = new Date(now.getFullYear(), now.getMonth(), 1);
      from = m.toISOString().slice(0, 10); to = todayISO();
    } else if (datePreset === "custom") { from = customFrom || null; to = customTo || null; }

    return leads.filter((l) => {
      const day = (l.visitDate || "").slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (exec !== "all" && l.feUsername !== exec) return false;
      if (status !== "all" && l.status !== status) return false;
      if (brand.trim() && !l.deviceBrand.toLowerCase().includes(brand.trim().toLowerCase())) return false;
      if (model.trim() && !l.deviceModel.toLowerCase().includes(model.trim().toLowerCase())) return false;
      return true;
    }).sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate));
  }, [leads, datePreset, customFrom, customTo, exec, status, brand, model]);

  const exportCsv = () => {
    if (filtered.length === 0) return flash("Nothing to export for these filters.", "error");
    const cols = ["Customer ID", "Customer Name", "Mobile Number", "Address", "Lead ID", "Device Brand", "Device Model",
      "Colour", "RAM", "ROM", "IMEI 1", "Accessories",
      "Expected Price", "Purchase Price", "Commission", "Commission Amount", "ID Proof Type", "FE Name", "Visit Date", "Status", "Remarks",
      "Last Edited At", "Last Edited By"];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = filtered.map((l) => {
      const c = custById(l.customerId) || {};
      // IMEI is wrapped as ="…" so Excel keeps all 15 digits instead of turning it into 3.57E+14.
      const imei = l.imei1 ? `="${l.imei1}"` : "";
      const cells = [c.id, c.name, c.mobile, c.address, l.leadId, l.deviceBrand, l.deviceModel, l.colour, l.ram, l.rom].map(esc);
      const rest = [l.accessories, l.expectedPrice, l.purchasePrice, l.commission, l.commissionAmount, c.idProofType, l.feName,
        l.visitDate, l.status, l.remarks, l.updatedAt, l.updatedBy].map(esc);
      return [...cells, imei, ...rest].join(",");
    });
    const csv = [cols.map(esc).join(","), ...rows].join("\n");
    try {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `leads-export-${todayISO()}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      flash(`Exported ${filtered.length} lead${filtered.length !== 1 ? "s" : ""}.`);
    } catch (e) {
      flash("Export failed in this environment.", "error");
    }
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 10, marginBottom: 16, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: 16 }}>
        <Field label="Date range">
          <Select value={datePreset} onChange={(e) => setDatePreset(e.target.value)}>
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="custom">Custom range</option>
          </Select>
        </Field>
        {datePreset === "custom" && (
          <>
            <Field label="From"><TextInput type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} /></Field>
            <Field label="To"><TextInput type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} /></Field>
          </>
        )}
        <Field label="Executive">
          <Select value={exec} onChange={(e) => setExec(e.target.value)}>
            <option value="all">All executives</option>
            {fes.map((f) => <option key={f.username} value={f.username}>{f.name}</option>)}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All statuses</option>
            <option>Pending</option><option>Completed</option><option>Cancelled</option>
          </Select>
        </Field>
        <Field label="Device brand"><TextInput value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Apple" /></Field>
        <Field label="Device model"><TextInput value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. iPhone 14" /></Field>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 13.5, color: C.slate }}>{filtered.length} lead{filtered.length !== 1 ? "s" : ""}</div>
        <button onClick={exportCsv} style={{
          display: "flex", alignItems: "center", gap: 6, background: C.ink, color: "#fff", border: "none",
          padding: "9px 14px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: "pointer",
        }}>
          <Download size={15} /> Export CSV
        </button>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, overflowX: "auto" }}>
        <table>
          <thead>
            <tr><th>Lead ID</th><th>Customer</th><th>Mobile</th><th>FE</th><th>Device</th><th>Purchase</th><th>Commission</th><th>Status</th><th>Visit date</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={10} style={{ textAlign: "center", color: C.slate, padding: 20 }}>No leads match these filters.</td></tr>}
            {filtered.map((l) => {
              const c = custById(l.customerId);
              return (
                <tr key={l.leadId} onClick={() => onOpenCustomer(l.customerId)} style={{ cursor: "pointer" }}>
                  <td>{l.leadId}</td>
                  <td style={{ fontWeight: 600 }}>{c ? c.name : "—"}</td>
                  <td>{c ? c.mobile : "—"}</td>
                  <td>{l.feName}</td>
                  <td>
                    {l.deviceBrand} {l.deviceModel}
                    {specLine(l) && <div style={{ fontSize: 12, color: C.slate }}>{specLine(l)}</div>}
                  </td>
                  <td>{inr(l.purchasePrice)}</td>
                  <td>{inr(l.commissionAmount)}</td>
                  <td><Badge status={l.status} /></td>
                  <td>{fmtDate(l.visitDate)}</td>
                  <td>
                    <button
                      onClick={(e) => { e.stopPropagation(); onEditLead(l.leadId); }}
                      aria-label={`Edit lead ${l.leadId}`}
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: `1px solid ${C.line}`, borderRadius: 6, padding: "5px 10px", fontSize: 12.5, fontWeight: 600, color: C.ink2, cursor: "pointer" }}
                    >
                      <Pencil size={13} /> Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}