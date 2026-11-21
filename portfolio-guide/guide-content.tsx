import { ArrowRight, ArrowUpRight } from "lucide-react";
import { chapters } from "./chapters";
export function Notes({ chapter }: { chapter: (typeof chapters)[number] }) {
  return (
    <div className="guide-notes">
      <section className="guide-note-try">
        <span className="guide-label">Try this</span>
        <ol>
          {chapter.try.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
      <section>
        <span className="guide-label">Product decision</span>
        <p>{chapter.decision}</p>
      </section>
      <section>
        <span className="guide-label">Architecture</span>
        <p>{chapter.architecture}</p>
      </section>
      <section>
        <span className="guide-label">Tradeoff</span>
        <p>{chapter.tradeoff}</p>
      </section>
      <section className="guide-source">
        <span className="guide-label">Implementation</span>
        <code>{chapter.source}</code>
      </section>
    </div>
  );
}
export function Engineering() {
  return (
    <article className="guide-engineering">
      <span className="guide-label">Behind the interface</span>
      <h1>Decisions you can inspect.</h1>
      <p className="guide-lead">
        The interesting boundary is where a document becomes data that people
        rely on.
      </p>
      <div className="guide-pipeline">
        {[
          "Source document",
          "Reviewed rows",
          "Calculations",
          "Obra",
          "Report",
        ].map((step, i) => (
          <span key={step}>
            <small>0{i + 1}</small>
            {step}
          </span>
        ))}
      </div>
      <div className="guide-notes">
        <section>
          <h2>Identity survives reprocessing</h2>
          <p>
            Technical row IDs can change after OCR reimport. Stable lineage
            identifies the business row. Macro-table overrides bind to that
            identity, and ambiguous bindings are recorded as conflicts.
          </p>
          <code>ADRs 0001 / 0002</code>
        </section>
        <section>
          <h2>Configuration has an owner</h2>
          <p>
            Tenant defaults provide shared calculations and layouts. Obra
            overrides allow local exceptions. The effective configuration merges
            both, and the General tab consumes the same layout contract.
          </p>
          <code>ADRs 0003 / 0005</code>
        </section>
        <section>
          <h2>Automation has explicit authority</h2>
          <p>
            A result can be displayed, proposed for review, or applied
            automatically. Invalid and self-dependent writes are blocked. Runs,
            suggestions and applied changes are recorded separately.
          </p>
          <code>ADR 0013</code>
        </section>
        <section>
          <h2>The demo has a smaller boundary</h2>
          <p>
            This static application imports product components directly. Local
            fixtures replace account data. A confined API adapter handles
            presets and report links; unrecognized operations never reach a
            backend.
          </p>
          <code>portfolio-guide/runtime/</code>
        </section>
      </div>
      <h2 className="guide-section-title">
        Before making the repository public
      </h2>
      <p>
        The guide is built. The following are proposed preparation steps, not
        completed claims.
      </p>
      <div className="guide-improvements">
        <article>
          <span>01 / Structure</span>
          <h3>Extract the reusable packages</h3>
          <p>
            Keep the guide, table engine, report workspace and calculation
            contracts independently buildable. Replace framework compatibility
            adapters with explicit navigation and service inputs.
          </p>
        </article>
        <article>
          <span>02 / Interaction</span>
          <h3>Give every state a complete path</h3>
          <p>
            Walk keyboard editing, document-sheet focus, import conflicts, empty
            data and narrow layouts. Keep metric definitions and save outcomes
            consistent across screens.
          </p>
        </article>
        <article>
          <span>03 / Code</span>
          <h3>Reduce the coordinator files</h3>
          <p>
            The file manager and report workspace own many responsibilities.
            Extract storage, extraction and report persistence at existing
            behavior boundaries, with focused regression tests.
          </p>
        </article>
        <article>
          <span>04 / Release</span>
          <h3>Prepare a clean public snapshot</h3>
          <p>
            Review source and Git history for private data, confirm asset and
            dependency licenses, choose a project license, and add CI plus a
            reproducible setup. Do this before publication.
          </p>
        </article>
      </div>
    </article>
  );
}
export function Overview({ onStartTour }: { onStartTour: () => void }) {
  return (
    <article className="guide-overview">
      <div className="guide-hero">
        <span className="guide-label">
          Independent product engineering / Síntesis
        </span>
        <h1>
          From construction documents
          <br />
          to decisions.
        </h1>
        <p>
          I’m Ignacio Liotti. I designed and built Síntesis independently: a
          workspace for construction teams to review documents, maintain project
          data and produce reports. This guide follows that work from source to
          export.
        </p>
        <div className="guide-hero-actions">
          <button className="guide-primary" onClick={onStartTour}>
            Start the 3-minute tour <ArrowRight size={17} />
          </button>
          <a href="#operations">
            Explore at your own pace <ArrowUpRight size={16} />
          </a>
        </div>
        <div className="guide-facts">
          <span>06 real product modules</span>
          <span>Sample data, local edits</span>
          <span>No account required</span>
        </div>
      </div>
      <div className="guide-live-preview">
        <div className="guide-preview-caption">
          <span>
            <i /> Live product component
          </span>
          <span>Operations / 01</span>
        </div>
        <iframe
          src="?screen=operations"
          title="Operations dashboard with example data"
          loading="lazy"
        />
        <a href="#operations">
          Explore this workspace <ArrowUpRight size={16} />
        </a>
      </div>
      <div className="guide-section-heading">
        <h2>One workflow. Six perspectives.</h2>
        <p>
          Explore any screen, or follow one certificate through review,
          correction and export.
        </p>
      </div>
      <div className="guide-chapter-grid">
        {chapters.map((chapter) => (
          <a href={"#" + chapter.id} key={chapter.id}>
            <span className="guide-card-number">
              {chapter.number} <ArrowUpRight size={17} />
            </span>
            <h3>{chapter.short}</h3>
            <p>{chapter.description}</p>
            <small>
              {Number(chapter.number) < 5
                ? "Core workflow"
                : "Technical deep dive"}
            </small>
          </a>
        ))}
      </div>
      <p className="guide-footnote">
        Product components are reused from Síntesis. Data, source documents and
        service responses are examples. Backend operations are described
        separately from the interactions available here.
      </p>
    </article>
  );
}
