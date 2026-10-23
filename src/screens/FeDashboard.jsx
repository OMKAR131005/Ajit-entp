import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, LogOut, Pencil, QrCode } from "lucide-react";
import { C } from "../constants/colors";
import { StatTile } from "../componets/ui/StatTile";
import { BigButton } from "../componets/ui/Bigbutton";
import { Badge } from "../componets/ui/Badge";
import { todayISO, isSameDay } from "../utils/formatters";

const PAGE_SIZE = 8;

export function FeDashboard({ fe, leads, customers, onLogout, onAddLead, onOpenCustomer, onEditLead, qrMap = {}, onAttachQr, onScanQr }) {
  const mine = useMemo(() => leads.filter((l) => l.feUsername === fe.username), [leads, fe]);
  const today = todayISO();
  const counts = useMemo(() => ({
    today: mine.filter((l) => isSameDay(l.visitDate, today)).length,
    completed: mine.filter((l) => l.status === "Completed").length,
    pending: mine.filter((l) => l.status === "Pending").length,
    cancelled: mine.filter((l) => l.status === "Cancelled").length,
    total: mine.length,
  }), [mine, today]);

  const sortedAll = useMemo(
    () => [...mine].sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate)),
    [mine]
  );

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const recent = sortedAll.slice(0, visibleCount);
  const hasMore = visibleCount < sortedAll.length;

  // Reset pagination whenever the underlying list changes (e.g. FE switches, new lead added).
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [mine]);

  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((c) => c + PAGE_SIZE);
        }
      },
      { root: node.parentElement, rootMargin: "80px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore]);

  const custById = (id) => customers.find((c) => c.id === id);

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: C.paper }}>
      <div style={{ padding: "20px 18px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 13, color: C.slate }}>Welcome back</div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 21 }}>{fe.name}</div>
        </div>
        <button onClick={onLogout} style={{ background: "none", border: "none", color: C.slate, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 13 }}>
          <LogOut size={16} /> Log out
        </button>
      </div>

      <div style={{ padding: "8px 18px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <StatTile label="Today's leads" value={counts.today} />
          <StatTile label="Total leads" value={counts.total} />
          <StatTile label="Completed" value={counts.completed} tone={C.ledger} />
          <StatTile label="Pending" value={counts.pending} tone={C.amber} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <StatTile label="Cancelled" value={counts.cancelled} tone={C.rust} />
        </div>

        <div style={{ marginBottom: 22 }}>
          <BigButton icon={Plus} onClick={onAddLead} style={{ padding: "18px 18px", fontSize: 17.5 }}>
            Add new lead
          </BigButton>
          <div style={{ marginTop: 10 }}>
            <BigButton tone="outline" icon={QrCode} onClick={onScanQr}>Scan &amp; attach QR</BigButton>
          </div>
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink2, marginBottom: 10, letterSpacing: 0.2 }}>
          Recent visits
        </div>
        {recent.length === 0 && (
          <div style={{ color: C.slate, fontSize: 13.5, padding: "20px 0", textAlign: "center" }}>
            No leads yet. Tap "Add new lead" to record your first visit.
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 420, overflowY: "auto", paddingRight: 2 }}>
          {recent.map((l) => {
            const cust = custById(l.customerId);
            return (
              <div key={l.leadId}
                style={{
                  display: "flex", alignItems: "stretch", background: "#fff", border: `1px solid ${C.line}`,
                  borderRadius: 8, flexShrink: 0, overflow: "hidden",
                }}>
                <button onClick={() => onOpenCustomer(l.customerId)}
                  style={{
                    flex: 1, minWidth: 0, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                    background: "none", border: "none", padding: "12px 14px", cursor: "pointer", textAlign: "left",
                  }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14.5 }}>{cust ? cust.name : "Unknown customer"}</div>
                    <div style={{ fontSize: 12.5, color: C.slate }}>{l.deviceBrand} {l.deviceModel} · {l.leadId}</div>
                    {l.status === "Completed" && (
                      <div style={{ fontSize: 12, marginTop: 3, fontWeight: 600, color: qrMap[l.leadId] ? C.ledger : C.amber }}>
                        {qrMap[l.leadId] ? `QR: ${qrMap[l.leadId].display}` : "No QR attached"}
                      </div>
                    )}
                  </div>
                  <Badge status={l.status} />
                </button>
                {l.status === "Completed" && !qrMap[l.leadId] && (
                  <button onClick={() => onAttachQr(l.leadId)} aria-label={`Attach QR to lead ${l.leadId}`}
                    style={{
                      display: "flex", alignItems: "center", gap: 5, padding: "0 13px", cursor: "pointer",
                      background: C.paperDim, border: "none", borderLeft: `1px solid ${C.line}`, color: C.ink2, fontSize: 12.5, fontWeight: 600,
                    }}>
                    <QrCode size={13} /> QR
                  </button>
                )}
                <button onClick={() => onEditLead(l.leadId)} aria-label={`Edit lead ${l.leadId}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 5, padding: "0 13px", cursor: "pointer",
                    background: C.paperDim, border: "none", borderLeft: `1px solid ${C.line}`, color: C.ink2, fontSize: 12.5, fontWeight: 600,
                  }}>
                  <Pencil size={13} /> Edit
                </button>
              </div>
            );
          })}

          {hasMore && (
            <div ref={sentinelRef} style={{ textAlign: "center", padding: "10px 0", color: C.slate, fontSize: 12.5, flexShrink: 0 }}>
              Loading more…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}