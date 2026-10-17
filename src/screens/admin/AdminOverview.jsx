import { useMemo } from "react";
import { C } from "../../constants/colors";
import { StatTile } from "../../componets/ui/StatTile";
import { todayISO, isSameDay, inr } from "../../utils/formatters";

export function AdminOverview({ customers, leads, fes }) {
  const today = todayISO();
  const stats = useMemo(() => ({
    totalCustomers: customers.length,
    totalLeads: leads.length,
    today: leads.filter((l) => isSameDay(l.visitDate, today)).length,
    completed: leads.filter((l) => l.status === "Completed").length,
    pending: leads.filter((l) => l.status === "Pending").length,
    cancelled: leads.filter((l) => l.status === "Cancelled").length,
    purchaseValue: leads.reduce((s, l) => s + (Number(l.purchasePrice) || 0), 0),
    commissionValue: leads.reduce((s, l) => s + (Number(l.commissionAmount) || 0), 0),
  }), [customers, leads, today]);

  const perf = useMemo(() => fes.map((f) => {
    const mine = leads.filter((l) => l.feUsername === f.username);
    return {
      ...f,
      total: mine.length,
      completed: mine.filter((l) => l.status === "Completed").length,
      pending: mine.filter((l) => l.status === "Pending").length,
      cancelled: mine.filter((l) => l.status === "Cancelled").length,
      purchaseValue: mine.reduce((s, l) => s + (Number(l.purchasePrice) || 0), 0),
      commissionValue: mine.reduce((s, l) => s + (Number(l.commissionAmount) || 0), 0),
    };
  }), [fes, leads]);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 30 }}>
        <StatTile label="Total customers" value={stats.totalCustomers} />
        <StatTile label="Total leads" value={stats.totalLeads} />
        <StatTile label="Today's leads" value={stats.today} />
        <StatTile label="Completed" value={stats.completed} tone={C.ledger} />
        <StatTile label="Pending" value={stats.pending} tone={C.amber} />
        <StatTile label="Cancelled" value={stats.cancelled} tone={C.rust} />
        <StatTile label="Total purchase value" value={inr(stats.purchaseValue)} />
        <StatTile label="Total commission" value={inr(stats.commissionValue)} tone={C.amber} />
      </div>

      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, fontFamily: "'Space Grotesk', sans-serif" }}>Executive performance</div>
      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Status</th><th>Total</th><th>Completed</th><th>Pending</th><th>Cancelled</th><th>Purchase value</th><th>Commission</th>
            </tr>
          </thead>
          <tbody>
            {perf.map((f) => (
              <tr key={f.username}>
                <td style={{ fontWeight: 600 }}>{f.name}</td>
                <td>{f.active ? <span style={{ color: C.ledger, fontWeight: 600 }}>Active</span> : <span style={{ color: C.rust, fontWeight: 600 }}>Inactive</span>}</td>
                <td>{f.total}</td><td>{f.completed}</td><td>{f.pending}</td><td>{f.cancelled}</td>
                <td>{inr(f.purchaseValue)}</td><td>{inr(f.commissionValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}