// Backend client (talks to the Supabase Edge Function in supabase/functions/api/index.ts).
// Set VITE_SHEETS_API_URL to the function URL (in .env locally and in Vercel).

const API_URL = import.meta.env.VITE_SHEETS_API_URL;
const QR_API_URL = import.meta.env.VITE_QR_API_URL;

let token = null;
try { token = sessionStorage.getItem("fl_token"); } catch { /* storage unavailable */ }

// App data (customers + leads + device master) that arrives together with the login response,
// so the first bootstrap() after login needs no extra network request.
let prefetched = null;
let prefetchedAt = 0;
const PREFETCH_TTL_MS = 5000; // also covers React StrictMode (dev) running the same effect twice

// While one listFieldExecutives request is in flight, a second identical call shares it.
let fePromise = null;
let bootPromise = null; // same idea for bootstrap's network call

function setToken(t) {
  if (!t) prefetched = null;
  token = t;
  try {
    if (t) sessionStorage.setItem("fl_token", t);
    else sessionStorage.removeItem("fl_token");
  } catch { /* ignore */ }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A request that fails at the network level, or comes back as a non-JSON error page,
// gets a couple of quick, quiet retries before giving up.
async function fetchOnce(url, action, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, token, ...payload }),
  });
  let json;
  try { json = await res.json(); } catch { throw new Error("Unexpected response from the server."); }
  return json;
}

const RETRY_DELAYS_MS = [600, 1500]; // ~2 extra tries, under 2.5s total, before surfacing the error

// Content-Type is text/plain so the browser skips the CORS preflight.
// url: which backend function to call. retry: false for actions that must never run twice.
async function call(action, payload = {}, { silent = false, url = API_URL, retry = true } = {}) {
  if (!url) throw new Error("App is not configured (missing API URL in .env).");

  const delays = retry ? RETRY_DELAYS_MS : [];
  let json, lastErr;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      json = await fetchOnce(url, action, payload);
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
      if (attempt < delays.length) await sleep(delays[attempt]);
    }
  }
  if (lastErr) throw new Error("Could not reach the server — check your connection and try again.");

  if (!json.ok) {
    const err = new Error(json.error || "Request failed.");
    err.code = json.code;
    if (json.code === "AUTH" && !silent) {
      setToken(null);
      // App.jsx listens for this and sends the user back to the login screen.
      window.dispatchEvent(new Event("auth-expired"));
    }
    throw err;
  }
  return json.data;
}

const qrCall = (action, payload, opts) => call(action, payload, { url: QR_API_URL, ...opts });

// ---- Files -------------------------------------------------------------

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

// Downscales phone photos before upload (keeps requests small and fast).
// Falls back to the original file if the browser can't decode it.
export async function fileToUpload(file, maxDim = 1600, quality = 0.8) {
  const original = async () => ({ fileName: file.name, mimeType: file.type || "image/jpeg", base64: await toBase64(file) });
  if (!file.type.startsWith("image/")) return original();
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (!blob) return original();
    return {
      fileName: file.name.replace(/\.[^.]+$/, "") + ".jpg",
      mimeType: "image/jpeg",
      base64: await toBase64(blob),
    };
  } catch {
    return original();
  }
}

// ---- API ---------------------------------------------------------------

export const api = {
  hasSession: () => !!token,

  // auth
  listFieldExecutives: () => {
    if (!fePromise) fePromise = call("listFieldExecutives").finally(() => { fePromise = null; });
    return fePromise;
  },
  login: async (role, username, password) => {
    // bootstrap: true -> the server sends customers + leads + device master in the same response
    const session = await call("login", { role, username, password, bootstrap: true }); // role: "fe" | "admin"
    setToken(session.token);
    prefetched = session.bootstrap || null;
    prefetchedAt = Date.now();
    delete session.bootstrap;
    return session; // { token, role, username, name }
  },
  logout: async () => {
    const old = token;
    setToken(null);
    if (!old) return;
    try { await call("logout", { token: old }, { silent: true }); } catch { /* already logged out locally */ }
  },

  // customers
  listCustomers: () => call("listCustomers"),
  createCustomer: (customer) => call("createCustomer", { customer }),
  updateCustomer: (customer_id, patch) => call("updateCustomer", { customer_id, patch }),
  uploadIdProof: (customer_id, type, file) => call("uploadIdProof", { customer_id, type, file }), // -> { path, name }

  // device master (Devices + Lists tables)
  getDeviceMaster: () => call("getDeviceMaster"),

  // customers + leads + device master in one go. For a few seconds after login this returns the data
  // that came with the login response (no network request); any later call fetches fresh data.
  bootstrap: () => {
    if (prefetched && Date.now() - prefetchedAt < PREFETCH_TTL_MS) return Promise.resolve(prefetched);
    prefetched = null;
    if (!bootPromise) bootPromise = call("bootstrap").finally(() => { bootPromise = null; });
    return bootPromise;
  },

  // leads
  listLeads: () => call("listLeads"),
  createLead: (lead) => call("createLead", { lead }),

  // The whole "Add lead" save in ONE request: [new customer] + ID proof uploads + lead + customer
  // ID-proof fields. App.jsx listens for "lead-saved" to add the new rows to its lists.
  // payload: { new_customer?, files: [{type, file}], id_proof_types, lead }  ->  { customer, lead }
  submitLead: async (payload) => {
    const result = await call("submitLead", payload);
    window.dispatchEvent(new CustomEvent("lead-saved", { detail: result }));
    return result;
  },
  updateLead: (lead_id, patch) => call("updateLead", { lead_id, patch }),

  // admin: field executives
  addFieldExecutive: (username, name, password) => call("addFieldExecutive", { username, name, password }),
  updateFieldExecutive: (username, name) => call("updateFieldExecutive", { username, name }),
  setFieldExecutivePassword: (username, password) => call("setFieldExecutivePassword", { username, password }),
  setFieldExecutiveActive: (username, active) => call("setFieldExecutiveActive", { username, active }),
    // QR labels (qr-handler function)
  generateQr: (count) => qrCall("generateQr", { count }, { retry: false }), // never auto-retried, would make a second batch
  checkQr: (code) => qrCall("checkQr", { code }),
  bindQr: (code, lead_id) => qrCall("bindQr", { code, lead_id }),
    listBoundLeads: () => qrCall("listBoundLeads", {}, { silent: true }),
};