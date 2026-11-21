"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, FilePlus2, FolderOpen, MessageSquareText, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GenerateDemo } from "./generate-demo";
import { AskDemo } from "./ask-demo";
import { CaptureDemo } from "./capture-demo";
import { demoFlows, demoWork, type DemoFlags, type DemoFlow } from "./fixtures";
import styles from "./demos.module.css";

const icons = { generate: FilePlus2, ask: MessageSquareText, capture: Upload };

export function ContextualFlowDemos({ initialFlow, initialFlags }: { initialFlow: DemoFlow; initialFlags: DemoFlags }) {
  const [flow, setFlow] = useState(initialFlow);
  const [flags, setFlags] = useState(initialFlags);

  function updateUrl(nextFlow: DemoFlow, nextFlags: DemoFlags) {
    const query = new URLSearchParams({ flow: nextFlow });
    for (const item of demoFlows) query.set(item.id, nextFlags[item.id] ? "1" : "0");
    window.history.replaceState(null, "", `?${query}`);
  }

  function selectFlow(nextFlow: DemoFlow) {
    setFlow(nextFlow);
    updateUrl(nextFlow, flags);
  }

  function toggleFlag(id: DemoFlow, checked: boolean) {
    const nextFlags = { ...flags, [id]: checked };
    setFlags(nextFlags);
    updateUrl(flow, nextFlags);
  }

  const activeFlow = demoFlows.find(item => item.id === flow)!;
  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>SÍNTESIS<span>.</span><Badge variant="outline">Demos de recorridos</Badge></div>
        <p>Datos de ejemplo. Los cambios se conservan mientras esta página esté abierta.</p>
      </header>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.company}><Building2 className="size-5" /><div><strong>{demoWork.company}</strong><span>Espacio de demostración</span></div></div>
          <nav aria-label="Recorridos de demostración" className={styles.navigation}>
            {demoFlows.map(item => {
              const Icon = icons[item.id];
              return <button key={item.id} aria-current={flow === item.id ? "page" : undefined} onClick={() => selectFlow(item.id)}><Icon className="size-4" /><span>{item.label}<small>{item.description}</small></span></button>;
            })}
          </nav>
          <div className={styles.experiments}>
            <h2>Propuestas activas</h2>
            {demoFlows.map(item => <label key={item.id} className={styles.switchRow}><span>{item.label}</span><Switch checked={flags[item.id]} onCheckedChange={value => toggleFlag(item.id, value)} aria-label={`Activar mejora: ${item.label}`} /></label>)}
            <p>Apagá un interruptor para recorrer la alternativa con selección manual. Los formularios conservan sus cambios al alternar.</p>
          </div>
        </aside>
        <main className={styles.main}>
          <div className={styles.workspaceHeading}>
            <div><p className={styles.eyebrow}>Obras / {demoWork.label}</p><h1>{activeFlow.label}</h1><p className={styles.muted}>{activeFlow.description}</p></div>
            <Tabs value={flags[flow] ? "contextual" : "manual"} onValueChange={value => toggleFlag(flow, value === "contextual")}>
              <TabsList aria-label="Versión del recorrido"><TabsTrigger value="manual">Selección manual</TabsTrigger><TabsTrigger value="contextual">Desde la obra</TabsTrigger></TabsList>
            </Tabs>
          </div>
          <div className={styles.obraBar}><span><FolderOpen className="size-4" /> {demoWork.label} / Documentos / {demoWork.folder}</span><Badge variant="neutral">Ejemplo local</Badge></div>
          {/* Each flow owns its draft. Keeping inactive flows mounted preserves it. */}
          <div hidden={flow !== "generate"}><GenerateDemo contextual={flags.generate} /></div>
          <div hidden={flow !== "ask"}><AskDemo contextual={flags.ask} /></div>
          <div hidden={flow !== "capture"}><CaptureDemo contextual={flags.capture} /></div>
          <footer className={styles.footer}><Button variant="link" asChild><Link href="/portfolio/previews/obra" prefetch={false}><ArrowLeft className="size-3.5" /> Vista de obra existente</Link></Button><p>Se reutilizan controles y reglas de presentación del proyecto. OCR, consultas y persistencia son simulados.</p></footer>
        </main>
      </div>
    </div>
  );
}
