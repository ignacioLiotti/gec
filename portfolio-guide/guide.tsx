import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Code2,
  Maximize2,
  RotateCcw,
  X,
  Check,
} from "lucide-react";
import { chapters } from "./chapters";
import { Engineering, Notes, Overview } from "./guide-content";
import { useGuideRoute } from "./runtime/navigation";
import { resetGuideData } from "./runtime/local-api";
import { resetJourney, updateJourney, useJourney } from "./runtime/journey";
import { prepareReviewExample } from "./sample-data";
import certificateSource from "./sample-data.ts?raw";

const persistenceExcerpt = certificateSource.slice(
  certificateSource.indexOf("export function readCertificates"),
  certificateSource.indexOf("export function prepareReviewExample"),
);

function DesignNotes({
  chapter,
  onClose,
}: {
  chapter: (typeof chapters)[number];
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current!;
    const opener = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialogRef}
      className="guide-note-dialog"
      aria-labelledby="notes-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="guide-note-content">
        <header>
          <div>
            <span className="guide-label">Inside chapter {chapter.number}</span>
            <h2 id="notes-title">{chapter.short}: design & code</h2>
          </div>
          <button onClick={onClose} aria-label="Close design notes">
            <X size={20} />
          </button>
        </header>
        <Notes chapter={chapter} />
        <section className="guide-note-boundary">
          <h3>What this demo runs</h3>
          <p>{chapter.boundary}</p>
        </section>
        <div className="guide-pipeline" aria-label="Data path">
          <span>
            <small>01 / Evidence</small>Source document
          </span>
          <span>
            <small>02 / Review</small>Editable rows
          </span>
          <span>
            <small>03 / Delivery</small>Report & export
          </span>
        </div>
        <details className="guide-code">
          <summary>Read the local persistence code</summary>
          <p>
            The save/read boundary in this demo. The production service is
            replaced here; the product components keep their own interaction
            logic.
          </p>
          <code>portfolio-guide/sample-data.ts</code>
          <pre>{persistenceExcerpt}</pre>
        </details>
        <a className="guide-notes-link" href="#engineering" onClick={onClose}>
          Explore the architecture decisions <ArrowUpRight size={16} />
        </a>
      </div>
    </dialog>
  );
}

export default function Guide() {
  const route = useGuideRoute();
  const chapter = chapters.find((item) => item.id === route);
  const index = chapters.findIndex((item) => item.id === route);
  const journey = useJourney();
  const [showNotes, setShowNotes] = useState(false);
  const [resetVersion, setResetVersion] = useState(0);
  const [notice, setNotice] = useState("");
  const contentRef = useRef<HTMLElement>(null);
  const step = !journey.sourceOpened
    ? 0
    : !journey.rowsSaved
      ? 1
      : !journey.reportOpened
        ? 2
        : !journey.exported
          ? 3
          : 4;
  const steps = [
    "Open the source",
    "Correct & save",
    "Read the report",
    "Export a file",
  ];
  useEffect(() => {
    document.title =
      (chapter?.short ??
        (route === "engineering" ? "Engineering notes" : "Field guide")) +
      " / Síntesis";
    contentRef.current?.scrollTo({ top: 0 });
  }, [chapter, route]);
  const startTour = () => {
    resetGuideData();
    prepareReviewExample();
    resetJourney(true);
    setResetVersion((version) => version + 1);
    setNotice("");
    window.location.hash = "operations";
  };
  return (
    <div className={"guide-shell" + (chapter ? " guide-workspace-mode" : "")}>
      <a
        className="guide-skip"
        href="#guide-content"
        onClick={(event) => {
          event.preventDefault();
          contentRef.current?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="guide-sidebar">
        <a className="guide-brand" href="#overview">
          <span>S/</span>
          <div>
            Síntesis<small>ENGINEERING FIELD GUIDE</small>
          </div>
        </a>
        <nav aria-label="Portfolio guide">
          <a
            className="guide-nav-overview"
            href="#overview"
            aria-current={route === "overview" ? "page" : undefined}
          >
            The project <ArrowUpRight size={15} />
          </a>
          <p className="guide-label">Explore the product</p>
          {chapters.map((item) => (
            <a
              href={"#" + item.id}
              key={item.id}
              aria-current={route === item.id ? "page" : undefined}
            >
              <span>{item.number}</span>
              {item.short}
            </a>
          ))}
          <a
            className="guide-nav-engineering"
            href="#engineering"
            aria-current={route === "engineering" ? "page" : undefined}
          >
            <Code2 size={16} />
            Engineering notes
          </a>
        </nav>
        <button className="guide-tour-entry" onClick={startTour}>
          <ArrowRight size={16} />
          {journey.active
            ? "Restart the 3-minute tour"
            : "Start the 3-minute tour"}
          <small>Restores the example data</small>
        </button>
        <footer>
          <span className="guide-avatar">IL</span>
          <div>
            Ignacio Liotti<small>Designed & built independently</small>
          </div>
        </footer>
      </aside>
      <main
        className="guide-main"
        ref={contentRef}
        id="guide-content"
        tabIndex={-1}
      >
        <header className="guide-topbar">
          <a href="#overview">
            Selected work <span>/</span> Síntesis
          </a>
          <span className="guide-local">
            <i />
            Sample data · local edits
          </span>
        </header>
        <div className="guide-mobile-nav">
          <label htmlFor="guide-chapter-select">Explore</label>
          <select
            id="guide-chapter-select"
            value={route}
            onChange={(event) => {
              window.location.hash = event.target.value;
            }}
          >
            <option value="overview">The project</option>
            {chapters.map((item) => (
              <option key={item.id} value={item.id}>
                {item.number} / {item.short}
              </option>
            ))}
            <option value="engineering">Engineering notes</option>
          </select>
        </div>
        {route === "overview" ? (
          <Overview onStartTour={startTour} />
        ) : route === "engineering" ? (
          <Engineering />
        ) : chapter ? (
          <article className="guide-chapter">
            <div className="guide-chapter-heading">
              <div>
                <span className="guide-label">
                  {chapter.number} / {chapter.category}
                </span>
                <h1>{chapter.title}</h1>
              </div>
              <button
                className="guide-notes-trigger"
                onClick={() => setShowNotes(true)}
              >
                <Code2 size={17} />
                Design & code
              </button>
            </div>
            {journey.active ? (
              <section className="guide-journey" aria-label="Guided case">
                <div className="guide-journey-progress">
                  {steps.map((label, i) => (
                    <span
                      key={label}
                      data-state={
                        i < step ? "done" : i === step ? "current" : "next"
                      }
                      aria-current={i === step ? "step" : undefined}
                    >
                      <b>{i < step ? <Check size={12} /> : i + 1}</b>
                      {label}
                    </span>
                  ))}
                </div>
                <div className="guide-journey-task">
                  <p role="status">
                    {
                      [
                        "Torre Madero has a certificate to review. Open its project row or continue below.",
                        "May's extracted amount is $ 17.000.000. Check the source, change it to $ 18.000.000, then save.",
                        "Your correction is saved. Open the report to see the updated amount.",
                        "The report includes your saved rows. Download CSV or Excel from its toolbar.",
                        "Case complete. You corrected the source data and generated an export. Explore the configuration next.",
                      ][step]
                    }
                  </p>
                  <div>
                    {step < 4 &&
                      chapter.id !== (step < 2 ? "documents" : "reports") && (
                        <a href={step < 2 ? "#documents" : "#reports"}>
                          {step < 2 ? "Open certificate" : "Open report"}
                          <ArrowRight size={15} />
                        </a>
                      )}
                    {step === 4 && (
                      <a href="#data-flow">
                        Trace the calculations
                        <ArrowRight size={15} />
                      </a>
                    )}
                    <button onClick={() => updateJourney({ active: false })}>
                      Exit tour
                    </button>
                  </div>
                </div>
              </section>
            ) : (
              <p className="guide-chapter-description">{chapter.description}</p>
            )}
            <div className="guide-demo">
              <div className="guide-demo-toolbar">
                <span>
                  <i />
                  {chapter.short} · live component
                </span>
                <div>
                  <button
                    onClick={() => {
                      resetGuideData();
                      resetJourney();
                      setResetVersion((version) => version + 1);
                      setNotice("Sample data restored.");
                    }}
                  >
                    <RotateCcw size={15} />
                    Reset data
                  </button>
                  <a href={"?screen=" + chapter.id}>
                    <Maximize2 size={15} />
                    Full screen
                  </a>
                </div>
              </div>
              <iframe
                key={chapter.id + resetVersion}
                src={"?screen=" + chapter.id}
                title={chapter.short + " interactive product demo"}
              />
            </div>
            <nav
              className="guide-chapter-footer"
              aria-label="Chapter navigation"
            >
              <a href={index > 0 ? "#" + chapters[index - 1].id : "#overview"}>
                <ArrowLeft size={16} />
                <span>
                  Previous
                  <small>
                    {index > 0 ? chapters[index - 1].short : "The project"}
                  </small>
                </span>
              </a>
              <span className="guide-position" role="status">
                {notice || `${chapter.number} / 06`}
              </span>
              <a
                href={
                  index < chapters.length - 1
                    ? "#" + chapters[index + 1].id
                    : "#engineering"
                }
              >
                <span>
                  Next
                  <small>
                    {index < chapters.length - 1
                      ? chapters[index + 1].short
                      : "Engineering notes"}
                  </small>
                </span>
                <ArrowRight size={16} />
              </a>
            </nav>
          </article>
        ) : (
          <div className="guide-error">
            <h1>Chapter not found</h1>
            <a href="#overview">Return to the project</a>
          </div>
        )}
      </main>
      {showNotes && chapter && (
        <DesignNotes chapter={chapter} onClose={() => setShowNotes(false)} />
      )}
    </div>
  );
}
