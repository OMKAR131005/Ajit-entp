// Google Sheets backend client (talks to the Apps Script web app in apps-script/Code.gs).
// Set VITE_SHEETS_API_URL to the Web App /exec URL (in .env locally and in Vercel).

const API_URL = import.meta.env.VITE_SHEETS_API_URL;

let token = null;
try { token = sessionStorage.getItem("fl_token"); } catch { /* storage unavailable */ }

function setToken(t) {
  token = t;
  try {
    if (t) sessionStorage.setItem("fl_token", t);
    else sessionStorage.removeItem("fl_token");
  } catch { /* ignore */ }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Google's free tier allows 30 Apps Script requests running at once per account; a request that
// lands when that's full comes back as a network failure or a non-JSON error page rather than a
// normal error, so those two cases get a couple of quick, quiet retries before giving up.
async function fetchOnce(action, payload) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, token, ...payload }),
  });
  let json;
  try { json = await res.json(); } catch { throw new Error("Unexpected response from the server."); }
  return json;
}

const RETRY_DELAYS_MS = [600, 1500]; // ~2 extra tries, under 2.5s total, before surfacing the error

// Content-Type must be text/plain so the browser skips the CORS preflight,
// which Apps Script web apps don't support.
async function call(action, payload = {}, { silent = false } = {}) {
  if (!API_URL) throw new Error("App is not configured (missing VITE_SHEETS_API_URL).");

  let json, lastErr;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      json = await fetchOnce(action, payload);
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
      if (attempt < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt]);
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
  listFieldExecutives: () => call("listFieldExecutives"),
  login: async (role, username, password) => {
    const session = await call("login", { role, username, password }); // role: "fe" | "admin"
    setToken(session.token);
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

  // device master (Devices + Lists tabs)
  getDeviceMaster: () => call("getDeviceMaster"),

  // One request instead of three (customers + leads + device master) — used right after login,
  // so the app isn't firing several requests at once against the account's concurrency limit.
  bootstrap: () => call("bootstrap"),

  // leads
  listLeads: () => call("listLeads"),
  createLead: (lead) => call("createLead", { lead }),
  updateLead: (lead_id, patch) => call("updateLead", { lead_id, patch }),

  // admin: field executives
  addFieldExecutive: (username, name, password) => call("addFieldExecutive", { username, name, password }),
  updateFieldExecutive: (username, name) => call("updateFieldExecutive", { username, name }),
  setFieldExecutivePassword: (username, password) => call("setFieldExecutivePassword", { username, password }),
  setFieldExecutiveActive: (username, active) => call("setFieldExecutiveActive", { username, active }),
};
