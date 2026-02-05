/**
 * Print-optimized CSS for PDF generation
 * Ensures proper pagination, table header repetition, and consistent styling
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
	primaryColor: "#1a1a1a",
	mutedColor: "#6b7280",
	alternateRowBg: "#f9fafb",
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
	line-height: 1.5;
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

/* Report header styles */
.report-header {
	margin-bottom: 24px;
	padding-bottom: 16px;
	border-bottom: 2px solid ${opts.primaryColor};
}

.report-header .company-name {
	font-size: 1.75em;
	font-weight: 700;
	margin-bottom: 4px;
}

.report-header .report-title {
	font-size: 1.25em;
	color: ${opts.mutedColor};
	margin-bottom: 4px;
}

.report-header .report-date {
	font-size: 0.9em;
	color: ${opts.mutedColor};
}

/* Table styles */
table {
	width: 100%;
	border-collapse: collapse;
	margin-bottom: 24px;
	font-size: 0.95em;
}

/* CRITICAL: This makes table headers repeat on each page */
thead {
	display: table-header-group;
}

/* Ensure tbody doesn't break weirdly */
tbody {
	display: table-row-group;
}

/* Footer group for totals */
tfoot {
	display: table-footer-group;
}

th {
	background-color: #f3f4f6;
	font-weight: 600;
	text-align: left;
	padding: 10px 12px;
	border-bottom: 2px solid #d1d5db;
	font-size: 0.85em;
	text-transform: uppercase;
	letter-spacing: 0.025em;
	color: ${opts.mutedColor};
}

td {
	padding: 8px 12px;
	border-bottom: 1px solid #e5e7eb;
	vertical-align: top;
}

/* CRITICAL: Prevent rows from breaking across pages */
tr {
	page-break-inside: avoid;
	break-inside: avoid;
}

/* Alternating row colors */
tbody tr:nth-child(even) {
	background-color: ${opts.alternateRowBg};
}

/* Hover is not needed for print, but won't hurt */
tbody tr:hover {
	background-color: #f3f4f6;
}

/* Text alignment utilities */
.text-left { text-align: left; }
.text-center { text-align: center; }
.text-right { text-align: right; }

/* Font weight utilities */
.font-mono { font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace; }
.font-bold { font-weight: 600; }
.font-semibold { font-weight: 500; }

/* Aggregation/totals row */
.totals-row {
	background-color: #e5e7eb !important;
	font-weight: 600;
	border-top: 2px solid #9ca3af;
}

.totals-row td {
	padding: 10px 12px;
}

/* Group section styles */
.group-section {
	margin-bottom: 32px;
	page-break-inside: avoid;
}

.group-section:last-child {
	margin-bottom: 0;
}

.group-title {
	font-size: 1.15em;
	font-weight: 600;
	margin-bottom: 12px;
	padding-bottom: 6px;
	border-bottom: 1px solid #d1d5db;
}

/* Table container with border */
.table-container {
	border: 1px solid #d1d5db;
	border-radius: 6px;
	overflow: hidden;
}

/* Currency formatting */
.currency {
	font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
	text-align: right;
}

/* Boolean display */
.boolean-yes {
	color: #059669;
	font-weight: 500;
}

.boolean-no {
	color: #dc2626;
	font-weight: 500;
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







