import { C } from "../../constants/colors";

export function Toast({ toast }) {
  if (!toast) return null;
  const bad = toast.type === "error";
  return (
    <div style={{
      position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
      background: bad ? C.rust : C.ledger, color: "#fff",
      padding: "12px 20px", borderRadius: 8, fontSize: 14.5, fontWeight: 600,
      boxShadow: "0 6px 20px rgba(0,0,0,0.18)", zIndex: 999, maxWidth: "90%",
      textAlign: "center",
    }}>
      {toast.msg}
    </div>
  );
}