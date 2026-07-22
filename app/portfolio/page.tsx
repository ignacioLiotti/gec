import type { Metadata } from "next";
import {
	ArrowDown,
	Braces,
	Database,
	FolderOpen,
	Gauge,
	Layers3,
	ScanText,
	ShieldCheck,
} from "lucide-react";

import { LiveProductPreview } from "./_components/live-product-preview";
import { DocumentThumbnail } from "./_components/document-thumbnail";
import { PortfolioThemeToggle } from "./_components/portfolio-theme-toggle";
import { RotatingSubtitle } from "./_components/rotating-subtitle";
import { NotchTail } from "@/components/ui/notch-tail";
import styles from "./portfolio.module.css";

const rotatingSubtitles = [
	"I turn operational complexity into usable products.",
	"I build interfaces that reveal what matters.",
	"I design the path from signal to decision.",
	"I connect product logic to human action.",
	"I make difficult systems easier to trust.",
	"I turn dense workflows into clear decisions.",
	"I build software for real operational work.",
	"I make complex products feel direct.",
	"I bring structure to messy systems.",
	"I design interfaces around how work actually happens.",
] as const;

const storyCards = [
	{
		number: "01",
		eyebrow: "· Operational workspace",
		title: "I make dense operational data legible.",
		body: "I shaped the project model and interface together, turning complex operational data into one clear workspace. Teams can scan, edit, and act without losing context, while filters, inline editing, and save states keep the workflow continuous.",
		previewSrc: "/portfolio/previews/obras",
		previewTitle: "Dense operational data made legible",
		chromeLabel: "Síntesis / Dense operational data",
		previewWidth: 1280,
		previewHeight: 760,
		tags: ["Information architecture", "TanStack Table", "Optimistic updates"],
	},
	{
		number: "02",
		eyebrow: "· Document intelligence",
		title: "I integrate AI into the workflow—not around it.",
		body: "I rebuilt document navigation for fast, server-first access, then placed OCR inside the same flow. Every extracted value stays linked to its source, while loading, scanning, and review states make progress and lineage visible instead of hiding them in a black box.",
		previewSrc: "/portfolio/previews/ocr-workflow",
		previewTitle: "Native document navigation and source-linked OCR",
		chromeLabel: "Síntesis / Native AI document workflow",
		previewWidth: 1280,
		previewHeight: 760,
		tags: ["RSC · SSR · Prefetching", "Source-linked OCR", "Visible system states"],
	},
	{
		number: "03",
		eyebrow: "· Hierarchical operations",
		title: "I make complex hierarchies explorable.",
		body: "This multidimensional dashboard makes a large operational system navigable across two axes. Its positional dimension lets operators move through locations, device classes, profiles, and individual devices without losing context. Its temporal dimension lets them select and compare two points in time.",
		previewSrc: "/portfolio/previews/hierarchy-explorer",
		previewTitle: "Interactive device hierarchy explorer",
		chromeLabel: "Zequenze / Hierarchy explorer",
		previewWidth: 1440,
		previewHeight: 900,
		tags: ["Hierarchy navigation", "Interactive time-series", "Portable React architecture"],
	},
] as const;

const decisions = [
	{
		icon: Database,
		label: "Navigation architecture",
		choice: "Server-first routes with prefetched next steps",
		result:
			"RSC and SSR deliver useful content on arrival. Likely next routes are prefetched so deep document navigation feels continuous rather than page-by-page.",
	},
	{
		icon: Gauge,
		label: "Perceived performance",
		choice: "Progressive loading without layout instability",
		result:
			"Skeletons preserve structure, cached returns remove repeat waits, and expensive views load only when needed. Motion communicates progress without blocking the next action.",
	},
	{
		icon: ShieldCheck,
		label: "Trust in automation",
		choice: "Source-linked results with visible review states",
		result:
			"Extracted values remain connected to their source coordinates. Confidence, review, and failure states stay visible so automation can be checked instead of accepted on faith.",
	},
] as const;

const stack = [
	{ icon: Braces, label: "React / Next.js", note: "Frontend architecture" },
	{ icon: Layers3, label: "TypeScript / Design systems", note: "Interface systems" },
	{ icon: ScanText, label: "Python / APIs", note: "Automation and AI workflows" },
	{ icon: Database, label: "Postgres / Supabase", note: "Data modeling and delivery" },
] as const;

export const metadata: Metadata = {
	title: "Hello, Profound — Ignacio Liotti",
	description:
		"An inspectable cover letter for Profound: frontend depth, product judgment, and end-to-end ownership.",
	openGraph: {
		title: "Hello, Profound — Ignacio Liotti",
		description:
			"Frontend depth and end-to-end ownership, demonstrated through interactive product cases.",
		type: "website",
	},
	robots: {
		index: true,
		follow: true,
	},
};

function ProductChrome({ label }: { label: string }) {
	return (
		<div className={`${styles.productChrome} flex h-11 items-center justify-between border-b px-4 sm:px-5`}>
			<div className="flex items-center gap-1.5" aria-hidden="true">
				<span className="size-1.5 rounded-full bg-white/30" />
				<span className="size-1.5 rounded-full bg-white/15" />
				<span className="size-1.5 rounded-full bg-white/15" />
			</div>
			<p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">
				{label}
			</p>
			<span className="size-1.5 rounded-full bg-emerald-400" aria-label="Live product" />
		</div>
	);
}

export default function PortfolioPage() {
	return (
		<article
			lang="en"
			className={`${styles.root} min-h-screen overflow-x-hidden selection:bg-[#9eb3ff] selection:text-black`}
		>
			<header className={`${styles.header} sticky top-0 z-50 border-b backdrop-blur-xl`}>
				<nav
					aria-label="Portfolio navigation"
					className="mx-auto flex h-16 max-w-[1180px] items-center justify-between border-x border-white/10 px-5 sm:px-7"
				>
					<a
						href="#top"
						className={`${styles.pressable} inline-flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--portfolio-accent)]`}
					>
						<span className="grid size-7 place-items-center rounded-md border border-white/20 bg-white text-[10px] font-semibold text-black">
							IL
						</span>
						<span className="text-sm font-medium tracking-[-0.01em]">Ignacio Liotti</span>
					</a>

					<div className="flex items-center gap-1 sm:gap-3">
						<PortfolioThemeToggle />
					</div>
				</nav>
			</header>

			<main id="top">
				<section className={`${styles.heroGrid} mx-auto max-w-[1180px] border-x border-white/10 px-5 pb-16 pt-20 sm:px-8 sm:pb-24 sm:pt-28 lg:px-12`}>
					<div className={`${styles.reveal} mx-auto max-w-[900px] text-center`}>
						<p className="mx-auto mb-7 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs font-medium text-white/60">
							<span className="size-1.5 rounded-full bg-[var(--portfolio-accent)]" />
							A cover letter you can inspect
						</p>
						<h1 className="text-[clamp(3.25rem,7vw,5.5rem)] font-medium leading-[0.98] tracking-[-0.055em] text-white">
							Hello, Profound.
						</h1>
						<p className="mx-auto mt-7 max-w-[850px] text-xl font-medium leading-tight tracking-[-0.025em] text-white/56 sm:text-2xl">
							<RotatingSubtitle options={rotatingSubtitles} />
						</p>
						<div className="mt-8 flex flex-wrap justify-center gap-3">
							<a
								href="#work"
								className={`${styles.pressable} inline-flex items-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-medium text-black`}
							>
								Explore the work
								<ArrowDown aria-hidden="true" className="size-4" />
							</a>
						</div>
					</div>

					<div className="mx-auto max-w-[1180px]  px-5 py-12 sm:px-8 lg:px-2">
						<div className="grid border-y border-white/10 lg:grid-cols-3">
							{[
								["What I understand", "The domain, constraints, data, and decisions that shape the product before they become an interface."],
								["What I own", "Product definition, UX, frontend architecture, system integration, and delivery."],
								["What I ship", "Precise, production-ready tools that make complex work easier to understand, trust, and act on."],
							].map(([label, body], index) => (
								<div
									key={label}
									className={`py-7 lg:px-7 ${index > 0 ? "border-t border-white/10 lg:border-l lg:border-t-0" : ""}`}
								>

									<p className="text-xs font-medium text-white/38 flex items-center gap-2">
										<span className="text-[var(--portfolio-accent)]">{index + 1}</span>
										{label}
									</p>
									<p className="mt-4 text-sm leading-6 text-white/68">{body}</p>
								</div>
							))}
						</div>
					</div>


				</section>



				<section id="work" className="scroll-mt-16 border-t border-white/10">
					<div id="work-content" className="mx-auto max-w-[1180px] border-x border-white/10 px-5 pb-20 pt-12 sm:px-8 sm:pb-28 sm:pt-16 lg:px-12">
						<div className="grid gap-6 border-b border-white/10 pb-12 sm:grid-cols-[1fr_360px] sm:items-end">
							<div>
								<p className={styles.eyebrow}>Three product cases</p>
								<h2 className="mt-4 text-[clamp(2.4rem,4.5vw,4rem)] font-medium tracking-[-0.04em]">
									What the work looks like in practice.
								</h2>
							</div>
							<p className="text-sm leading-6 text-white/44">
								Each case follows a different layer of the same work: dense operational data, source-linked AI, and complex hierarchies made explorable.
							</p>
						</div>

						<div>
							{storyCards.map((story) => (
								<article key={story.number} className="grid gap-8 border-b border-white/10 py-14 lg:grid-cols-[0.38fr_1fr] lg:gap-12 lg:py-20">
									<div>
										<p className="flex items-center gap-3 text-xs font-medium text-white/40">
											<span className="font-mono text-[10px] text-[var(--portfolio-accent)]">{story.number}</span>
											{story.eyebrow}
										</p>
										<h3 className="mt-5 text-3xl font-medium leading-tight tracking-[-0.035em] sm:text-4xl">
											{story.title}
										</h3>
										<p className="mt-5 text-sm leading-6 text-white/50 sm:text-base sm:leading-7">
											{story.body}
										</p>
										<div className="mt-6 flex flex-wrap gap-2">
											{story.tags.map((tag) => (
												<span key={tag} className="rounded-md border border-white/10 bg-white/[0.035] px-2.5 py-1.5 text-[10px] font-medium text-white/45">
													{tag}
												</span>
											))}
										</div>
									</div>

									<div className={styles.productFrame}>
										<ProductChrome label={story.chromeLabel} />
										<LiveProductPreview
											src={story.previewSrc}
											title={story.previewTitle}
											baseWidth={story.previewWidth}
											baseHeight={story.previewHeight}
										/>
									</div>
								</article>
							))}
						</div>
					</div>
				</section>

				<section className={`${styles.subtleSection} border-t`}>
					<div className="mx-auto grid max-w-[1180px] border-x border-white/10 lg:grid-cols-[0.42fr_1fr]">
						<div className="px-5 py-20 sm:px-8 sm:py-24 lg:border-r lg:border-white/10 lg:px-12">
							<p className={styles.eyebrow}>Design judgment</p>
							<h2 className="mt-4 max-w-md text-[clamp(2.35rem,4vw,3.6rem)] font-medium leading-[1.04] tracking-[-0.04em]">
								Skeuomorphism, used as onboarding.
							</h2>
							<p className="mt-6 max-w-md text-sm leading-6 text-white/48 sm:text-base sm:leading-7">
								Many Síntesis and Zequenze users know real life workflows better than modern software conventions, so folders behave like containers and documents retain a physical presence.
							</p>
							<p className="mt-4 max-w-md text-sm leading-6 text-white/48 sm:text-base sm:leading-7">
								Motion follows the same rule across both products. Scanning signals processing and traced lines reveal document provenance; hierarchy transitions preserve spatial context, while the moving timeline makes changes between two historical states legible. Each cue explains cause, location, or change—none exists only to decorate the interface.
							</p>
						</div>

						<div className="p-5 sm:p-8 lg:p-12">
							<div className={`${styles.raisedSurface} overflow-hidden rounded-xl border`}>
								<div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
									<div>
										<p className="text-xs font-medium">Síntesis UI / Familiar interaction language</p>
										<p className="mt-1 text-[10px] text-white/35">The interface explains the workflow through recognizable objects and visible causes.</p>
									</div>
									<span className="shrink-0 text-[10px] font-medium text-emerald-400">In product</span>
								</div>
								<div className={styles.skeuoGrid}>
									<figure className={`${styles.skeuoCard} ${styles.skeuoFolderCard}`}>
										<figcaption>
											<p className={styles.skeuoIndex}>01 · Familiar container</p>
											<h3 className={styles.skeuoTitle}>A folder behaves like a folder.</h3>
											<p className={styles.skeuoBody}>Its shape communicates hierarchy before the user learns the navigation.</p>
										</figcaption>
										<div className={`${styles.folderObject} bg-[#e5ae58]`} aria-hidden="true">
											<div className={styles.folderNotchHeader}>
												<NotchTail side="right" className={`${styles.folderNotchTail} bg-[#e5ae58]`} />
												<strong><FolderOpen className="size-3.5" /> Certificados</strong>
												<small>13 archivos</small>
											</div>
											<div className={styles.folderPanelBody}>
												<div className={styles.folderDocumentGrid}>
													{[
														[1, "CERT N-10"],
														[2, "CERT 0-12"],
														[12, "CURVA"],
													].map(([variant, name]) => (
														<div key={name} className={styles.folderDocumentTile}>
															<div className={styles.folderThumbnail}>
																<DocumentThumbnail variant={Number(variant)} />
															</div>
															<span>{name}</span>
														</div>
													))}
												</div>
											</div>
										</div>
									</figure>

									<figure className={styles.skeuoCard}>
										<figcaption>
											<p className={styles.skeuoIndex}>02 · Visible processing</p>
											<h3 className={styles.skeuoTitle}>Scanning looks like scanning.</h3>
										</figcaption>
										<div className={styles.scanStage} aria-hidden="true">
											<div className={styles.scanDocument}>
												<span className={styles.scanHeading} />
												<span /><span /><span /><span />
												<i className={styles.scanBeam} />
											</div>
											<div className={styles.processingPill}><ScanText className="size-3" /> Reading page 8 of 13</div>
										</div>
										<p className={styles.skeuoBody}>The motion makes processing state and direction immediately understandable.</p>
									</figure>

									<figure className={styles.skeuoCard}>
										<figcaption>
											<p className={styles.skeuoIndex}>03 · Visible provenance</p>
											<h3 className={styles.skeuoTitle}>A result points back to its source.</h3>
										</figcaption>
										<div className={styles.lineageStage} aria-hidden="true">
											<div className={styles.sourceExcerpt}>
												<span>Monto certificado</span>
												<strong>$ 133.467,80</strong>
											</div>
											<div className={styles.lineageConnector}><span /></div>
											<div className={styles.extractedValue}>
												<span>Extracted</span>
												<strong>$ 133.467,80</strong>
											</div>
										</div>
										<p className={styles.skeuoBody}>The connection turns an AI output into evidence a reviewer can verify.</p>
									</figure>
								</div>
							</div>
						</div>
					</div>
				</section>

				<section className="border-t border-white/10">
					<div className="mx-auto max-w-[1180px] border-x border-white/10 px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
						<div className="grid gap-7 lg:grid-cols-[0.42fr_1fr] lg:gap-20">
							<div>
								<p className={styles.eyebrow}>What sits behind the demos</p>
								<h2 className="mt-4 text-[clamp(2.35rem,4vw,3.6rem)] font-medium leading-[1.04] tracking-[-0.04em]">
									Speed and trust are engineered together.
								</h2>
							</div>

							<div className="border-t border-white/10">
								{decisions.map(({ icon: Icon, label, choice, result }, index) => (
									<div key={label} className="grid gap-5 border-b border-white/10 py-7 sm:grid-cols-[42px_1fr] sm:py-9">
										<div className="grid size-9 place-items-center rounded-md border border-white/10 bg-white/[0.035]">
											<Icon aria-hidden="true" className="size-4 text-[var(--portfolio-accent)]" strokeWidth={1.7} />
										</div>
										<div>
											<p className="font-mono text-[10px] uppercase tracking-[0.1em] text-white/32">0{index + 1} · {label}</p>
											<h3 className="mt-3 text-lg font-medium tracking-[-0.02em] sm:text-xl">{choice}</h3>
											<p className="mt-3 max-w-2xl text-sm leading-6 text-white/46">{result}</p>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				</section>

				<section className={`${styles.subtleSection} border-t`}>
					<div className="mx-auto max-w-[1180px] border-x border-white/10 px-5 py-20 sm:px-8 sm:py-24 lg:px-12">
						<div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
							<div>
								<p className={styles.eyebrow}>The throughline</p>
								<h2 className="mt-4 text-[clamp(2.35rem,4vw,3.6rem)] font-medium tracking-[-0.04em]">
									Frontend depth. End-to-end ownership.
								</h2>
							</div>
							<p className="max-w-sm text-sm leading-6 text-white/42">I work closest to the interface, but I follow the problem through rendering, data boundaries, APIs, persistence, and delivery. That lets me refine the product at pixel level without losing sight of the system that makes it reliable.</p>
						</div>

						<div className="mt-12 grid border-y border-white/10 sm:grid-cols-2 lg:grid-cols-4">
							{stack.map(({ icon: Icon, label, note }, index) => (
								<div key={label} className={`py-6 sm:px-6 ${index > 0 ? "border-t border-white/10 sm:border-t-0" : ""} ${index % 2 === 1 ? "sm:border-l" : ""} ${index > 1 ? "sm:border-t lg:border-l lg:border-t-0" : ""} border-white/10`}>
									<Icon aria-hidden="true" className="size-4 text-white/42" strokeWidth={1.7} />
									<p className="mt-8 text-sm font-medium">{label}</p>
									<p className="mt-1 text-xs text-white/35">{note}</p>
								</div>
							))}
						</div>
					</div>
				</section>
			</main>

			<footer className="border-t border-white/10">
				<div className="mx-auto max-w-[1180px] border-x border-white/10 px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
					<div>
						<div>
							<p className={styles.eyebrow}>Ignacio Liotti · For Profound</p>
							<h2 className="mt-4 max-w-3xl text-[clamp(2.4rem,4.5vw,4rem)] font-medium leading-[1.04] tracking-[-0.04em]">
								I&apos;d like to bring this way of working to Profound.
							</h2>
						</div>
					</div>

					<div className="mt-16 flex flex-col gap-3 border-t border-white/10 pt-5 text-[10px] font-medium uppercase tracking-[0.12em] text-white/28 sm:flex-row sm:items-center sm:justify-between">
						<p>Built specifically for Profound</p>
						<p>Product judgment · Interface craft · End-to-end ownership</p>
					</div>
				</div>
			</footer>
		</article>
	);
}
