"use client";

import { useEffect, useState } from "react";

import styles from "../portfolio.module.css";

type RotatingSubtitleProps = {
	options: readonly string[];
};

export function RotatingSubtitle({ options }: RotatingSubtitleProps) {
	const [activeIndex, setActiveIndex] = useState(0);

	useEffect(() => {
		if (options.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			return;
		}

		const interval = window.setInterval(() => {
			setActiveIndex((currentIndex) => (currentIndex + 1) % options.length);
		}, 3600);

		return () => window.clearInterval(interval);
	}, [options.length]);

	if (options.length === 0) return null;

	return (
		<>
			<span className="sr-only">{options[0]}</span>
			<span aria-hidden="true" className={styles.rotatingSubtitle}>
				<span key={activeIndex} className={styles.rotatingSubtitleText}>
					{options[activeIndex]}
				</span>
			</span>
		</>
	);
}
