// IMEI helpers. An IMEI is 15 digits and the last digit is a Luhn check digit.

export function luhnValid(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

export const cleanImei = (s) => String(s ?? "").replace(/\D/g, "");

export const isValidImei = (s) => {
  const d = String(s ?? "");
  return /^\d{15}$/.test(d) && luhnValid(d);
};

// Pulls an IMEI out of whatever a barcode decoded to (some labels add text or a 16th digit).
export function extractImei(text) {
  const d = cleanImei(text);
  if (d.length >= 15 && d.length <= 17 && isValidImei(d.slice(0, 15))) return d.slice(0, 15);
  return null;
}

export function imeiProblem(value) {
  const d = String(value ?? "");
  if (!d) return "";
  if (d.length < 15) return `IMEI has 15 digits (${d.length} entered).`;
  if (!isValidImei(d)) return "This IMEI doesn't look right — check the digits.";
  return "";
}
