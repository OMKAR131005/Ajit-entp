import { useState } from "react";
import { Plus, Pencil, Ban, RotateCcw } from "lucide-react";
import { api } from "../../sheetsApi";
import { C } from "../../constants/colors";
import { Field } from "../../componets/ui/Field";
import { TextInput } from "../../componets/ui/TextInput";
import { BigButton } from "../../componets/ui/Bigbutton";
import { IconBtn } from "../../componets/ui/IconBtn";

export function AdminFes({ fes, setFes, leads, flash }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", username: "", password: "" });
  const [editingUser, setEditingUser] = useState(null);
  const [editDraft, setEditDraft] = useState({});

  const addFe = async () => {
    if (!draft.name.trim() || !draft.username.trim() || !draft.password.trim()) return flash("All fields are required.", "error");
    const uname = draft.username.trim().toLowerCase();
    if (fes.some((f) => f.username === uname)) return flash("That username is already taken.", "error");
    try {
      await api.addFieldExecutive(uname, draft.name.trim(), draft.password);
      setFes((prev) => [...prev, { username: uname, name: draft.name.trim(), active: true }]);
      setDraft({ name: "", username: "", password: "" });
      setAdding(false);
      flash("Field executive added.");
    } catch (e) {
      flash(e?.message || "Could not add field executive — try again.", "error");
    }
  };

  const startEdit = (f) => { setEditingUser(f.username); setEditDraft({ name: f.name, password: "" }); };
  const saveEdit = async () => {
    try {
      await api.updateFieldExecutive(editingUser, editDraft.name.trim());
      if (editDraft.password && editDraft.password.trim()) {
        await api.setFieldExecutivePassword(editingUser, editDraft.password.trim());
      }
      setFes((prev) => prev.map((f) => (f.username === editingUser ? { ...f, name: editDraft.name.trim() } : f)));
      setEditingUser(null);
      flash("Updated.");
    } catch (e) {
      flash(e?.message || "Could not update — try again.", "error");
    }
  };
  const toggleActive = async (username) => {
    const target = fes.find((f) => f.username === username);
    if (!target) return;
    try {
      await api.setFieldExecutiveActive(username, !target.active);
      setFes((prev) => prev.map((f) => (f.username === username ? { ...f, active: !f.active } : f)));
    } catch (e) {
      flash(e?.message || "Could not update status — try again.", "error");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>Field executives</div>
        <button onClick={() => setAdding((v) => !v)} style={{
          display: "flex", alignItems: "center", gap: 6, background: C.ink, color: "#fff", border: "none",
          padding: "9px 14px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: "pointer",
        }}>
          <Plus size={15} /> Add field executive
        </button>
      </div>

      {adding && (
        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: 16, marginBottom: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 10 }}>
          <Field label="Name"><TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
          <Field label="Username"><TextInput value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} /></Field>
          <Field label="Password"><TextInput value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} /></Field>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <BigButton onClick={addFe} style={{ padding: "12px" }}>Save</BigButton>
          </div>
        </div>
      )}

      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, overflowX: "auto" }}>
        <table>
          <thead><tr><th>Name</th><th>Username</th><th>Status</th><th>Leads</th><th>Actions</th></tr></thead>
          <tbody>
            {fes.map((f) => {
              const count = leads.filter((l) => l.feUsername === f.username).length;
              const editing = editingUser === f.username;
              return (
                <tr key={f.username}>
                  <td>
                    {editing ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <TextInput value={editDraft.name} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} style={{ padding: "6px 8px" }} />
                        <TextInput type="password" placeholder="New password (optional)" value={editDraft.password} onChange={(e) => setEditDraft({ ...editDraft, password: e.target.value })} style={{ padding: "6px 8px" }} />
                      </div>
                    ) : f.name}
                  </td>
                  <td>{f.username}</td>
                  <td>{f.active ? <span style={{ color: C.ledger, fontWeight: 600 }}>Active</span> : <span style={{ color: C.rust, fontWeight: 600 }}>Inactive</span>}</td>
                  <td>{count}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      {editing ? (
                        <>
                          <IconBtn onClick={saveEdit} label="Save" />
                          <IconBtn onClick={() => setEditingUser(null)} label="Cancel" />
                        </>
                      ) : (
                        <>
                          <IconBtn onClick={() => startEdit(f)} Icon={Pencil} label="Edit" />
                          <IconBtn onClick={() => toggleActive(f.username)} Icon={f.active ? Ban : RotateCcw} label={f.active ? "Deactivate" : "Reactivate"} tone={f.active ? C.rust : C.ledger} />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}