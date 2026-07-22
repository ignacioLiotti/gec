"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, FileText, X } from "lucide-react";

import styles from "../portfolio.module.css";

export function WorkDisclosurePanel() {
	const [isOpen, setIsOpen] = useState(false);

	const closePanel = () => {
		setIsOpen(false);
	};

	useEffect(() => {
		if (!isOpen) return;
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") closePanel();
		};
		window.addEventListener("keydown", closeOnEscape);
		return () => window.removeEventListener("keydown", closeOnEscape);
	}, [isOpen]);

	return (
		<>
			<button
				type="button"
				className={styles.disclosureTrigger}
				onClick={() => setIsOpen(true)}
				aria-label="Learn how this demo was recreated"
				aria-haspopup="dialog"
				aria-expanded={isOpen}
			>
				Recreated <span aria-hidden="true">(?)</span>
			</button>
			<button
				type="button"
				className={styles.disclosureBackdrop}
				data-visible={isOpen ? "true" : "false"}
				onClick={closePanel}
				tabIndex={-1}
				aria-hidden="true"
			/>
			<aside
				className={styles.disclosurePanel}
				data-visible={isOpen ? "true" : "false"}
				aria-hidden={!isOpen}
				aria-label="A note on the work shown here"
				role="dialog"
				aria-modal="true"
			>
				<button
					type="button"
					onClick={closePanel}
					tabIndex={isOpen ? 0 : -1}
					className={styles.disclosureClose}
					aria-label="Dismiss note"
				>
					<X aria-hidden="true" className="size-4" strokeWidth={1.8} />
				</button>
				<div className={styles.disclosureVisual} aria-hidden="true">
					<div className={styles.disclosureArtwork}>
						<div className={styles.disclosureWindowDots}><span /><span /><span /></div>
						<div className={styles.disclosureArtworkRow}><FileText className="size-3.5" /> Production behavior preserved</div>
						<div className={styles.disclosureArtworkRow}><Check className="size-3.5" /> Proprietary data replaced</div>
						<div className={styles.disclosureArtworkRow}><Check className="size-3.5" /> Safe to inspect</div>
					</div>
				</div>
				<div className={styles.disclosureContent}>
					<p className={styles.eyebrow}>A note on the work shown here</p>
					<h2 className={styles.disclosureTitle}>Recreated, not exposed.</h2>
					<p className={styles.disclosureBody}>
						These are faithful recreations of production systems I designed and built, using fabricated data and no proprietary assets. They preserve the product decisions, system behavior, and interaction work that matter.
					</p>
					<button
						type="button"
						onClick={closePanel}
						tabIndex={isOpen ? 0 : -1}
						className={styles.disclosureContinue}
					>
						Continue exploring <ArrowRight aria-hidden="true" className="size-4" />
					</button>
				</div>
			</aside>
		</>
	);
}
