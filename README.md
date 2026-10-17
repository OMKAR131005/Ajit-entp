# Field Ledger

Customer & lead tracking for device pickups — field-executive workflow, admin
dashboard, CSV export. Data lives in a **Google Sheet**; a small Google Apps
Script (`apps-script/Code.gs`) is the only thing that talks to it.

```
React app (Vercel)  ──POST──▶  Apps Script web app  ──▶  Google Sheet (data)
                                                     └─▶  Drive folder (ID-proof photos)
```

## 1. Set up the Sheet + script (5 min, one time)

1. Create a new Google Sheet (keep it private — share it only with admins).
2. **Extensions → Apps Script**, delete the sample code, paste in `apps-script/Code.gs`.
3. Pick `setup` in the function dropdown and click **Run**. Approve the permission
   prompts (Sheets + Drive). This creates the tabs `Customers`, `Leads`, `FieldExecutives`, `Admins`,
   `Devices`, `Lists`, a private Drive folder for ID proofs, and the demo accounts:
   - Field executives: `sangewar` / `dnyaneshwar` / `harish` / `ajit`, password `<username>123`
   - Admin: `admin` / `admin123`
4. **Deploy → New deployment → Web app** — *Execute as:* **Me**, *Who has access:* **Anyone**.
   Copy the Web app URL (ends in `/exec`).

**Change the demo passwords before real use.** Field executives: log in as admin →
*Field executives* → Edit. Admin: edit `NEW_PASSWORD` in `changeAdminPassword()`, run it once,
then set it back to `'CHANGE-ME'`.

When you edit `Code.gs` later, redeploy with **Deploy → Manage deployments → ✏️ → Version: New
version → Deploy** (the URL stays the same). Re-check that **Who has access** still says **Anyone**.
Updates that need new tabs or columns apply themselves on the first page load after redeploying.

## 2. Run locally

```bash
cp .env.example .env      # then paste your Web app URL into VITE_SHEETS_API_URL
npm install
npm run dev
```

## 3. Deploy to Vercel

1. Push to GitHub, then in Vercel: **Add New → Project**, import the repo (Vite is auto-detected).
2. Add one environment variable before deploying: `VITE_SHEETS_API_URL` = your Web app URL.
3. Deploy. `vercel.json` makes deep links like `/admin` work on refresh.

## Master lists: brands, models, colours, RAM, storage

The add-lead form and the edit form pick from two tabs in the Sheet (created and filled
automatically the first time the new script runs):

- **Devices** — one row per phone: `brand | model | ram_options | storage_options | colours`.
  The last three are comma-separated (e.g. `128 GB, 256 GB, 512 GB`). Leave them empty to use the
  shared defaults. **To add a new phone, add a row.** Apple rows already carry their own storage and
  colours; other brands start with model names only, so fill in the options as you go.
- **Lists** — the shared defaults: `colours | ram | storage`, one value per row.

Field executives see changes the next time they log in. Anything not in the lists can still be typed
in, so a brand-new phone never blocks a pickup. RAM isn't asked for iPhones.

## Notes

- **Login:** passwords are salted + hashed in the Sheet. A successful login returns a
  session token (valid 6 hours) that the server checks on every request; five wrong
  passwords lock that username for 15 minutes.
- **Editing leads:** a field executive can correct their own leads; an admin can correct any lead.
  Name / mobile / address of a customer can be corrected by an admin, or by an executive who has a
  lead for that customer. Every edit stamps `updated_at` / `updated_by` on the lead.
- **IMEI 1:** optional. Type it or tap **Scan** (uses the camera; needs HTTPS, which Vercel provides).
  It must be 15 digits with a valid check digit. A duplicate IMEI shows a warning but isn't blocked.
- **Accessories:** All Kit / Box / Charger / No accessories (default). Stored as text, e.g. `Box, Charger`.
- **Status** defaults to Completed.
- **Field executive visibility:** `FE_CAN_SEE_ALL_LEADS` at the top of `Code.gs` (default `true`,
  matching the old app) controls whether executives can see each other's leads. Set it to
  `false` to restrict them to their own — note that customer history, the IMEI duplicate warning and the
  Lead ID check in the wizard then only see that executive's leads.
- **ID proofs** are saved in the Drive folder *Field Ledger - ID proofs* (one sub-folder per
  customer). The `id_proof_path` column holds the file links.
- **Editing the Sheet by hand** is fine (fix a typo, add a row, reorder columns), but don't rename
  tabs or column headers. New columns added by an update appear on the right.
- **Limits:** each request takes ~1–2 s; a Sheet comfortably handles thousands of leads.
