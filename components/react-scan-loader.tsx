"use client";

import { useEffect } from "react";

const REACT_SCAN_SCRIPT_ID = "react-scan-auto";

export function ReactScanLoader() {
	useEffect(() => {
		if (document.getElementById(REACT_SCAN_SCRIPT_ID)) return;

		const script = document.createElement("script");
		script.id = REACT_SCAN_SCRIPT_ID;
		script.src = "https://unpkg.com/react-scan/dist/auto.global.js";
		script.crossOrigin = "anonymous";
		script.async = true;
		document.head.appendChild(script);
	}, []);

	return null;
}
