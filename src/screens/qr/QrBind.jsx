import { useMemo, useRef, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { api } from "../../sheetsApi";
import { C } from "../../constants/colors";
import { Field } from "../../componets/ui/Field";
import { TextInput } from "../../componets/ui/TextInput";
import { BigButton } from "../../componets/ui/Bigbutton";
import { Row } from "../../componets/ui/Row";
import { QrCamera } from "./QrCamera";

const SHOW_MAX = 30;
const eligible = (l, qrMap) => l.status === "Completed" && !qrMap[l.leadId];

export function QrBind({ session, leads, customers, qrMap, initialLeadId, onBound, onRefresh, onBack, flash }) {
  // When opened from a lead ("Attach QR" button) that lead is already chosen.
  const preLead = initialLeadId ? leads.find((l) => l.leadId === initialLeadId) : null;
  const preOk = !!preLead && eligible(preLead, qrMap);

  const [step, setStep] = useState("scan"); // scan -> lead -> confirm -> done
  const [code, setCode] = useState(null); // { code, display }
  const [selected, setSelected] = useState(preOk ? preLead : null);
  const [query, setQuery] = useState("");
  const [manual, setManual] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const checking = useRef(false);
  const lastTry = useRef({ text: "", at: 0 });

  const custById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = leads.filter((l) => eligible(l, qrMap)).filter((l) => {
      if (!q) return true;
      const c = custById.get(l.customerId);
      const hay = [l.leadId, l.deviceBrand, l.deviceModel, l.imei1, c?.name, c?.mobile].join(" ").toLowerCase();
      return hay.includes(q);
    });
    // my own leads first, then newest
    list.sort((a, b) => {
      const ma = a.feUsername === session.username ? 0 : 1;
      const mb = b.feUsername === session.username ? 0 : 1;
      return ma - mb || new Date(b.visitDate) - new Date(a.visitDate);
    });
    return list;
  }, [leads, qrMap, query, custById, session.username]);

  // Called for every camera read and for manual entry. Ignores repeats of the same code for 3 seconds.
  const handleCode = async (raw, force = false) => {
    const text = String(raw || "").trim();
    if (!text || checking.current) return;
    const now = Date.now();
    if (!force && text === lastTry.current.text && now - lastTry.current.at < 3000) return;
    lastTry.current = { text, at: now };
    checking.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await api.checkQr(text);
      setCode(r);
      setStep(selected ? "confirm" : "lead");
    } catch (e) {
      setError(e?.message || "Could not check this QR.");
    } finally {
      checking.current = false;
      setBusy(false);
    }
  };

  const handleBind = async () => {
    if (busy || !code || !selected) return;
    setBusy(true);
    setError("");
    try {
      const r = await api.bindQr(code.code, selected.leadId);
      onBound(selected.leadId, { code: r.code, display: r.display });
      setStep("done");
    } catch (e) {
      setError(e?.message || "Could not attach the QR. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await onRefresh(); } catch { flash("Could not refresh the list.", "error"); }
    finally { setRefreshing(false); }
  };

  const startOver = () => {
    setCode(null);
    setSelected(null);
    setQuery("");
    setManual("");
    setError("");
    lastTry.current = { text: "", at: 0 };
    setStep("scan");
  };

  const errorBox = error && (
    <div style={{ background: C.rustBg, color: C.rust, padding: 10, borderRadius: 8, fontSize: 13.5, margin: "12px 0" }}>{error}</div>
  );

  const customerOf = (l) => custById.get(l.customerId);

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: C.paper, padding: "18px 18px 40px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: C.slate, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 13.5, padding: 0, marginBottom: 14 }}>
        <ArrowLeft size={16} /> Back
      </button>

      {initialLeadId && !preOk && step === "scan" && (
        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: 10, fontSize: 13, color: C.slate, marginBottom: 12 }}>
          Lead {initialLeadId} is not available for a QR (it is not Completed, or it already has a QR). You can still scan and pick another lead.
        </div>
      )}

      {step === "scan" && (
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20, marginBottom: 4 }}>Scan QR sticker</div>
          <div style={{ color: C.slate, fontSize: 13.5, marginBottom: 12 }}>Point the camera at the QR code on the sticker.</div>

          {selected && (
            <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: 10, fontSize: 13.5, marginBottom: 12 }}>
              Attaching to lead <b>{selected.leadId}</b> · {selected.deviceBrand} {selected.deviceModel}
            </div>
          )}

          <QrCamera onScan={handleCode} />
          {busy && <div style={{ color: C.slate, fontSize: 13, marginTop: 10 }}>Checking...</div>}
          {errorBox}

          <div style={{ marginTop: 18 }}>
            <Field label="Or type the code printed below the QR">
              <TextInput value={manual} onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCode(manual, true)} placeholder="e.g. K7M2-QX9R" />
            </Field>
            <BigButton tone="outline" onClick={() => handleCode(manual, true)} disabled={busy}>Check code</BigButton>
          </div>
        </div>
      )}

      {step === "lead" && (
        <div>
          <div style={{ background: C.ledgerBg, color: C.ledger, padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700, marginBottom: 14, display: "inline-block" }}>
            QR {code.display} is valid
          </div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20, marginBottom: 4 }}>Choose the phone</div>
          <div style={{ color: C.slate, fontSize: 13.5, marginBottom: 12 }}>
            Only Completed leads that do not have a QR yet are shown.
          </div>
          <Field label="Search by lead ID, model, IMEI, customer name or mobile">
            <TextInput autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search..." />
          </Field>
          <button onClick={handleRefresh} disabled={refreshing}
            style={{ background: "none", border: "none", color: C.slate, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 12 }}>
            <RefreshCw size={14} /> {refreshing ? "Refreshing..." : "Refresh list"}
          </button>

          {results.length === 0 && (
            <div style={{ color: C.slate, fontSize: 13.5, padding: "16px 0" }}>No matching leads. Try refreshing the list or changing the search.</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {results.slice(0, SHOW_MAX).map((l) => {
              const c = customerOf(l);
              return (
                <button key={l.leadId} onClick={() => { setSelected(l); setError(""); setStep("confirm"); }}
                  style={{ textAlign: "left", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: "12px 14px", cursor: "pointer" }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>{l.deviceBrand} {l.deviceModel}</div>
                  <div style={{ fontSize: 12.5, color: C.slate }}>
                    {l.leadId}{c ? ` · ${c.name}` : ""}{l.imei1 ? ` · IMEI ${l.imei1}` : ""}
                  </div>
                </button>
              );
            })}
          </div>
          {results.length > SHOW_MAX && (
            <div style={{ color: C.slate, fontSize: 12.5, marginTop: 10 }}>
              Showing {SHOW_MAX} of {results.length}. Type in the search box to narrow down.
            </div>
          )}
          <div style={{ marginTop: 16 }}>
            <BigButton tone="outline" onClick={startOver}>Scan a different QR</BigButton>
          </div>
        </div>
      )}

      {step === "confirm" && selected && code && (
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20, marginBottom: 12 }}>Confirm</div>
          <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
            <Row label="QR code" value={code.display} />
            <Row label="Lead ID" value={selected.leadId} />
            <Row label="Device" value={`${selected.deviceBrand} ${selected.deviceModel}`} />
            {selected.imei1 && <Row label="IMEI 1" value={selected.imei1} />}
            {customerOf(selected) && <Row label="Customer" value={customerOf(selected).name} />}
          </div>
          {errorBox}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <BigButton tone="ledger" onClick={handleBind} disabled={busy}>{busy ? "Attaching..." : "Attach QR to this phone"}</BigButton>
            <BigButton tone="outline" onClick={() => { setSelected(null); setError(""); setStep("lead"); }} disabled={busy}>Choose a different lead</BigButton>
            <BigButton tone="outline" onClick={startOver} disabled={busy}>Scan a different QR</BigButton>
          </div>
        </div>
      )}

      {step === "done" && selected && code && (
        <div>
          <div style={{ background: C.ledgerBg, color: C.ledger, padding: 16, borderRadius: 10, marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>QR attached</div>
            <div style={{ fontSize: 13.5 }}>{code.display} is now linked to lead {selected.leadId}.</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <BigButton onClick={startOver}>Scan next phone</BigButton>
            <BigButton tone="outline" onClick={onBack}>Done</BigButton>
          </div>
        </div>
      )}
    </div>
  );
}