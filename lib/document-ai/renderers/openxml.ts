import JSZip from "jszip";

export function xmlEscape(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function zipToBytes(zip: JSZip) {
  const buffer = await zip.generateAsync({ type: "uint8array" });
  return new Uint8Array(buffer);
}
