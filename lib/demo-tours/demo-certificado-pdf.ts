const DEMO_CERTIFICADO_ASSET_URL =
  "/demo/certificado-mensual-obra-n4-abril-2026.png";

const DEMO_CERTIFICADO_FILE_NAME =
  "certificado-mensual-obra-n4-abril-2026.png";

export function downloadDemoCertificadoPdf() {
  const link = document.createElement("a");
  link.href = DEMO_CERTIFICADO_ASSET_URL;
  link.download = DEMO_CERTIFICADO_FILE_NAME;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
