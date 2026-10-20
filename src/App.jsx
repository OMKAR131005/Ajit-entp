import { useState, useEffect, useCallback } from "react";
import { Routes, Route, useNavigate, useParams, useLocation, Navigate } from "react-router-dom";
import { api } from "./sheetsApi";
import { C } from "./constants/colors";
import { Shell } from "./componets/ui/Shell";
import { Toast } from "./componets/ui/Toast";
import { LoginScreen } from "./screens/LoginScreen";
import { FeDashboard } from "./screens/FeDashboard";
import { CustomerProfile } from "./screens/CustomerProfile";
import { AddLeadWizard } from "./screens/wizard/AddLeadWizard";
import { initialWizard } from "./screens/wizard/InitialWizard";
import { AdminShell } from "./screens/admin/AdminShell";
import { EditLeadModal } from "./screens/edit/EditLeadModal";
import { EditCustomerModal } from "./screens/edit/EditCustomerModal";
import { toCamelCustomer, toCamelLead, toCamelFe } from "./utils/mappers";
import { buildMaster, EMPTY_MASTER } from "./utils/master";

const byName = (a, b) => String(a.name).localeCompare(String(b.name));
const byCreated = (a, b) => String(a.createdAt).localeCompare(String(b.createdAt));

function loadSession() {
  try {
    if (!api.hasSession()) return null; // login token is gone (new tab / expired) -> log in again
    const saved = sessionStorage.getItem("session");
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [toast, setToast] = useState(null);

  const [customers, setCustomers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [fes, setFes] = useState([]);
  const [session, setSession] = useState(loadSession);
  const [wizard, setWizard] = useState(null);
  const [master, setMaster] = useState(EMPTY_MASTER);
  const [editingLeadId, setEditingLeadId] = useState(null);
  const [editingCustomerId, setEditingCustomerId] = useState(null);

  const navigate = useNavigate();

  const flash = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2600);
  }, []);

  // Customers, leads and the device master need a login token, so they're loaded after login (or on
  // refresh if still logged in) — as ONE request. Right after a login, api.bootstrap() returns the
  // data that already came back with the login response, so no extra network call is made.
  const loadData = useCallback(async () => {
    const { customers: custRows, leads: leadRows, deviceMaster: masterRaw } = await api.bootstrap();
    setCustomers(custRows.map(toCamelCustomer).sort(byCreated));
    setLeads(leadRows.map(toCamelLead).sort(byCreated));
    setMaster(masterRaw ? buildMaster(masterRaw) : EMPTY_MASTER);
  }, []);

  const clearSession = useCallback(() => {
    sessionStorage.removeItem("session");
    setSession(null);
    setWizard(null);
    setCustomers([]);
    setLeads([]);
    setMaster(EMPTY_MASTER);
    setEditingLeadId(null);
    setEditingCustomerId(null);
  }, []);

  // sheetsApi.js fires this when the server says the login token is no longer valid.
  useEffect(() => {
    const onExpired = () => {
      flash("Session expired — please log in again.", "error");
      clearSession();
      navigate("/login");
    };
    window.addEventListener("auth-expired", onExpired);
    return () => window.removeEventListener("auth-expired", onExpired);
  }, [flash, clearSession, navigate]);

  // api.submitLead() fires this after the server saved a new lead (and maybe a new customer),
  // so the lists on screen update without another request.
  useEffect(() => {
    const onLeadSaved = (ev) => {
      const { customer, lead } = ev.detail || {};
      if (customer) {
        const c = toCamelCustomer(customer);
        setCustomers((prev) => (prev.some((x) => x.id === c.id) ? prev.map((x) => (x.id === c.id ? c : x)) : [...prev, c]));
      }
      if (lead) setLeads((prev) => [...prev, toCamelLead(lead)]);
    };
    window.addEventListener("lead-saved", onLeadSaved);
    return () => window.removeEventListener("lead-saved", onLeadSaved);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // field executives (public, for the login dropdown) and app data (only if logged in)
        // load at the same time instead of one after the other
        const fePromise = api.listFieldExecutives().then((feRows) => {
          setFes(feRows.map(toCamelFe).sort(byName));
        });
        const dataPromise = session ? loadData() : Promise.resolve();
        await Promise.all([fePromise, dataPromise]);
      } catch (e) {
        if (e.code !== "AUTH") {
          setLoadError("Could not load data. Check your connection and try again.");
        }
      } finally {
        setReady(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateCustomerRow = useCallback(async (id, patch) => {
    try {
      const data = await api.updateCustomer(id, patch);
      const mapped = toCamelCustomer(data);
      setCustomers((prev) => prev.map((c) => (c.id === id ? mapped : c)));
      return mapped;
    } catch (e) {
      flash(e.message || "Could not update customer — try again", "error");
      throw e;
    }
  }, [flash]);

  const updateLeadRow = useCallback(async (leadId, patch) => {
    try {
      const data = await api.updateLead(leadId, patch);
      const mapped = toCamelLead(data);
      setLeads((prev) => prev.map((l) => (l.leadId === leadId ? mapped : l)));
      return mapped;
    } catch (e) {
      flash(e.message || "Could not update lead — try again", "error");
      throw e;
    }
  }, [flash]);

  const logout = () => {
    api.logout(); // clears the token immediately; tells the server in the background
    clearSession();
    navigate("/login");
  };

  // Called by LoginScreen after a successful password check. Loads data first so the
  // login button stays on "Checking…" and the dashboard never opens empty.
  const handleLogin = async (s) => {
    try {
      await loadData();
    } catch (e) {
      await api.logout();
      throw e;
    }
    sessionStorage.setItem("session", JSON.stringify(s));
    setSession(s);
    navigate(s.role === "admin" ? "/admin" : "/fe/dashboard");
  };

  if (!ready) {
    return (
      <Shell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "70vh", color: C.slate }}>
          Loading workspace…
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {loadError && <div style={{ background: C.rustBg, color: C.rust, padding: 10, fontSize: 13, textAlign: "center" }}>{loadError}</div>}

      <Routes>
        <Route
          path="/login"
          element={session ? <Navigate to={session.role === "admin" ? "/admin" : "/fe/dashboard"} replace /> : <LoginScreen fes={fes} onLogin={handleLogin} />}
        />

        <Route
          path="/fe/dashboard"
          element={
            session && session.role === "fe" ? (
              <FeDashboard
                fe={session}
                leads={leads}
                customers={customers}
                onLogout={logout}
                onAddLead={() => { setWizard(initialWizard()); navigate("/fe/add-lead"); }}
                onOpenCustomer={(id) => navigate(`/customer/${id}`, { state: { from: "fe-dashboard" } })}
                onEditLead={setEditingLeadId}
              />
            ) : <Navigate to="/login" replace />
          }
        />

        <Route
          path="/fe/add-lead"
          element={
            session && session.role === "fe" && wizard ? (
              <AddLeadWizard
                wizard={wizard}
                setWizard={setWizard}
                fe={session}
                customers={customers}
                leads={leads}
                master={master}
                flash={flash}
                onCancel={() => { setWizard(null); navigate("/fe/dashboard"); }}
                onDone={(customerId) => { setWizard(null); navigate(`/customer/${customerId}`, { state: { from: "fe-dashboard" } }); }}
                onFinishToDashboard={() => { setWizard(null); navigate("/fe/dashboard"); }}
              />
            ) : <Navigate to={session?.role === "fe" ? "/fe/dashboard" : "/login"} replace />
          }
        />

        <Route
          path="/customer/:customerId"
          element={
            session ? <CustomerProfileRoute customers={customers} leads={leads} session={session} setWizard={setWizard} onEditLead={setEditingLeadId} onEditCustomer={setEditingCustomerId} /> : <Navigate to="/login" replace />
          }
        />

        <Route
          path="/admin/*"
          element={
            session && session.role === "admin" ? (
              <AdminShell
                admin={session}
                onLogout={logout}
                customers={customers}
                leads={leads}
                fes={fes}
                setFes={setFes}
                flash={flash}
                onOpenCustomer={(id) => navigate(`/customer/${id}`, { state: { from: "admin" } })}
                onEditLead={setEditingLeadId}
              />
            ) : <Navigate to="/login" replace />
          }
        />

        <Route path="*" element={<Navigate to={session ? (session.role === "admin" ? "/admin" : "/fe/dashboard") : "/login"} replace />} />
      </Routes>

      {session && editingLeadId && (() => {
        const lead = leads.find((l) => l.leadId === editingLeadId);
        if (!lead) return null;
        return (
          <EditLeadModal
            key={lead.leadId}
            lead={lead}
            customer={customers.find((c) => c.id === lead.customerId)}
            master={master}
            leads={leads}
            onClose={() => setEditingLeadId(null)}
            onSave={updateLeadRow}
            flash={flash}
          />
        );
      })()}

      {session && editingCustomerId && (() => {
        const customer = customers.find((c) => c.id === editingCustomerId);
        if (!customer) return null;
        return (
          <EditCustomerModal
            key={customer.id}
            customer={customer}
            customers={customers}
            onClose={() => setEditingCustomerId(null)}
            onSave={updateCustomerRow}
            flash={flash}
          />
        );
      })()}

      <Toast toast={toast} />
    </Shell>
  );
}

function CustomerProfileRoute({ customers, leads, session, setWizard, onEditLead, onEditCustomer }) {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "fe-dashboard";

  return (
    <CustomerProfile
      customerId={customerId}
      customers={customers}
      leads={leads}
      session={session}
      onEditLead={onEditLead}
      onEditCustomer={onEditCustomer}
      onBack={() => navigate(from === "admin" ? "/admin" : "/fe/dashboard")}
      onAddLead={(cId, mobile) => {
        setWizard(initialWizard({ customerId: cId, mobile, skipTo: "device" }));
        navigate("/fe/add-lead");
      }}
    />
  );
}