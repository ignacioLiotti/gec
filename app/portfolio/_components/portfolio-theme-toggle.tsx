"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect } from "react";

import styles from "../portfolio.module.css";

type PortfolioTheme = "dark" | "light";

const STORAGE_KEY = "portfolio-theme";

function applyTheme(theme: PortfolioTheme) {
	document.documentElement.dataset.portfolioTheme = theme;
	document.documentElement.style.colorScheme = theme;
}

export function PortfolioThemeToggle() {
	useEffect(() => {
		const storedTheme = window.localStorage.getItem(STORAGE_KEY);
		const initialTheme: PortfolioTheme =
			storedTheme === "light" || storedTheme === "dark"
				? storedTheme
				: window.matchMedia("(prefers-color-scheme: light)").matches
					? "light"
					: "dark";

		applyTheme(initialTheme);

		return () => {
			delete document.documentElement.dataset.portfolioTheme;
			document.documentElement.style.removeProperty("color-scheme");
		};
	}, []);

	return (
		<button
			type="button"
			className={styles.themeToggle}
			aria-label="Toggle color theme"
			title="Toggle color theme"
			onClick={() => {
				const currentTheme =
					document.documentElement.dataset.portfolioTheme === "light"
						? "light"
						: "dark";
				const nextTheme: PortfolioTheme = currentTheme === "dark" ? "light" : "dark";
				window.localStorage.setItem(STORAGE_KEY, nextTheme);
				applyTheme(nextTheme);
			}}
		>
			<span className={styles.whenDark}>
				<Sun aria-hidden="true" className="size-4" strokeWidth={1.8} />
				<span className="hidden md:inline">Light</span>
			</span>
			<span className={styles.whenLight}>
				<Moon aria-hidden="true" className="size-4" strokeWidth={1.8} />
				<span className="hidden md:inline">Dark</span>
			</span>
		</button>
	);
}
