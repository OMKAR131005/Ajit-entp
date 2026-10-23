import { useMemo, useState } from "react";
import { Phone, Plus, Pencil, FileText } from "lucide-react";
import { C } from "../constants/colors";
import { Badge } from "../componets/ui/Badge";
import { Row } from "../componets/ui/Row";
import { BackBtn } from "../componets/ui/BackBtn";
import { BigButton } from "../componets/ui/Bigbutton";
import { fmtDate, fmtDateTime, inr, specLine } from "../utils/formatters";
import { CustomerDocuments } from "./CustomerDocuments";

export function CustomerProfile({ customerId, customers, leads, session, onBack, onAddLead, onEditLead, onEditCustomer }) {
  const [showDocs, setShowDocs] = useState(false);
  const customer = customers.find((c) => c.id === customerId);
  const history = useMemo(
    () => leads.filter((l) => l.customerId === customerId).sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate)),
    [leads, customerId]
  );
  const latest = history[0];
  const canEditLead = (l) => session.role === "admin" || l.feUsername === session.username;
  const canEditCustomer = session.role === "admin" || history.some((l) => l.feUsername === session.username);

  if (!customer) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: 20 }}>
        <BackBtn onBack={onBack} />
        <div style={{ color: C.slate, marginTop: 20 }}>Customer not found.</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "18px 18px 50px" }}>
      <BackBtn onBack={onBack} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 10, marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700 }}>{customer.name}</div>
          <div style={{ color: C.slate, fontSize: 13.5 }}>{customer.id}</div>
        </div>
        {latest && <Badge status={latest.status} />}
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
        <Row label="Mobile" value={customer.mobile} />
        <Row label="Address" value={customer.address} />
        <Row label="ID proof" value={customer.idProofType || "Not provided"} />
        <Row label="Customer since" value={fmtDate(customer.createdAt)} />
        {canEditCustomer && (
          <button onClick={() => onEditCustomer(customer.id)} style={editLinkStyle}>
            <Pencil size={13} /> Edit customer details
          </button>
        )}
        {session.role === "admin" && (
          <button onClick={() => setShowDocs(true)} style={{ ...editLinkStyle, marginLeft: 8 }}>
            <FileText size={13} /> View documents
          </button>
        )}
        <div style={{ marginTop: 12 }}>
          <a href={`tel:${customer.mobile}`} style={{ textDecoration: "none" }}>
            <BigButton icon={Phone} tone="ledger">Call customer</BigButton>
          </a>
        </div>
      </div>

      {latest && (
        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.slate }}>Latest lead</div>
            {canEditLead(latest) && (
              <button onClick={() => onEditLead(latest.leadId)} style={{ ...editLinkStyle, marginTop: 0 }}>
                <Pencil size={13} /> Edit lead
              </button>
            )}
          </div>
          <Row label="Lead ID" value={latest.leadId} />
          <Row label="Device" value={`${latest.deviceBrand} ${latest.deviceModel}`} />
          <LeadDetails l={latest} />
          <Row label="Expected price" value={inr(latest.expectedPrice)} />
          <Row label="Purchase price" value={inr(latest.purchasePrice)} />
          <Row label="Commission" value={`${latest.commission} → ${inr(latest.commissionAmount)}`} />
          <Row label="Field executive" value={latest.feName} />
          <Row label="Visit date" value={fmtDateTime(latest.visitDate)} />
          {latest.remarks && <Row label="Remarks" value={latest.remarks} />}
        </div>
      )}

      {session.role === "fe" && (
        <div style={{ marginBottom: 22 }}>
          <BigButton icon={Plus} onClick={() => onAddLead(customer.id, customer.mobile)}>Add new lead for this customer</BigButton>
        </div>
      )}

      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink2, marginBottom: 10 }}>
        History ({history.length} visit{history.length !== 1 ? "s" : ""})
      </div>
      {history.length === 0 ? (
        <div style={{ color: C.slate, fontSize: 13.5 }}>No leads recorded yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {history.map((l) => (
            <div key={l.leadId} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{l.deviceBrand} {l.deviceModel}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Badge status={l.status} />
                  {canEditLead(l) && (
                    <button onClick={() => onEditLead(l.leadId)} aria-label={`Edit lead ${l.leadId}`} style={{ ...editLinkStyle, marginTop: 0 }}>
                      <Pencil size={13} /> Edit
                    </button>
                  )}
                </div>
              </div>
              <Row label="Lead ID" value={l.leadId} />
              <LeadDetails l={l} />
              <Row label="Purchase price" value={inr(l.purchasePrice)} />
              <Row label="Commission" value={inr(l.commissionAmount)} />
              <Row label="Field executive" value={l.feName} />
              <Row label="Visit" value={fmtDateTime(l.visitDate)} />
              {l.remarks && <Row label="Remarks" value={l.remarks} />}
            </div>
          ))}
        </div>
      )}

      {showDocs && <CustomerDocuments customerId={customer.id} onClose={() => setShowDocs(false)} />}
    </div>
  );
}

const editLinkStyle = {
  display: "inline-flex", alignItems: "center", gap: 5, marginTop: 10, background: "none", border: `1px solid ${C.line}`,
  borderRadius: 6, padding: "5px 10px", fontSize: 12.5, fontWeight: 600, color: C.ink2, cursor: "pointer",
};

// Colour / RAM / ROM / IMEI / accessories — only the parts that were recorded.
function LeadDetails({ l }) {
  const spec = specLine(l);
  return (
    <>
      {spec && <Row label="Variant" value={spec} />}
      {l.imei1 && <Row label="IMEI 1" value={l.imei1} />}
      {l.accessories && <Row label="Accessories" value={l.accessories} />}
    </>
  );
}