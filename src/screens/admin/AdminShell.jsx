import { useState } from "react";
import { LogOut, TrendingUp, Search, SlidersHorizontal, Users } from "lucide-react";
import { C } from "../../constants/colors";
import { AdminOverview } from "./AdminOverview";
import { AdminSearch } from "./AdminSearch";
import { AdminLeadsFilters } from "./AdminLeadFilters";
import { AdminFes } from "./AdminFes";

const ADMIN_TABS = [
  { id: "overview", label: "Overview", Icon: TrendingUp },
  { id: "search", label: "Search", Icon: Search },
  { id: "leads", label: "Leads & filters", Icon: SlidersHorizontal },
  { id: "fes", label: "Field executives", Icon: Users },
];

// Remember the tab so returning from a customer page lands on the same tab.
const readTab = () => { try { return sessionStorage.getItem("adminTab") || "overview"; } catch { return "overview"; } };

export function AdminShell({ admin, onLogout, customers, leads, fes, setFes, flash, onOpenCustomer, onEditLead }) {
  const [tab, setTabState] = useState(readTab);
  const setTab = (t) => { setTabState(t); try { sessionStorage.setItem("adminTab", t); } catch { /* ignore */ } };

  return (
    <div style={{ minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderBottom: `1px solid ${C.line}`, background: "#fff" }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 19 }}>Field Ledger · Admin</div>
        <button onClick={onLogout} style={{ background: "none", border: "none", color: C.slate, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 13.5 }}>
          <LogOut size={16} /> Log out
        </button>
      </div>

      <div style={{ display: "flex", gap: 4, padding: "10px 24px 0", borderBottom: `1px solid ${C.line}`, background: "#fff", overflowX: "auto" }}>
        {ADMIN_TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", cursor: "pointer",
              background: "none", border: "none", whiteSpace: "nowrap",
              borderBottom: tab === t.id ? `2.5px solid ${C.ink}` : "2.5px solid transparent",
              color: tab === t.id ? C.ink : C.slate, fontWeight: 600, fontSize: 13.5,
            }}>
            <t.Icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "22px 24px 60px", maxWidth: 1100, margin: "0 auto" }}>
        {tab === "overview" && <AdminOverview customers={customers} leads={leads} fes={fes} />}
        {tab === "search" && <AdminSearch customers={customers} leads={leads} onOpenCustomer={onOpenCustomer} />}
        {tab === "leads" && <AdminLeadsFilters customers={customers} leads={leads} fes={fes} flash={flash} onOpenCustomer={onOpenCustomer} onEditLead={onEditLead} />}
        {tab === "fes" && <AdminFes fes={fes} setFes={setFes} leads={leads} flash={flash} />}
      </div>
    </div>
  );
}