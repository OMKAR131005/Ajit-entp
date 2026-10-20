// Field Ledger API — Supabase Edge Function.
// Drop-in replacement for the Apps Script web app: same POST body { action, token, ... }
// and same response { ok, data } / { ok:false, error, code? }.

import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const STATUSES = ["Pending", "Completed", "Cancelled"];
const ACCESSORIES = ["All Kit", "Box", "Charger", "No accessories"];
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_LOGIN_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;
const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const FE_CAN_SEE_ALL_LEADS = true;
const NUM_COLS = ["expected_price", "purchase_price", "commission", "commission_amount"];
const LEAD_EDITABLE = [
  "lead_id", "visit_date", "device_brand", "device_model", "colour", "ram", "rom", "imei1",
  "accessories", "expected_price", "purchase_price", "commission", "commission_amount", "status", "remarks",
];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const out = (obj: unknown) =>
  new Response(JSON.stringify(obj), { headers: { ...CORS, "Content-Type": "application/json" } });

// ---------- db helpers ----------
// deno-lint-ignore no-explicit-any
type Any = any;
const ck = (r: Any) => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};

// PostgREST returns max 1000 rows per request, so page through everything.
async function all(table: string, cols = "*", order = "seq"): Promise<Any[]> {
  const rows: Any[] = [];
  for (let from = 0;; from += 1000) {
    const data = ck(await sb.from(table).select(cols).order(order).range(from, from + 999));
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

// Hide internal columns; turn NULLs (e.g. from CSV import) into ''/0 like the Sheet gave.
function pub(o: Any) {
  const c: Any = {};
  for (const [k, v] of Object.entries(o)) {
    if (k === "seq" || k === "password_hash") continue;
    c[k] = v === null ? (NUM_COLS.includes(k) ? 0 : "") : v;
  }
  return c;
}

// ---------- validation helpers ----------
const cleanText = (v: Any, max = 200) => String(v == null ? "" : v).trim().slice(0, max);
const money = (v: Any) => {
  const n = Number(v);
  return isNaN(n) || n < 0 ? 0 : n;
};
const last10 = (s: Any) => String(s == null ? "" : s).replace(/\D/g, "").slice(-10);

function luhnOk(d: string) {
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let x = Number(d.charAt(d.length - 1 - i));
    if (i % 2 === 1) {
      x *= 2;
      if (x > 9) x -= 9;
    }
    sum += x;
  }
  return sum % 10 === 0;
}
function normalizeImei(v: Any) {
  const s = String(v == null ? "" : v).replace(/[\s-]/g, "");
  if (!s) return "";
  if (!/^\d{15}$/.test(s) || !luhnOk(s)) throw new Error("IMEI must be a valid 15-digit number.");
  return s;
}
function normalizeAccessories(v: Any) {
  const parts = (Array.isArray(v) ? v : String(v == null ? "" : v).split(","))
    .map((x: Any) => String(x).trim()).filter(Boolean);
  if (!parts.length) return "";
  parts.forEach((x: string) => {
    if (!ACCESSORIES.includes(x)) throw new Error("Unknown accessory: " + x);
  });
  if (parts.includes("All Kit")) return "All Kit";
  if (parts.includes("No accessories")) return "No accessories";
  return ACCESSORIES.filter((a) => parts.includes(a)).join(", ");
}
const splitList = (v: Any) =>
  String(v == null ? "" : v).split(/[,;|\n]/).map((x) => x.trim()).filter(Boolean);

// ---------- passwords (same format as the Apps Script: salt$sha256(salt+pw)) ----------
async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function hashPassword(pw: string) {
  const salt = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  return salt + "$" + await sha256(salt + pw);
}
async function verifyPassword(pw: Any, stored: Any) {
  const parts = String(stored || "").split("$");
  return parts.length === 2 && await sha256(parts[0] + String(pw || "")) === parts[1];
}

// ---------- auth ----------
type Session = { role: "fe" | "admin"; username: string; name: string };

async function getSession(token: Any): Promise<Session | null> {
  if (!token) return null;
  const r = ck(
    await sb.from("sessions").select("role,username,name,expires_at").eq("token", String(token)).maybeSingle(),
  );
  if (!r || new Date(r.expires_at).getTime() < Date.now()) return null;
  return { role: r.role, username: r.username, name: r.name };
}

async function listFieldExecutives() {
  const rows = ck(await sb.from("field_executives").select("username,name,active").order("seq"));
  return rows.map((u: Any) => ({ username: u.username, name: u.name, active: u.active === true }));
}

async function login(p: Any) {
  const role = p.role === "admin" ? "admin" : "fe";
  const username = String(p.username || "").trim().toLowerCase();

  const att = ck(await sb.from("login_attempts").select("*").eq("username", username).maybeSingle());
  const recent = att && Date.now() - new Date(att.last_at).getTime() < LOCK_MS;
  if (att && recent && att.fails >= MAX_LOGIN_FAILURES) {
    throw new Error("Too many failed attempts. Try again in 15 minutes.");
  }

  const user = ck(
    await sb.from(role === "admin" ? "admins" : "field_executives").select("*").eq("username", username).maybeSingle(),
  );
  const ok = user && (role === "admin" || user.active === true) && await verifyPassword(p.password, user.password_hash);
  if (!ok) {
    ck(await sb.from("login_attempts").upsert({
      username,
      fails: (recent ? att.fails : 0) + 1,
      last_at: new Date().toISOString(),
    }));
    throw new Error("Incorrect username or password.");
  }
  ck(await sb.from("login_attempts").delete().eq("username", username));
  ck(await sb.from("sessions").delete().lt("expires_at", new Date().toISOString())); // housekeeping

  const token = crypto.randomUUID() + crypto.randomUUID();
  const session = { role, username: user.username, name: user.name || "Admin" };
  ck(await sb.from("sessions").insert({
    token, ...session, expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  }));
  return { token, ...session };
}

async function logout(p: Any) {
  ck(await sb.from("sessions").delete().eq("token", String(p.token)));
  return true;
}

// ---------- customers ----------
const listCustomers = async () => (await all("customers")).map(pub);

async function findCustomer(id: Any) {
  const c = ck(await sb.from("customers").select("*").eq("id", String(id)).maybeSingle());
  if (!c) throw new Error("Customer not found.");
  return c;
}

async function createCustomer(p: Any) {
  const c = p.customer || {};
  const name = cleanText(c.name, 120), address = cleanText(c.address, 400), mobile = cleanText(c.mobile, 30);
  if (!name || !mobile || !address) throw new Error("Name, mobile and address are required.");
  if (last10(mobile).length !== 10) throw new Error("Enter a valid 10-digit mobile number.");
  const existing = await all("customers", "id,mobile", "id");
  if (existing.some((x) => last10(x.mobile) === last10(mobile))) {
    throw new Error("A customer with this mobile number already exists — go back and search again.");
  }
  const id = ck(await sb.rpc("next_customer_id"));
  const row = ck(
    await sb.from("customers").insert({
      id, name, mobile, address,
      id_proof_type: "", id_proof_path: "", id_proof_file_name: "",
      created_at: new Date().toISOString(),
    }).select().single(),
  );
  return pub(row);
}

async function updateCustomer(p: Any, s: Session) {
  const cust = await findCustomer(p.customer_id);
  const inp = p.patch || {};
  const patch: Any = {};

  ["id_proof_type", "id_proof_path", "id_proof_file_name"].forEach((k) => {
    if (inp[k] !== undefined) patch[k] = String(inp[k]);
  });

  if (["name", "mobile", "address"].some((k) => inp[k] !== undefined)) {
    if (s.role === "fe") {
      const mine = ck(
        await sb.from("leads").select("lead_id").eq("customer_id", cust.id).eq("fe_username", s.username).limit(1),
      );
      if (!mine.length) throw new Error("You can only edit customers you have a lead for.");
    }
    if (inp.name !== undefined) patch.name = cleanText(inp.name, 120);
    if (inp.address !== undefined) patch.address = cleanText(inp.address, 400);
    if (inp.mobile !== undefined) patch.mobile = cleanText(inp.mobile, 30);
    if (patch.name !== undefined && !patch.name) throw new Error("Name is required.");
    if (patch.address !== undefined && !patch.address) throw new Error("Address is required.");
    if (patch.mobile !== undefined) {
      if (last10(patch.mobile).length !== 10) throw new Error("Enter a valid 10-digit mobile number.");
      const others = await all("customers", "id,mobile", "id");
      if (others.some((x) => x.id !== cust.id && last10(x.mobile) === last10(patch.mobile))) {
        throw new Error("Another customer already has this mobile number.");
      }
    }
  }
  if (!Object.keys(patch).length) return pub(cust);
  const row = ck(await sb.from("customers").update(patch).eq("id", cust.id).select().single());
  return pub(row);
}

async function uploadIdProof(p: Any) {
  const cust = await findCustomer(p.customer_id);
  const f = p.file || {};
  if (!f.base64) throw new Error("No file received.");
  const mime = f.mimeType || "image/jpeg";
  if (!/^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/.test(mime)) throw new Error("Unsupported file type.");
  const b64 = String(f.base64).replace(/^data:[^,]*,/, "");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (bytes.length > MAX_UPLOAD_BYTES) throw new Error("File is too large.");

  const type = String(p.type || "ID").replace(/[^\w\-]+/g, "_");
  const safeName = String(f.fileName || "proof").replace(/[^\w.\-]+/g, "_");
  const path = `${cust.id}/${type}_${Date.now()}_${safeName}`;
  ck(await sb.storage.from("id-proofs").upload(path, bytes, { contentType: mime }));
  // Private bucket; the link below is a signed URL valid for 1 year.
  const signed = ck(await sb.storage.from("id-proofs").createSignedUrl(path, 60 * 60 * 24 * 365));
  return { path: signed.signedUrl, name: f.fileName || safeName };
}

// ---------- device master ----------
async function getDeviceMaster() {
  const devices = (await all("devices", "*", "id")).map((r) => ({
    brand: cleanText(r.brand, 60),
    model: cleanText(r.model, 80),
    ram_options: splitList(r.ram_options),
    storage_options: splitList(r.storage_options),
    colours: splitList(r.colours),
  })).filter((d) => d.brand && d.model);

  const rows = await all("lists", "*", "id");
  const col = (k: string) => rows.map((r) => cleanText(r[k], 40)).filter(Boolean);
  return { devices, lists: { colours: col("colours"), ram: col("ram"), storage: col("storage") } };
}

async function bootstrap(p: Any, s: Session) {
  const [customers, leads, deviceMaster] = await Promise.all([listCustomers(), listLeads(p, s), getDeviceMaster()]);
  return { customers, leads, deviceMaster };
}

// ---------- leads ----------
async function listLeads(_p: Any, s: Session) {
  let rows = await all("leads");
  if (s.role === "fe" && !FE_CAN_SEE_ALL_LEADS) rows = rows.filter((l) => l.fe_username === s.username);
  return rows.map(pub);
}

async function leadIdTaken(id: string, exceptId: string | null) {
  const esc = id.replace(/[\\%_]/g, (c) => "\\" + c);
  const rows = ck(await sb.from("leads").select("lead_id").ilike("lead_id", esc));
  return rows.some((x: Any) => exceptId === null || x.lead_id.toLowerCase() !== exceptId.toLowerCase());
}

async function createLead(p: Any, s: Session) {
  const l = p.lead || {};
  const leadId = cleanText(l.lead_id, 60);
  const brand = cleanText(l.device_brand, 60), model = cleanText(l.device_model, 80);
  if (!leadId || !l.customer_id || !brand || !model) {
    throw new Error("Lead ID, customer, device brand and device model are required.");
  }
  await findCustomer(l.customer_id);
  if (await leadIdTaken(leadId, null)) throw new Error("This Lead ID already exists — check with Cashify.");

  const status = l.status || "Completed";
  if (!STATUSES.includes(status)) throw new Error("Invalid status.");

  const row = {
    lead_id: leadId,
    customer_id: l.customer_id,
    fe_username: s.role === "fe" ? s.username : (l.fe_username || ""),
    fe_name: s.role === "fe" ? s.name : (l.fe_name || ""),
    visit_date: l.visit_date || new Date().toISOString(),
    device_brand: brand,
    device_model: model,
    colour: cleanText(l.colour, 40),
    ram: cleanText(l.ram, 40),
    rom: cleanText(l.rom, 40),
    imei1: normalizeImei(l.imei1),
    accessories: normalizeAccessories(l.accessories) || "No accessories",
    expected_price: money(l.expected_price),
    purchase_price: money(l.purchase_price),
    commission: money(l.commission),
    commission_amount: money(l.commission_amount),
    status,
    remarks: cleanText(l.remarks, 1000),
    created_at: new Date().toISOString(),
  };
  return pub(ck(await sb.from("leads").insert(row).select().single()));
}

async function updateLead(p: Any, s: Session) {
  const lead = ck(await sb.from("leads").select("*").eq("lead_id", String(p.lead_id)).maybeSingle());
  if (!lead) throw new Error("Lead not found.");
  if (s.role === "fe" && lead.fe_username !== s.username) throw new Error("You can only edit your own leads.");

  const inp = p.patch || {};
  const patch: Any = {};
  LEAD_EDITABLE.forEach((k) => {
    if (inp[k] !== undefined) patch[k] = inp[k];
  });

  if (patch.lead_id !== undefined) {
    patch.lead_id = cleanText(patch.lead_id, 60);
    if (!patch.lead_id) throw new Error("Lead ID is required.");
    if (await leadIdTaken(patch.lead_id, lead.lead_id)) throw new Error("This Lead ID already exists — check with Cashify.");
  }
  ["device_brand", "device_model"].forEach((k) => {
    if (patch[k] !== undefined) {
      patch[k] = cleanText(patch[k], 80);
      if (!patch[k]) throw new Error("Device brand and model cannot be empty.");
    }
  });
  ["colour", "ram", "rom"].forEach((k) => {
    if (patch[k] !== undefined) patch[k] = cleanText(patch[k], 40);
  });
  if (patch.remarks !== undefined) patch.remarks = cleanText(patch.remarks, 1000);
  if (patch.imei1 !== undefined) patch.imei1 = normalizeImei(patch.imei1);
  if (patch.accessories !== undefined) patch.accessories = normalizeAccessories(patch.accessories);
  if (patch.status !== undefined && !STATUSES.includes(patch.status)) throw new Error("Invalid status.");
  NUM_COLS.forEach((k) => {
    if (patch[k] !== undefined) patch[k] = money(patch[k]);
  });

  patch.updated_at = new Date().toISOString();
  patch.updated_by = s.username;
  return pub(ck(await sb.from("leads").update(patch).eq("lead_id", lead.lead_id).select().single()));
}

// ---------- field executive management (admin) ----------
async function findFe(username: Any) {
  return ck(
    await sb.from("field_executives").select("*").eq("username", String(username || "").trim().toLowerCase()).maybeSingle(),
  );
}
async function requireFe(username: Any) {
  const fe = await findFe(username);
  if (!fe) throw new Error("Field executive not found.");
  return fe;
}

async function addFieldExecutive(p: Any) {
  const username = String(p.username || "").trim().toLowerCase();
  if (!/^[a-z0-9_.\-]{3,30}$/.test(username)) throw new Error("Username: 3-30 letters, digits, . _ -");
  if (!p.name || !p.password || String(p.password).length < 6) {
    throw new Error("Name and a password of 6+ characters are required.");
  }
  if (await findFe(username)) throw new Error("That username is already taken.");
  ck(await sb.from("field_executives").insert({
    username, name: String(p.name).trim(), password_hash: await hashPassword(p.password), active: true,
  }));
  return true;
}
async function updateFieldExecutive(p: Any) {
  const fe = await requireFe(p.username);
  if (!p.name || !String(p.name).trim()) throw new Error("Name is required.");
  ck(await sb.from("field_executives").update({ name: String(p.name).trim() }).eq("username", fe.username));
  return true;
}
async function setFieldExecutivePassword(p: Any) {
  if (!p.password || String(p.password).length < 6) throw new Error("Password must be 6+ characters.");
  const fe = await requireFe(p.username);
  ck(await sb.from("field_executives").update({ password_hash: await hashPassword(p.password) }).eq("username", fe.username));
  return true;
}
async function setFieldExecutiveActive(p: Any) {
  const fe = await requireFe(p.username);
  ck(await sb.from("field_executives").update({ active: !!p.active }).eq("username", fe.username));
  return true;
}

// ---------- routing ----------
const BOTH = ["fe", "admin"];
const ACTIONS: Record<string, { public?: boolean; roles?: string[]; fn: (p: Any, s: Session) => Promise<unknown> }> = {
  listFieldExecutives: { public: true, fn: listFieldExecutives },
  login: { public: true, fn: login },
  logout: { roles: BOTH, fn: logout },

  listCustomers: { roles: BOTH, fn: listCustomers },
  createCustomer: { roles: BOTH, fn: createCustomer },
  updateCustomer: { roles: BOTH, fn: updateCustomer },
  uploadIdProof: { roles: BOTH, fn: uploadIdProof },

  getDeviceMaster: { roles: BOTH, fn: getDeviceMaster },
  bootstrap: { roles: BOTH, fn: bootstrap },

  listLeads: { roles: BOTH, fn: listLeads },
  createLead: { roles: BOTH, fn: createLead },
  updateLead: { roles: BOTH, fn: updateLead },

  addFieldExecutive: { roles: ["admin"], fn: addFieldExecutive },
  updateFieldExecutive: { roles: ["admin"], fn: updateFieldExecutive },
  setFieldExecutivePassword: { roles: ["admin"], fn: setFieldExecutivePassword },
  setFieldExecutiveActive: { roles: ["admin"], fn: setFieldExecutiveActive },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method === "GET") return out({ ok: true, service: "field-ledger" });
  try {
    const body = JSON.parse(await req.text());
    const def = ACTIONS[body.action];
    if (!def) return out({ ok: false, error: "Unknown action" });

    let session: Session | null = null;
    if (!def.public) {
      session = await getSession(body.token);
      if (!session || !def.roles!.includes(session.role)) {
        return out({ ok: false, code: "AUTH", error: "Session expired — please log in again." });
      }
    }
    return out({ ok: true, data: await def.fn(body, session as Session) });
  } catch (err) {
    return out({ ok: false, error: String((err as Error)?.message || err) });
  }
});