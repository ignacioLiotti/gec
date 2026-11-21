export async function generatePdf(element: HTMLElement) {
  const copy = element.cloneNode(true) as HTMLElement;
  copy.id = "guide-print-document";
  document.body.append(copy);
  document.body.classList.add("guide-printing");
  const cleanup = () => {
    copy.remove();
    document.body.classList.remove("guide-printing");
  };
  window.addEventListener("afterprint", cleanup, { once: true });
  window.print();
  cleanup();
  return { success: true };
}
