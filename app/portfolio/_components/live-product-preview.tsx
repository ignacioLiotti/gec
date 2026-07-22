"use client";

import { ExternalLink, Laptop, Maximize2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";

import { WorkDisclosurePanel } from "./work-disclosure-panel";
import styles from "./live-product-preview.module.css";

type LiveProductPreviewProps = {
	src: string;
	title: string;
	baseWidth?: number;
	baseHeight?: number;
	mobileWidth?: number;
	mobileHeight?: number;
};

export function LiveProductPreview({
	src,
	title,
	baseWidth = 1280,
	baseHeight = 800,
	mobileWidth = 390,
	mobileHeight = 760,
}: LiveProductPreviewProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [layout, setLayout] = useState({ width: baseWidth, height: baseHeight, scale: 0 });
	const [isExpanded, setIsExpanded] = useState(false);
	const [isMobile, setIsMobile] = useState<boolean | null>(null);
	const [shouldLoadPreview, setShouldLoadPreview] = useState(false);
	const [isPreviewLoaded, setIsPreviewLoaded] = useState(false);
	const [isExpandedLoaded, setIsExpandedLoaded] = useState(false);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const updateScale = () => {
			const useMobileLayout = container.clientWidth < 600;
			const width = useMobileLayout ? mobileWidth : baseWidth;
			const height = useMobileLayout ? mobileHeight : baseHeight;
			setLayout({ width, height, scale: container.clientWidth / width });
		};
		const observer = new ResizeObserver(updateScale);
		observer.observe(container);
		updateScale();

		return () => observer.disconnect();
	}, [baseHeight, baseWidth, mobileHeight, mobileWidth]);

	useEffect(() => {
		const mobileQuery = window.matchMedia("(max-width: 720px)");
		const updateMobileState = () => setIsMobile(mobileQuery.matches);
		updateMobileState();
		mobileQuery.addEventListener("change", updateMobileState);
		return () => mobileQuery.removeEventListener("change", updateMobileState);
	}, []);

	useEffect(() => {
		const container = containerRef.current;
		if (!container || isMobile !== false || shouldLoadPreview) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				setShouldLoadPreview(true);
				observer.disconnect();
			},
			{ rootMargin: "320px 0px" },
		);
		observer.observe(container);
		return () => observer.disconnect();
	}, [isMobile, shouldLoadPreview]);

	return (
		<Dialog
			open={isExpanded}
			onOpenChange={(open) => {
				setIsExpanded(open);
				if (open) setIsExpandedLoaded(false);
			}}
		>
			<div
				ref={containerRef}
				className={styles.viewport}
				style={{
					aspectRatio: `${baseWidth} / ${baseHeight}`,
					height: layout.scale > 0 ? layout.height * layout.scale : undefined,
				}}
			>
				{shouldLoadPreview && !isPreviewLoaded ? (
					<div className={styles.previewLoading} aria-hidden="true">
						<span className={styles.loadingBars}><span /><span /><span /></span>
						<span>Loading demo</span>
					</div>
				) : null}
				{shouldLoadPreview && isMobile === false ? (
					<iframe
						src={src}
						title={title}
						loading="lazy"
						onLoad={() => setIsPreviewLoaded(true)}
						tabIndex={-1}
						aria-hidden="true"
						className={styles.frame}
						data-loaded={isPreviewLoaded ? "true" : "false"}
						style={{
							width: layout.width,
							height: layout.height,
							transform: `scale(${layout.scale})`,
						}}
					/>
				) : null}

			</div>
			<div className={styles.previewActions}>
				<WorkDisclosurePanel />
				<DialogTrigger asChild>
					<button
						type="button"
						className={styles.expandButton}
						aria-label={`Open ${title} as an interactive full-screen demo`}
					>
						<Maximize2 aria-hidden="true" size={14} strokeWidth={1.8} />
						<span>Open demo</span>
					</button>
				</DialogTrigger>
			</div>
			<div className={styles.mobileNotice} role="note">
				<span className={styles.mobileNoticeIcon} aria-hidden="true">
					<Laptop size={18} strokeWidth={1.7} />
				</span>
				<div>
					<p className={styles.mobileNoticeTitle}>Explore the demos on desktop</p>
					<p className={styles.mobileNoticeBody}>
						These product interfaces are designed for large operational workspaces. Open this portfolio on a desktop to interact with them in full.
					</p>
				</div>
			</div>

			<DialogContent
				showCloseButton={false}
				className={`${styles.expandedDialog} translate-x-0 translate-y-0`}
				style={{ translate: "none" }}
				aria-describedby={undefined}
			>
				<header className={styles.expandedHeader}>
					<div className={styles.expandedTitleGroup}>
						<span className={styles.liveIndicator} aria-hidden="true" />
						<div>
							<p>Interactive product demo</p>
							<DialogTitle className={styles.expandedTitle}>{title}</DialogTitle>
						</div>
					</div>

					<div className={styles.expandedActions}>
						<a
							href={src}
							target="_blank"
							rel="noreferrer"
							className={styles.headerButton}
						>
							<ExternalLink aria-hidden="true" size={14} strokeWidth={1.8} />
							<span>New tab</span>
						</a>
						<DialogClose asChild>
							<button type="button" className={styles.closeButton}>
								<X aria-hidden="true" size={15} strokeWidth={1.8} />
								<span>Close</span>
							</button>
						</DialogClose>
					</div>
				</header>

				<div className={styles.interactiveViewport}>
					{!isExpandedLoaded ? (
						<div className={styles.interactiveLoading} role="status" aria-live="polite">
							<span className={styles.loadingBars} aria-hidden="true"><span /><span /><span /></span>
							<span>Loading interactive demo</span>
						</div>
					) : null}
					<iframe
						src={src}
						title={`${title} — interactive demo`}
						className={styles.interactiveFrame}
						data-loaded={isExpandedLoaded ? "true" : "false"}
						onLoad={() => setIsExpandedLoaded(true)}
					/>
				</div>
			</DialogContent>
		</Dialog>
	);
}
