"use client";

/* eslint-disable @typescript-eslint/no-unused-vars */

import * as React from "react";

import { IArrow, IDownload } from "./landing-chrome";

const { useState, useEffect, useRef } = React;

const WRAP =
	"wrap mx-auto max-w-[1200px] px-8 max-md:w-full max-md:max-w-full max-md:box-border";
const EYEBROW =
	"eyebrow inline-block text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--stone-500)]";
const SERIF_SECTION =
	"serif-section font-serif text-[clamp(36px,4.2vw,60px)] font-normal leading-[1.02] tracking-[-0.018em] text-[var(--stone-900)] [&_em]:italic [&_em]:text-[var(--stone-500)]";
const SECTION_HEAD = "section-head mb-14 max-w-[760px]";
const SECTION_HEAD_P =
	"mt-[22px] max-w-[60ch] text-[17px] leading-[1.55] text-[var(--stone-600)]";
const LEAD =
	"lead max-w-[56ch] text-[17px] leading-[1.55] text-[var(--stone-600)]";
const SECTION = "section relative py-[110px] max-md:py-28";
const SECTION_TIGHT = "section section-tight relative py-20 max-md:py-28";

function embedFrameVariant(frame) {
	if (!frame) return "default";
	if (frame.includes("warm")) return "warm";
	if (frame.includes("dark")) return "dark";
	if (frame.includes("cool")) return "cool";
	return "default";
}

function EmbedFrameArt({ variant = "cool", seed = 0 }) {
	const uid = "efb-" + seed;
	const palettes = {
		cool: {
			sky: ["#fffaf4", "#f0e0cc", "#d9c4a8"],
			stroke: "#8f6b42",
			patches: [
				"#ffb366",
				"#ff8c3a",
				"#fff5eb",
				"#c9955e",
				"#ffd9b8",
				"#e88b45",
			],
			accent: "#ff5800",
		},
		warm: {
			sky: ["#fff6eb", "#ffd9b0", "#e8a86a"],
			stroke: "#9a5c2e",
			patches: [
				"#ff7a1a",
				"#ff5800",
				"#fff0e0",
				"#ea580c",
				"#fdba74",
				"#dc4f00",
			],
			accent: "#c2410c",
		},
		dark: {
			sky: ["#f2e8da", "#d9c0a3", "#b8956e"],
			stroke: "#6f4f2c",
			patches: [
				"#b86a2e",
				"#8f4f1f",
				"#f0e2d0",
				"#7a5518",
				"#d4a06a",
				"#9c6428",
			],
			accent: "#7c3b0d",
		},
		default: {
			sky: ["#fff9f2", "#eddcc6", "#d4bc9a"],
			stroke: "#8f6b42",
			patches: [
				"#ffb078",
				"#ff8f45",
				"#fdf3e2",
				"#c9955e",
				"#ffd4a8",
				"#e88840",
			],
			accent: "#ff5800",
		},
	};
	const p = palettes[variant] || palettes.default;

	const brushStrokes = [
		"M -40,380 Q 120,300 280,340 T 520,310 T 840,350",
		"M -20,220 Q 180,160 360,200 T 680,170 T 860,210",
		"M 60,480 Q 240,420 400,460 T 720,430",
		"M 100,140 Q 300,90 480,130 T 780,100",
	];

	const contours = [...Array(18)].map((_, i) => {
		const y = 70 + i * 34;
		const sway = i % 2 ? 14 : -10;
		const sway2 = i % 3 ? 12 : -16;
		return `M -80,${y} Q 220,${y - 20 + sway} 420,${y + sway2} T 880,${y - 8}`;
	});

	const dots = [...Array(36)].map((_, i) => ({
		cx: (i * 97 + seed * 41) % 800,
		cy: (i * 53 + seed * 29) % 600,
		r: 0.7 + (i % 3) * 0.35,
		o: 0.08 + (i % 5) * 0.04,
	}));

	return (
		<svg
			className='embed-frame-art'
			viewBox='0 0 800 600'
			preserveAspectRatio='xMidYMid slice'
			aria-hidden='true'>
			<defs>
				<filter
					id={uid + "-soft"}
					x='-6%'
					y='-6%'
					width='112%'
					height='112%'>
					<feGaussianBlur stdDeviation='8' />
				</filter>
				<filter id={uid + "-grain"}>
					<feTurbulence
						type='fractalNoise'
						baseFrequency='0.9'
						numOctaves='2'
						stitchTiles='stitch'
					/>
					<feColorMatrix
						type='matrix'
						values='0 0 0 0 0.45  0 0 0 0 0.38  0 0 0 0 0.32  0 0 0 0.05 0'
					/>
				</filter>
				<linearGradient
					id={uid + "-sky"}
					x1='0'
					y1='0'
					x2='0.35'
					y2='1'>
					<stop
						offset='0%'
						stopColor={p.sky[0]}
					/>
					<stop
						offset='52%'
						stopColor={p.sky[1]}
					/>
					<stop
						offset='100%'
						stopColor={p.sky[2]}
					/>
				</linearGradient>
				<radialGradient
					id={uid + "-vignette"}
					cx='50%'
					cy='50%'
					r='78%'>
					<stop
						offset='62%'
						stopColor='#000'
						stopOpacity='0'
					/>
					<stop
						offset='100%'
						stopColor='#000'
						stopOpacity='0.16'
					/>
				</radialGradient>
			</defs>

			<rect
				width='800'
				height='600'
				fill={"url(#" + uid + "-sky)"}
			/>

			<g filter={"url(#" + uid + "-soft)"}>
				<g opacity='0.82'>
					<ellipse
						cx='130'
						cy='200'
						rx='210'
						ry='130'
						fill={p.patches[0]}
					/>
					<ellipse
						cx='660'
						cy='400'
						rx='230'
						ry='145'
						fill={p.patches[1]}
					/>
					<ellipse
						cx='440'
						cy='95'
						rx='185'
						ry='110'
						fill={p.patches[2]}
					/>
					<ellipse
						cx='250'
						cy='490'
						rx='170'
						ry='105'
						fill={p.patches[3]}
					/>
					<ellipse
						cx='720'
						cy='150'
						rx='140'
						ry='88'
						fill={p.patches[4]}
					/>
					<path
						d='M 0,520 L 320,460 L 480,540 L 0,600 Z'
						fill={p.patches[5]}
						opacity='0.7'
					/>
					<path
						d='M 520,0 L 800,0 L 800,220 L 620,180 Z'
						fill={p.patches[0]}
						opacity='0.55'
					/>
				</g>

				<g opacity='0.62'>
					{brushStrokes.map((d, i) => (
						<path
							key={"brush-" + i}
							d={d}
							stroke={p.patches[i % p.patches.length]}
							strokeWidth={34 + (i % 3) * 12}
							strokeLinecap='round'
							fill='none'
						/>
					))}
				</g>
			</g>

			<g
				fill='none'
				stroke={p.stroke}
				strokeOpacity='0.38'
				strokeWidth='1.15'>
				{contours.map((d, i) => (
					<path
						key={"contour-" + i}
						d={d}
					/>
				))}
			</g>

			<g
				stroke={p.stroke}
				strokeOpacity='0.18'
				strokeWidth='0.75'>
				{[...Array(14)].map((_, i) => (
					<line
						key={"gv-" + i}
						x1={i * 58}
						y1='0'
						x2={i * 58}
						y2='600'
					/>
				))}
				{[...Array(10)].map((_, i) => (
					<line
						key={"gh-" + i}
						x1='0'
						y1={i * 62}
						x2='800'
						y2={i * 62}
					/>
				))}
			</g>

			{dots.map((dot, i) => (
				<circle
					key={"dot-" + i}
					cx={dot.cx}
					cy={dot.cy}
					r={dot.r}
					fill='#7c5a2e'
					opacity={dot.o}
				/>
			))}

			<g>
				{[
					"M 120,500 Q 280,440 440,480",
					"M 480,120 Q 580,80 680,110",
					"M 40,280 Q 160,250 280,270",
				].map((d, i) => (
					<path
						key={"accent-" + i}
						d={d}
						stroke={p.accent}
						strokeWidth='2.2'
						strokeLinecap='round'
						fill='none'
						opacity={0.32 + i * 0.06}
					/>
				))}
			</g>

			<rect
				width='800'
				height='600'
				fill={"url(#" + uid + "-vignette)"}
			/>

			<rect
				width='800'
				height='600'
				filter={"url(#" + uid + "-grain)"}
				opacity='0.22'
			/>
		</svg>
	);
}

function EmbedInner({ children }) {
	return (
		<div className='embed-inner'>
			<div className='embed-inner-surface'>
				<div className='embed-inner-viewport'>
					<div className='embed-inner-clip'>{children}</div>
				</div>
			</div>
		</div>
	);
}

// ============================================================
// QUICK REFERENCE — 3-column feature row
// ============================================================
function QuickReference({ eyebrow, title, lead, items }) {
	return (
		<section className={SECTION_TIGHT}>
			<div className={WRAP}>
				<div className={SECTION_HEAD}>
					<div className={`${EYEBROW} mb-[18px]`}>{eyebrow}</div>
					<h2
						className={`${SERIF_SECTION} mt-[18px]`}
						dangerouslySetInnerHTML={{ __html: title }}
					/>
					<p className={SECTION_HEAD_P}>{lead}</p>
				</div>
			</div>
			<div className={WRAP}>
				<div className='grid grid-cols-1 border-t border-[rgba(28,25,23,0.08)] md:grid-cols-3'>
					{items.map((it, i) => {
						const Ic = it.icon;
						return (
							<div
								className='border-b border-r border-[rgba(28,25,23,0.08)] px-8 py-9 pb-10 last:border-r-0 md:border-b md:[&:nth-child(3n)]:border-r-0'
								key={i}>
								<div className='mb-[22px] flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--stone-500)] [&_svg]:text-[var(--orange-primary)]'>
									<Ic size={14} /> {it.eyebrow}
								</div>
								<h4 className='mb-2.5 text-lg font-semibold tracking-[-0.005em] text-[var(--stone-900)]'>
									{it.title}
								</h4>
								<p className='m-0 text-[14.5px] leading-[1.55] text-[var(--stone-600)]'>
									{it.body}
								</p>
							</div>
						);
					})}
				</div>
			</div>
		</section>
	);
}

// ============================================================
// SIDE-ANCHOR FEATURE SECTION — sticky rail + 3-4 anchored blocks
// ============================================================
function useLandingStepScroll({ rootSelector = "#root" } = {}) {
	const snapLockRef = useRef(false);
	const wheelDeltaRef = useRef(0);
	const snapTimerRef = useRef(null);

	useEffect(() => {
		const reduce =
			window.matchMedia &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (reduce) return undefined;

		const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
		const maxScrollTop = () =>
			Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
		const targetTopFor = (el) => {
			if (!el) return window.scrollY;
			if (el.classList.contains("hero")) return 0;
			const rect = el.getBoundingClientRect();
			return clamp(
				window.scrollY + rect.top + rect.height / 2 - window.innerHeight / 2,
				0,
				maxScrollTop(),
			);
		};
		const getSteps = () => {
			const root = document.querySelector(rootSelector);
			if (!root) return [];
			const steps = [];
			Array.from(root.children).forEach((el) => {
				if (el.matches("nav")) return;
				if (el.id === "producto") {
					steps.push(...Array.from(el.querySelectorAll(".anchor-block")));
					return;
				}
				if (
					el.matches(
						".hero, .stats, .section, .section-tight, .section-dark, .cierre, .footer",
					)
				) {
					steps.push(el);
				}
			});
			return steps.filter((el) => {
				const rect = el.getBoundingClientRect();
				return rect.height > 0 && rect.width > 0;
			});
		};
		const nearestStep = (steps) => {
			const viewportCenter = window.innerHeight / 2;
			let nearest = 0;
			let distance = Number.POSITIVE_INFINITY;
			steps.forEach((el, i) => {
				const rect = el.getBoundingClientRect();
				const d = Math.abs(rect.top + rect.height / 2 - viewportCenter);
				if (d < distance) {
					nearest = i;
					distance = d;
				}
			});
			return nearest;
		};
		const isInteractiveTarget = (target) =>
			target &&
			target.closest &&
			target.closest(
				"input, textarea, select, [contenteditable='true'], [data-native-scroll]",
			);
		const unlockAfterSnap = () => {
			if (snapTimerRef.current) window.clearTimeout(snapTimerRef.current);
			snapTimerRef.current = window.setTimeout(() => {
				snapLockRef.current = false;
			}, 720);
		};
		const onWheel = (e) => {
			if (e.defaultPrevented || isInteractiveTarget(e.target)) return;
			if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;

			const steps = getSteps();
			if (steps.length < 2) return;

			const current = nearestStep(steps);
			const currentStep = steps[current];
			const currentTop = targetTopFor(currentStep);
			const currentDistance = currentTop - window.scrollY;
			const eventDirection = e.deltaY > 0 ? 1 : -1;
			const isCentered = Math.abs(currentDistance) < 54;
			const wantsToLeave =
				isCentered &&
				((eventDirection < 0 && current === 0) ||
					(eventDirection > 0 && current === steps.length - 1));
			if (wantsToLeave) {
				wheelDeltaRef.current = 0;
				return;
			}

			if (snapLockRef.current) {
				e.preventDefault();
				return;
			}

			wheelDeltaRef.current += e.deltaY;
			if (Math.abs(wheelDeltaRef.current) < 18) return;

			const direction = wheelDeltaRef.current > 0 ? 1 : -1;
			wheelDeltaRef.current = 0;
			const movingTowardCurrent =
				!isCentered && Math.sign(currentDistance) === direction;
			const targetIndex = isCentered
				? clamp(current + direction, 0, steps.length - 1)
				: movingTowardCurrent
					? current
					: clamp(current + direction, 0, steps.length - 1);

			e.preventDefault();
			snapLockRef.current = true;
			window.scrollTo({
				top: targetTopFor(steps[targetIndex]),
				behavior: "smooth",
			});
			unlockAfterSnap();
		};

		window.addEventListener("wheel", onWheel, {
			capture: true,
			passive: false,
		});
		return () => {
			window.removeEventListener("wheel", onWheel, { capture: true });
			if (snapTimerRef.current) window.clearTimeout(snapTimerRef.current);
		};
	}, [rootSelector]);
}

function AnchoredFeatures({ eyebrow, title, lead, blocks, hideHeader = false }) {
	const visibleBlocks = blocks.filter((b) => !b.hidden);
	const [active, setActive] = useState(0);
	const sectionRef = useRef(null);
	const refs = useRef([]);
	const snapLockRef = useRef(false);
	const wheelDeltaRef = useRef(0);
	const snapTimerRef = useRef(null);

	const scrollBlockToCenter = (index, behavior = "smooth") => {
		const block = refs.current[index];
		if (!block) return;
		const rect = block.getBoundingClientRect();
		const nextTop =
			window.scrollY + rect.top + rect.height / 2 - window.innerHeight / 2;
		window.scrollTo({ top: Math.max(0, nextTop), behavior });
	};

	const nearestBlockIndex = () => {
		const viewportCenter = window.innerHeight / 2;
		let nearest = active;
		let nearestDistance = Number.POSITIVE_INFINITY;
		refs.current.forEach((block, i) => {
			if (!block) return;
			const rect = block.getBoundingClientRect();
			const distance = Math.abs(rect.top + rect.height / 2 - viewportCenter);
			if (distance < nearestDistance) {
				nearest = i;
				nearestDistance = distance;
			}
		});
		return nearest;
	};

	useEffect(() => {
		const obs = new IntersectionObserver(
			(entries) => {
				entries.forEach((e) => {
					if (e.isIntersecting) {
						const i = refs.current.findIndex((r) => r === e.target);
						if (i >= 0) setActive(i);
					}
				});
			},
			{ rootMargin: "-30% 0px -55% 0px", threshold: 0 },
		);
		refs.current.forEach((r) => r && obs.observe(r));
		return () => obs.disconnect();
	}, []);

	useEffect(() => {
		return () => {
			if (snapTimerRef.current) window.clearTimeout(snapTimerRef.current);
		};
	}, []);

	const handleSteppedWheel = (e) => {
		if (e.defaultPrevented) return;
		if (visibleBlocks.length < 2) return;
		if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;

		const section = sectionRef.current;
		if (!section) return;
		const sectionRect = section.getBoundingClientRect();
		const viewportCenter = window.innerHeight / 2;
		const centerInsideSection =
			sectionRect.top < viewportCenter && sectionRect.bottom > viewportCenter;
		if (!centerInsideSection) return;

		const current = nearestBlockIndex();
		const currentBlock = refs.current[current];
		if (!currentBlock) return;

		const currentRect = currentBlock.getBoundingClientRect();
		const currentDistance =
			currentRect.top + currentRect.height / 2 - viewportCenter;
		const isCentered = Math.abs(currentDistance) < 48;
		const eventDirection = e.deltaY > 0 ? 1 : -1;
		const wantsToLeave =
			isCentered &&
			((eventDirection < 0 && current === 0) ||
				(eventDirection > 0 && current === visibleBlocks.length - 1));
		if (wantsToLeave) {
			wheelDeltaRef.current = 0;
			return;
		}

		e.preventDefault();
		if (snapLockRef.current) return;

		wheelDeltaRef.current += e.deltaY;
		if (Math.abs(wheelDeltaRef.current) < 32) return;

		const direction = wheelDeltaRef.current > 0 ? 1 : -1;
		wheelDeltaRef.current = 0;
		const target = isCentered ? current + direction : current;

		if (target < 0 || target >= visibleBlocks.length) return;

		snapLockRef.current = true;
		scrollBlockToCenter(target);
		snapTimerRef.current = window.setTimeout(() => {
			snapLockRef.current = false;
		}, 620);
	};

	return (
		<section
			ref={sectionRef}
			className={`${SECTION} anchored-section`}
			id='producto'
			onWheel={handleSteppedWheel}>
			<div className={WRAP}>
				{!hideHeader && (
					<div className={SECTION_HEAD}>
						<div className={`${EYEBROW} mb-[18px]`}>{eyebrow}</div>
						<h2
							className={`${SERIF_SECTION} mt-[18px]`}
							dangerouslySetInnerHTML={{ __html: title }}
						/>
						<p className={SECTION_HEAD_P}>{lead}</p>
					</div>
				)}
				<div className='anchored grid grid-cols-1 items-start gap-12'>
					<div className='anchor-rail hidden'>
						{visibleBlocks.map((b, i) => (
							<a
								key={i}
								href={"#blk-" + i}
								className={active === i ? "active" : ""}
								onClick={(e) => {
									e.preventDefault();
									scrollBlockToCenter(i);
								}}>
								<span className='dot' /> {b.anchor}
							</a>
						))}
					</div>
					<div className='max-md:w-full max-md:min-w-0'>
						{visibleBlocks.map((b, i) => (
							<div
								key={i}
								id={"blk-" + i}
								ref={(el) => (refs.current[i] = el)}
								className={`anchor-block flex max-w-[80vw] items-center justify-between gap-10 pb-24 max-md:w-full max-md:max-w-full max-md:flex-col max-md:items-stretch max-md:gap-6 ${i % 2 === 1 ? "flex-row-reverse max-md:flex-col" : ""}`}>
								<div>
									<h3
										className='mb-5 font-serif text-[clamp(32px,3.6vw,50px)] font-normal leading-[1.04] max-w-[18ch] [&_em]:italic [&_em]:text-[var(--stone-500)]'
										dangerouslySetInnerHTML={{ __html: b.title }}
									/>
									<p
										className={`${LEAD} mb-5 max-w-[62ch] text-base leading-[1.6]`}>
										{b.lead}
									</p>
								</div>
								<div
									className={
										"embed-frame py-16! px-8! shadow-card! " + (b.frame || "")
									}>
									<EmbedFrameArt
										variant={embedFrameVariant(b.frame)}
										seed={i}
									/>
									<EmbedInner>{b.mock}</EmbedInner>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}

// ============================================================
// FLUJO — 4-step horizontal stepper with serif numerals
// ============================================================
function Flujo({ eyebrow, title, lead, steps }) {
	return (
		<section
			className={`${SECTION} border-y border-[rgba(28,25,23,0.06)] bg-white/40`}
			id='flujo'>
			<div className={WRAP}>
				<div className={SECTION_HEAD}>
					<div className={`${EYEBROW} mb-[18px]`}>{eyebrow}</div>
					<h2
						className={`${SERIF_SECTION} mt-[18px]`}
						dangerouslySetInnerHTML={{ __html: title }}
					/>
					<p className={SECTION_HEAD_P}>{lead}</p>
				</div>
			</div>
			<div className={WRAP}>
				<div className='grid grid-cols-1 border-y border-[rgba(28,25,23,0.08)] sm:grid-cols-2 lg:grid-cols-4'>
					{steps.map((s, i) => (
						<div
							key={i}
							className={`relative border-b border-r border-[rgba(28,25,23,0.08)] px-7 py-10 pb-9 last:border-r-0 sm:[&:nth-child(2n)]:border-r-0 lg:border-b-0 lg:[&:nth-child(2n)]:border-r lg:last:border-r-0 ${i === 0 ? "active" : ""}`}>
							<div
								className={`mb-7 font-serif text-[60px] font-normal leading-none tracking-[-0.02em] ${i === 0 ? "text-[var(--orange-primary)]" : "text-[var(--stone-300)]"}`}>
								{String(i + 1).padStart(2, "0")}
							</div>
							<h4 className='mb-3 text-[19px] font-semibold tracking-[-0.005em] text-[var(--stone-900)]'>
								{s.title}
							</h4>
							<p className='m-0 text-sm leading-[1.55] text-[var(--stone-600)]'>
								{s.body}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

// ============================================================
// DEMO SECTION — tabs over a dashboard mock embed
// ============================================================
function DemoSection({ eyebrow, title, lead, tabs, demoMock }) {
	const [active, setActive] = useState(0);
	return (
		<section
			className={SECTION}
			id='demo'>
			<div className={WRAP}>
				<div className={`${SECTION_HEAD} max-w-[820px]`}>
					<div className={`${EYEBROW} mb-[18px]`}>{eyebrow}</div>
					<h2
						className={`${SERIF_SECTION} mt-[18px]`}
						dangerouslySetInnerHTML={{ __html: title }}
					/>
					<p className={SECTION_HEAD_P}>{lead}</p>
				</div>

				<div className='grid grid-cols-1 items-start gap-10 lg:grid-cols-[300px_1fr]'>
					<div className='grid gap-3'>
						{tabs.map((t, i) => (
							<button
								key={i}
								onClick={() => setActive(i)}
								className={`grid cursor-pointer grid-cols-[auto_1fr] gap-3.5 rounded-[14px] border px-[22px] py-5 text-left transition-all duration-200 ${
									active === i
										? "border-[rgba(28,25,23,0.10)] bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)]"
										: "border-transparent bg-transparent shadow-none"
								}`}>
								<div
									className={`min-w-14 pt-0.5 text-[10px] font-bold uppercase tracking-[0.15em] ${
										active === i
											? "text-[var(--orange-primary)]"
											: "text-[var(--stone-400)]"
									}`}>
									{t.tag}
								</div>
								<div>
									<div className='mb-1.5 font-serif text-[22px] leading-[1.1] text-[var(--stone-900)]'>
										{t.title}
									</div>
									<div className='text-[13.5px] leading-[1.55] text-[var(--stone-600)]'>
										{t.body}
									</div>
								</div>
							</button>
						))}
					</div>
					<div className='embed-frame cool'>
						<EmbedFrameArt
							variant='cool'
							seed={99}
						/>
						<EmbedInner>{demoMock(active)}</EmbedInner>
					</div>
				</div>
			</div>
		</section>
	);
}

// ============================================================
// DARK GET-STARTED SECTION
// ============================================================
function DarkSteps({ eyebrow, title, steps, ctaLight, ctaGhost }) {
	return (
		<section className='section-dark bg-[#16130f] py-[110px] text-[#f5f0e8] max-md:py-28'>
			<div className={WRAP}>
				<div className='max-w-[760px]'>
					<div className={`${EYEBROW} text-[rgba(245,240,232,0.55)]`}>
						{eyebrow}
					</div>
					<h2
						className={`${SERIF_SECTION} mt-5 text-[#f5f0e8] [&_em]:text-[rgba(245,240,232,0.45)]`}
						dangerouslySetInnerHTML={{ __html: title }}
					/>
				</div>
				<div className='dark-grid mt-14 grid grid-cols-1 overflow-hidden rounded-[20px] border border-[rgba(245,240,232,0.08)] sm:grid-cols-2 lg:grid-cols-4'>
					{steps.map((s, i) => (
						<div
							key={i}
							className='dark-cell border-b border-r border-[rgba(245,240,232,0.08)] px-7 py-9 pb-8 last:border-r-0 sm:[&:nth-child(2n)]:border-r-0 lg:border-b-0 lg:[&:nth-child(2n)]:border-r lg:last:border-r-0'>
							<div className='num mb-[18px] text-[11px] font-semibold tracking-[0.15em] text-[rgba(245,240,232,0.4)]'>
								{String(i + 1).padStart(2, "0")}
							</div>
							<h4 className='mb-3.5 font-serif text-[22px] font-normal leading-[1.15] text-[#f5f0e8]'>
								{s.title}
							</h4>
							<p className='m-0 text-sm leading-[1.55] text-[rgba(245,240,232,0.62)]'>
								{s.body}
							</p>
						</div>
					))}
				</div>
				<div className='dark-cta-row mt-11 flex flex-wrap gap-3'>
					<button className='btn btn-light border-0 bg-[#f5f0e8] text-[#16130f] hover:bg-white'>
						{ctaLight} <IArrow size={14} />
					</button>
					<button className='btn btn-dark-ghost border border-[rgba(245,240,232,0.18)] bg-transparent text-[#f5f0e8]'>
						{ctaGhost}
					</button>
				</div>
			</div>
		</section>
	);
}

// ============================================================
// SPLIT / OPEN SOURCE STYLE — narrative left + 2x2 right
// ============================================================
function Split({ eyebrow, title, lead, ctaLabel, ctaIcon = null, items, stacked = false }) {
	return (
		<section
			className={SECTION}
			id='preguntas'>
			<div className={WRAP}>
				<div
					className={
						stacked
							? "split-stacked flex flex-col gap-11"
							: "split grid grid-cols-1 items-start gap-16 lg:grid-cols-[1fr_1.1fr]"
					}>
					<div className={stacked ? "max-w-[760px]" : ""}>
						<div className={EYEBROW}>{eyebrow}</div>
						<h2
							className={`${SERIF_SECTION} my-5 mb-7`}
							dangerouslySetInnerHTML={{ __html: title }}
						/>
						<p className={`${LEAD} mb-9`}>{lead}</p>
						{ctaLabel ? (
							<button className='btn btn-primary'>
								{ctaLabel} <IArrow size={14} />
							</button>
						) : null}
					</div>
					<div
						className={`split-grid grid grid-cols-1 overflow-hidden rounded-[18px] border border-[rgba(28,25,23,0.08)] bg-white sm:grid-cols-2 ${stacked ? "w-full" : ""}`}>
						{items.map((it, i) => (
							<div
								className='split-cell border-b border-r border-[rgba(28,25,23,0.08)] px-8! py-5! sm:[&:nth-child(2n)]:border-r-0 sm:[&:nth-last-child(-n+2)]:border-b-0 max-sm:border-r-0'
								key={i}>
								<h4 className='mb-3.5 text-[21px] font-bold leading-[1.2] text-[var(--stone-900)]'>
									{it.title}
								</h4>
								<p className='m-0 text-[15.5px] leading-[1.6] text-[var(--stone-600)]'>
									{it.body}
								</p>
							</div>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}

// ============================================================
// CIERRE — final centered CTA
// ============================================================
function Cierre({ eyebrow, title, lead, primary, secondary }) {
	return (
		<section className='cierre relative overflow-hidden px-8 py-[120px] text-center max-md:py-28'>
			<div
				className='pointer-events-none absolute left-1/2 top-[30%] z-0 h-[460px] w-[460px] -translate-x-1/2 rounded-full blur-[40px]'
				style={{
					background:
						"radial-gradient(circle, rgba(255,88,0,.18), rgba(255,88,0,0) 70%)",
				}}
			/>
			<div className='relative'>
				<div className={`${EYEBROW} mb-[18px]`}>{eyebrow}</div>
				<h2
					className={`${SERIF_SECTION} mx-auto max-w-[22ch]`}
					dangerouslySetInnerHTML={{ __html: title }}
				/>
				<p className={`${LEAD} mx-auto mt-7 text-center`}>{lead}</p>
				<div className='hero-cta-row mt-9 flex flex-wrap justify-center gap-3'>
					<button className='btn btn-orange'>
						{primary} <IArrow size={14} />
					</button>
					<button className='btn btn-light'>{secondary}</button>
				</div>
			</div>
		</section>
	);
}

// ============================================================
// PROOF STRIP — real-world validation (pilot in Corrientes)
// ============================================================
function ProofStrip({ eyebrow, title, lead, points }) {
	return (
		<section
			className={SECTION_TIGHT}
			id='validacion'>
			<div className={WRAP}>
				<div className={`${SECTION_HEAD} mx-auto text-center`}>
					<div className={`${EYEBROW} mb-[18px]`}>{eyebrow}</div>
					<h2
						className={`${SERIF_SECTION} mt-[18px]`}
						dangerouslySetInnerHTML={{ __html: title }}
					/>
					<p className={`${SECTION_HEAD_P} mx-auto`}>{lead}</p>
				</div>
				{points && (
					<div className='mt-2 flex flex-wrap justify-center gap-2.5'>
						{points.map((p, i) => (
							<span
								className='rounded-full border border-[rgba(28,25,23,0.08)] bg-white px-4 py-2 text-[12.5px] font-medium text-[var(--stone-700)] shadow-[0_1px_0_rgba(0,0,0,0.03)]'
								key={i}>
								{p}
							</span>
						))}
					</div>
				)}
			</div>
		</section>
	);
}

// ============================================================
// DOSSIER BAR — turns the landing into a shareable dossier
// ============================================================
function DossierBar({ note }) {
	return (
		<section className='dossier-bar border-b border-[rgba(28,25,23,0.06)] bg-white/55'>
			<div
				className={`${WRAP} dossier-bar-inner flex flex-wrap items-center justify-between gap-5 py-[13px]`}>
				<div className='dossier-bar-text text-[13px] leading-[1.5] text-[var(--stone-600)] [&_b]:text-[var(--stone-900)]'>
					<b>Esta página es también nuestro dossier comercial.</b>{" "}
					{note ||
						"Guardala como PDF y compartila con quien decide: contiene producto, perfiles, módulos, ficha técnica y plan de arranque."}
				</div>
				<button
					className='btn btn-light px-4 py-2 text-xs'
					onClick={() => window.print()}>
					<IDownload size={14} /> Guardar como PDF
				</button>
			</div>
		</section>
	);
}

// ============================================================
// PERFILES — who uses it, dossier-grade (4-up with bullets)
// ============================================================
function Perfiles({ eyebrow, title, lead, items }) {
	return (
		<section
			className={SECTION_TIGHT}
			id='perfiles'>
			<div className={WRAP}>
				<div className={SECTION_HEAD}>
					<div className={`${EYEBROW} mb-[18px]`}>{eyebrow}</div>
					<h2
						className={`${SERIF_SECTION} mt-[18px]`}
						dangerouslySetInnerHTML={{ __html: title }}
					/>
					<p className={SECTION_HEAD_P}>{lead}</p>
				</div>
				<div className='perfil-grid grid grid-cols-1 border-t border-[rgba(28,25,23,0.08)] sm:grid-cols-2 lg:grid-cols-4'>
					{items.map((p, i) => (
						<div
							className='perfil-cell border-b border-r border-[rgba(28,25,23,0.08)] px-[26px] py-8 pb-9 last:border-r-0 sm:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r lg:last:border-r-0 max-sm:border-r-0'
							key={i}>
							<div className='perfil-role mb-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--orange-primary)]'>
								{p.role}
							</div>
							<h4 className='mb-2.5 font-serif text-[21px] font-normal leading-[1.15] text-[var(--stone-900)]'>
								{p.title}
							</h4>
							<p className='mb-4 text-[13.5px] leading-[1.55] text-[var(--stone-600)]'>
								{p.body}
							</p>
							<ul className='m-0 grid list-none gap-2 p-0'>
								{p.bullets.map((b, j) => (
									<li
										className='relative pl-4 text-[12.5px] leading-[1.45] text-[var(--stone-700)] before:absolute before:left-0 before:top-[7px] before:h-1.5 before:w-1.5 before:rounded-full before:bg-[var(--stone-300)] before:content-[""]'
										key={j}>
										{b}
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

// ============================================================
// MÓDULOS — product catalog (dossier inventory of capabilities)
// ============================================================
function ModuloCatalogo({ eyebrow, title, lead, modules, note }) {
	return (
		<section
			className={SECTION}
			id='modulos'>
			<div className={WRAP}>
				<div className={SECTION_HEAD}>
					<div className={`${EYEBROW} mb-[18px]`}>{eyebrow}</div>
					<h2
						className={`${SERIF_SECTION} mt-[18px]`}
						dangerouslySetInnerHTML={{ __html: title }}
					/>
					<p className={SECTION_HEAD_P}>{lead}</p>
				</div>
				<div className='modulo-grid grid grid-cols-1 gap-[18px] lg:grid-cols-3'>
					{modules.map((m, i) => {
						const Ic = m.icon;
						return (
							<div
								className='modulo-card rounded-[18px] border border-[rgba(28,25,23,0.08)] bg-white p-[26px] shadow-[0_1px_0_rgba(0,0,0,0.03)]'
								key={i}>
								<div className='modulo-head mb-3.5 flex items-center gap-3'>
									<div className='modulo-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--stone-200)] bg-[var(--stone-50)] text-[var(--orange-primary)]'>
										<Ic size={15} />
									</div>
									<h4 className='m-0 text-base font-semibold tracking-[-0.005em] text-[var(--stone-900)]'>
										{m.name}
									</h4>
								</div>
								<p className='mb-3.5 text-[13.5px] leading-[1.55] text-[var(--stone-600)]'>
									{m.desc}
								</p>
								<ul className='m-0 grid list-none gap-[7px] p-0'>
									{m.bullets.map((b, j) => (
										<li
											className='relative pl-4 text-[12.5px] leading-[1.45] text-[var(--stone-700)] before:absolute before:left-0 before:top-[7px] before:h-1.5 before:w-1.5 before:rounded-full before:bg-[var(--orange-primary)] before:opacity-55 before:content-[""]'
											key={j}>
											{b}
										</li>
									))}
								</ul>
							</div>
						);
					})}
				</div>
				{note && (
					<p className='modulo-note mt-7 max-w-[70ch] text-[13px] text-[var(--stone-500)]'>
						{note}
					</p>
				)}
			</div>
		</section>
	);
}

// ============================================================
// FICHA TÉCNICA — spec sheet rows (the dossier core)
// ============================================================
function FichaTecnica({ eyebrow, title, lead, rows }) {
	return (
		<section
			className={`${SECTION_TIGHT} border-y border-[rgba(28,25,23,0.06)] bg-white/40`}
			id='ficha'>
			<div className={WRAP}>
				<div className={SECTION_HEAD}>
					<div className={`${EYEBROW} mb-[18px]`}>{eyebrow}</div>
					<h2
						className={`${SERIF_SECTION} mt-[18px]`}
						dangerouslySetInnerHTML={{ __html: title }}
					/>
					<p className={SECTION_HEAD_P}>{lead}</p>
				</div>
				<div className='ficha border-t border-[rgba(28,25,23,0.12)]'>
					{rows.map((r, i) => (
						<div
							className='ficha-row grid grid-cols-1 gap-2 border-b border-[rgba(28,25,23,0.08)] py-[18px] sm:grid-cols-[240px_1fr] sm:gap-8'
							key={i}>
							<div className='ficha-label pt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--stone-500)]'>
								{r.label}
							</div>
							<div
								className='ficha-value max-w-[72ch] text-[14.5px] leading-[1.6] text-[var(--stone-700)] [&_b]:text-[var(--stone-900)]'
								dangerouslySetInnerHTML={{ __html: r.value }}
							/>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}


export {
	useLandingStepScroll,
	QuickReference,
	AnchoredFeatures,
	Flujo,
	DemoSection,
	DarkSteps,
	Split,
	Cierre,
	DossierBar,
	Perfiles,
	ModuloCatalogo,
	FichaTecnica,
	ProofStrip,
};
