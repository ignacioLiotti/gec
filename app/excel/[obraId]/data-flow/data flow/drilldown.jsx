/* global React, TRAZA, IcoX, IcoFile, IcoFolder, IcoDownload, IcoEye, IcoDb, IcoChevR */
const { useState } = React;

// =================================================================
// TABLE DRILL-DOWN — slides in from the right, shows real rows
// =================================================================
function TableDrillDown({ tableId, onClose, onOpenDoc }) {
  if (!tableId) return null;
  const t = TRAZA.tablas.find(x => x.id === tableId);
  const data = TRAZA.tablaRows[tableId] || { cols: [], rows: [] };
  const docs = TRAZA.documentos[tableId] || [];

  return (
    <>
      {/* Scrim */}
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(28,25,23,.32)",
        zIndex: 50, animation: "fadeIn .2s ease-out",
      }}/>
      {/* Drawer */}
      <div style={{
        position: "fixed", right: 0, top: 0, bottom: 0,
        width: 720, maxWidth: "92vw",
        background: "#fff", zIndex: 51,
        boxShadow: "-20px 0 50px rgba(0,0,0,.18)",
        display: "flex", flexDirection: "column",
        animation: "slideInRight .26s cubic-bezier(.2,.8,.2,1)",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--stone-200)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: "var(--stone-900)", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}><IcoDb size={16}/></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".15em",
                          textTransform: "uppercase", color: "var(--stone-400)" }}>
              Tabla
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--stone-900)" }}>
              {t.label}
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--stone-500)",
                        fontVariantNumeric: "tabular-nums", marginRight: 8 }}>
            <span><strong style={{ color: "var(--stone-800)" }}>{t.rows}</strong> filas</span>
            <span><strong style={{ color: "var(--stone-800)" }}>{t.cols}</strong> cols</span>
            <span><strong style={{ color: "var(--stone-800)" }}>{docs.length}</strong> docs</span>
          </div>
          <button onClick={onClose} style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: "var(--stone-500)", padding: 6, display: "inline-flex",
          }}><IcoX size={16}/></button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: 20, display: "flex",
                      flexDirection: "column", gap: 20 }}>
          {/* Status banner */}
          {t.status === "empty" && (
            <div style={{
              padding: "14px 16px", background: "#f5f5f4",
              border: "1px solid var(--stone-200)", borderRadius: 8,
              fontSize: 12, color: "var(--stone-700)", lineHeight: 1.5,
            }}>
              <strong>Sin certificados cargados.</strong> Una vez que la entidad apruebe
              el primer certificado mensual, las filas aparecerán acá automáticamente.
            </div>
          )}

          {/* Rows */}
          {data.rows.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".15em",
                            textTransform: "uppercase", color: "var(--stone-400)",
                            marginBottom: 8 }}>
                Filas ({data.rows.length})
              </div>
              <div style={{
                border: "1px solid var(--stone-200)", borderRadius: 8,
                overflow: "hidden", background: "#fff",
              }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      {data.cols.map((c, i) => (
                        <th key={i} style={{
                          textAlign: "left", padding: "9px 12px", fontWeight: 700, fontSize: 9,
                          textTransform: "uppercase", letterSpacing: ".12em", color: "#5b616b",
                          background: "#f1f3f6",
                          borderBottom: "2px solid #c7cbd3",
                          whiteSpace: "nowrap",
                        }}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r, i) => (
                      <tr key={i} style={{ background: i % 2 ? "#fafaf9" : "#fff" }}>
                        {r.map((cell, j) => (
                          <td key={j} style={{
                            padding: "8px 12px", borderBottom: "1px solid #e1e4ea",
                            color: "#1f2328", fontVariantNumeric: "tabular-nums",
                            whiteSpace: "nowrap",
                          }}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Documents */}
          {docs.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".15em",
                            textTransform: "uppercase", color: "var(--stone-400)",
                            marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                <IcoFolder size={12}/> {t.folder} · {docs.length} documento{docs.length !== 1 ? "s" : ""}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {docs.map(d => (
                  <div key={d.id} onClick={() => onOpenDoc({ ...d, table: t.label })} style={{
                    padding: "10px 12px",
                    border: "1px solid var(--stone-200)", borderRadius: 8,
                    background: "#fff", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 12,
                    transition: "background .12s, border-color .12s",
                  }} onMouseEnter={(e) => { e.currentTarget.style.background = "#fafaf9"; e.currentTarget.style.borderColor = "var(--stone-300)"; }}
                     onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "var(--stone-200)"; }}>
                    <div style={{
                      width: 32, height: 40, borderRadius: 4,
                      background: d.type === "pdf" ? "#fef2f2" : d.type === "xls" ? "#ecfdf5" : "#eff6ff",
                      color: d.type === "pdf" ? "#b91c1c" : d.type === "xls" ? "#047857" : "#1e40af",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, fontSize: 9, fontWeight: 800, letterSpacing: ".05em",
                      border: "1px solid currentColor",
                    }}>{d.type.toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--stone-900)",
                                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {d.name}
                      </div>
                      <div style={{ fontSize: 10.5, color: "var(--stone-500)", marginTop: 2,
                                    fontVariantNumeric: "tabular-nums" }}>
                        {d.size} · {d.date}
                      </div>
                    </div>
                    <span style={{ color: "var(--stone-400)" }}><IcoEye size={14}/></span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {docs.length === 0 && data.rows.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: "var(--stone-500)" }}>
              <div style={{ marginBottom: 12, color: "var(--stone-300)" }}>
                <IcoFolder size={48}/>
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--stone-700)" }}>
                Sin filas ni documentos
              </div>
              <div style={{ fontSize: 11, marginTop: 6 }}>
                Subí archivos a <strong style={{ fontFamily: "var(--font-mono)" }}>{t.folder}</strong>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// =================================================================
// DOC PREVIEW — modal mock of a PDF
// =================================================================
function DocPreview({ doc, onClose }) {
  if (!doc) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(28,25,23,.55)",
      zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center",
      padding: 32, animation: "fadeIn .2s ease-out",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 720, maxWidth: "100%", maxHeight: "100%",
        background: "#fff", borderRadius: 12,
        boxShadow: "0 30px 80px rgba(0,0,0,.4)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        animation: "popIn .22s ease-out",
      }}>
        {/* Header */}
        <div style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--stone-200)",
          display: "flex", alignItems: "center", gap: 10, background: "#fafaf9",
        }}>
          <div style={{
            width: 28, height: 36, borderRadius: 3,
            background: doc.type === "pdf" ? "#fef2f2" : "#ecfdf5",
            color: doc.type === "pdf" ? "#b91c1c" : "#047857",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 8, fontWeight: 800, border: "1px solid currentColor",
          }}>{doc.type.toUpperCase()}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--stone-900)" }}>{doc.name}</div>
            <div style={{ fontSize: 10.5, color: "var(--stone-500)", fontVariantNumeric: "tabular-nums" }}>
              {doc.table} · {doc.size} · {doc.date}
            </div>
          </div>
          <button style={{
            background: "#fff", border: "1px solid var(--stone-200)", borderRadius: 6,
            padding: "6px 10px", fontSize: 11, fontWeight: 500, cursor: "pointer",
            color: "var(--stone-700)", display: "inline-flex", alignItems: "center", gap: 5,
            fontFamily: "inherit",
          }}>
            <IcoDownload size={12}/> Descargar
          </button>
          <button onClick={onClose} style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: "var(--stone-500)", padding: 4, display: "inline-flex",
          }}><IcoX size={16}/></button>
        </div>
        {/* Body — fake PDF page */}
        <div style={{
          flex: 1, padding: 24, background: "var(--stone-100)",
          overflow: "auto",
        }}>
          <div style={{
            background: "#fff",
            margin: "0 auto",
            maxWidth: 560,
            aspectRatio: "8.5/11",
            boxShadow: "0 4px 20px rgba(0,0,0,.10), 0 0 0 1px var(--stone-200)",
            padding: "48px 56px",
            fontFamily: "var(--font-serif)",
            color: "var(--stone-900)",
            position: "relative",
          }}>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: ".2em",
              textTransform: "uppercase", color: "var(--stone-400)",
              fontFamily: "var(--font-sans)", marginBottom: 32,
              borderBottom: "1px solid var(--stone-200)", paddingBottom: 8,
            }}>
              {doc.table}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.3, marginBottom: 6 }}>
              {doc.name.replace(/\.[a-z]+$/, "")}
            </div>
            <div style={{
              fontSize: 10, color: "var(--stone-500)", fontFamily: "var(--font-sans)",
              fontVariantNumeric: "tabular-nums", marginBottom: 24,
            }}>
              Hospital Municipal Norte · EX-2024-1856-MSAL · {doc.date}
            </div>
            {/* Skeleton lines */}
            {[0.95, 0.88, 0.92, 0.7, 0.85, 0.9, 0.6].map((w, i) => (
              <div key={i} style={{
                height: 8, background: "var(--stone-100)", borderRadius: 2,
                marginBottom: 10, width: `${w * 100}%`,
              }}/>
            ))}
            <div style={{ height: 24 }}/>
            {[0.92, 0.86, 0.78, 0.9, 0.55].map((w, i) => (
              <div key={i} style={{
                height: 8, background: "var(--stone-100)", borderRadius: 2,
                marginBottom: 10, width: `${w * 100}%`,
              }}/>
            ))}
            <div style={{
              position: "absolute", bottom: 32, right: 56,
              fontSize: 9, color: "var(--stone-400)", fontFamily: "var(--font-mono)",
            }}>1 / 1</div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.TableDrillDown = TableDrillDown;
window.DocPreview = DocPreview;
