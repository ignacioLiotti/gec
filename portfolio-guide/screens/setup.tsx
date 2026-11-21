import { useState } from "react";
import { SampleAnalysisCard } from "@/app/admin/obra-defaults/_components/SampleAnalysisCard";
import { Button } from "@/components/ui/button";
import { sampleAnalysis } from "../sample-data";
export default function Setup() {
  const [definition, setDefinition] = useState("");
  const [version, setVersion] = useState(0);
  return (
    <div className="product-page setup-page">
      <header>
        <h1>Configurar desde un ejemplo</h1>
        <p>
          La propuesta está precargada. Elegí campos, revisá las preguntas y
          aplicá la configuración localmente.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setVersion(version + 1);
            setDefinition("");
          }}
        >
          Restablecer propuesta
        </Button>
      </header>
      <SampleAnalysisCard
        key={version}
        initialSample={{
          fileName: "certificado-torre-madero.pdf",
          analysis: sampleAnalysis,
        }}
        allowSampleReplacement={false}
        onApply={setDefinition}
      />
      {definition && (
        <details className="definition-output" open>
          <summary>Configuración producida por el componente</summary>
          <pre>{JSON.stringify(JSON.parse(definition), null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
