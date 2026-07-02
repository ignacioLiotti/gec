/**
 * Print-optimized CSS for PDF generation
 * Governmental / paper-skeuomorphic aesthetic
 */

export type PrintStylesOptions = {
	/** Base font size in pixels */
	baseFontSize?: number;
	/** Primary color for headers and accents */
	primaryColor?: string;
	/** Muted color for borders and secondary text */
	mutedColor?: string;
	/** Background color for alternating rows */
	alternateRowBg?: string;
};

const defaultOptions: Required<PrintStylesOptions> = {
	baseFontSize: 11,
	primaryColor: "#1c1917",
	mutedColor: "#78716c",
	alternateRowBg: "#f8f9fa",
};

/**
 * Generates print-optimized CSS for PDF rendering
 */
export function generatePrintStyles(options: PrintStylesOptions = {}): string {
	const opts = { ...defaultOptions, ...options };

	return `
/* Reset and base styles */
*, *::before, *::after {
	box-sizing: border-box;
	margin: 0;
	padding: 0;
}

html, body {
	font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
	font-size: ${opts.baseFontSize}px;
	line-height: 1.6;
	color: ${opts.primaryColor};
	background: white;
	-webkit-print-color-adjust: exact;
	print-color-adjust: exact;
}

/* Page break controls */
.page-break-before {
	page-break-before: always;
	break-before: page;
}

.page-break-after {
	page-break-after: always;
	break-after: page;
}

.avoid-break {
	page-break-inside: avoid;
	break-inside: avoid;
}

/* Report header styles - purchase-order paper aesthetic */
.report-header {
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(12em, 18em);
	gap: 24px;
	margin-bottom: 24px;
	padding-bottom: 16px;
	border-bottom: 1px solid #e5e7eb;
	text-align: left;
}

.report-header .company-name {
	position: relative;
	font-size: 1.75em;
	font-weight: 700;
	letter-spacing: 0;
	text-transform: uppercase;
	padding-left: 28px;
	line-height: 1.1;
}

.report-header .company-name::before {
	content: "";
	position: absolute;
	left: 0;
	top: 0.12em;
	width: 16px;
	height: 16px;
	border-radius: 999px;
	background: #ff5800;
}

.report-header .report-doc-head {
	text-align: right;
}

.report-header .report-label {
	font-size: 0.82em;
	color: #a8a29e;
	font-weight: 700;
	letter-spacing: 0.2em;
	text-transform: uppercase;
}

.report-header .report-title {
	font-size: 1.55em;
	line-height: 1.08;
	color: ${opts.primaryColor};
	font-style: normal;
	font-weight: 700;
	letter-spacing: 0;
	text-transform: none;
	margin-bottom: 5px;
	text-align: right;
}

.report-header .report-date {
	font-size: 0.85em;
	color: ${opts.mutedColor};
	letter-spacing: 0;
	font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
	text-align: right;
}

/* Table styles */
table {
	width: 100%;
	border-collapse: collapse;
	margin-bottom: 24px;
	font-size: 0.95em;
}

/* Table headers repeat on each printed page */
thead {
	display: table-header-group;
}

tbody {
	display: table-row-group;
}

tfoot {
	display: table-footer-group;
}

th {
	background-color: #ffffff;
	font-weight: 700;
	text-align: left;
	padding: 0 8px 8px;
	border-bottom: 1px solid #1c1917;
	border-top: 0;
	font-size: 0.8em;
	text-transform: uppercase;
	letter-spacing: 0.1em;
	color: #292524;
}

td {
	padding: 7px 8px;
	border-bottom: 1px solid #e5e7eb;
	vertical-align: top;
}

/* Prevent rows from breaking across pages */
tr {
	page-break-inside: avoid;
	break-inside: avoid;
}

/* Alternating row colors */
tbody tr:nth-child(even) {
	background-color: ${opts.alternateRowBg};
}

/* Text alignment utilities */
.text-left { text-align: left; }
.text-center { text-align: center; }
.text-right { text-align: right; }

/* Font weight utilities */
.font-mono { font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace; }
.font-bold { font-weight: 700; }
.font-semibold { font-weight: 600; }

/* Aggregation/totals row */
.totals-row,
.report-totals-row {
	background-color: #f8f9fa !important;
	font-weight: 700;
	border-top: 1px solid #1c1917;
}

.totals-row td,
.report-totals-row td {
	padding: 8px;
	border-bottom: none;
}

/* Group section styles */
.group-section,
.report-table-section {
	margin-bottom: 28px;
	page-break-inside: auto;
	break-inside: auto;
}


.group-section:last-child,
.report-table-section:last-child {
	margin-bottom: 0;
}

.group-title,
.report-group-title {
	font-size: 0.9em;
	font-weight: 700;
	margin-bottom: 10px;
	padding-bottom: 8px;
	border-bottom: 1px solid #1c1917;
	letter-spacing: 0.18em;
	text-transform: uppercase;
	color: #a8a29e;
}

/* Table container with border */
.table-container {
	border: 1px solid #e5e7eb;
	border-radius: 4px;
	overflow: hidden;
}

/* Currency formatting */
.currency {
	font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
	text-align: right;
}

/* Boolean display */
.boolean-yes {
	color: #3d7a45;
	font-weight: 600;
}

.boolean-no {
	color: #9c3a3a;
	font-weight: 600;
}

/* Empty state */
.empty-state {
	text-align: center;
	padding: 48px 24px;
	color: ${opts.mutedColor};
	font-style: italic;
}

/* Spacing utilities */
.mt-4 { margin-top: 16px; }
.mt-8 { margin-top: 32px; }
.mb-4 { margin-bottom: 16px; }
.mb-8 { margin-bottom: 32px; }

/* Ensure images print properly */
img {
	max-width: 100%;
	height: auto;
	-webkit-print-color-adjust: exact;
	print-color-adjust: exact;
}

/* Hide elements meant only for screen */
.screen-only {
	display: none !important;
}

/* Footer rule for end-of-document */
.report-footer-line {
	margin-top: 32px;
	height: 1px;
	background: #e5e7eb;
}
`.trim();
}

/**
 * Generates a complete HTML document with print styles
 */
export function wrapHtmlForPrint(
	bodyContent: string,
	options: PrintStylesOptions = {}
): string {
	const styles = generatePrintStyles(options);

	return `<!DOCTYPE html>
<html lang="es">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Report</title>
	<style>${styles}</style>
</head>
<body>
	${bodyContent}
</body>
</html>`;
}
