import type { Metadata } from "next";

import OperativoLandingClient from "../_components/operativo-landing-client";

export const metadata: Metadata = {
	title: "Sintesis — Sistema operativo de obras",
	description:
		"Documentos, datos, alertas y equipo de cada obra en un solo lugar. Landing y dossier comercial de Sintesis, enfoque operativo.",
};

export default function OperativoLandingPage() {
	return <OperativoLandingClient />;
}
