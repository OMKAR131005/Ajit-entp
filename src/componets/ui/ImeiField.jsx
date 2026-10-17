import { useState } from "react";
import { ScanBarcode } from "lucide-react";
import { C } from "../../constants/colors";
import { Field } from "./Field";
import { TextInput } from "./TextInput";
import { BarcodeScanner } from "./BarcodeScanner";
import { cleanImei, imeiProblem } from "../../utils/imei";

// IMEI 1: type it, or scan the barcode. Optional, but if present it must be a valid 15-digit IMEI.
export function ImeiField({ value, onChange, leads = [], currentLeadId = null, flash }) {
  const [scanning, setScanning] = useState(false);
  const problem = imeiProblem(value);
  const dup = !problem && value
    ? leads.find((l) => l.imei1 === value && l.leadId !== currentLeadId)
    : null;

  return (
    <Field label="IMEI 1 (optional)">
      <div style={{ display: "flex", gap: 8 }}>
        <TextInput
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(cleanImei(e.target.value).slice(0, 15))}
          placeholder="15-digit IMEI"
          style={{ flex: 1, minWidth: 0, letterSpacing: 0.5 }}
        />
        <button
          type="button"
          onClick={() => setScanning(true)}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "0 16px", borderRadius: 8, cursor: "pointer",
            background: C.ink, color: "#fff", border: "none", fontSize: 14.5, fontWeight: 600, flexShrink: 0,
          }}
        >
          <ScanBarcode size={18} /> Scan
        </button>
      </div>

      {value && problem && <div style={{ fontSize: 12.5, color: C.rust, marginTop: 5 }}>{problem}</div>}
      {value && !problem && !dup && <div style={{ fontSize: 12.5, color: C.ledger, marginTop: 5 }}>✓ Valid IMEI</div>}
      {dup && (
        <div style={{ fontSize: 12.5, color: C.amber, marginTop: 5 }}>
          ⚠ This IMEI is already recorded on lead {dup.leadId}. Check that it isn't a duplicate.
        </div>
      )}
      {!value && <div style={{ fontSize: 12, color: C.slate, marginTop: 4 }}>Dial *#06# on the phone to see it, or tap Scan.</div>}

      {scanning && (
        <BarcodeScanner
          onClose={() => setScanning(false)}
          onDetect={(imei) => { setScanning(false); onChange(imei); flash && flash("IMEI captured."); }}
        />
      )}
    </Field>
  );
}
