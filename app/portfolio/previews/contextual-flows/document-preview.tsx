import { FileText } from "lucide-react";
import styles from "./demos.module.css";

export function DocumentPreview({ title, html }: { title: string; html: string }) {
  return (
    <section className={styles.document} aria-label={title}>
      <div className={styles.documentHeader}><FileText className="size-4" /><span>{title}</span></div>
      <iframe title={title} srcDoc={html} sandbox="" className={styles.documentFrame} />
    </section>
  );
}
