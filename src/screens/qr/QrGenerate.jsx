import { useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { Printer, QrCode } from "lucide-react";
import { api } from "../../sheetsApi";
import { C } from "../../constants/colors";
import { Field } from "../../componets/ui/Field";
import { TextInput } from "../../componets/ui/TextInput";
import { BigButton } from "../../componets/ui/Bigbutton";

const PER_PAGE = 40; // A4: 4 columns x 10 rows
const MAX = 500;

// One A4 page = 200 x 286 mm (A4 minus 5 mm margin). Cells are 50 x 28.6 mm.
const PRINT_CSS = `
@page { size: A4; margin: 5mm; }
.qr-print-root { display: none; }
@media print {
  #root { display: none !important; }
  .qr-print-root { display: block; }
  html, body { margin: 0; padding: 0; background: #fff; }
}
.qr-page {
  width: 200mm; height: 286mm; display: grid; box-sizing: border-box;
  grid-template-columns: repeat(4, 50mm); grid-template-rows: repeat(10, 28.6mm);
  break-after: page; page-break-after: always; background: #fff;
}
.qr-page:last-child { break-after: auto; page-break-after: auto; }
.qr-cell {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  border: 0.2mm dashed #bbb; box-sizing: border-box; overflow: hidden;
}
.qr-cell img { width: 22mm; height: 22mm; image-rendering: pixelated; }
.qr-cell span { font: 700 9pt/1.1 monospace; margin-top: 1mm; letter-spacing: 0.3mm; color: #000; }
`;

function chunk(arr, n) {
  const pages = [];
  for (let i = 0; i < arr.length; i += n) pages.push(arr.slice(i, i + n));
  return pages;
}

function Sheet({ items, maxPages }) {
  const pages = chunk(items, PER_PAGE).slice(0, maxPages || Infinity);
  return pages.map((page, i) => (
    <div className="qr-page" key={i}>
      {page.map((it) => (
        <div className="qr-cell" key={it.code}>
          <img src={it.img} alt="" />
          <span>{it.display}</span>
        </div>
      ))}
    </div>
  ));
}

export function QrGenerate({ flash }) {
  const [count, setCount] = useState("40");
  const [busy, setBusy] = useState(false);
  const [batch, setBatch] = useState(null);

  const handleGenerate = async () => {
    if (busy) return;
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > MAX) return flash(`Enter a number between 1 and ${MAX}.`, "error");
    setBusy(true);
    try {
      const { codes } = await api.generateQr(n); // saved in the database BEFORE we get them back
      const items = await Promise.all(
        codes.map(async (c) => ({
          ...c,
          // the QR holds only the code, nothing else
          img: await QRCode.toDataURL(c.code, { margin: 0, width: 300, errorCorrectionLevel: "M" }),
        }))
      );
      setBatch(items);
      flash(`${items.length} QR codes saved.`);
    } catch (e) {
      flash(e?.message || "Could not generate QR codes. Please try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  const pages = batch ? Math.ceil(batch.length / PER_PAGE) : 0;

  return (
    <div>
      <style>{PRINT_CSS}</style>

      <div style={{ maxWidth: 420, marginBottom: 22 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 4 }}>
          Generate QR labels
        </div>
        <div style={{ color: C.slate, fontSize: 13.5, marginBottom: 14 }}>
          How many QR codes do you need? Maximum {MAX} per batch. One A4 page holds 40 stickers.
        </div>
        <Field label="Number of QR codes">
          <TextInput inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()} placeholder="e.g. 40" />
        </Field>
        <BigButton icon={QrCode} onClick={handleGenerate} disabled={busy}>
          {busy ? "Generating..." : "Generate QR codes"}
        </BigButton>
      </div>

      {batch && (
        <div>
          <div style={{
            background: C.amberBg || "#fff7e6", border: `1px solid ${C.line}`, borderRadius: 8,
            padding: "10px 14px", fontSize: 13.5, marginBottom: 14, maxWidth: 640,
          }}>
            <b>{batch.length} QR codes are saved in the database</b> ({pages} {pages === 1 ? "page" : "pages"}).
            Do not close this page before printing, because the sheet cannot be shown again once you leave.
            In the print dialog, set <b>Scale to 100%</b> and turn off <b>Headers and footers</b>.
          </div>
          <div style={{ marginBottom: 16, maxWidth: 260 }}>
            <BigButton tone="ledger" icon={Printer} onClick={() => window.print()}>Print sheet</BigButton>
          </div>

          <div style={{ fontSize: 12.5, color: C.slate, marginBottom: 8 }}>
            Preview (first page{pages > 1 ? `; the other ${pages - 1} will be included when you print` : ""}):
          </div>
          <div style={{ overflowX: "auto", border: `1px solid ${C.line}`, background: "#fff", maxWidth: "100%" }}>
            <Sheet items={batch} maxPages={1} />
          </div>

          {/* Full sheet used only for printing (hidden on screen) */}
          {createPortal(
            <div className="qr-print-root"><Sheet items={batch} /></div>,
            document.body
          )}
        </div>
      )}
    </div>
  );
}