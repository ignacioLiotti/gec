/* global React */
const { useState, useEffect, useRef } = React;

// ============================================================
// QUICK REFERENCE — 3-column feature row
// ============================================================
function QuickReference({ eyebrow, title, lead, items }) {
  return (
    <section className="section section-tight">
      <div className="wrap">
        <div className="section-head">
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="serif-section" style={{ marginTop: 18 }}
              dangerouslySetInnerHTML={{ __html: title }} />
          <p>{lead}</p>
        </div>
      </div>
      <div className="wrap">
        <div className="feature-grid">
          {items.map((it, i) => {
            const Ic = it.icon;
            return (
              <div className="feature-cell" key={i}>
                <div className="icon-row">
                  <Ic size={14} /> {it.eyebrow}
                </div>
                <h4>{it.title}</h4>
                <p>{it.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// SIDE-ANCHOR FEATURE SECTION — sticky rail + 3-4 anchored blocks
// ============================================================
function AnchoredFeatures({ eyebrow, title, lead, blocks }) {
  const [active, setActive] = useState(0);
  const refs = useRef([]);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const i = refs.current.findIndex((r) => r === e.target);
            if (i >= 0) setActive(i);
          }
        });
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: 0 }
    );
    refs.current.forEach((r) => r && obs.observe(r));
    return () => obs.disconnect();
  }, []);

  return (
    <section className="section" id="producto">
      <div className="wrap">
        <div className="section-head">
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="serif-section" style={{ marginTop: 18 }}
              dangerouslySetInnerHTML={{ __html: title }} />
          <p>{lead}</p>
        </div>
        <div className="anchored">
          <div className="anchor-rail">
            {blocks.map((b, i) => (
              <a key={i}
                 href={"#blk-" + i}
                 className={active === i ? "active" : ""}
                 onClick={(e) => { e.preventDefault(); refs.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
                <span className="dot" /> {b.anchor}
              </a>
            ))}
          </div>
          <div>
            {blocks.map((b, i) => (
              <div key={i}
                   id={"blk-" + i}
                   ref={(el) => (refs.current[i] = el)}
                   className="anchor-block">
                <h3 dangerouslySetInnerHTML={{ __html: b.title }} />
                <p className="lead">{b.lead}</p>
                <div className={"embed-frame " + (b.frame || "")}>
                  <div className="embed-inner">{b.mock}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// FLUJO — 4-step horizontal stepper with serif numerals
// ============================================================
function Flujo({ eyebrow, title, lead, steps }) {
  return (
    <section className="section" id="flujo" style={{ background: "rgba(255,255,255,.4)", borderTop: "1px solid rgba(28,25,23,.06)", borderBottom: "1px solid rgba(28,25,23,.06)" }}>
      <div className="wrap">
        <div className="section-head">
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="serif-section" style={{ marginTop: 18 }}
              dangerouslySetInnerHTML={{ __html: title }} />
          <p>{lead}</p>
        </div>
      </div>
      <div className="wrap">
        <div className="flujo">
          {steps.map((s, i) => (
            <div key={i} className={"flujo-step" + (i === 0 ? " active" : "")}>
              <div className="flujo-num">{String(i + 1).padStart(2, "0")}</div>
              <h4>{s.title}</h4>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// DEMO SECTION — tabs over a dashboard mock embed
// ============================================================
function DemoSection({ eyebrow, title, lead, tabs, demoMock }) {
  const [active, setActive] = useState(0);
  return (
    <section className="section" id="demo">
      <div className="wrap">
        <div className="section-head" style={{ maxWidth: 820 }}>
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="serif-section" style={{ marginTop: 18 }}
              dangerouslySetInnerHTML={{ __html: title }} />
          <p>{lead}</p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "300px 1fr",
          gap: 40,
          alignItems: "start",
        }}>
          <div style={{ display: "grid", gap: 12 }}>
            {tabs.map((t, i) => (
              <button key={i} onClick={() => setActive(i)} style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: 14,
                padding: "20px 22px",
                background: active === i ? "#fff" : "transparent",
                border: "1px solid " + (active === i ? "rgba(28,25,23,.10)" : "transparent"),
                borderRadius: 14,
                textAlign: "left",
                cursor: "pointer",
                boxShadow: active === i ? "0 1px 0 rgba(0,0,0,.03)" : "none",
                transition: "all .2s",
              }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: ".15em",
                  textTransform: "uppercase",
                  color: active === i ? "var(--orange-primary)" : "var(--stone-400)",
                  paddingTop: 2,
                  minWidth: 56,
                }}>{t.tag}</div>
                <div>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, lineHeight: 1.1, color: "var(--stone-900)", marginBottom: 6 }}>{t.title}</div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--stone-600)" }}>{t.body}</div>
                </div>
              </button>
            ))}
          </div>
          <div className="embed-frame cool">
            <div className="embed-inner">{demoMock(active)}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// DARK GET-STARTED SECTION
// ============================================================
function DarkSteps({ eyebrow, title, steps, ctaLight, ctaGhost }) {
  return (
    <section className="section-dark">
      <div className="wrap">
        <div style={{ maxWidth: 760 }}>
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="serif-section" style={{ marginTop: 20 }}
              dangerouslySetInnerHTML={{ __html: title }} />
        </div>
        <div className="dark-grid">
          {steps.map((s, i) => (
            <div key={i} className="dark-cell">
              <div className="num">{String(i + 1).padStart(2, "0")}</div>
              <h4>{s.title}</h4>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
        <div className="dark-cta-row">
          <button className="btn btn-light">{ctaLight} <IArrow size={14} /></button>
          <button className="btn btn-dark-ghost">{ctaGhost}</button>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// SPLIT / OPEN SOURCE STYLE — narrative left + 2x2 right
// ============================================================
function Split({ eyebrow, title, lead, ctaLabel, ctaIcon, items }) {
  return (
    <section className="section" id="preguntas">
      <div className="wrap">
        <div className="split">
          <div>
            <div className="eyebrow">{eyebrow}</div>
            <h2 className="serif-section" style={{ margin: "20px 0 28px" }}
                dangerouslySetInnerHTML={{ __html: title }} />
            <p className="lead" style={{ marginBottom: 36 }}>{lead}</p>
            <button className="btn btn-primary">{ctaLabel} <IArrow size={14} /></button>
          </div>
          <div className="split-grid">
            {items.map((it, i) => (
              <div className="split-cell" key={i}>
                <h4>{it.title}</h4>
                <p>{it.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// CIERRE — final centered CTA
// ============================================================
function Cierre({ eyebrow, title, lead, primary, secondary }) {
  return (
    <section className="cierre" style={{ position: "relative", overflow: "hidden" }}>
      <div style={{
        position: "absolute", left: "50%", top: "30%", transform: "translateX(-50%)",
        width: 460, height: 460, borderRadius: 9999,
        background: "radial-gradient(circle, rgba(255,88,0,.18), rgba(255,88,0,0) 70%)",
        filter: "blur(40px)",
        zIndex: 0,
      }} />
      <div style={{ position: "relative" }}>
        <div className="eyebrow" style={{ marginBottom: 18 }}>{eyebrow}</div>
        <h2 className="serif-section" dangerouslySetInnerHTML={{ __html: title }} />
        <p className="lead">{lead}</p>
        <div className="hero-cta-row">
          <button className="btn btn-orange">{primary} <IArrow size={14} /></button>
          <button className="btn btn-light">{secondary}</button>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// PROOF STRIP — real-world validation (pilot in Corrientes)
// ============================================================
function ProofStrip({ eyebrow, title, lead, points }) {
  return (
    <section className="section section-tight" id="validacion">
      <div className="wrap">
        <div className="section-head" style={{ textAlign: "center", margin: "0 auto" }}>
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="serif-section" style={{ marginTop: 18 }}
              dangerouslySetInnerHTML={{ __html: title }} />
          <p style={{ marginLeft: "auto", marginRight: "auto" }}>{lead}</p>
        </div>
        {points && (
          <div className="proof-points">
            {points.map((p, i) => <span key={i}>{p}</span>)}
          </div>
        )}
      </div>
    </section>
  );
}

// ============================================================
// DOSSIER BAR — turns the landing into a shareable dossier
// ============================================================
function DossierBar({ note }) {
  return (
    <section className="dossier-bar">
      <div className="wrap dossier-bar-inner">
        <div className="dossier-bar-text">
          <b>Esta página es también nuestro dossier comercial.</b>{" "}
          {note || "Guardala como PDF y compartila con quien decide: contiene producto, perfiles, módulos, ficha técnica y plan de arranque."}
        </div>
        <button className="btn btn-light" onClick={() => window.print()}>
          <IDownload size={14} /> Guardar como PDF
        </button>
      </div>
    </section>
  );
}

// ============================================================
// PERFILES — who uses it, dossier-grade (4-up with bullets)
// ============================================================
function Perfiles({ eyebrow, title, lead, items }) {
  return (
    <section className="section section-tight" id="perfiles">
      <div className="wrap">
        <div className="section-head">
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="serif-section" style={{ marginTop: 18 }}
              dangerouslySetInnerHTML={{ __html: title }} />
          <p>{lead}</p>
        </div>
        <div className="perfil-grid">
          {items.map((p, i) => (
            <div className="perfil-cell" key={i}>
              <div className="perfil-role">{p.role}</div>
              <h4>{p.title}</h4>
              <p>{p.body}</p>
              <ul>
                {p.bullets.map((b, j) => <li key={j}>{b}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// MÓDULOS — product catalog (dossier inventory of capabilities)
// ============================================================
function ModuloCatalogo({ eyebrow, title, lead, modules, note }) {
  return (
    <section className="section" id="modulos">
      <div className="wrap">
        <div className="section-head">
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="serif-section" style={{ marginTop: 18 }}
              dangerouslySetInnerHTML={{ __html: title }} />
          <p>{lead}</p>
        </div>
        <div className="modulo-grid">
          {modules.map((m, i) => {
            const Ic = m.icon;
            return (
              <div className="modulo-card" key={i}>
                <div className="modulo-head">
                  <div className="modulo-icon"><Ic size={15} /></div>
                  <h4>{m.name}</h4>
                </div>
                <p>{m.desc}</p>
                <ul>
                  {m.bullets.map((b, j) => <li key={j}>{b}</li>)}
                </ul>
              </div>
            );
          })}
        </div>
        {note && <p className="modulo-note">{note}</p>}
      </div>
    </section>
  );
}

// ============================================================
// FICHA TÉCNICA — spec sheet rows (the dossier core)
// ============================================================
function FichaTecnica({ eyebrow, title, lead, rows }) {
  return (
    <section className="section section-tight" id="ficha" style={{ background: "rgba(255,255,255,.4)", borderTop: "1px solid rgba(28,25,23,.06)", borderBottom: "1px solid rgba(28,25,23,.06)" }}>
      <div className="wrap">
        <div className="section-head">
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="serif-section" style={{ marginTop: 18 }}
              dangerouslySetInnerHTML={{ __html: title }} />
          <p>{lead}</p>
        </div>
        <div className="ficha">
          {rows.map((r, i) => (
            <div className="ficha-row" key={i}>
              <div className="ficha-label">{r.label}</div>
              <div className="ficha-value" dangerouslySetInnerHTML={{ __html: r.value }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { QuickReference, AnchoredFeatures, Flujo, DemoSection, DarkSteps, Split, Cierre, DossierBar, Perfiles, ModuloCatalogo, FichaTecnica, ProofStrip });
