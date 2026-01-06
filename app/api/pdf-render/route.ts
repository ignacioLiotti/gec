import { NextRequest, NextResponse } from "next/server";
import puppeteer, { type Browser, type LaunchOptions } from "puppeteer-core";

export const maxDuration = 60; // Allow up to 60 seconds for PDF generation
export const dynamic = "force-dynamic";

type PdfRenderRequest = {
	html: string;
	options?: {
		companyName?: string;
		reportTitle?: string;
		date?: string;
		format?: "A4" | "Letter";
		landscape?: boolean;
	};
};

/**
 * Header template for PDF pages
 * Uses Puppeteer's special classes for dynamic page info
 */
function createHeaderTemplate(
	companyName: string,
	reportTitle: string,
	date: string
): string {
	return `
		<div style="
			width: 100%;
			font-size: 9px;
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			padding: 0 15mm;
			display: flex;
			justify-content: space-between;
			align-items: center;
			color: #6b7280;
			border-bottom: 1px solid #e5e7eb;
			padding-bottom: 5mm;
		">
			<span style="font-weight: 600; color: #1a1a1a;">${companyName}</span>
			<span>${reportTitle}</span>
			<span>${date}</span>
		</div>
	`;
}

/**
 * Footer template for PDF pages
 * Uses Puppeteer's special classes for page numbers
 */
function createFooterTemplate(): string {
	return `
		<div style="
			width: 100%;
			font-size: 9px;
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			padding: 0 15mm;
			display: flex;
			justify-content: center;
			align-items: center;
			color: #6b7280;
			border-top: 1px solid #e5e7eb;
			padding-top: 5mm;
		">
			<span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
		</div>
	`;
}

/**
 * Get browser launch options based on environment
 * - Local dev: Uses puppeteer's bundled Chromium or system Chrome
 * - Production (Vercel): Uses @sparticuz/chromium
 */
async function getBrowserLaunchOptions(): Promise<LaunchOptions> {
	const isDev = process.env.NODE_ENV === "development";

	if (isDev) {
		// For local development, try to use puppeteer's bundled Chromium
		try {
			// Dynamic import puppeteer (full version with bundled Chromium)
			const puppeteerFull = await import("puppeteer");
			const executablePath = puppeteerFull.default.executablePath();
			
			return {
				executablePath,
				headless: true,
				args: ["--no-sandbox", "--disable-setuid-sandbox"],
			};
		} catch {
			// Fallback: try common Chrome installation paths on Windows
			const commonPaths = [
				"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
				"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
				process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe",
			];

			for (const chromePath of commonPaths) {
				try {
					const fs = await import("fs");
					if (fs.existsSync(chromePath)) {
						return {
							executablePath: chromePath,
							headless: true,
							args: ["--no-sandbox", "--disable-setuid-sandbox"],
						};
					}
				} catch {
					continue;
				}
			}

			throw new Error(
				"No Chrome installation found. Please install Chrome or run: npm install puppeteer"
			);
		}
	}

	// Production: use @sparticuz/chromium for serverless
	const chromium = (await import("@sparticuz/chromium")).default;
	const executablePath = await chromium.executablePath();

	return {
		args: chromium.args,
		defaultViewport: { width: 1920, height: 1080 },
		executablePath,
		headless: true,
	};
}

export async function POST(request: NextRequest) {
	let browser: Browser | null = null;

	try {
		const body: PdfRenderRequest = await request.json();

		if (!body.html) {
			return NextResponse.json(
				{ error: "HTML content is required" },
				{ status: 400 }
			);
		}

		const {
			companyName = "Empresa",
			reportTitle = "Reporte",
			date = new Date().toLocaleDateString("es-AR"),
			format = "A4",
			landscape = false,
		} = body.options || {};

		// Get browser options based on environment
		const launchOptions = await getBrowserLaunchOptions();
		browser = await puppeteer.launch(launchOptions);

		const page = await browser.newPage();

		// Set the HTML content
		await page.setContent(body.html, {
			waitUntil: "networkidle0",
		});

		// Generate PDF with proper configuration
		const pdfBuffer = await page.pdf({
			format,
			landscape,
			margin: {
				top: "25mm", // Space for header
				bottom: "25mm", // Space for footer
				left: "15mm",
				right: "15mm",
			},
			displayHeaderFooter: true,
			headerTemplate: createHeaderTemplate(companyName, reportTitle, date),
			footerTemplate: createFooterTemplate(),
			printBackground: true,
			preferCSSPageSize: false,
		});

		await browser.close();
		browser = null;

		// Convert Uint8Array to Buffer for NextResponse
		const buffer = Buffer.from(pdfBuffer);

		// Return PDF as blob
		return new NextResponse(buffer, {
			status: 200,
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": `attachment; filename="${reportTitle.replace(/[^a-zA-Z0-9]/g, "_")}_${date.replace(/\//g, "-")}.pdf"`,
				"Content-Length": buffer.length.toString(),
			},
		});
	} catch (error) {
		console.error("PDF generation error:", error);

		if (browser) {
			await browser.close();
		}

		return NextResponse.json(
			{
				error: "Failed to generate PDF",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
