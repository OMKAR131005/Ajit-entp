import { inputStyle } from "./inputStyle";

export function TextArea(props) {
  return <textarea {...props} style={{ ...inputStyle, resize: "vertical", minHeight: 80, ...(props.style || {}) }} />;
}