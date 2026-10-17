import { C } from "../../constants/colors";
import { FONT_IMPORT } from "../../constants/colors";

export function Shell({ children }) {
  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", background: C.paper, minHeight: "100%", color: C.ink }}>
      <style>{`
        ${FONT_IMPORT}
        * { box-sizing: border-box; }
        input:focus, textarea:focus, select:focus { border-color: ${C.ink} !important; }
        table { border-collapse: collapse; width: 100%; }
        th, td { text-align: left; padding: 10px 12px; font-size: 13.5px; border-bottom: 1px solid ${C.line}; }
        th { color: ${C.slate}; font-weight: 600; font-size: 12px; text-transform: none; }
        ::-webkit-scrollbar { height: 6px; width: 6px; }
      `}</style>
      {children}
    </div>
  );
}