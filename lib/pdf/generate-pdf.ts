import { wrapHtmlForPrint, type PrintStylesOptions } from "./print-styles";

export type GeneratePdfOptions = {
	/** Company name for header */
	companyName: string;
	/** Report title for header */
	reportTitle: string;
	/** Date string for header */
	date: string;
	/** Page format */
	format?: "A4" | "Letter";
	/** Landscape orientation */
	landscape?: boolean;
	/** Print style options */
	styleOptions?: PrintStylesOptions;
};

export type GeneratePdfResult = {
	success: boolean;
	error?: string;
};

/**
 * Generates a PDF from the report content
 * 
 * @param reportElement - The DOM element containing the report content to print
 * @param options - PDF generation options
 * @returns Promise with success status
 */
export async function generatePdf(
	reportElement: HTMLElement,
	options: GeneratePdfOptions
): Promise<GeneratePdfResult> {
	try {
		// Clone the element to avoid modifying the original
		const clone = reportElement.cloneNode(true) as HTMLElement;

		// Remove any elements marked as screen-only or no-print
		clone.querySelectorAll(".screen-only, .no-print").forEach((el) => el.remove());

		// Remove any interactive elements (inputs that should show their values)
		clone.querySelectorAll("input, button").forEach((el) => {
			if (el instanceof HTMLInputElement) {
				// Replace input with its value as text
				const span = document.createElement("span");
				span.textContent = el.value;
				span.className = el.className;
				el.replaceWith(span);
			} else if (el instanceof HTMLButtonElement) {
				el.remove();
			}
		});

		// Build the report HTML structure
		const reportHtml = buildReportHtml(clone.innerHTML, options);

		// Wrap with print styles
		const fullHtml = wrapHtmlForPrint(reportHtml, options.styleOptions);

		// Send to API
		const response = await fetch("/api/pdf-render", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				html: fullHtml,
				options: {
					companyName: options.companyName,
					reportTitle: options.reportTitle,
					date: options.date,
					format: options.format || "A4",
					landscape: options.landscape || false,
				},
			}),
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(errorData.error || `HTTP error: ${response.status}`);
		}

		// Get the PDF blob
		const pdfBlob = await response.blob();

		// Trigger download
		downloadBlob(
			pdfBlob,
			`${options.reportTitle.replace(/[^a-zA-Z0-9]/g, "_")}_${options.date.replace(/\//g, "-")}.pdf`
		);

		return { success: true };
	} catch (error) {
		console.error("PDF generation failed:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Error desconocido",
		};
	}
}

/**
 * Builds the report HTML with proper structure for printing
 */
function buildReportHtml(contentHtml: string, options: GeneratePdfOptions): string {
	return `
		<div class="report-header">
			<div class="company-name">${escapeHtml(options.companyName)}</div>
			<div class="report-title">${escapeHtml(options.reportTitle)}</div>
			<div class="report-date">${escapeHtml(options.date)}</div>
		</div>
		<div class="report-content">
			${contentHtml}
		</div>
	`;
}

/**
 * Escapes HTML special characters
 */
function escapeHtml(text: string): string {
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

/**
 * Triggers a file download from a blob
 */
function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

/**
 * Converts a table element to print-optimized HTML
 * Ensures proper classes for styling
 */
export function prepareTableForPrint(tableElement: HTMLTableElement): string {
	const clone = tableElement.cloneNode(true) as HTMLTableElement;

	// Ensure thead exists and has proper structure
	let thead = clone.querySelector("thead");
	if (!thead) {
		const firstRow = clone.querySelector("tr");
		if (firstRow && firstRow.querySelector("th")) {
			thead = document.createElement("thead");
			thead.appendChild(firstRow);
			clone.insertBefore(thead, clone.firstChild);
		}
	}

	// Ensure tbody exists
	let tbody = clone.querySelector("tbody");
	if (!tbody) {
		tbody = document.createElement("tbody");
		const rows = clone.querySelectorAll("tr:not(thead tr)");
		rows.forEach((row) => tbody!.appendChild(row));
		clone.appendChild(tbody);
	}

	// Add table-container wrapper
	const wrapper = document.createElement("div");
	wrapper.className = "table-container";
	wrapper.appendChild(clone);

	return wrapper.outerHTML;
}




