/**
 * Field Ledger — Google Sheets backend (Apps Script Web App)
 *
 * Setup: open your Google Sheet -> Extensions -> Apps Script -> paste this
 * file -> run setup() once -> Deploy -> New deployment -> Web app
 * (Execute as: Me, Who has access: Anyone) -> copy the /exec URL.
 *
 * After changing this code later: Deploy -> Manage deployments -> edit
 * (pencil) -> Version: New version -> Deploy. The URL stays the same.
 *
 * SPEED: add an installable trigger once: Triggers -> Add trigger ->
 * onSheetEdit_ -> From spreadsheet -> On edit. It clears the read cache when
 * you edit the Sheet by hand (script writes invalidate the cache themselves).
 *
 * Tabs (created automatically): Customers, Leads, FieldExecutives, Admins,
 * Devices (master list of brands/models), Lists (colours / RAM / storage choices).
 *
 * Columns are found by their header NAME, so you may reorder columns in the Sheet.
 * Don't rename headers or tabs. New columns added by an update are appended on the right.
 */

// Bump when TABS changes: the next request adds any missing tabs/columns automatically.
const SCHEMA_VERSION = 2;

const TABS = {
  Customers: ['id', 'name', 'mobile', 'address', 'id_proof_type', 'id_proof_path', 'id_proof_file_name', 'created_at'],
  Leads: ['lead_id', 'customer_id', 'fe_username', 'fe_name', 'visit_date', 'device_brand', 'device_model',
          'expected_price', 'purchase_price', 'commission', 'commission_amount', 'status', 'remarks', 'created_at',
          'colour', 'ram', 'rom', 'accessories', 'imei1', 'updated_at', 'updated_by'],
  FieldExecutives: ['username', 'name', 'password_hash', 'active'],
  Admins: ['username', 'password_hash'],
  Devices: ['brand', 'model', 'ram_options', 'storage_options', 'colours'],
  Lists: ['colours', 'ram', 'storage'],
};

const STATUSES = ['Pending', 'Completed', 'Cancelled'];
const ACCESSORIES = ['All Kit', 'Box', 'Charger', 'No accessories'];

// Columns that are NOT plain text. Every other column is stored as text, which
// also stops anything a user types (e.g. "=IMPORTXML(...)") from being run as a formula.
const NON_TEXT = {
  Leads: ['expected_price', 'purchase_price', 'commission', 'commission_amount'],
  FieldExecutives: ['active'],
};

const SESSION_TTL_SECONDS = 6 * 60 * 60; // CacheService maximum: 6 hours
const MAX_LOGIN_FAILURES = 5;            // per username, locked for 15 minutes
const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;

// true  = a field executive can see every lead (same as the current app: customer
//         history across executives and duplicate Lead ID checks keep working).
// false = a field executive only receives their own leads.
const FE_CAN_SEE_ALL_LEADS = true;

const LEAD_EDITABLE = ['lead_id', 'visit_date', 'device_brand', 'device_model', 'colour', 'ram', 'rom', 'imei1',
                       'accessories', 'expected_price', 'purchase_price', 'commission', 'commission_amount',
                       'status', 'remarks'];

// ---- Read cache (speed) ----
// Tabs listed here are cached for N seconds. FieldExecutives/Admins are NOT cached
// (login must always see the latest password / active flag).
const CACHED_TABS = { Customers: 600, Leads: 600, Devices: 3600, Lists: 3600 };

// Write requests set this to true so they always read fresh data from the Sheet
// (a stale row number could otherwise update the wrong row).
let FORCE_FRESH_ = false;

// ------------------------------------------------------------------
// One-time setup
// ------------------------------------------------------------------

function setup() {
  PropertiesService.getScriptProperties().deleteProperty('schema_version');
  ensureSchema_(); // creates/updates every tab and fills the Devices + Lists master data

  // Demo accounts (same as the prototype). CHANGE THESE before real use.
  if (sheet_('Admins').getLastRow() < 2) {
    appendObj_('Admins', { username: 'admin', password_hash: hashPassword_('admin123') });
  }
  if (sheet_('FieldExecutives').getLastRow() < 2) {
    [['sangewar', 'Sangewar'], ['dnyaneshwar', 'Dnyaneshwar'], ['harish', 'Harish'], ['ajit', 'Ajit']]
      .forEach(function (fe) {
        appendObj_('FieldExecutives', {
          username: fe[0], name: fe[1], password_hash: hashPassword_(fe[0] + '123'), active: true,
        });
      });
  }
  idFolder_(); // creates the private Drive folder for ID proofs and asks for Drive permission
}

/**
 * Runs automatically on the first request after an update (and from setup()):
 * adds missing tabs and missing columns (on the right), and fills the master lists once.
 */
function ensureSchema_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('schema_version') === String(SCHEMA_VERSION)) return;
  withLock_(function () {
    if (props.getProperty('schema_version') === String(SCHEMA_VERSION)) return;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    Object.keys(TABS).forEach(function (name) {
      const sh = ss.getSheetByName(name) || ss.insertSheet(name);
      const want = TABS[name];
      if (sh.getLastRow() === 0) {
        sh.getRange(1, 1, 1, want.length).setValues([want]).setFontWeight('bold');
      } else {
        const have = headers_(sh);
        want.forEach(function (h) {
          if (have.indexOf(h) < 0) {
            sh.getRange(1, have.length + 1).setValue(h).setFontWeight('bold');
            have.push(h);
          }
        });
      }
      sh.setFrozenRows(1);
    });
    if (sheet_('Devices').getLastRow() < 2) seedDevices_();
    if (sheet_('Lists').getLastRow() < 2) seedLists_();
    Object.keys(CACHED_TABS).forEach(function (n) { cacheDrop_('tab_' + n); });
    props.setProperty('schema_version', String(SCHEMA_VERSION));
  });
}

/** Edit NEW_PASSWORD below, run this once from the editor, then put it back to 'CHANGE-ME'. */
function changeAdminPassword() {
  const NEW_PASSWORD = 'CHANGE-ME';
  if (NEW_PASSWORD === 'CHANGE-ME') throw new Error('Edit NEW_PASSWORD first.');
  const row = readAll_('Admins').filter(function (u) { return u.username === 'admin'; })[0];
  if (!row) throw new Error('No admin row found.');
  updateRow_('Admins', row._row, { password_hash: hashPassword_(NEW_PASSWORD) });
}

/**
 * Installable "On edit" trigger (see header). Clears the read cache when someone edits
 * the Sheet by hand, so the app never shows stale data for more than a moment.
 */
function onSheetEdit_(e) {
  try { cacheDrop_('tab_' + e.range.getSheet().getName()); } catch (err) { /* ignore */ }
}

// ------------------------------------------------------------------
// HTTP entry points
// ------------------------------------------------------------------

function doGet() {
  return out_({ ok: true, service: 'field-ledger' });
}

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    const def = ACTIONS[req.action];
    if (!def) return out_({ ok: false, error: 'Unknown action' });
    if (def.write) FORCE_FRESH_ = true; // writes never read from the cache
    ensureSchema_(); // before any lock is taken by the action itself

    let session = null;
    if (!def.public) {
      session = getSession_(req.token);
      if (!session || def.roles.indexOf(session.role) < 0) {
        return out_({ ok: false, code: 'AUTH', error: 'Session expired — please log in again.' });
      }
    }
    const data = def.write ? withLock_(function () { return def.fn(req, session); }) : def.fn(req, session);
    return out_({ ok: true, data: data });
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message || err) });
  }
}

const ACTIONS = {
  listFieldExecutives:       { public: true, fn: listFieldExecutives_ },
  login:                     { public: true, fn: login_ },
  logout:                    { roles: ['fe', 'admin'], fn: logout_ },

  listCustomers:             { roles: ['fe', 'admin'], fn: listCustomers_ },
  createCustomer:            { roles: ['fe', 'admin'], fn: createCustomer_, write: true },
  updateCustomer:            { roles: ['fe', 'admin'], fn: updateCustomer_, write: true },
  uploadIdProof:             { roles: ['fe', 'admin'], fn: uploadIdProof_ },

  getDeviceMaster:           { roles: ['fe', 'admin'], fn: getDeviceMaster_ },
  bootstrap:                  { roles: ['fe', 'admin'], fn: bootstrap_ },

  listLeads:                 { roles: ['fe', 'admin'], fn: listLeads_ },
  createLead:                { roles: ['fe', 'admin'], fn: createLead_, write: true },
  updateLead:                { roles: ['fe', 'admin'], fn: updateLead_, write: true },

  addFieldExecutive:         { roles: ['admin'], fn: addFieldExecutive_, write: true },
  updateFieldExecutive:      { roles: ['admin'], fn: updateFieldExecutive_, write: true },
  setFieldExecutivePassword: { roles: ['admin'], fn: setFieldExecutivePassword_, write: true },
  setFieldExecutiveActive:   { roles: ['admin'], fn: setFieldExecutiveActive_, write: true },
};

// ------------------------------------------------------------------
// Auth
// ------------------------------------------------------------------

function listFieldExecutives_() {
  return readAll_('FieldExecutives').map(function (u) {
    return { username: u.username, name: u.name, active: isActive_(u.active) };
  });
}

function login_(p) {
  const role = p.role === 'admin' ? 'admin' : 'fe';
  const username = String(p.username || '').trim().toLowerCase();
  const cache = CacheService.getScriptCache();
  const failKey = 'fail_' + username;
  if (Number(cache.get(failKey) || 0) >= MAX_LOGIN_FAILURES) {
    throw new Error('Too many failed attempts. Try again in 15 minutes.');
  }

  const users = readAll_(role === 'admin' ? 'Admins' : 'FieldExecutives');
  const user = users.filter(function (u) { return String(u.username).toLowerCase() === username; })[0];
  const ok = user && (role === 'admin' || isActive_(user.active)) && verifyPassword_(p.password, user.password_hash);

  if (!ok) {
    cache.put(failKey, String(Number(cache.get(failKey) || 0) + 1), 900);
    throw new Error('Incorrect username or password.');
  }
  cache.remove(failKey);

  const token = Utilities.getUuid() + Utilities.getUuid();
  const session = { role: role, username: user.username, name: user.name || 'Admin' };
  cache.put('s_' + token, JSON.stringify(session), SESSION_TTL_SECONDS);
  return { token: token, role: session.role, username: session.username, name: session.name };
}

function logout_(p) {
  CacheService.getScriptCache().remove('s_' + p.token);
  return true;
}

function getSession_(token) {
  if (!token) return null;
  const raw = CacheService.getScriptCache().get('s_' + token);
  return raw ? JSON.parse(raw) : null;
}

function hashPassword_(pw) {
  const salt = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  return salt + '$' + sha256_(salt + pw);
}

function verifyPassword_(pw, stored) {
  const parts = String(stored || '').split('$');
  return parts.length === 2 && sha256_(parts[0] + String(pw || '')) === parts[1];
}

function sha256_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function isActive_(v) {
  return v === true || String(v).toLowerCase() === 'true';
}

// ------------------------------------------------------------------
// Customers
// ------------------------------------------------------------------

function listCustomers_() {
  return readAll_('Customers').map(pub_);
}

function createCustomer_(p) {
  const c = p.customer || {};
  const name = cleanText_(c.name, 120), address = cleanText_(c.address, 400), mobile = cleanText_(c.mobile, 30);
  if (!name || !mobile || !address) throw new Error('Name, mobile and address are required.');
  if (last10_(mobile).length !== 10) throw new Error('Enter a valid 10-digit mobile number.');
  const existing = readAll_('Customers');
  if (existing.some(function (x) { return last10_(x.mobile) === last10_(mobile); })) {
    throw new Error('A customer with this mobile number already exists — go back and search again.');
  }
  const row = {
    id: nextId_('customer_seq', 'CUST-', existing.map(function (x) { return x.id; })),
    name: name,
    mobile: mobile,
    address: address,
    id_proof_type: '',
    id_proof_path: '',
    id_proof_file_name: '',
    created_at: new Date().toISOString(),
  };
  appendObj_('Customers', row);
  return row;
}

function updateCustomer_(p, s) {
  const cust = findCustomer_(p.customer_id);
  const inp = p.patch || {};
  const patch = {};

  ['id_proof_type', 'id_proof_path', 'id_proof_file_name'].forEach(function (k) {
    if (inp[k] !== undefined) patch[k] = String(inp[k]);
  });

  // Correcting name / mobile / address: admin, or a field executive who has a lead for this customer.
  if (['name', 'mobile', 'address'].some(function (k) { return inp[k] !== undefined; })) {
    if (s.role === 'fe') {
      const mine = readAll_('Leads').some(function (l) { return l.customer_id === cust.id && l.fe_username === s.username; });
      if (!mine) throw new Error('You can only edit customers you have a lead for.');
    }
    if (inp.name !== undefined) patch.name = cleanText_(inp.name, 120);
    if (inp.address !== undefined) patch.address = cleanText_(inp.address, 400);
    if (inp.mobile !== undefined) patch.mobile = cleanText_(inp.mobile, 30);
    if (patch.name !== undefined && !patch.name) throw new Error('Name is required.');
    if (patch.address !== undefined && !patch.address) throw new Error('Address is required.');
    if (patch.mobile !== undefined) {
      if (last10_(patch.mobile).length !== 10) throw new Error('Enter a valid 10-digit mobile number.');
      const clash = readAll_('Customers').some(function (x) { return x.id !== cust.id && last10_(x.mobile) === last10_(patch.mobile); });
      if (clash) throw new Error('Another customer already has this mobile number.');
    }
  }
  updateRow_('Customers', cust._row, patch);
  return pub_(Object.assign({}, cust, patch));
}

function findCustomer_(id) {
  const cust = readAll_('Customers').filter(function (c) { return c.id === id; })[0];
  if (!cust) throw new Error('Customer not found.');
  return cust;
}

/** Saves one ID-proof file to Drive (one sub-folder per customer). Returns a Drive link. */
function uploadIdProof_(p) {
  const cust = findCustomer_(p.customer_id);
  const f = p.file || {};
  if (!f.base64) throw new Error('No file received.');
  const mime = f.mimeType || 'image/jpeg';
  if (!/^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/.test(mime)) throw new Error('Unsupported file type.');
  const bytes = Utilities.base64Decode(f.base64);
  if (bytes.length > MAX_UPLOAD_BYTES) throw new Error('File is too large.');

  const type = String(p.type || 'ID').replace(/[^\w\-]+/g, '_');
  const safeName = String(f.fileName || 'proof').replace(/[^\w.\-]+/g, '_');
  const blob = Utilities.newBlob(bytes, mime, type + '_' + Date.now() + '_' + safeName);
  const file = customerFolder_(cust.id).createFile(blob); // private to the account that owns the script
  return { path: file.getUrl(), name: f.fileName || safeName };
}

// The folder id per customer is cached, so repeat uploads skip the slow Drive folder search.
function customerFolder_(customerId) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('cf_' + customerId);
  if (cached) {
    try { return DriveApp.getFolderById(cached); } catch (e) { /* folder gone, recreate below */ }
  }
  return withLock_(function () {
    const root = idFolder_();
    const it = root.getFoldersByName(customerId);
    const folder = it.hasNext() ? it.next() : root.createFolder(customerId);
    cache.put('cf_' + customerId, folder.getId(), 21600);
    return folder;
  });
}

function idFolder_() {
  const props = PropertiesService.getScriptProperties();
  const saved = props.getProperty('id_folder');
  if (saved) {
    try { return DriveApp.getFolderById(saved); } catch (e) { /* recreate below */ }
  }
  const folder = DriveApp.createFolder('Field Ledger - ID proofs');
  props.setProperty('id_folder', folder.getId());
  return folder;
}

// ------------------------------------------------------------------
// Device master (Devices + Lists tabs) — edited by hand in the Sheet
// ------------------------------------------------------------------

// One call instead of three: customers + leads + device master together, the moment someone
// logs in. Fewer simultaneous requests against the account-wide 30-at-once Apps Script limit,
// which is what was behind the empty field-executive dropdown and "Unexpected response" errors.
function bootstrap_(p, s) {
  return {
    customers: listCustomers_(),
    leads: listLeads_(p, s),
    deviceMaster: getDeviceMaster_(),
  };
}

function getDeviceMaster_() {
  const devices = readAll_('Devices').map(function (r) {
    return {
      brand: cleanText_(r.brand, 60),
      model: cleanText_(r.model, 80),
      ram_options: splitList_(r.ram_options),
      storage_options: splitList_(r.storage_options),
      colours: splitList_(r.colours),
    };
  }).filter(function (d) { return d.brand && d.model; });

  const rows = readAll_('Lists');
  const col = function (k) {
    return rows.map(function (r) { return cleanText_(r[k], 40); }).filter(Boolean);
  };
  return { devices: devices, lists: { colours: col('colours'), ram: col('ram'), storage: col('storage') } };
}

function splitList_(v) {
  return String(v == null ? '' : v).split(/[,;|\n]/).map(function (x) { return x.trim(); }).filter(Boolean);
}

// ------------------------------------------------------------------
// Leads
// ------------------------------------------------------------------

function listLeads_(p, s) {
  let rows = readAll_('Leads');
  if (s.role === 'fe' && !FE_CAN_SEE_ALL_LEADS) {
    rows = rows.filter(function (l) { return l.fe_username === s.username; });
  }
  return rows.map(pub_);
}

function createLead_(p, s) {
  const l = p.lead || {};
  const leadId = cleanText_(l.lead_id, 60);
  const brand = cleanText_(l.device_brand, 60), model = cleanText_(l.device_model, 80);
  if (!leadId || !l.customer_id || !brand || !model) {
    throw new Error('Lead ID, customer, device brand and device model are required.');
  }
  findCustomer_(l.customer_id);
  if (leadIdTaken_(leadId, null)) throw new Error('This Lead ID already exists — check with Cashify.');

  const status = l.status || 'Completed';
  if (STATUSES.indexOf(status) < 0) throw new Error('Invalid status.');

  const row = {
    lead_id: leadId,
    customer_id: l.customer_id,
    fe_username: s.role === 'fe' ? s.username : (l.fe_username || ''),
    fe_name: s.role === 'fe' ? s.name : (l.fe_name || ''),
    visit_date: l.visit_date || new Date().toISOString(),
    device_brand: brand,
    device_model: model,
    colour: cleanText_(l.colour, 40),
    ram: cleanText_(l.ram, 40),
    rom: cleanText_(l.rom, 40),
    imei1: normalizeImei_(l.imei1),
    accessories: normalizeAccessories_(l.accessories) || 'No accessories',
    expected_price: money_(l.expected_price),
    purchase_price: money_(l.purchase_price),
    commission: money_(l.commission),
    commission_amount: money_(l.commission_amount),
    status: status,
    remarks: cleanText_(l.remarks, 1000),
    created_at: new Date().toISOString(),
  };
  appendObj_('Leads', row);
  return row;
}

function updateLead_(p, s) {
  const lead = readAll_('Leads').filter(function (l) { return l.lead_id === p.lead_id; })[0];
  if (!lead) throw new Error('Lead not found.');
  if (s.role === 'fe' && lead.fe_username !== s.username) throw new Error('You can only edit your own leads.');

  const inp = p.patch || {};
  const patch = {};
  LEAD_EDITABLE.forEach(function (k) { if (inp[k] !== undefined) patch[k] = inp[k]; });

  if (patch.lead_id !== undefined) {
    patch.lead_id = cleanText_(patch.lead_id, 60);
    if (!patch.lead_id) throw new Error('Lead ID is required.');
    if (leadIdTaken_(patch.lead_id, lead.lead_id)) throw new Error('This Lead ID already exists — check with Cashify.');
  }
  ['device_brand', 'device_model'].forEach(function (k) {
    if (patch[k] !== undefined) {
      patch[k] = cleanText_(patch[k], 80);
      if (!patch[k]) throw new Error('Device brand and model cannot be empty.');
    }
  });
  ['colour', 'ram', 'rom'].forEach(function (k) { if (patch[k] !== undefined) patch[k] = cleanText_(patch[k], 40); });
  if (patch.remarks !== undefined) patch.remarks = cleanText_(patch.remarks, 1000);
  if (patch.imei1 !== undefined) patch.imei1 = normalizeImei_(patch.imei1);
  if (patch.accessories !== undefined) patch.accessories = normalizeAccessories_(patch.accessories);
  if (patch.status !== undefined && STATUSES.indexOf(patch.status) < 0) throw new Error('Invalid status.');
  ['expected_price', 'purchase_price', 'commission', 'commission_amount'].forEach(function (k) {
    if (patch[k] !== undefined) patch[k] = money_(patch[k]);
  });

  patch.updated_at = new Date().toISOString();
  patch.updated_by = s.username;
  updateRow_('Leads', lead._row, patch);
  return pub_(Object.assign({}, lead, patch));
}

function leadIdTaken_(id, exceptId) {
  const want = String(id).toLowerCase();
  return readAll_('Leads').some(function (x) {
    const have = String(x.lead_id).toLowerCase();
    return have === want && (exceptId === null || have !== String(exceptId).toLowerCase());
  });
}

// ------------------------------------------------------------------
// Validation helpers
// ------------------------------------------------------------------

function cleanText_(v, max) {
  return String(v == null ? '' : v).trim().slice(0, max || 200);
}

function money_(v) {
  const n = Number(v);
  if (isNaN(n) || n < 0) return 0;
  return n;
}

function last10_(s) {
  return String(s == null ? '' : s).replace(/\D/g, '').slice(-10);
}

function luhnOk_(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits.charAt(digits.length - 1 - i));
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

/** '' is allowed (IMEI is optional); otherwise it must be a 15-digit number with a valid check digit. */
function normalizeImei_(v) {
  const s = String(v == null ? '' : v).replace(/[\s-]/g, '');
  if (!s) return '';
  if (!/^\d{15}$/.test(s) || !luhnOk_(s)) throw new Error('IMEI must be a valid 15-digit number.');
  return s;
}

/** Returns 'Box, Charger' style text, 'All Kit', 'No accessories', or '' when nothing was given. */
function normalizeAccessories_(v) {
  const parts = (Array.isArray(v) ? v : String(v == null ? '' : v).split(','))
    .map(function (x) { return String(x).trim(); }).filter(Boolean);
  if (!parts.length) return '';
  parts.forEach(function (x) { if (ACCESSORIES.indexOf(x) < 0) throw new Error('Unknown accessory: ' + x); });
  if (parts.indexOf('All Kit') >= 0) return 'All Kit';
  if (parts.indexOf('No accessories') >= 0) return 'No accessories';
  return ACCESSORIES.filter(function (a) { return parts.indexOf(a) >= 0; }).join(', ');
}

// ------------------------------------------------------------------
// Field executive management (admin only)
// ------------------------------------------------------------------

function addFieldExecutive_(p) {
  const username = String(p.username || '').trim().toLowerCase();
  if (!/^[a-z0-9_.\-]{3,30}$/.test(username)) throw new Error('Username: 3-30 letters, digits, . _ -');
  if (!p.name || !p.password || String(p.password).length < 6) throw new Error('Name and a password of 6+ characters are required.');
  if (findFe_(username)) throw new Error('That username is already taken.');
  appendObj_('FieldExecutives', {
    username: username, name: String(p.name).trim(), password_hash: hashPassword_(p.password), active: true,
  });
  return true;
}

function updateFieldExecutive_(p) {
  const fe = requireFe_(p.username);
  if (!p.name || !String(p.name).trim()) throw new Error('Name is required.');
  updateRow_('FieldExecutives', fe._row, { name: String(p.name).trim() });
  return true;
}

function setFieldExecutivePassword_(p) {
  if (!p.password || String(p.password).length < 6) throw new Error('Password must be 6+ characters.');
  const fe = requireFe_(p.username);
  updateRow_('FieldExecutives', fe._row, { password_hash: hashPassword_(p.password) });
  return true;
}

function setFieldExecutiveActive_(p) {
  const fe = requireFe_(p.username);
  updateRow_('FieldExecutives', fe._row, { active: !!p.active });
  return true;
}

function findFe_(username) {
  return readAll_('FieldExecutives').filter(function (u) {
    return String(u.username).toLowerCase() === String(username).toLowerCase();
  })[0];
}

function requireFe_(username) {
  const fe = findFe_(username);
  if (!fe) throw new Error('Field executive not found.');
  return fe;
}


// ------------------------------------------------------------------
// Sheet helpers
// ------------------------------------------------------------------

function sheet_(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Missing tab "' + name + '". Run setup() first.');
  return sh;
}

function headers_(sh) {
  if (sh.getLastColumn() < 1) return [];
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
}

function isText_(tab, col) {
  return (NON_TEXT[tab] || []).indexOf(col) < 0;
}

/** Cached read for the tabs in CACHED_TABS; write requests (FORCE_FRESH_) always read the Sheet. */
function readAll_(name) {
  const ttl = CACHED_TABS[name];
  if (!ttl || FORCE_FRESH_) return readAllRaw_(name);
  const hit = cacheGet_('tab_' + name);
  if (hit) return hit;
  const rows = readAllRaw_(name);
  cachePut_('tab_' + name, rows, ttl);
  return rows;
}

function readAllRaw_(name) {
  const values = sheet_(name).getDataRange().getValues();
  const headers = values.shift().map(function (h) { return String(h).trim(); });
  const rows = [];
  values.forEach(function (r, i) {
    if (!r.some(function (c) { return c !== ''; })) return;
    const o = {};
    headers.forEach(function (h, j) { o[h] = r[j] instanceof Date ? r[j].toISOString() : r[j]; });
    o._row = i + 2;
    rows.push(o);
  });
  return rows;
}

function appendObj_(name, obj) {
  const sh = sheet_(name);
  const cols = headers_(sh); // columns are matched by header name, so their order in the Sheet doesn't matter
  const row = sh.getLastRow() + 1;
  if (row > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 200);
  const range = sh.getRange(row, 1, 1, cols.length);
  range.setNumberFormats([cols.map(function (c) { return isText_(name, c) ? '@' : '0.###############'; })]);
  range.setValues([cols.map(function (c) {
    const v = obj[c] === undefined || obj[c] === null ? '' : obj[c];
    return isText_(name, c) ? String(v) : v;
  })]);
  cacheDrop_('tab_' + name);
}

/** Reads the row once, patches it in memory, writes it back once (2-3 calls instead of ~2 per field). */
function updateRow_(name, row, patch) {
  const sh = sheet_(name);
  const cols = headers_(sh);
  const range = sh.getRange(row, 1, 1, cols.length);
  const vals = range.getValues()[0];
  const fmts = range.getNumberFormats()[0];
  Object.keys(patch).forEach(function (k) {
    const i = cols.indexOf(k);
    if (i < 0) return;
    if (isText_(name, k)) { fmts[i] = '@'; vals[i] = String(patch[k]); }
    else vals[i] = patch[k];
  });
  range.setNumberFormats([fmts]);
  range.setValues([vals]);
  cacheDrop_('tab_' + name);
}

function pub_(o) {
  const c = Object.assign({}, o);
  delete c._row;
  delete c.password_hash;
  return c;
}

/** Next id like CUST-00007. Never reuses an id that is already in the Sheet, even if the counter is behind. */
function nextId_(key, prefix, existingIds) {
  const props = PropertiesService.getScriptProperties();
  let n = Number(props.getProperty(key) || 0);
  (existingIds || []).forEach(function (id) {
    const m = String(id).match(/(\d+)$/);
    if (m && Number(m[1]) > n) n = Number(m[1]);
  });
  n += 1;
  props.setProperty(key, String(n));
  return prefix + String(n).padStart(5, '0');
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ------------------------------------------------------------------
// Read cache helpers (CacheService, values split into chunks because one value is limited to 100KB)
// ------------------------------------------------------------------

function cacheGet_(key) {
  const c = CacheService.getScriptCache();
  const n = Number(c.get(key + ':n') || 0);
  if (!n) return null;
  const keys = [];
  for (let i = 0; i < n; i++) keys.push(key + ':' + i);
  const parts = c.getAll(keys);
  let s = '';
  for (let i = 0; i < n; i++) {
    if (parts[keys[i]] == null) return null;
    s += parts[keys[i]];
  }
  try { return JSON.parse(s); } catch (e) { return null; }
}

function cachePut_(key, obj, ttl) {
  const s = JSON.stringify(obj);
  const SZ = 30000; // chars per chunk; safe for UTF-8 text, limit is 100KB per value
  const n = Math.ceil(s.length / SZ) || 1;
  const map = {};
  for (let i = 0; i < n; i++) map[key + ':' + i] = s.substr(i * SZ, SZ);
  map[key + ':n'] = String(n);
  try { CacheService.getScriptCache().putAll(map, ttl); } catch (e) { /* too big for the cache: skip, just slower */ }
}

function cacheDrop_(key) {
  const c = CacheService.getScriptCache();
  const n = Number(c.get(key + ':n') || 0);
  const keys = [key + ':n'];
  for (let i = 0; i < n; i++) keys.push(key + ':' + i);
  c.removeAll(keys);
}

// ------------------------------------------------------------------
// Seed data for the Devices + Lists tabs (written once; edit them in the Sheet afterwards)
//
// Devices: one row per model. ram_options / storage_options / colours are comma-separated.
// Leave them empty to use the defaults from the Lists tab. Add new phones as new rows.
// ------------------------------------------------------------------

function seedLists_() {
  const colours = ['Black', 'White', 'Silver', 'Gold', 'Grey', 'Blue', 'Green', 'Red', 'Purple', 'Pink', 'Yellow', 'Orange', 'Titanium'];
  const ram = ['2 GB', '3 GB', '4 GB', '6 GB', '8 GB', '12 GB', '16 GB', '18 GB', '24 GB'];
  const storage = ['16 GB', '32 GB', '64 GB', '128 GB', '256 GB', '512 GB', '1 TB', '2 TB'];
  const n = Math.max(colours.length, ram.length, storage.length);
  const rows = [];
  for (let i = 0; i < n; i++) rows.push([colours[i] || '', ram[i] || '', storage[i] || '']);
  const sh = sheet_('Lists');
  sh.getRange(2, 1, rows.length, 3).setNumberFormat('@').setValues(rows);
}

function seedDevices_() {
  const rows = [];
  // Apple: storage and colours per model (RAM isn't shown for iPhones in the app).
  [
    ['iPhone XR', '64 GB, 128 GB, 256 GB', 'Black, White, Blue, Yellow, Coral, Red'],
    ['iPhone XS', '64 GB, 256 GB, 512 GB', 'Space Gray, Silver, Gold'],
    ['iPhone XS Max', '64 GB, 256 GB, 512 GB', 'Space Gray, Silver, Gold'],
    ['iPhone 11', '64 GB, 128 GB, 256 GB', 'Black, White, Green, Yellow, Purple, Red'],
    ['iPhone 11 Pro', '64 GB, 256 GB, 512 GB', 'Space Gray, Silver, Gold, Midnight Green'],
    ['iPhone 11 Pro Max', '64 GB, 256 GB, 512 GB', 'Space Gray, Silver, Gold, Midnight Green'],
    ['iPhone SE (2020)', '64 GB, 128 GB, 256 GB', 'Black, White, Red'],
    ['iPhone SE (2022)', '64 GB, 128 GB, 256 GB', 'Midnight, Starlight, Red'],
    ['iPhone 12 mini', '64 GB, 128 GB, 256 GB', 'Black, White, Red, Green, Blue, Purple'],
    ['iPhone 12', '64 GB, 128 GB, 256 GB', 'Black, White, Red, Green, Blue, Purple'],
    ['iPhone 12 Pro', '128 GB, 256 GB, 512 GB', 'Graphite, Silver, Gold, Pacific Blue'],
    ['iPhone 12 Pro Max', '128 GB, 256 GB, 512 GB', 'Graphite, Silver, Gold, Pacific Blue'],
    ['iPhone 13 mini', '128 GB, 256 GB, 512 GB', 'Midnight, Starlight, Blue, Pink, Red, Green'],
    ['iPhone 13', '128 GB, 256 GB, 512 GB', 'Midnight, Starlight, Blue, Pink, Red, Green'],
    ['iPhone 13 Pro', '128 GB, 256 GB, 512 GB, 1 TB', 'Graphite, Gold, Silver, Sierra Blue, Alpine Green'],
    ['iPhone 13 Pro Max', '128 GB, 256 GB, 512 GB, 1 TB', 'Graphite, Gold, Silver, Sierra Blue, Alpine Green'],
    ['iPhone 14', '128 GB, 256 GB, 512 GB', 'Midnight, Starlight, Blue, Purple, Red, Yellow'],
    ['iPhone 14 Plus', '128 GB, 256 GB, 512 GB', 'Midnight, Starlight, Blue, Purple, Red, Yellow'],
    ['iPhone 14 Pro', '128 GB, 256 GB, 512 GB, 1 TB', 'Space Black, Silver, Gold, Deep Purple'],
    ['iPhone 14 Pro Max', '128 GB, 256 GB, 512 GB, 1 TB', 'Space Black, Silver, Gold, Deep Purple'],
    ['iPhone 15', '128 GB, 256 GB, 512 GB', 'Black, Blue, Green, Yellow, Pink'],
    ['iPhone 15 Plus', '128 GB, 256 GB, 512 GB', 'Black, Blue, Green, Yellow, Pink'],
    ['iPhone 15 Pro', '128 GB, 256 GB, 512 GB, 1 TB', 'Black Titanium, White Titanium, Blue Titanium, Natural Titanium'],
    ['iPhone 15 Pro Max', '256 GB, 512 GB, 1 TB', 'Black Titanium, White Titanium, Blue Titanium, Natural Titanium'],
    ['iPhone 16e', '128 GB, 256 GB, 512 GB', 'Black, White'],
    ['iPhone 16', '128 GB, 256 GB, 512 GB', 'Black, White, Pink, Teal, Ultramarine'],
    ['iPhone 16 Plus', '128 GB, 256 GB, 512 GB', 'Black, White, Pink, Teal, Ultramarine'],
    ['iPhone 16 Pro', '128 GB, 256 GB, 512 GB, 1 TB', 'Black Titanium, White Titanium, Natural Titanium, Desert Titanium'],
    ['iPhone 16 Pro Max', '256 GB, 512 GB, 1 TB', 'Black Titanium, White Titanium, Natural Titanium, Desert Titanium'],
    ['iPhone 17', '', ''],
    ['iPhone Air', '', ''],
    ['iPhone 17 Pro', '', ''],
    ['iPhone 17 Pro Max', '', ''],
  ].forEach(function (m) { rows.push(['Apple', m[0], '', m[1], m[2]]); });

  // Other brands: model names only — RAM / storage / colours fall back to the Lists tab
  // until you fill them in for a model.
  const OTHERS = {
    Samsung: 'Galaxy S20|Galaxy S20 FE|Galaxy S20 Ultra|Galaxy S21|Galaxy S21+|Galaxy S21 Ultra|Galaxy S21 FE|Galaxy S22|Galaxy S22+|Galaxy S22 Ultra|Galaxy S23|Galaxy S23+|Galaxy S23 Ultra|Galaxy S23 FE|Galaxy S24|Galaxy S24+|Galaxy S24 Ultra|Galaxy S24 FE|Galaxy S25|Galaxy S25+|Galaxy S25 Ultra|Galaxy S25 Edge|Galaxy S25 FE|Galaxy Note 10|Galaxy Note 10+|Galaxy Note 20|Galaxy Note 20 Ultra|Galaxy Z Flip 3|Galaxy Z Flip 4|Galaxy Z Flip 5|Galaxy Z Flip 6|Galaxy Z Flip 7|Galaxy Z Fold 3|Galaxy Z Fold 4|Galaxy Z Fold 5|Galaxy Z Fold 6|Galaxy Z Fold 7|Galaxy A12|Galaxy A13|Galaxy A14|Galaxy A15|Galaxy A16|Galaxy A22|Galaxy A23|Galaxy A24|Galaxy A25|Galaxy A26|Galaxy A32|Galaxy A33|Galaxy A34|Galaxy A35|Galaxy A36|Galaxy A50|Galaxy A51|Galaxy A52|Galaxy A53|Galaxy A54|Galaxy A55|Galaxy A56|Galaxy A71|Galaxy A72|Galaxy A73|Galaxy M13|Galaxy M14|Galaxy M15|Galaxy M31|Galaxy M32|Galaxy M33|Galaxy M34|Galaxy M35|Galaxy M51|Galaxy M52|Galaxy M53|Galaxy M54|Galaxy M55|Galaxy F13|Galaxy F14|Galaxy F15|Galaxy F23|Galaxy F34|Galaxy F54',
    Redmi: 'Redmi Note 8|Redmi Note 9|Redmi Note 9 Pro|Redmi Note 10|Redmi Note 10 Pro|Redmi Note 10S|Redmi Note 11|Redmi Note 11 Pro|Redmi Note 11 Pro+|Redmi Note 11S|Redmi Note 12|Redmi Note 12 Pro|Redmi Note 12 Pro+|Redmi Note 13|Redmi Note 13 Pro|Redmi Note 13 Pro+|Redmi Note 14|Redmi Note 14 Pro|Redmi Note 14 Pro+|Redmi 9A|Redmi 9 Prime|Redmi 10|Redmi 10 Prime|Redmi 11 Prime|Redmi 12|Redmi 12C|Redmi 13|Redmi 13C|Redmi 14C|Redmi A3|Redmi A4|Redmi K50|Redmi K50i',
    Xiaomi: 'Mi 10T|Mi 11X|Xiaomi 11T Pro|Xiaomi 12|Xiaomi 12 Pro|Xiaomi 13|Xiaomi 13 Pro|Xiaomi 13T|Xiaomi 13T Pro|Xiaomi 14|Xiaomi 14 Ultra|Xiaomi 14T|Xiaomi 14T Pro|Xiaomi 15|Xiaomi 15 Ultra',
    Poco: 'Poco X3|Poco X3 Pro|Poco X4 Pro|Poco X5|Poco X5 Pro|Poco X6|Poco X6 Pro|Poco X7|Poco X7 Pro|Poco M4 Pro|Poco M5|Poco M6|Poco M6 Pro|Poco M7|Poco C55|Poco C65|Poco F4|Poco F5|Poco F6|Poco F7',
    OnePlus: 'OnePlus 7T|OnePlus 8|OnePlus 8T|OnePlus 8 Pro|OnePlus 9|OnePlus 9R|OnePlus 9RT|OnePlus 9 Pro|OnePlus 10R|OnePlus 10T|OnePlus 10 Pro|OnePlus 11|OnePlus 11R|OnePlus 12|OnePlus 12R|OnePlus 13|OnePlus 13R|OnePlus Nord|OnePlus Nord 2|OnePlus Nord 2T|OnePlus Nord 3|OnePlus Nord 4|OnePlus Nord 5|OnePlus Nord CE|OnePlus Nord CE 2|OnePlus Nord CE 2 Lite|OnePlus Nord CE 3|OnePlus Nord CE 3 Lite|OnePlus Nord CE 4|OnePlus Nord CE 4 Lite|OnePlus Nord CE 5',
    Vivo: 'Vivo Y12|Vivo Y15|Vivo Y20|Vivo Y21|Vivo Y22|Vivo Y27|Vivo Y28|Vivo Y29|Vivo Y36|Vivo Y56|Vivo Y58|Vivo Y100|Vivo Y200|Vivo V20|Vivo V21|Vivo V23|Vivo V25|Vivo V27|Vivo V29|Vivo V30|Vivo V40|Vivo V50|Vivo T1|Vivo T2|Vivo T3|Vivo X60|Vivo X70 Pro|Vivo X80|Vivo X90|Vivo X100|Vivo X200',
    iQOO: 'iQOO 7|iQOO 9|iQOO 9T|iQOO 11|iQOO 12|iQOO 13|iQOO Neo 6|iQOO Neo 7|iQOO Neo 9 Pro|iQOO Neo 10R|iQOO Z6|iQOO Z7|iQOO Z9|iQOO Z9x',
    Oppo: 'Oppo A15|Oppo A16|Oppo A17|Oppo A31|Oppo A53|Oppo A54|Oppo A57|Oppo A58|Oppo A59|Oppo A74|Oppo A78|Oppo A79|Oppo A3|Oppo A5|Oppo A18|Oppo F17|Oppo F19|Oppo F21 Pro|Oppo F23|Oppo F25 Pro|Oppo F27|Oppo Reno 5|Oppo Reno 6|Oppo Reno 7|Oppo Reno 8|Oppo Reno 10|Oppo Reno 11|Oppo Reno 12|Oppo Reno 13|Oppo K10|Oppo K12x',
    Realme: 'Realme Narzo 30|Realme Narzo 50|Realme Narzo 60|Realme Narzo 70|Realme 8|Realme 9 Pro|Realme 10 Pro|Realme 11|Realme 11 Pro|Realme 12|Realme 12 Pro|Realme 13|Realme 13 Pro|Realme 14 Pro|Realme C11|Realme C21|Realme C25|Realme C33|Realme C35|Realme C53|Realme C55|Realme C63|Realme C65|Realme GT|Realme GT Neo 3|Realme GT 6|Realme P1|Realme P2 Pro',
    Motorola: 'Moto G31|Moto G32|Moto G34|Moto G42|Moto G45|Moto G54|Moto G60|Moto G62|Moto G84|Moto G85|Moto Edge 30|Moto Edge 30 Fusion|Moto Edge 40|Moto Edge 40 Neo|Moto Edge 50 Fusion|Moto Edge 50 Pro|Moto Edge 60|Moto Razr 40|Moto Razr 50',
    Google: 'Pixel 6|Pixel 6 Pro|Pixel 6a|Pixel 7|Pixel 7 Pro|Pixel 7a|Pixel 8|Pixel 8 Pro|Pixel 8a|Pixel 9|Pixel 9 Pro|Pixel 9 Pro XL|Pixel 9 Pro Fold|Pixel 9a|Pixel 10|Pixel 10 Pro|Pixel 10 Pro XL',
    Nothing: 'Phone (1)|Phone (2)|Phone (2a)|Phone (2a) Plus|Phone (3a)|Phone (3a) Pro|Phone (3)|CMF Phone 1|CMF Phone 2 Pro',
    Infinix: 'Infinix Note 30|Infinix Note 40|Infinix Hot 30|Infinix Hot 40|Infinix Zero 30|Infinix Smart 8',
    Tecno: 'Tecno Spark 10|Tecno Spark 20|Tecno Pova 5|Tecno Pova 6|Tecno Camon 20',
    Asus: 'ROG Phone 6|ROG Phone 7|ROG Phone 8|Zenfone 8|Zenfone 9|Zenfone 10|Zenfone 11 Ultra',
  };
  Object.keys(OTHERS).forEach(function (brand) {
    OTHERS[brand].split('|').forEach(function (model) { rows.push([brand, model, '', '', '']); });
  });

  const sh = sheet_('Devices');
  sh.getRange(2, 1, rows.length, 5).setNumberFormat('@').setValues(rows);
}
