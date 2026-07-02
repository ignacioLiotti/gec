import type { Metadata } from "next";

import FinancieroLandingClient from "../_components/financiero-landing-client";

export const metadata: Metadata = {
	title: "Sintesis — Control financiero de obras",
	description:
		"Certificados, avances, saldos y respaldo documental por obra. Landing y dossier comercial de Sintesis, enfoque financiero.",
};

export default function FinancieroLandingPage() {
	return <FinancieroLandingClient />;
}
