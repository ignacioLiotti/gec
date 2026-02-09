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
	primaryColor: "#1f2328",
	mutedColor: "#6b7280",
	alternateRowBg: "#f7f8fb",
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

/* Report header styles – formal / governmental */
.report-header {
	margin-bottom: 24px;
	padding-bottom: 16px;
	border-bottom: 3px double ${opts.primaryColor};
	text-align: center;
}

.report-header .company-name {
	font-size: 1.75em;
	font-weight: 700;
	letter-spacing: 0.04em;
	text-transform: uppercase;
	margin-bottom: 6px;
}

.report-header .report-title {
	font-size: 1.15em;
	color: ${opts.mutedColor};
	font-style: italic;
	margin-bottom: 4px;
}

.report-header .report-date {
	font-size: 0.85em;
	color: ${opts.mutedColor};
	letter-spacing: 0.06em;
	font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
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
	background-color: #f1f3f6;
	font-weight: 700;
	text-align: left;
	padding: 7px 10px;
	border-bottom: 2px solid #c7cbd3;
	border-top: 1px solid #c7cbd3;
	font-size: 0.8em;
	text-transform: uppercase;
	letter-spacing: 0.08em;
	color: ${opts.mutedColor};
}

td {
	padding: 5px 10px;
	border-bottom: 1px solid #e1e4ea;
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
	background-color: #eef1f5 !important;
	font-weight: 700;
	border-top: 2px solid #c7cbd3;
}

.totals-row td,
.report-totals-row td {
	padding: 7px 10px;
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
	font-size: 1.1em;
	font-weight: 600;
	margin-bottom: 8px;
	padding-bottom: 6px;
	border-bottom: 1px solid #d4d7dd;
	letter-spacing: 0.02em;
}

/* Table container with border */
.table-container {
	border: 1px solid #d4d7dd;
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
	background: #c7cbd3;
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
