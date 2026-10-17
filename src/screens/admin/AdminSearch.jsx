import { useState, useMemo } from "react";
import { C } from "../../constants/colors";
import { Field } from "../../componets/ui/Field";
import { TextInput } from "../../componets/ui/TextInput";
import { Badge } from "../../componets/ui/Badge";
import { fmtDate } from "../../utils/formatters";

export function AdminSearch({ customers, leads, onOpenCustomer }) {
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return customers
      .map((c) => {
        const custLeads = leads.filter((l) => l.customerId === c.id).sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate));
        const matches =
          c.name.toLowerCase().includes(term) ||
          c.mobile.includes(term) ||
          c.id.toLowerCase().includes(term) ||
          custLeads.some((l) =>
            l.leadId.toLowerCase().includes(term) ||
            l.deviceModel.toLowerCase().includes(term) ||
            l.deviceBrand.toLowerCase().includes(term) ||
            l.feName.toLowerCase().includes(term) ||
            (l.imei1 || "").includes(term)
          );
        return matches ? { customer: c, latest: custLeads[0] } : null;
      })
      .filter(Boolean);
  }, [q, customers, leads]);

  return (
    <div>
      <Field label="Search by customer name, mobile, customer ID, lead ID, IMEI, device or executive">
        <TextInput autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Start typing to search…" />
      </Field>
      {q.trim() && (
        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Customer</th><th>Customer ID</th><th>Mobile</th><th>Latest device</th><th>Status</th><th>Latest visit</th><th>FE</th><th>Lead ID</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 && (
                <tr><td colSpan={8} style={{ color: C.slate, textAlign: "center", padding: 20 }}>No matches found.</td></tr>
              )}
              {results.map(({ customer, latest }) => (
                <tr key={customer.id} onClick={() => onOpenCustomer(customer.id)} style={{ cursor: "pointer" }}>
                  <td style={{ fontWeight: 600 }}>{customer.name}</td>
                  <td>{customer.id}</td>
                  <td>{customer.mobile}</td>
                  <td>{latest ? `${latest.deviceBrand} ${latest.deviceModel}` : "—"}</td>
                  <td>{latest ? <Badge status={latest.status} /> : "—"}</td>
                  <td>{latest ? fmtDate(latest.visitDate) : "—"}</td>
                  <td>{latest ? latest.feName : "—"}</td>
                  <td>{latest ? latest.leadId : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}