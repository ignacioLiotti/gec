"use client";

/* eslint-disable @typescript-eslint/no-unused-vars */

import * as React from "react";

import { IBell, IDoc, IDownload, IFilter } from "./landing-chrome";

const { useState } = React;

// ============================================================
// DS PRIMITIVES — mirror components/ui/button.tsx, tray.tsx,
// tabs.tsx and app-sidebar.tsx so every mock reads like the app
// ============================================================

// Lifted button recipe (components/ui/button.tsx): rounded-lg,
// 12px medium, border-black/15, hue-matched 2-layer shadow + glint.
const UIButton = ({
	variant = "outline",
	size = "sm",
	icon,
	children,
	style = {},
	...rest
}) => {
	const recipes = {
		default: {
			background: "var(--orange-primary)",
			color: "#FAF9F5",
			border: "1px solid rgba(0,0,0,.15)",
			boxShadow:
				"0 1px 3px rgba(180,90,30,.35), 0 2px 6px rgba(180,90,30,.20), inset 0 1px 0 rgba(255,255,255,.15)",
		},
		dark: {
			background: "var(--stone-900)",
			color: "#fafaf9",
			border: "1px solid rgba(0,0,0,.15)",
			boxShadow:
				"0 1px 3px rgba(0,0,0,.35), 0 2px 6px rgba(0,0,0,.20), inset 0 1px 0 rgba(255,255,255,.10)",
		},
		outline: {
			background: "var(--stone-100)",
			color: "var(--stone-700)",
			border: "1px solid rgba(0,0,0,.15)",
			boxShadow:
				"0 1px 2px rgba(0,0,0,.06), 0 1px 3px rgba(0,0,0,.04), inset 0 1px 0 rgba(255,255,255,.70)",
		},
		ghost: {
			background: "transparent",
			color: "var(--stone-700)",
			border: "1px solid transparent",
			boxShadow: "none",
		},
	};
	const sizes = {
		xs: { height: 28, padding: "0 10px" },
		sm: { height: 32, padding: "0 12px" },
		md: { height: 36, padding: "0 16px" },
	};
	return (
		<button
			style={{
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center",
				gap: 6,
				borderRadius: 8,
				fontSize: 12,
				fontWeight: 500,
				fontFamily: "var(--font-sans)",
				cursor: "pointer",
				whiteSpace: "nowrap",
				...recipes[variant],
				...sizes[size],
				...style,
			}}
			{...rest}>
			{icon}
			{children}
		</button>
	);
};

// Badge — rounded-full, soft tonal bg (DS: badges/tags = rounded-full)
const StatusBadge = ({ tone = "stone", children }) => {
	const tones = {
		green: { bg: "#dcfce7", fg: "#15803d" },
		amber: { bg: "#fef3c7", fg: "#b45309" },
		red: { bg: "#fee2e2", fg: "#b91c1c" },
		orange: { bg: "#ffedd5", fg: "#c2410c" },
		stone: { bg: "var(--stone-100)", fg: "var(--stone-600)" },
	}[tone];
	return (
		<span
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: 6,
				padding: "2px 10px",
				borderRadius: 9999,
				background: tones.bg,
				color: tones.fg,
				fontSize: 11,
				fontWeight: 500,
				whiteSpace: "nowrap",
			}}>
			{children}
		</span>
	);
};

// Tray + Chip (components/ui/tray.tsx): white tray, stone-200 border,
// rounded-xl, p-1; chip pill rounded-lg, active = stone-100 fill
const UITray = ({ children, style }) => (
	<div
		style={{
			display: "inline-flex",
			alignItems: "center",
			gap: 4,
			padding: 4,
			background: "#fff",
			border: "1px solid var(--stone-200)",
			borderRadius: 12,
			boxShadow: "0 1px 0 rgba(0,0,0,.03)",
			...style,
		}}>
		{children}
	</div>
);
const UIChip = ({ active, dark, dot, children, ...rest }) => (
	<button
		style={{
			display: "inline-flex",
			alignItems: "center",
			gap: 6,
			height: 28,
			padding: "0 12px",
			borderRadius: 8,
			border: 0,
			cursor: "pointer",
			fontFamily: "var(--font-sans)",
			fontSize: 12,
			fontWeight: active || dark ? 500 : 400,
			background: dark
				? "var(--stone-900)"
				: active
					? "var(--stone-100)"
					: "transparent",
			color: dark ? "#fff" : active ? "var(--stone-900)" : "var(--stone-700)",
		}}
		{...rest}>
		{dot && (
			<span
				style={{
					width: 7,
					height: 7,
					borderRadius: 9999,
					background: `var(--src-${dot})`,
					display: "inline-block",
				}}
			/>
		)}
		{children}
	</button>
);

// Segment control (DS §8): gray tray + white active pill
const SegmentControl = ({ options, value, onChange }) => (
	<div
		style={{
			display: "inline-flex",
			alignItems: "center",
			borderRadius: 12,
			border: "1px solid #e8e8e8",
			background: "#f5f5f4",
			padding: 4,
		}}>
		{options.map((o) => (
			<button
				key={o}
				onClick={() => onChange && onChange(o)}
				style={{
					display: "inline-flex",
					alignItems: "center",
					gap: 6,
					borderRadius: 8,
					padding: "6px 14px",
					fontSize: 13,
					fontWeight: 500,
					border: 0,
					cursor: "pointer",
					fontFamily: "var(--font-sans)",
					background: value === o ? "#fff" : "transparent",
					color: value === o ? "#1a1a1a" : "#999",
					boxShadow: value === o ? "0 1px 2px rgba(0,0,0,.08)" : "none",
					transition: "all .15s",
				}}>
				{o}
			</button>
		))}
	</div>
);

// Top-nav tabs (excel-page-tabs.tsx): dark pill, active = #1a1a1a fill
const PillTabs = ({ tabs, active = 0 }) => (
	<div
		style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
		{tabs.map((t, i) => (
			<div
				key={t}
				style={{
					display: "inline-flex",
					alignItems: "center",
					gap: 8,
					height: 32,
					padding: "0 14px",
					borderRadius: 10,
					fontSize: 13,
					fontWeight: 500,
					background: i === active ? "#1a1a1a" : "transparent",
					color: i === active ? "#fff" : "#999",
				}}>
				{t}
			</div>
		))}
	</div>
);

const ProgressBar = ({ value, color = "var(--orange-primary)" }) => (
	<div
		style={{
			height: 6,
			width: "100%",
			background: "var(--stone-100)",
			borderRadius: 9999,
		}}>
		<div
			style={{
				height: 6,
				width: value + "%",
				background: color,
				borderRadius: 9999,
			}}
		/>
	</div>
);

const Dot = ({ color, size = 8 }) => (
	<span
		style={{
			width: size,
			height: size,
			borderRadius: 9999,
			background: color,
			display: "inline-block",
		}}
	/>
);

// Shell card (DS §10): rounded-xl, border #e8e8e8, white
const cardStyle = {
	background: "#fff",
	borderRadius: 12,
	border: "1px solid #e8e8e8",
	overflow: "hidden",
};

// Table cells (DS §4): header px-4 py-2 semibold; rows px-4 py-1.5 text-sm
const thStyle = {
	fontSize: 11,
	fontWeight: 600,
	color: "var(--stone-500)",
	padding: "8px 16px",
	background: "var(--stone-50)",
	borderBottom: "1px solid var(--stone-200)",
};
const tdRow = (last) => ({
	padding: "7px 16px",
	fontSize: 13,
	alignItems: "center",
	borderBottom: last ? "none" : "1px solid var(--stone-100)",
});

// ============================================================
// APP SHELL — topbar only (sidebar removed from previews)
// ============================================================
const MockChrome = ({ children, breadcrumb }) => (
	<div
		style={{
			display: "flex",
			flexDirection: "column",
			minHeight: 480,
			background: "var(--background)",
			fontFamily: "var(--font-sans)",
		}}>
		<div
			style={{
				padding: "10px 20px",
				borderBottom: "1px solid rgba(28,25,23,.06)",
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				background: "#fff",
				flexShrink: 0,
			}}>
			<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
				<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
					<div
						style={{
							width: 18,
							height: 18,
							borderRadius: 9999,
							background: "var(--orange-primary)",
						}}
					/>
					<span
						style={{
							fontWeight: 700,
							fontSize: 11,
							letterSpacing: ".12em",
							textTransform: "uppercase",
							color: "var(--stone-900)",
						}}>
						Sintesis
					</span>
				</div>
				<div style={{ width: 1, height: 14, background: "var(--stone-200)" }} />
				<div style={{ fontSize: 12, color: "var(--stone-500)" }}>
					{breadcrumb}
				</div>
			</div>
			<div
				style={{
					display: "flex",
					gap: 8,
					alignItems: "center",
					fontSize: 11,
					color: "var(--stone-500)",
				}}>
				<span
					style={{
						display: "inline-flex",
						alignItems: "center",
						gap: 8,
						padding: "4px 10px",
						border: "1px solid var(--stone-200)",
						borderRadius: 8,
						background: "var(--stone-50)",
					}}>
					Buscar
					<span
						style={{
							fontFamily: "var(--font-mono)",
							fontSize: 10,
							padding: "1px 5px",
							borderRadius: 4,
							background: "#fff",
							border: "1px solid var(--stone-200)",
							color: "var(--stone-600)",
						}}>
						⌘K
					</span>
				</span>
				<IBell size={14} />
				<div
					style={{
						width: 26,
						height: 26,
						borderRadius: 9999,
						background: "var(--stone-700)",
						color: "#fff",
						fontSize: 10,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}>
					IL
				</div>
			</div>
		</div>
		<div style={{ padding: 20, flex: 1, minWidth: 0 }}>{children}</div>
	</div>
);

// ============================================================
// OBRAS OVERVIEW (financiero / operativo flavor)
// ============================================================
function ObrasOverview({ variant }) {
	const rows =
		variant === "financiero"
			? [
					{
						name: "Escuela Tecnica – Etapa II",
						ent: "Min. Educacion Corrientes",
						avance: 38,
						plazo: 52,
						saldo: "$42.1M",
						risk: "alto",
					},
					{
						name: "Centro de Salud – Refaccion",
						ent: "Municipio de Goya",
						avance: 64,
						plazo: 58,
						saldo: "$18.2M",
						risk: "medio",
					},
					{
						name: "Red Cloacal – Tramo Norte",
						ent: "AySA",
						avance: 12,
						plazo: 31,
						saldo: "$87.4M",
						risk: "alto",
					},
					{
						name: "Pavimento Av. San Martin",
						ent: "Provincia de Buenos Aires",
						avance: 88,
						plazo: 80,
						saldo: "$6.3M",
						risk: "bajo",
					},
					{
						name: "Polideportivo Municipal",
						ent: "Municipio de Mercedes",
						avance: 45,
						plazo: 47,
						saldo: "$28.9M",
						risk: "medio",
					},
				]
			: [
					{
						name: "Escuela Tecnica – Etapa II",
						ent: "Min. Educacion Corrientes",
						avance: 38,
						equipo: 12,
						pendientes: 8,
						risk: "active",
					},
					{
						name: "Centro de Salud – Refaccion",
						ent: "Municipio de Goya",
						avance: 64,
						equipo: 9,
						pendientes: 3,
						risk: "active",
					},
					{
						name: "Red Cloacal – Tramo Norte",
						ent: "AySA",
						avance: 12,
						equipo: 18,
						pendientes: 14,
						risk: "active",
					},
					{
						name: "Pavimento Av. San Martin",
						ent: "Provincia de Buenos Aires",
						avance: 88,
						equipo: 7,
						pendientes: 1,
						risk: "close",
					},
					{
						name: "Polideportivo Municipal",
						ent: "Municipio de Mercedes",
						avance: 45,
						equipo: 11,
						pendientes: 5,
						risk: "active",
					},
				];

	const riskTone = { alto: "red", medio: "amber", bajo: "green" };
	const cols =
		variant === "financiero"
			? "1.8fr 1.1fr 1.4fr 80px 90px"
			: "1.8fr 1.1fr 1.4fr 60px 100px";

	return (
		<MockChrome
			breadcrumb='Constructora Norte / Excel / Obras'
			active='Excel'>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "flex-end",
					marginBottom: 16,
					gap: 12,
					flexWrap: "wrap",
				}}>
				<div>
					<div
						style={{
							fontSize: 11,
							color: "var(--stone-500)",
							letterSpacing: ".1em",
							textTransform: "uppercase",
							fontWeight: 600,
						}}>
						Cartera activa
					</div>
					<div
						style={{
							fontFamily: "var(--font-serif)",
							fontSize: 24,
							color: "var(--stone-900)",
							marginTop: 4,
						}}>
						{variant === "financiero"
							? "$182.9M de contrato registrado"
							: "5 obras en ejecución"}
					</div>
				</div>
				<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
					<UITray>
						<UIChip active>Todas</UIChip>
						<UIChip>En obra</UIChip>
						<UIChip>Por cerrar</UIChip>
					</UITray>
					<UIButton
						variant='outline'
						size='sm'
						icon={<IFilter size={13} />}>
						Filtros
					</UIButton>
					<UIButton
						variant='dark'
						size='sm'>
						+ Nueva obra
					</UIButton>
				</div>
			</div>
			<div style={cardStyle}>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: cols,
						...thStyle,
						padding: 0,
					}}>
					<div style={{ padding: "8px 16px" }}>Obra</div>
					<div style={{ padding: "8px 16px" }}>Entidad</div>
					<div style={{ padding: "8px 16px" }}>Avance</div>
					{variant === "financiero" ? (
						<div style={{ padding: "8px 16px", textAlign: "right" }}>Saldo</div>
					) : (
						<div style={{ padding: "8px 16px", textAlign: "right" }}>
							Equipo
						</div>
					)}
					<div style={{ padding: "8px 16px", textAlign: "right" }}>
						{variant === "financiero" ? "Riesgo" : "Estado"}
					</div>
				</div>
				{rows.map((r, i) => (
					<div
						key={i}
						style={{
							display: "grid",
							gridTemplateColumns: cols,
							...tdRow(i === rows.length - 1),
							padding: 0,
						}}>
						<div
							style={{
								padding: "8px 16px",
								color: "var(--stone-900)",
								fontWeight: 500,
							}}>
							{r.name}
						</div>
						<div style={{ padding: "8px 16px", color: "var(--stone-500)" }}>
							{r.ent}
						</div>
						<div
							style={{
								padding: "8px 16px",
								display: "flex",
								alignItems: "center",
								gap: 10,
							}}>
							<div style={{ flex: 1 }}>
								<ProgressBar
									value={r.avance}
									color={
										r.avance > 60
											? "#16a34a"
											: r.avance > 30
												? "var(--orange-primary)"
												: "#dc2626"
									}
								/>
							</div>
							<div
								style={{
									fontFamily: "var(--font-mono)",
									fontSize: 11,
									color: "var(--stone-700)",
									minWidth: 32,
									textAlign: "right",
								}}>
								{r.avance}%
							</div>
						</div>
						{variant === "financiero" ? (
							<div
								style={{
									padding: "8px 16px",
									fontFamily: "var(--font-mono)",
									fontWeight: 600,
									color: "var(--stone-900)",
									textAlign: "right",
								}}>
								{r.saldo}
							</div>
						) : (
							<div
								style={{
									padding: "8px 16px",
									fontFamily: "var(--font-mono)",
									color: "var(--stone-700)",
									textAlign: "right",
								}}>
								{r.equipo}
							</div>
						)}
						<div
							style={{
								padding: "6px 16px",
								display: "flex",
								justifyContent: "flex-end",
								alignItems: "center",
							}}>
							{variant === "financiero" ? (
								<StatusBadge tone={riskTone[r.risk]}>{r.risk}</StatusBadge>
							) : (
								<StatusBadge tone={r.risk === "active" ? "orange" : "stone"}>
									{r.risk === "active" ? "En obra" : "Por cerrar"}
								</StatusBadge>
							)}
						</div>
					</div>
				))}
			</div>
			<div
				style={{
					display: "flex",
					gap: 14,
					marginTop: 12,
					fontSize: 11,
					color: "var(--stone-500)",
					alignItems: "center",
				}}>
				<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
					<Dot
						color='var(--src-extraction)'
						size={7}
					/>{" "}
					Dato extraído de documento
				</span>
				<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
					<Dot
						color='var(--src-manual)'
						size={7}
					/>{" "}
					Carga manual
				</span>
				<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
					<Dot
						color='var(--src-mixed)'
						size={7}
					/>{" "}
					Mixto
				</span>
				<span style={{ marginLeft: "auto" }}>
					Exportar: <b style={{ color: "var(--stone-700)" }}>Excel · PDF</b>
				</span>
			</div>
		</MockChrome>
	);
}

// ============================================================
// OBRA DETAIL — top-nav dark-pill tabs + KPIs + activity rail
// ============================================================
function ObraDetail({ variant }) {
	return (
		<MockChrome
			breadcrumb='Excel / Obras / Centro de Salud – Refacción'
			active='Excel'>
			<div style={{ marginBottom: 14 }}>
				<div
					style={{
						fontSize: 10,
						fontWeight: 700,
						letterSpacing: ".15em",
						textTransform: "uppercase",
						color: "var(--stone-500)",
						marginBottom: 6,
					}}>
					Municipio de Goya · OB-2401
				</div>
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "flex-end",
						gap: 12,
						flexWrap: "wrap",
					}}>
					<div
						style={{
							fontFamily: "var(--font-serif)",
							fontSize: 26,
							color: "var(--stone-900)",
							lineHeight: 1.1,
						}}>
						Centro de Salud – Refacción
					</div>
					<div style={{ display: "flex", gap: 8 }}>
						<UIButton
							variant='outline'
							size='sm'>
							Compartir
						</UIButton>
						<UIButton
							variant='dark'
							size='sm'
							icon={<IDoc size={13} />}>
							Generar reporte
						</UIButton>
					</div>
				</div>
			</div>

			{/* top-nav tabs: dark pill (excel-page-tabs pattern) */}
			<div style={{ marginBottom: 12 }}>
				<PillTabs
					tabs={[
						"General",
						"Flujo",
						"Documentos",
						"Certificados",
						"Gastos",
						"Reportes",
					]}
					active={0}
				/>
			</div>

			<div style={{ ...cardStyle, padding: 18 }}>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(4, 1fr)",
						gap: 12,
						marginBottom: 18,
					}}>
					{(variant === "financiero"
						? [
								{
									l: "Avance",
									v: "64%",
									sub: "+4pp vs mes ant.",
									c: "#16a34a",
								},
								{
									l: "Plazo",
									v: "58%",
									sub: "12 días atraso",
									c: "var(--orange-primary)",
								},
								{
									l: "Saldo a certificar",
									v: "$18.2M",
									sub: "3 certs pendientes",
									c: "var(--stone-700)",
								},
								{
									l: "Desvío acumulado",
									v: "-7.4%",
									sub: "vs curva plan",
									c: "#dc2626",
								},
							]
						: [
								{
									l: "Avance",
									v: "64%",
									sub: "+4pp esta semana",
									c: "#16a34a",
								},
								{
									l: "Equipo activo",
									v: "9",
									sub: "3 roles distintos",
									c: "var(--stone-700)",
								},
								{
									l: "Pendientes",
									v: "3",
									sub: "1 vence hoy",
									c: "var(--orange-primary)",
								},
								{
									l: "Documentos",
									v: "147",
									sub: "12 sin clasificar",
									c: "var(--stone-700)",
								},
							]
					).map((k, i) => (
						<div
							key={i}
							style={{
								padding: "12px 14px",
								background: "var(--stone-50)",
								borderRadius: 8,
								border: "1px solid var(--stone-100)",
							}}>
							<div
								style={{
									fontSize: 10,
									fontWeight: 700,
									letterSpacing: ".1em",
									textTransform: "uppercase",
									color: "var(--stone-500)",
								}}>
								{k.l}
							</div>
							<div
								style={{
									fontFamily: "var(--font-serif)",
									fontSize: 28,
									color: k.c,
									marginTop: 6,
									lineHeight: 1,
								}}>
								{k.v}
							</div>
							<div
								style={{
									fontSize: 10.5,
									color: "var(--stone-500)",
									marginTop: 6,
								}}>
								{k.sub}
							</div>
						</div>
					))}
				</div>

				<div
					style={{
						fontSize: 10,
						fontWeight: 700,
						letterSpacing: ".15em",
						textTransform: "uppercase",
						color: "var(--stone-500)",
						marginBottom: 8,
					}}>
					Actividad reciente
				</div>
				{(variant === "financiero"
					? [
							{
								tag: "CERT",
								title: "Certificado N° 7 emitido por $4.8M",
								time: "hace 12 min",
								who: "Ignacio L.",
							},
							{
								tag: "ALERT",
								title: "Curva financiera por debajo del plan",
								time: "hace 1 h",
								who: "Sistema",
							},
							{
								tag: "DOC",
								title: "OC 0421 procesada — 12 items extraídos",
								time: "hace 3 h",
								who: "Sistema",
							},
							{
								tag: "GASTO",
								title: "Gasto cargado: hormigón H21 — $640k",
								time: "hoy 09:14",
								who: "M. Pérez",
							},
						]
					: [
							{
								tag: "FLUJO",
								title: "Recordatorio: revisión quincenal mañana 10hs",
								time: "hace 8 min",
								who: "Calendario",
							},
							{
								tag: "DOC",
								title: "Nuevo plano subido en /Documentos/Técnico",
								time: "hace 1 h",
								who: "C. López",
							},
							{
								tag: "ROL",
								title: "Permiso de Contador habilitado para Compras",
								time: "hace 3 h",
								who: "Admin",
							},
							{
								tag: "PEND",
								title: "3 tareas asignadas al equipo de campo",
								time: "hoy 09:14",
								who: "Coordinación",
							},
						]
				).map((a, i) => (
					<div
						key={i}
						style={{
							display: "grid",
							gridTemplateColumns: "70px 1fr auto",
							gap: 12,
							alignItems: "center",
							padding: "8px 12px",
							borderTop: i ? "1px solid var(--stone-100)" : "none",
							fontSize: 13,
						}}>
						<div
							style={{
								fontSize: 9.5,
								fontWeight: 700,
								letterSpacing: ".1em",
								color: "var(--stone-500)",
							}}>
							{a.tag}
						</div>
						<div style={{ color: "var(--stone-900)" }}>{a.title}</div>
						<div style={{ fontSize: 10.5, color: "var(--stone-500)" }}>
							{a.time} · {a.who}
						</div>
					</div>
				))}
			</div>
		</MockChrome>
	);
}

// ============================================================
// PERMISOS / RBAC MATRIX
// ============================================================
function PermisosMatrix() {
	const roles = ["Admin", "Obra Mgr", "Contador", "Técnico", "Dirección"];
	const modules = [
		{ m: "Obras", a: [true, true, false, true, true] },
		{ m: "Documentos", a: [true, true, true, true, true] },
		{ m: "Certificados", a: [true, true, true, false, true] },
		{ m: "Gastos", a: [true, true, true, false, true] },
		{ m: "Reportes", a: [true, true, true, false, true] },
		{ m: "Configuración", a: [true, false, false, false, false] },
		{ m: "Secretos API", a: [true, false, false, false, false] },
	];
	return (
		<MockChrome
			breadcrumb='Administración / Roles y Permisos'
			active='Roles y Permisos'>
			<div
				style={{
					marginBottom: 14,
					display: "flex",
					justifyContent: "space-between",
					alignItems: "flex-end",
					gap: 12,
					flexWrap: "wrap",
				}}>
				<div>
					<div
						style={{
							fontSize: 10,
							fontWeight: 700,
							letterSpacing: ".15em",
							textTransform: "uppercase",
							color: "var(--stone-500)",
						}}>
						Roles de la organización
					</div>
					<div
						style={{
							fontFamily: "var(--font-serif)",
							fontSize: 24,
							color: "var(--stone-900)",
							marginTop: 4,
						}}>
						Permisos por módulo y rol
					</div>
				</div>
				<UIButton
					variant='dark'
					size='sm'>
					+ Nuevo rol
				</UIButton>
			</div>
			<div style={cardStyle}>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: `1.2fr repeat(${roles.length}, 1fr)`,
						...thStyle,
						padding: "8px 16px",
					}}>
					<div>Módulo</div>
					{roles.map((r) => (
						<div
							key={r}
							style={{ textAlign: "center" }}>
							{r}
						</div>
					))}
				</div>
				{modules.map((mod, i) => (
					<div
						key={i}
						style={{
							display: "grid",
							gridTemplateColumns: `1.2fr repeat(${roles.length}, 1fr)`,
							...tdRow(i === modules.length - 1),
						}}>
						<div style={{ color: "var(--stone-900)", fontWeight: 500 }}>
							{mod.m}
						</div>
						{mod.a.map((ok, j) => (
							<div
								key={j}
								style={{ textAlign: "center" }}>
								{ok ? (
									<span
										style={{
											display: "inline-flex",
											width: 18,
											height: 18,
											borderRadius: 4,
											background: "var(--orange-primary)",
											color: "#fff",
											alignItems: "center",
											justifyContent: "center",
											fontSize: 10,
										}}>
										✓
									</span>
								) : (
									<span
										style={{
											display: "inline-block",
											width: 18,
											height: 18,
											borderRadius: 4,
											border: "1px dashed var(--stone-300)",
										}}
									/>
								)}
							</div>
						))}
					</div>
				))}
			</div>
			<div
				style={{
					display: "flex",
					gap: 16,
					marginTop: 12,
					fontSize: 11,
					color: "var(--stone-500)",
					alignItems: "center",
				}}>
				<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
					<Dot color='var(--orange-primary)' /> Permitido
				</span>
				<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
					<span
						style={{
							width: 8,
							height: 8,
							border: "1px dashed var(--stone-400)",
							borderRadius: 2,
						}}
					/>{" "}
					Sin acceso
				</span>
				<span style={{ marginLeft: "auto", color: "var(--stone-700)" }}>
					Override por obra: <b>12 reglas activas</b>
				</span>
			</div>
		</MockChrome>
	);
}

// ============================================================
// FLUJO BOARD — workflow / pending tasks
// ============================================================
function FlujoBoard() {
	const items = [
		{
			tag: "Alerta",
			text: "Póliza Norte II vence en 2 días",
			meta: "Vence 31/05",
			c: "#dc2626",
		},
		{
			tag: "Recordatorio",
			text: "Cargar certificado N° 7 — Centro de Salud",
			meta: "Hoy 16:00",
			c: "var(--orange-primary)",
		},
		{
			tag: "Calendario",
			text: "Visita a obra Polideportivo",
			meta: "Jue 30/05",
			c: "#9333ea",
		},
		{
			tag: "Notificación",
			text: "Adicional 03 subido por M. Pérez",
			meta: "hace 2 h",
			c: "#2563eb",
		},
		{
			tag: "Alerta",
			text: "3 documentos pendientes de revisión",
			meta: "Escuela Téc.",
			c: "#dc2626",
		},
		{
			tag: "Recordatorio",
			text: "Reporte mensual a dirección",
			meta: "Vie 31/05",
			c: "var(--orange-primary)",
		},
	];
	return (
		<MockChrome
			breadcrumb='Notificaciones / Esta semana'
			active='Notificaciones'>
			<div
				style={{
					marginBottom: 14,
					display: "flex",
					justifyContent: "space-between",
					alignItems: "flex-end",
					gap: 12,
					flexWrap: "wrap",
				}}>
				<div>
					<div
						style={{
							fontSize: 10,
							fontWeight: 700,
							letterSpacing: ".15em",
							textTransform: "uppercase",
							color: "var(--stone-500)",
						}}>
						Notificaciones y recordatorios
					</div>
					<div
						style={{
							fontFamily: "var(--font-serif)",
							fontSize: 24,
							color: "var(--stone-900)",
							marginTop: 4,
						}}>
						Actividad de la obra
					</div>
				</div>
				<UITray>
					<UIChip active>Todas</UIChip>
					<UIChip>Alertas</UIChip>
					<UIChip>Recordatorios</UIChip>
				</UITray>
			</div>
			<div style={cardStyle}>
				{items.map((it, i) => (
					<div
						key={i}
						style={{
							display: "grid",
							gridTemplateColumns: "auto 96px 1fr auto",
							gap: 12,
							...tdRow(i === items.length - 1),
							padding: "10px 16px",
						}}>
						<Dot
							color={it.c}
							size={7}
						/>
						<div
							style={{
								fontSize: 10,
								fontWeight: 700,
								letterSpacing: ".1em",
								textTransform: "uppercase",
								color: it.c,
							}}>
							{it.tag}
						</div>
						<div style={{ fontSize: 12.5, color: "var(--stone-800)" }}>
							{it.text}
						</div>
						<div
							style={{
								fontFamily: "var(--font-mono)",
								fontSize: 11,
								color: "var(--stone-500)",
							}}>
							{it.meta}
						</div>
					</div>
				))}
			</div>
		</MockChrome>
	);
}

// ============================================================
// CERTIFICADOS — financial cycle table
// ============================================================
function CertificadosTable() {
	const rows = [
		{
			n: "C-007",
			obra: "Centro de Salud",
			monto: "$4.80M",
			emit: "12/05",
			est: "Facturado",
			pag: "—",
			tone: "amber",
		},
		{
			n: "C-006",
			obra: "Centro de Salud",
			monto: "$3.20M",
			emit: "28/04",
			est: "Cobrado",
			pag: "10/05",
			tone: "green",
		},
		{
			n: "C-014",
			obra: "Escuela Téc.",
			monto: "$6.10M",
			emit: "02/05",
			est: "Pendiente",
			pag: "—",
			tone: "red",
		},
		{
			n: "C-013",
			obra: "Escuela Téc.",
			monto: "$5.40M",
			emit: "18/04",
			est: "Cobrado",
			pag: "29/04",
			tone: "green",
		},
		{
			n: "C-022",
			obra: "Red Cloacal",
			monto: "$9.80M",
			emit: "07/05",
			est: "Facturado",
			pag: "—",
			tone: "amber",
		},
		{
			n: "C-001",
			obra: "Polideportivo",
			monto: "$2.30M",
			emit: "01/05",
			est: "Pendiente",
			pag: "—",
			tone: "red",
		},
	];
	const cols = "70px 1.4fr 1fr 80px 110px 90px";
	return (
		<MockChrome
			breadcrumb='Excel / Obras / Certificados'
			active='Excel'>
			<div
				style={{
					marginBottom: 14,
					display: "flex",
					justifyContent: "space-between",
					alignItems: "flex-end",
					gap: 12,
					flexWrap: "wrap",
				}}>
				<div>
					<div
						style={{
							fontSize: 10,
							fontWeight: 700,
							letterSpacing: ".15em",
							textTransform: "uppercase",
							color: "var(--stone-500)",
						}}>
						Ciclo de cobro
					</div>
					<div
						style={{
							fontFamily: "var(--font-serif)",
							fontSize: 24,
							color: "var(--stone-900)",
							marginTop: 4,
						}}>
						Certificados &amp; facturación
					</div>
				</div>
				<div
					style={{
						display: "flex",
						gap: 14,
						alignItems: "center",
						fontSize: 11,
					}}>
					<div>
						<span style={{ color: "var(--stone-500)" }}>Total emitido</span>{" "}
						<b
							style={{
								color: "var(--stone-900)",
								fontFamily: "var(--font-mono)",
							}}>
							$31.6M
						</b>
					</div>
					<div>
						<span style={{ color: "var(--stone-500)" }}>Por cobrar</span>{" "}
						<b style={{ color: "#b45309", fontFamily: "var(--font-mono)" }}>
							$16.9M
						</b>
					</div>
					<UIButton
						variant='outline'
						size='sm'
						icon={<IDownload size={13} />}>
						Exportar
					</UIButton>
				</div>
			</div>
			<div style={cardStyle}>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: cols,
						...thStyle,
						padding: "8px 16px",
					}}>
					<div>N°</div>
					<div>Obra</div>
					<div style={{ textAlign: "right" }}>Monto</div>
					<div style={{ textAlign: "right" }}>Emisión</div>
					<div style={{ textAlign: "center" }}>Estado</div>
					<div style={{ textAlign: "right" }}>Cobro</div>
				</div>
				{rows.map((r, i) => (
					<div
						key={i}
						style={{
							display: "grid",
							gridTemplateColumns: cols,
							...tdRow(i === rows.length - 1),
						}}>
						<div
							style={{
								fontFamily: "var(--font-mono)",
								color: "var(--stone-700)",
								fontSize: 12,
							}}>
							{r.n}
						</div>
						<div style={{ color: "var(--stone-900)" }}>{r.obra}</div>
						<div
							style={{
								fontFamily: "var(--font-mono)",
								fontWeight: 600,
								color: "var(--stone-900)",
								textAlign: "right",
							}}>
							{r.monto}
						</div>
						<div
							style={{
								fontFamily: "var(--font-mono)",
								color: "var(--stone-600)",
								textAlign: "right",
								fontSize: 11,
							}}>
							{r.emit}
						</div>
						<div style={{ textAlign: "center" }}>
							<StatusBadge tone={r.tone}>{r.est}</StatusBadge>
						</div>
						<div
							style={{
								fontFamily: "var(--font-mono)",
								color: "var(--stone-500)",
								textAlign: "right",
								fontSize: 11,
							}}>
							{r.pag}
						</div>
					</div>
				))}
			</div>
			<div
				style={{
					display: "flex",
					gap: 14,
					marginTop: 12,
					fontSize: 11,
					color: "var(--stone-500)",
				}}>
				<span>
					Tabla editable: doble clic para corregir estado, fecha o nota.
				</span>
				<span style={{ marginLeft: "auto" }}>
					Cada fila enlaza al certificado PDF que la respalda.
				</span>
			</div>
		</MockChrome>
	);
}

// ============================================================
// AVANCE VS PLAZO — chart-style mock
// ============================================================
function AvanceVsPlazo() {
	const obras = [
		{ n: "Centro de Salud", av: 64, pl: 58, dx: "+6", c: "#16a34a" },
		{ n: "Escuela Técnica", av: 38, pl: 52, dx: "-14", c: "#dc2626" },
		{ n: "Red Cloacal", av: 12, pl: 31, dx: "-19", c: "#dc2626" },
		{ n: "Pavimento SM", av: 88, pl: 80, dx: "+8", c: "#16a34a" },
		{
			n: "Polideportivo",
			av: 45,
			pl: 47,
			dx: "-2",
			c: "var(--orange-primary)",
		},
	];
	return (
		<MockChrome
			breadcrumb='Dashboard / Avance vs plazo'
			active='Dashboard'>
			<div
				style={{
					marginBottom: 14,
					display: "flex",
					justifyContent: "space-between",
					alignItems: "flex-end",
					gap: 12,
					flexWrap: "wrap",
				}}>
				<div>
					<div
						style={{
							fontSize: 10,
							fontWeight: 700,
							letterSpacing: ".15em",
							textTransform: "uppercase",
							color: "var(--stone-500)",
						}}>
						Curva física vs cronograma
					</div>
					<div
						style={{
							fontFamily: "var(--font-serif)",
							fontSize: 24,
							color: "var(--stone-900)",
							marginTop: 4,
						}}>
						2 obras para revisar
					</div>
				</div>
				<SegmentControl
					options={["Mes", "Trimestre", "Obra"]}
					value='Obra'
				/>
			</div>
			<div style={{ ...cardStyle, padding: 18 }}>
				{obras.map((o, i) => (
					<div
						key={i}
						style={{ marginBottom: i < obras.length - 1 ? 18 : 0 }}>
						<div
							style={{
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								marginBottom: 6,
								fontSize: 13,
							}}>
							<span style={{ color: "var(--stone-900)", fontWeight: 500 }}>
								{o.n}
							</span>
							<span
								style={{
									fontFamily: "var(--font-mono)",
									color: o.c,
									fontWeight: 600,
									fontSize: 12,
								}}>
								{o.dx} pp
							</span>
						</div>
						<div
							style={{
								position: "relative",
								height: 18,
								background: "var(--stone-50)",
								borderRadius: 6,
								overflow: "hidden",
							}}>
							{/* plazo (cronograma) */}
							<div
								style={{
									position: "absolute",
									inset: 0,
									width: o.pl + "%",
									background:
										"repeating-linear-gradient(45deg, var(--stone-200), var(--stone-200) 6px, transparent 6px, transparent 12px)",
								}}
							/>
							{/* avance fisico */}
							<div
								style={{
									position: "absolute",
									left: 0,
									top: 4,
									bottom: 4,
									width: o.av + "%",
									background: o.c,
									borderRadius: 4,
								}}
							/>
							<div
								style={{
									position: "absolute",
									left: o.av + "%",
									top: 0,
									bottom: 0,
									width: 2,
									background: "var(--stone-900)",
								}}
							/>
						</div>
						<div
							style={{
								display: "flex",
								justifyContent: "space-between",
								marginTop: 4,
								fontSize: 10,
								color: "var(--stone-500)",
								fontFamily: "var(--font-mono)",
							}}>
							<span>Avance {o.av}%</span>
							<span>Plazo {o.pl}%</span>
						</div>
					</div>
				))}
			</div>
		</MockChrome>
	);
}

// ============================================================
// ALERTAS — financial alerts list
// ============================================================
function AlertasFinancieras() {
	const items = [
		{
			sev: "REVISIÓN",
			c: "#dc2626",
			t: "Escuela Técnica: avance menor al plazo",
			d: "El avance físico está 14 puntos por debajo del plazo transcurrido. Conviene revisar el detalle de obra.",
			time: "hace 8 min",
		},
		{
			sev: "SEGUIMIENTO",
			c: "#d97706",
			t: "Certificado C-022 facturado sin cobro",
			d: "Red Cloacal – Tramo Norte. AySA. 42 días sin registrar cobro en la tabla de certificados.",
			time: "hace 1 h",
		},
		{
			sev: "SEGUIMIENTO",
			c: "#d97706",
			t: "Polideportivo: documentos por revisar",
			d: "Hay documentos recientes vinculados a la obra que todavía no fueron revisados en la tabla destino.",
			time: "hoy 09:14",
		},
		{
			sev: "AVISO",
			c: "var(--orange-primary)",
			t: "Centro de Salud: cambio de avance",
			d: "El porcentaje de avance cambió esta semana. El reporte conserva el contexto de la modificación.",
			time: "hoy 08:02",
		},
		{
			sev: "OK",
			c: "#16a34a",
			t: "Pavimento Av. San Martín al día",
			d: "Avance y certificados registrados sin pendientes visibles en esta vista.",
			time: "ayer",
		},
	];
	return (
		<MockChrome
			breadcrumb='Notificaciones / Esta semana'
			active='Notificaciones'>
			<div
				style={{
					marginBottom: 14,
					display: "flex",
					justifyContent: "space-between",
					alignItems: "flex-end",
					gap: 12,
					flexWrap: "wrap",
				}}>
				<div>
					<div
						style={{
							fontSize: 10,
							fontWeight: 700,
							letterSpacing: ".15em",
							textTransform: "uppercase",
							color: "var(--stone-500)",
						}}>
						5 señales detectadas
					</div>
					<div
						style={{
							fontFamily: "var(--font-serif)",
							fontSize: 24,
							color: "var(--stone-900)",
							marginTop: 4,
						}}>
						Seguimiento financiero
					</div>
				</div>
				<UIButton
					variant='outline'
					size='sm'
					icon={<IDownload size={13} />}>
					Exportar reporte
				</UIButton>
			</div>
			{items.map((it, i) => (
				<div
					key={i}
					style={{
						display: "grid",
						gridTemplateColumns: "90px 1fr auto",
						gap: 16,
						alignItems: "start",
						padding: "13px 16px",
						...cardStyle,
						marginBottom: 8,
					}}>
					<div
						style={{
							fontSize: 10,
							fontWeight: 700,
							letterSpacing: ".1em",
							color: it.c,
							paddingTop: 2,
						}}>
						{it.sev}
					</div>
					<div>
						<div
							style={{
								fontSize: 13,
								color: "var(--stone-900)",
								fontWeight: 500,
								marginBottom: 4,
							}}>
							{it.t}
						</div>
						<div
							style={{
								fontSize: 12,
								color: "var(--stone-600)",
								lineHeight: 1.45,
							}}>
							{it.d}
						</div>
					</div>
					<div
						style={{
							fontSize: 11,
							color: "var(--stone-500)",
							whiteSpace: "nowrap",
							paddingTop: 2,
						}}>
						{it.time}
					</div>
				</div>
			))}
		</MockChrome>
	);
}

// ============================================================
// VISTA POR ROL — role switcher demo (segment control DS §8)
// ============================================================
function VistaPorRol() {
	const [rol, setRol] = useState("Admin");
	const roles = ["Admin", "Obra Manager", "Contador"];
	const nav = {
		Admin: [
			"Dashboard",
			"Excel",
			"Document AI",
			"Notificaciones",
			"Generar Documentos",
			"Usuarios",
			"Roles y Permisos",
			"Facturación",
			"Organizaciones",
		],
		"Obra Manager": [
			"Dashboard",
			"Excel",
			"Notificaciones",
			"Generar Documentos",
			"Historial",
		],
		Contador: [
			"Dashboard",
			"Excel",
			"Notificaciones",
			"Generar Documentos",
			"Facturación",
		],
	};
	return (
		<MockChrome
			breadcrumb={"Vista actual: " + rol}
			active='Dashboard'>
			<div style={{ marginBottom: 18 }}>
				<SegmentControl
					options={roles}
					value={rol}
					onChange={setRol}
				/>
			</div>
			<div
				style={{ display: "grid", gridTemplateColumns: "230px 1fr", gap: 16 }}>
				<div style={{ ...cardStyle, padding: 12 }}>
					<div
						style={{
							fontSize: 10,
							fontWeight: 700,
							letterSpacing: ".15em",
							color: "var(--stone-500)",
							marginBottom: 10,
							textTransform: "uppercase",
						}}>
						Navegación visible
					</div>
					{nav[rol].map((n) => (
						<div
							key={n}
							style={{
								padding: "6px 10px",
								fontSize: 12.5,
								color: "var(--stone-800)",
								borderRadius: 6,
							}}>
							{n}
						</div>
					))}
				</div>
				<div style={{ ...cardStyle, padding: 18 }}>
					<div
						style={{
							fontFamily: "var(--font-serif)",
							fontSize: 22,
							color: "var(--stone-900)",
						}}>
						Buen día,{" "}
						{rol === "Admin"
							? "Ignacio"
							: rol === "Obra Manager"
								? "Cecilia"
								: "Mariano"}
					</div>
					<div
						style={{ fontSize: 13, color: "var(--stone-500)", marginTop: 4 }}>
						{rol === "Admin" &&
							"Tenés 12 eventos nuevos y 3 pendientes de la organización."}
						{rol === "Obra Manager" &&
							"Hoy: 2 visitas agendadas y 5 documentos por revisar en tus obras."}
						{rol === "Contador" &&
							"3 certificados emitidos esperan facturación y 6 cobros por confirmar."}
					</div>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "1fr 1fr 1fr",
							gap: 10,
							marginTop: 18,
						}}>
						{(rol === "Admin"
							? ["Cartera total", "Obras activas", "Usuarios"]
							: rol === "Obra Manager"
								? ["Mis obras", "Pendientes", "Documentos"]
								: ["Por cobrar", "Por facturar", "Cierre mes"]
						).map((l, i) => (
							<div
								key={i}
								style={{
									padding: 12,
									background: "var(--stone-50)",
									borderRadius: 8,
									border: "1px solid var(--stone-100)",
								}}>
								<div
									style={{
										fontSize: 9.5,
										fontWeight: 700,
										letterSpacing: ".1em",
										textTransform: "uppercase",
										color: "var(--stone-500)",
									}}>
									{l}
								</div>
								<div
									style={{
										fontFamily: "var(--font-serif)",
										fontSize: 22,
										color: "var(--stone-900)",
										marginTop: 4,
									}}>
									{
										(rol === "Admin"
											? ["$182.9M", "5", "23"]
											: rol === "Obra Manager"
												? ["3", "8", "147"]
												: ["$16.9M", "$14.4M", "12d"])[i]
									}
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</MockChrome>
	);
}

// ============================================================
// ACCION RAPIDA — Document AI pipeline stepper
// ============================================================
function AccionRapida() {
	const steps = [
		{ t: "Subida", d: "OC_0421.pdf · 240KB", on: "done" },
		{ t: "Tipificación", d: "Detectado: Orden de compra", on: "done" },
		{ t: "Extracción", d: "12 items reconocidos", on: "active" },
		{ t: "Revisión", d: "Confirmar y sincronizar con la tabla", on: "queued" },
	];
	return (
		<MockChrome
			breadcrumb='Document AI / Carga documental'
			active='Document AI'>
			<div style={{ marginBottom: 16 }}>
				<div
					style={{
						fontSize: 10,
						fontWeight: 700,
						letterSpacing: ".15em",
						textTransform: "uppercase",
						color: "var(--stone-500)",
					}}>
					Acción rápida en curso
				</div>
				<div
					style={{
						fontFamily: "var(--font-serif)",
						fontSize: 23,
						color: "var(--stone-900)",
						marginTop: 4,
					}}>
					Procesando OC_0421.pdf
				</div>
			</div>
			<div style={{ ...cardStyle, padding: 18 }}>
				{steps.map((s, i) => (
					<div
						key={i}
						style={{
							display: "grid",
							gridTemplateColumns: "auto 1fr auto",
							gap: 16,
							alignItems: "center",
							padding: "10px 0",
							borderBottom:
								i < steps.length - 1 ? "1px dashed var(--stone-200)" : "none",
						}}>
						<div
							style={{
								width: 28,
								height: 28,
								borderRadius: 9999,
								background:
									s.on === "done"
										? "#16a34a"
										: s.on === "active"
											? "var(--orange-primary)"
											: "var(--stone-100)",
								color: s.on === "queued" ? "var(--stone-400)" : "#fff",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								fontSize: 12,
								fontWeight: 600,
								boxShadow:
									s.on === "active" ? "0 0 0 4px rgba(255,88,0,.18)" : "none",
							}}>
							{s.on === "done" ? "✓" : i + 1}
						</div>
						<div>
							<div
								style={{
									fontSize: 13,
									color: "var(--stone-900)",
									fontWeight: 500,
								}}>
								{s.t}
							</div>
							<div
								style={{
									fontSize: 11.5,
									color: "var(--stone-500)",
									marginTop: 2,
								}}>
								{s.d}
							</div>
						</div>
						<StatusBadge
							tone={
								s.on === "done"
									? "green"
									: s.on === "active"
										? "orange"
										: "stone"
							}>
							{s.on === "done"
								? "Listo"
								: s.on === "active"
									? "En curso"
									: "En cola"}
						</StatusBadge>
					</div>
				))}
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						paddingTop: 14,
						marginTop: 8,
						borderTop: "1px solid var(--stone-100)",
						gap: 12,
						flexWrap: "wrap",
					}}>
					<div
						style={{
							display: "flex",
							gap: 12,
							alignItems: "center",
							fontSize: 11,
							color: "var(--stone-500)",
						}}>
						<span
							style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
							<Dot
								color='var(--src-extraction)'
								size={7}
							/>{" "}
							Extraído
						</span>
						<span
							style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
							<Dot
								color='var(--src-manual)'
								size={7}
							/>{" "}
							Manual
						</span>
						<span
							style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
							<Dot
								color='var(--src-mixed)'
								size={7}
							/>{" "}
							Mixto
						</span>
					</div>
					<div style={{ display: "flex", gap: 8 }}>
						<UIButton
							variant='outline'
							size='sm'>
							Cancelar
						</UIButton>
						<UIButton
							variant='dark'
							size='sm'>
							Ver resultado
						</UIButton>
					</div>
				</div>
			</div>
		</MockChrome>
	);
}

// ============================================================
// DOCUMENT EXTRACTION ANIMATION - upload, extraction, table
// ============================================================
const EX_DOC_W = 360;
const EX_DOC_H = 484;
const EX_STAGE = {
	w: 1080,
	h: 720,
	viewW: 1080,
	cropX: 0,
	controlsH: 48,
	duration: 17.8,
};
const EX_DROP = {
	scale: 2,
	zoneW: 520,
	zoneH: 320,
	zoneY: 196,
	docScale: 0.6,
	dropEnd: 2.7,
};
EX_DROP.zoneX = (EX_STAGE.w - EX_DROP.zoneW) / 2;
EX_DROP.docX = EX_DROP.zoneX + EX_DROP.zoneW / 2 - 150;
EX_DROP.docY = EX_DROP.zoneY + EX_DROP.zoneH / 2 - 150;
const EX_EXTRACT_ROOT = {
	x: 100,
	y: 10,
	w: EX_STAGE.w - 200,
	h: EX_STAGE.h - 20,
	scale: 1.3,
};
const EX_EXTRACT_DOC = {
	x: 96,
	y: 132,
	scaleStart: 0.72,
	scaleEnd: 0.8,
};
const EX_EXTRACT_PANEL = {
	x: 470,
	y: 150,
	w: 520,
	rowH: 48,
};
const EX_TABLE_ROOT = {
	x: 0,
	y: 100,
	w: EX_STAGE.w,
	h: EX_STAGE.h - 100,
	scale: 1.3,
};
const EX_TABLE_FRAME = {
	w: 750,
	x: (EX_STAGE.w - 750) / 2,
	y: 116,
	headerH: 35,
	rowH: 50,
	footerH: 52,
};
const EX_C = {
	bg: "#f4f3f0",
	canvas: "#faf9f700",
	white: "#ffffff",
	s100: "#f5f5f4",
	s200: "#e7e5e4",
	s300: "#d6d3d1",
	s400: "#a8a29e",
	s500: "#78716c",
	s600: "#57534e",
	s700: "#44403c",
	s800: "#292524",
	s900: "#1c1917",
	orange: "#ff5800",
	orangeSoft: "rgba(255,88,0,0.10)",
	orangeMid: "rgba(255,88,0,0.22)",
	green: "#16a34a",
	greenSoft: "rgba(22,163,74,0.12)",
};
const EX_FIELDS = [
	{
		key: "numero",
		label: "NRO COMPROBANTE",
		value: "0001-00004821",
		x: 26,
		y: 92,
		w: 176,
		h: 31,
	},
	{
		key: "fecha",
		label: "FECHA",
		value: "14/05/2026",
		x: 238,
		y: 92,
		w: 92,
		h: 31,
	},
	{
		key: "proveedor",
		label: "PROVEEDOR",
		value: "Aceros del Litoral S.A.",
		x: 26,
		y: 150,
		w: 308,
		h: 31,
	},
	{
		key: "cuit",
		label: "CUIT",
		value: "30-71024588-4",
		x: 26,
		y: 208,
		w: 140,
		h: 31,
	},
	{
		key: "obra",
		label: "OBRA",
		value: "Ruta Prov. 12 - Tramo III",
		x: 196,
		y: 208,
		w: 138,
		h: 31,
	},
	{
		key: "subtotal",
		label: "SUBTOTAL",
		value: "$ 1.840.000",
		x: 196,
		y: 352,
		w: 138,
		h: 30,
	},
	{
		key: "iva",
		label: "IVA 21%",
		value: "$ 386.400",
		x: 196,
		y: 398,
		w: 138,
		h: 30,
	},
	{
		key: "total",
		label: "TOTAL",
		value: "$ 2.226.400",
		x: 196,
		y: 444,
		w: 138,
		h: 34,
	},
];
const EX_SCAN_T0 = 0.9;
const EX_SCAN_T1 = 4.4;

const exClamp = (v, min, max) => Math.max(min, Math.min(max, v));
const exLerp = (a, b, t) => a + (b - a) * t;
const exEase = {
	outCubic: (t) => 1 - Math.pow(1 - t, 3),
	inOutCubic: (t) =>
		t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
	inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};
function exAnimate({ from, to, start, end, ease = exEase.inOutCubic }) {
	return (t) => {
		if (t <= start) return from;
		if (t >= end) return to;
		return from + (to - from) * ease((t - start) / (end - start));
	};
}
function exSceneOpacity(lt, dur, inD = 0.45, outD = 0.55) {
	return Math.min(exClamp(lt / inD, 0, 1), exClamp((dur - lt) / outD, 0, 1));
}
function exCaptureTimeFor(field) {
	return EX_SCAN_T0 + (field.y / EX_DOC_H) * (EX_SCAN_T1 - EX_SCAN_T0) + 0.05;
}
function exStageScaledPoint(x, y, scale = 1) {
	const ox = EX_STAGE.w / 2;
	const oy = EX_STAGE.h / 2;
	return {
		x: ox + (x - ox) * scale,
		y: oy + (y - oy) * scale,
	};
}
function exRootScaledPoint(x, y, root = EX_EXTRACT_ROOT) {
	const ox = root.w / 2;
	const oy = root.h / 2;
	return {
		x: root.x + ox + (x - ox) * root.scale,
		y: root.y + oy + (y - oy) * root.scale,
	};
}
function exDropDocFrame() {
	const point = exStageScaledPoint(EX_DROP.docX, EX_DROP.docY, EX_DROP.scale);
	return {
		x: point.x,
		y: point.y,
		scale: EX_DROP.docScale * EX_DROP.scale,
		rotation: -1,
	};
}
function exExtractDocFrame() {
	const point = exRootScaledPoint(EX_EXTRACT_DOC.x, EX_EXTRACT_DOC.y);
	return {
		x: point.x,
		y: point.y,
		scale: EX_EXTRACT_DOC.scaleEnd * EX_EXTRACT_ROOT.scale,
		rotation: 0,
	};
}
function exExtractPanelFrame() {
	const point = exRootScaledPoint(EX_EXTRACT_PANEL.x, EX_EXTRACT_PANEL.y + 48);
	return {
		x: point.x,
		y: point.y,
		width: EX_EXTRACT_PANEL.w * EX_EXTRACT_ROOT.scale,
		height: 360,
	};
}
function exTableScaledPoint(x, y) {
	const ox = EX_TABLE_ROOT.w / 2;
	const oy = EX_TABLE_ROOT.h / 2;
	return {
		x: EX_TABLE_ROOT.x + ox + (x - ox) * EX_TABLE_ROOT.scale,
		y: EX_TABLE_ROOT.y + oy + (y - oy) * EX_TABLE_ROOT.scale,
	};
}
function exTableFirstRowFrame() {
	const point = exTableScaledPoint(
		EX_TABLE_FRAME.x + 18,
		EX_TABLE_FRAME.y + EX_TABLE_FRAME.headerH,
	);
	return {
		x: point.x,
		y: point.y,
		width: (EX_TABLE_FRAME.w - 36) * EX_TABLE_ROOT.scale,
		height: EX_TABLE_FRAME.rowH * EX_TABLE_ROOT.scale,
	};
}
function exTableCellFrame(colKey) {
	const row = exTableFirstRowFrame();
	const colTotalW = EX_COLS.reduce((a, c) => a + c.w, 0);
	let offset = 0;
	for (const col of EX_COLS) {
		const width = row.width * (col.w / colTotalW);
		if (col.key === colKey) {
			return { ...row, x: row.x + offset, width, col };
		}
		offset += width;
	}
	return { ...row, col: EX_COLS[0] };
}
function exEstimatedTextWidth(value, fontSize) {
	return Math.max(34, String(value).length * fontSize * 0.58);
}

function useCurrentAnchorStep(ref) {
	const [isCurrent, setIsCurrent] = React.useState(false);

	React.useEffect(() => {
		const element = ref.current;
		if (!element) return undefined;

		const block = element.closest(".anchor-block");
		if (!block) {
			setIsCurrent(true);
			return undefined;
		}

		let raf = 0;
		const measure = () => {
			raf = 0;
			const rect = block.getBoundingClientRect();
			const viewportCenter = window.innerHeight / 2;
			const blockCenter = rect.top + rect.height / 2;
			setIsCurrent(Math.abs(blockCenter - viewportCenter) < 42);
		};
		const schedule = () => {
			if (raf) return;
			raf = requestAnimationFrame(measure);
		};

		measure();
		window.addEventListener("scroll", schedule, { passive: true });
		window.addEventListener("resize", schedule);
		return () => {
			if (raf) cancelAnimationFrame(raf);
			window.removeEventListener("scroll", schedule);
			window.removeEventListener("resize", schedule);
		};
	}, [ref]);

	return isCurrent;
}

function useExtractionPreviewTime(duration, active = true) {
	const [time, setTime] = React.useState(0);
	const [playing, setPlaying] = React.useState(false);
	const [reducedMotion, setReducedMotion] = React.useState(false);
	const wasActiveRef = React.useRef(false);

	React.useEffect(() => {
		const reduce =
			window.matchMedia &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		setReducedMotion(reduce);
		if (reduce) {
			setTime(8.2);
			setPlaying(false);
		}
	}, []);

	React.useEffect(() => {
		if (reducedMotion) return;
		if (active && !wasActiveRef.current) {
			setTime(0);
			setPlaying(true);
		}
		if (!active && wasActiveRef.current) {
			setTime(0);
			setPlaying(false);
		}
		wasActiveRef.current = active;
	}, [active, reducedMotion]);

	React.useEffect(() => {
		if (reducedMotion || !active || !playing) return undefined;

		let raf = 0;
		let last = null;
		const step = (ts) => {
			if (last == null) last = ts;
			const dt = (ts - last) / 1000;
			last = ts;
			setTime((t) => (t + dt) % duration);
			raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
		return () => cancelAnimationFrame(raf);
	}, [duration, active, playing, reducedMotion]);

	const seek = React.useCallback(
		(next) => {
			setTime(exClamp(next, 0, duration));
		},
		[duration],
	);

	const reset = React.useCallback(() => {
		setTime(0);
		setPlaying(false);
	}, []);

	return { time, playing, setPlaying, seek, reset };
}

function useScaledStage() {
	const ref = React.useRef(null);
	const [scale, setScale] = React.useState(1);

	React.useEffect(() => {
		const measure = () => {
			if (!ref.current) return;
			const rect = ref.current.getBoundingClientRect();
			setScale(
				Math.max(
					0.05,
					Math.min(rect.width / EX_STAGE.viewW, rect.height / EX_STAGE.h),
				),
			);
		};
		measure();
		let ro = null;
		if (typeof ResizeObserver !== "undefined") {
			ro = new ResizeObserver(measure);
			ro.observe(ref.current);
		}
		window.addEventListener("resize", measure);
		return () => {
			if (ro) ro.disconnect();
			window.removeEventListener("resize", measure);
		};
	}, []);

	return { ref, scale };
}

function ExtractionSprite({ time, start, end, children }) {
	if (time < start || time > end) return null;
	const duration = end - start;
	const localTime = time - start;
	return children({
		localTime,
		duration,
		progress: exClamp(localTime / duration, 0, 1),
	});
}

function DocumentExtractionAnimation() {
	const shellRef = React.useRef(null);
	const isCurrentStep = useCurrentAnchorStep(shellRef);
	const { time } = useExtractionPreviewTime(EX_STAGE.duration, isCurrentStep);
	const { ref, scale } = useScaledStage();
	return (
		<div
			ref={shellRef}
			style={{
				width: "100%",
				aspectRatio: `${EX_STAGE.viewW} / ${EX_STAGE.h}`,
				minHeight: 0,
				maxHeight: "min(75vh, 680px)",
				background: EX_C.bg,
				overflow: "hidden",
				fontFamily: "var(--font-sans)",
				display: "flex",
				flexDirection: "column",
			}}>
			<div
				ref={ref}
				style={{
					position: "relative",
					flex: 1,
					minHeight: 0,
					background: EX_C.canvas,
					overflow: "hidden",
				}}>
				<div
					style={{
						position: "absolute",
						left: "50%",
						top: "50%",
						width: EX_STAGE.viewW,
						height: EX_STAGE.h,
						transform: `translate(-50%, -50%) scale(${scale})`,
						transformOrigin: "center",
						background: EX_C.canvas,
						overflow: "hidden",
					}}>
					<div
						style={{
							position: "absolute",
							left: -EX_STAGE.cropX,
							top: 0,
							width: EX_STAGE.w,
							height: EX_STAGE.h,
							background: EX_C.canvas,
						}}>
						<ExtractionSprite
							time={time}
							start={0}
							end={3.35}>
							{(s) => <ExtractionActDrop {...s} />}
						</ExtractionSprite>
						<ExtractionSprite
							time={time}
							start={3.6}
							end={10.95}>
							{(s) => <ExtractionActExtract {...s} />}
						</ExtractionSprite>
						<ExtractionSprite
							time={time}
							start={10.6}
							end={17.8}>
							{(s) => <ExtractionActTable {...s} />}
						</ExtractionSprite>
						<ExtractionSprite
							time={time}
							start={2.7}
							end={4.35}>
							{(s) => <ExtractionDocumentHandoff {...s} />}
						</ExtractionSprite>
						<ExtractionSprite
							time={time}
							start={9.65}
							end={11.4}>
							{(s) => <ExtractionDataRowHandoff {...s} />}
						</ExtractionSprite>
					</div>
				</div>
			</div>
		</div>
	);
}

function ExtractionPlaybackBar({
	time,
	duration,
	playing,
	onToggle,
	onReset,
	onSeek,
}) {
	const trackRef = React.useRef(null);
	const [dragging, setDragging] = React.useState(false);

	const timeFromClientX = React.useCallback(
		(clientX) => {
			if (!trackRef.current) return time;
			const rect = trackRef.current.getBoundingClientRect();
			const pct = exClamp((clientX - rect.left) / rect.width, 0, 1);
			return pct * duration;
		},
		[duration, time],
	);

	React.useEffect(() => {
		if (!dragging) return undefined;
		const onMove = (e) => onSeek(timeFromClientX(e.clientX));
		const onUp = () => setDragging(false);
		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
		return () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		};
	}, [dragging, onSeek, timeFromClientX]);

	const pct = duration > 0 ? (time / duration) * 100 : 0;
	const fmt = (t) => {
		const total = Math.max(0, t);
		const m = Math.floor(total / 60);
		const s = Math.floor(total % 60);
		const cs = Math.floor((total * 100) % 100);
		return `${m}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
	};
	const iconButton = {
		width: 30,
		height: 30,
		borderRadius: 7,
		border: "1px solid rgba(255,255,255,0.10)",
		background: "rgba(255,255,255,0.08)",
		color: "#f6f4ef",
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		padding: 0,
		cursor: "pointer",
		flexShrink: 0,
	};

	return (
		<div
			style={{
				height: EX_STAGE.controlsH,
				display: "flex",
				alignItems: "center",
				gap: 10,
				padding: "8px 12px",
				background: "rgba(20,20,20,0.94)",
				borderTop: "1px solid rgba(255,255,255,0.08)",
				color: "#f6f4ef",
				flexShrink: 0,
			}}>
			<button
				type='button'
				aria-label='Volver al inicio'
				onClick={onReset}
				style={iconButton}>
				<svg
					width='13'
					height='13'
					viewBox='0 0 14 14'
					fill='none'>
					<path
						d='M3 2v10M12 2L5 7l7 5V2z'
						stroke='currentColor'
						strokeWidth='1.5'
						strokeLinejoin='round'
						strokeLinecap='round'
					/>
				</svg>
			</button>
			<button
				type='button'
				aria-label={playing ? "Pausar" : "Reproducir"}
				onClick={onToggle}
				style={iconButton}>
				{playing ? (
					<svg
						width='13'
						height='13'
						viewBox='0 0 14 14'
						fill='none'>
						<rect
							x='3'
							y='2'
							width='3'
							height='10'
							fill='currentColor'
						/>
						<rect
							x='8'
							y='2'
							width='3'
							height='10'
							fill='currentColor'
						/>
					</svg>
				) : (
					<svg
						width='13'
						height='13'
						viewBox='0 0 14 14'
						fill='none'>
						<path
							d='M3 2l9 5-9 5V2z'
							fill='currentColor'
						/>
					</svg>
				)}
			</button>
			<div
				style={{
					fontFamily: "var(--font-mono)",
					fontSize: 11,
					width: 48,
					color: "rgba(246,244,239,0.78)",
					fontVariantNumeric: "tabular-nums",
					flexShrink: 0,
				}}>
				{fmt(time)}
			</div>
			<div
				ref={trackRef}
				onMouseDown={(e) => {
					setDragging(true);
					onSeek(timeFromClientX(e.clientX));
				}}
				style={{
					position: "relative",
					height: 22,
					flex: 1,
					minWidth: 54,
					display: "flex",
					alignItems: "center",
					cursor: "pointer",
				}}>
				<div
					style={{
						position: "absolute",
						left: 0,
						right: 0,
						height: 4,
						borderRadius: 999,
						background: "rgba(255,255,255,0.16)",
					}}
				/>
				<div
					style={{
						position: "absolute",
						left: 0,
						width: `${pct}%`,
						height: 4,
						borderRadius: 999,
						background: EX_C.orange,
					}}
				/>
				<div
					style={{
						position: "absolute",
						left: `calc(${pct}% - 5px)`,
						width: 10,
						height: 10,
						borderRadius: 999,
						background: "#fff",
						boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
					}}
				/>
			</div>
			<div
				style={{
					fontFamily: "var(--font-mono)",
					fontSize: 11,
					width: 48,
					textAlign: "right",
					color: "rgba(246,244,239,0.52)",
					fontVariantNumeric: "tabular-nums",
					flexShrink: 0,
				}}>
				{fmt(duration)}
			</div>
		</div>
	);
}

function ExtractionFacturaDoc({
	variant = "factura",
	scanY = null,
	captured = null,
	dim = false,
}) {
	const isCert = variant === "certificado";
	const labelStyle = {
		fontFamily: "var(--font-sans)",
		fontSize: 8.5,
		fontWeight: 700,
		letterSpacing: "0.12em",
		color: EX_C.s400,
		textTransform: "uppercase",
	};
	const valStyle = {
		fontFamily: "var(--font-sans)",
		fontSize: 14,
		fontWeight: 600,
		color: EX_C.s800,
		marginTop: 3,
		whiteSpace: "nowrap",
	};
	return (
		<div
			style={{
				position: "relative",
				width: EX_DOC_W,
				height: EX_DOC_H,
				background: EX_C.white,
				borderRadius: 8,
				border: `1px solid ${EX_C.s200}`,
				boxShadow:
					"0 18px 40px -12px rgba(28,25,23,0.28), 0 2px 6px rgba(28,25,23,0.08)",
				overflow: "hidden",
				filter: dim ? "saturate(0.9)" : "none",
			}}>
			<div
				style={{
					position: "absolute",
					top: 24,
					left: 26,
					right: 26,
					display: "flex",
					alignItems: "center",
					gap: 10,
				}}>
				<div
					style={{
						width: 22,
						height: 22,
						borderRadius: 5,
						background: EX_C.orange,
					}}
				/>
				<div
					style={{
						fontFamily: "var(--font-sans)",
						fontSize: 17,
						fontWeight: 700,
						letterSpacing: "0.04em",
						color: EX_C.s900,
					}}>
					{isCert ? "CERTIFICADO" : "FACTURA"}
				</div>
				<div
					style={{
						marginLeft: "auto",
						width: 26,
						height: 26,
						borderRadius: 5,
						border: `1.5px solid ${EX_C.s300}`,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						fontWeight: 700,
						fontSize: 13,
						color: EX_C.s600,
					}}>
					{isCert ? "C" : "A"}
				</div>
			</div>
			<div
				style={{
					position: "absolute",
					top: 60,
					left: 26,
					right: 26,
					height: 1,
					background: EX_C.s200,
				}}
			/>

			{captured &&
				EX_FIELDS.map((f) => {
					if (!captured.has(f.key)) return null;
					const box = exHighlightBox(f);
					return (
						<div
							key={"box" + f.key}
							style={{
								position: "absolute",
								left: box.left,
								top: box.top + 5,
								width: box.width,
								height: box.height,
								border: `1.4px solid ${EX_C.orange}`,
								borderRadius: 6,
							}}
						/>
					);
				})}

			{EX_FIELDS.map((f) => {
				const lbl = isCert ? exCertLabel(f.key) : f.label;
				const val = isCert ? exCertValue(f.key) : f.value;
				return (
					<div
						key={f.key}
						style={{ position: "absolute", left: f.x, top: f.y }}>
						<div style={labelStyle}>{lbl}</div>
						<div
							style={{
								...valStyle,
								fontSize: f.key === "total" ? 19 : 14,
								color: f.key === "total" ? EX_C.s900 : EX_C.s800,
							}}>
							{val}
						</div>
					</div>
				);
			})}

			<div style={{ position: "absolute", left: 26, top: 256, right: 26 }}>
				<div style={{ ...labelStyle, marginBottom: 8 }}>DETALLE</div>
				{[0, 1, 2].map((i) => (
					<div
						key={i}
						style={{
							display: "flex",
							alignItems: "center",
							gap: 8,
							marginBottom: 9,
						}}>
						<div
							style={{
								height: 7,
								borderRadius: 3,
								background: EX_C.s200,
								flex: i === 0 ? 5 : i === 1 ? 4 : 6,
							}}
						/>
						<div
							style={{
								height: 7,
								width: 52,
								borderRadius: 3,
								background: EX_C.s100,
							}}
						/>
					</div>
				))}
			</div>
			<div
				style={{
					position: "absolute",
					left: 26,
					top: 336,
					right: 26,
					height: 1,
					background: EX_C.s200,
				}}
			/>

			{scanY != null && scanY > 0 && scanY < EX_DOC_H && (
				<React.Fragment>
					<div
						style={{
							position: "absolute",
							left: 0,
							right: 0,
							top: 0,
							height: scanY,
							background:
								"linear-gradient(180deg, rgba(255,88,0,0.00) 60%, rgba(255,88,0,0.07) 100%)",
						}}
					/>
					<div
						style={{
							position: "absolute",
							left: 0,
							right: 0,
							top: scanY - 1,
							height: 2,
							background: EX_C.orange,
							boxShadow: "0 0 14px 3px rgba(255,88,0,0.55)",
						}}
					/>
				</React.Fragment>
			)}
		</div>
	);
}

function exCertLabel(k) {
	return {
		numero: "NRO CERTIFICADO",
		fecha: "PERIODO",
		proveedor: "ENTIDAD CONTRATANTE",
		cuit: "AVANCE",
		obra: "OBRA",
		subtotal: "CERTIFICADO",
		iva: "RETENCION",
		total: "A COBRAR",
	}[k];
}
function exCertValue(k) {
	return {
		numero: "CERT-014",
		fecha: "Abril 2026",
		proveedor: "Vialidad Provincial",
		cuit: "62%",
		obra: "Ruta Prov. 12 - Tramo III",
		subtotal: "$ 3.910.000",
		iva: "$ 195.500",
		total: "$ 3.714.500",
	}[k];
}
function exHighlightBox(f) {
	const tune = {
		numero: { x: -7, y: -9, w: 16, h: 13 },
		fecha: { x: -7, y: -9, w: 14, h: 13 },
		proveedor: { x: -7, y: -8, w: 14, h: 13 },
		cuit: { x: -7, y: -8, w: 14, h: 13 },
		obra: { x: -7, y: -8, w: 24, h: 13 },
		subtotal: { x: -8, y: -8, w: 16, h: 13 },
		iva: { x: -8, y: -8, w: 16, h: 13 },
		total: { x: -8, y: -8, w: 16, h: 12 },
	}[f.key] || { x: -7, y: -8, w: 14, h: 12 };
	return {
		left: f.x + tune.x,
		top: f.y + tune.y,
		width: f.w + tune.w,
		height: f.h + tune.h,
	};
}

function ExtractionActDrop({ localTime, duration }) {
	const op = exSceneOpacity(localTime, duration, 0.35, 0.45);
	const moveX = exAnimate({
		from: 700,
		to: EX_DROP.docX,
		start: 0.5,
		end: EX_DROP.dropEnd,
	});
	const moveY = exAnimate({
		from: 18,
		to: EX_DROP.docY,
		start: 0.5,
		end: EX_DROP.dropEnd,
	});
	const rot = exAnimate({
		from: -7,
		to: -1,
		start: 0.5,
		end: 3.0,
		ease: exEase.outCubic,
	});
	const dropped = localTime > EX_DROP.dropEnd;
	const settle = dropped
		? 1 +
			Math.sin(exClamp((localTime - EX_DROP.dropEnd) / 0.32, 0, 1) * Math.PI) *
				0.05
		: 1;
	const zoneGlow = dropped
		? exClamp((localTime - EX_DROP.dropEnd) / 0.35, 0, 1) *
			(1 - exClamp((localTime - 3.55) / 0.3, 0, 1))
		: 0;
	const docTransfer = exClamp((localTime - EX_DROP.dropEnd) / 0.22, 0, 1);
	const grabIntent =
		exEase.outCubic(exClamp(localTime / 0.34, 0, 1)) *
		(1 - exClamp((localTime - 0.82) / 0.24, 0, 1));
	const grabPress =
		exClamp((localTime - 0.46) / 0.1, 0, 1) *
		(1 - exClamp((localTime - 0.62) / 0.16, 0, 1));
	const dropIntent =
		exEase.outCubic(
			exClamp((localTime - (EX_DROP.dropEnd - 0.46)) / 0.3, 0, 1),
		) *
		(1 - exClamp((localTime - (EX_DROP.dropEnd + 0.2)) / 0.26, 0, 1));
	const dropPress =
		exClamp((localTime - EX_DROP.dropEnd) / 0.1, 0, 1) *
		(1 - exClamp((localTime - (EX_DROP.dropEnd + 0.12)) / 0.16, 0, 1));
	const cursorOpacity = 1 - docTransfer;
	const cursorX = moveX(localTime);
	const cursorY = moveY(localTime);

	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				opacity: op,
				transform: `scale(${EX_DROP.scale})`,
				transformOrigin: "center",
			}}>
			<div
				style={{
					position: "absolute",
					left: 0,
					right: 0,
					top: 64,
					textAlign: "center",
				}}>
				<div
					style={{
						fontSize: 11,
						fontWeight: 700,
						letterSpacing: "0.14em",
						color: EX_C.s400,
					}}>
					INGESTA DE DOCUMENTOS
				</div>
				<div
					style={{
						fontSize: 26,
						fontWeight: 300,
						color: EX_C.s900,
						marginTop: 6,
					}}>
					Subi los documentos de tu obra
				</div>
			</div>

			<div
				style={{
					position: "absolute",
					left: EX_DROP.zoneX,
					top: EX_DROP.zoneY,
					width: EX_DROP.zoneW,
					height: EX_DROP.zoneH,
					borderRadius: 18,
					border: `2px dashed ${zoneGlow > 0.05 ? EX_C.orange : EX_C.s300}`,
					background:
						zoneGlow > 0.05
							? `rgba(255,88,0,${0.05 * zoneGlow})`
							: "rgba(255,255,255,0.5)",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					padding: 26,
					boxSizing: "border-box",
					boxShadow:
						zoneGlow > 0.05
							? `0 0 0 6px rgba(255,88,0,${0.1 * zoneGlow})`
							: "none",
				}}>
				<svg
					width='46'
					height='46'
					viewBox='0 0 24 24'
					fill='none'
					style={{ opacity: dropped ? 0.25 : 0.5 }}>
					<path
						d='M12 16V4M12 4l-5 5M12 4l5 5'
						stroke={EX_C.s500}
						strokeWidth='1.6'
						strokeLinecap='round'
						strokeLinejoin='round'
					/>
					<path
						d='M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3'
						stroke={EX_C.s500}
						strokeWidth='1.6'
						strokeLinecap='round'
					/>
				</svg>
				<div
					style={{
						fontSize: 16,
						fontWeight: 600,
						color: EX_C.s600,
						marginTop: 14,
					}}>
					Arrastra tus documentos aca
				</div>
				<div style={{ fontSize: 12.5, color: EX_C.s400, marginTop: 6 }}>
					Factura, certificado, orden de compra - PDF - JPG
				</div>
			</div>

			<div
				style={{
					position: "absolute",
					left: cursorX,
					top: cursorY,
					opacity: 1 - docTransfer,
					transform: `rotate(${rot(localTime)}deg) scale(${EX_DROP.docScale * settle})`,
					transformOrigin: "top left",
				}}>
				<div
					style={{
						position: "absolute",
						left: 22,
						top: 16,
						transform: "rotate(5deg)",
					}}>
					<ExtractionFacturaDoc
						variant='certificado'
						dim
					/>
				</div>
				<ExtractionFacturaDoc />
			</div>
			{cursorOpacity > 0.01 && (
				<ExtractionCursor
					x={cursorX + 6}
					y={cursorY + 8}
					opacity={cursorOpacity}
					press={Math.max(grabPress, dropPress)}
					intent={Math.max(grabIntent, dropIntent)}
				/>
			)}
		</div>
	);
}

function ExtractionCursor({ x, y, opacity = 1, press = 0, intent = 0 }) {
	const cue = Math.max(intent * 0.72, press);
	const ringOpacity = opacity * Math.max(intent * 0.34, press * 0.82);
	const ringScale = 0.72 + intent * 0.18 + press * 0.62;
	const dotOpacity = opacity * Math.max(intent * 0.42, press);
	const hotX = x + 2;
	const hotY = y + 2;
	return (
		<React.Fragment>
			{cue > 0.01 && (
				<div
					style={{
						position: "absolute",
						left: hotX - 22,
						top: hotY - 22,
						width: 44,
						height: 44,
						borderRadius: 999,
						border: `2px solid rgba(255,88,0,${0.76 * cue})`,
						background: `rgba(255,88,0,${0.08 * cue})`,
						boxShadow: `0 0 0 ${6 + press * 6}px rgba(255,88,0,${0.1 * cue})`,
						opacity: ringOpacity,
						transform: `scale(${ringScale})`,
						transformOrigin: "center",
						zIndex: 59,
						pointerEvents: "none",
					}}
				/>
			)}
			{cue > 0.01 && (
				<div
					style={{
						position: "absolute",
						left: hotX - 4,
						top: hotY - 4,
						width: 8,
						height: 8,
						borderRadius: 999,
						background: EX_C.orange,
						opacity: dotOpacity,
						transform: `scale(${0.75 + press * 0.5})`,
						transformOrigin: "center",
						zIndex: 59,
						pointerEvents: "none",
					}}
				/>
			)}
			<svg
				width='26'
				height='30'
				viewBox='0 0 26 30'
				style={{
					position: "absolute",
					left: x,
					top: y,
					opacity,
					transform: `translate(${press * 1.6}px, ${press * 1.6}px) scale(${1 - press * 0.08})`,
					transformOrigin: "top left",
					filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.3))",
					zIndex: 60,
					pointerEvents: "none",
				}}>
				<path
					d='M2 2l7 20 3.5-8.5L21 10 2 2z'
					fill='#1c1917'
					stroke='#fff'
					strokeWidth='1.5'
					strokeLinejoin='round'
				/>
			</svg>
		</React.Fragment>
	);
}

function ExtractionDocumentHandoff({ localTime, duration }) {
	const p = exEase.inOutCubic(exClamp(localTime / duration, 0, 1));
	const fade = Math.min(
		exClamp(localTime / 0.16, 0, 1),
		exClamp((duration - localTime) / 0.24, 0, 1),
	);
	const from = exDropDocFrame();
	const to = exExtractDocFrame();
	const x = exLerp(from.x, to.x, p);
	const y = exLerp(from.y, to.y, p);
	const scale = exLerp(from.scale, to.scale, p);
	const rotation = exLerp(from.rotation, to.rotation, p);
	const lift = Math.sin(p * Math.PI) * 34;

	return (
		<div
			style={{
				position: "absolute",
				left: x,
				top: y - lift,
				opacity: fade,
				transform: `rotate(${rotation}deg) scale(${scale})`,
				transformOrigin: "top left",
				filter: `drop-shadow(0 ${10 + 10 * p}px ${14 + 8 * p}px rgba(28,25,23,${0.16 + 0.08 * p}))`,
			}}>
			<ExtractionFacturaDoc />
		</div>
	);
}

function ExtractionDataRowHandoff({ localTime, duration }) {
	const p = exEase.inOutCubic(exClamp(localTime / duration, 0, 1));
	const spriteOp = Math.min(
		exClamp(localTime / 0.12, 0, 1),
		1 - exClamp((localTime - (duration - 0.28)) / 0.22, 0, 1),
	);
	const rowGuideOp =
		exClamp((p - 0.64) / 0.18, 0, 1) *
		exClamp((duration - localTime) / 0.26, 0, 1);
	const rowFrame = exTableFirstRowFrame();
	const row = EX_ROWS[0];
	const fieldTargets = {
		numero: { col: "num", value: row.num },
		fecha: { col: "fecha", value: row.fecha },
		proveedor: { col: "prov", value: row.prov },
		cuit: { col: "cuit", value: row.cuit },
		obra: {
			col: "prov",
			value: EX_FIELDS.find((f) => f.key === "obra").value,
			extra: true,
			y: 18,
		},
		subtotal: {
			col: "total",
			value: EX_FIELDS.find((f) => f.key === "subtotal").value,
			extra: true,
			y: -18,
		},
		iva: {
			col: "total",
			value: EX_FIELDS.find((f) => f.key === "iva").value,
			extra: true,
			y: 3,
		},
		total: { col: "total", value: exFmtMoney(row.total) },
	};

	return (
		<>
			<div
				style={{
					position: "absolute",
					left: rowFrame.x,
					top: rowFrame.y,
					width: rowFrame.width,
					height: rowFrame.height,
					borderRadius: 6,
					background: `rgba(255,88,0,${0.045 * rowGuideOp})`,
					boxShadow: `0 0 0 ${2 + 5 * rowGuideOp}px rgba(255,88,0,${0.05 * rowGuideOp})`,
					opacity: rowGuideOp,
					zIndex: 3,
					pointerEvents: "none",
				}}
			/>

			{EX_FIELDS.map((field, i) => {
				const targetSpec = fieldTargets[field.key];
				const cell = exTableCellFrame(targetSpec.col);
				const isMoney =
					field.key === "subtotal" ||
					field.key === "iva" ||
					field.key === "total";
				const source = exRootScaledPoint(
					EX_EXTRACT_PANEL.x + 172,
					EX_EXTRACT_PANEL.y + 78 + i * EX_EXTRACT_PANEL.rowH,
				);
				const sourceFont = 15 * EX_EXTRACT_ROOT.scale;
				const targetFont =
					(targetSpec.col === "total" ? 13.5 : 12.5) * EX_TABLE_ROOT.scale;
				const fontSize = exLerp(sourceFont, targetFont, p);
				const width = exEstimatedTextWidth(targetSpec.value, fontSize);
				const targetPad = 8 * EX_TABLE_ROOT.scale;
				let targetX = cell.x + targetPad;
				if (cell.col.right) targetX = cell.x + cell.width - width - targetPad;
				if (targetSpec.extra && targetSpec.col === "prov") {
					targetX = cell.x + targetPad + 20 * EX_TABLE_ROOT.scale;
				}
				const targetY =
					cell.y +
					(cell.height - targetFont * 1.25) / 2 +
					(targetSpec.y || 0) * EX_TABLE_ROOT.scale;
				const stagger = i * 0.025;
				const lp = exEase.outCubic(
					exClamp((localTime - 0.1 - stagger) / (duration - 0.35), 0, 1),
				);
				const x = exLerp(source.x, targetX, lp);
				const y =
					exLerp(source.y, targetY, lp) -
					Math.sin(lp * Math.PI) * (20 + i * 0.8);
				const extraFade = targetSpec.extra
					? 1 - exClamp((p - 0.66) / 0.22, 0, 1)
					: 1;
				const totalReveal =
					field.key === "total" ? exClamp((p - 0.36) / 0.28, 0, 1) : 1;
				const opacity = spriteOp * extraFade * totalReveal;
				const scale = exLerp(1, targetSpec.extra ? 0.76 : 0.92, p);
				return (
					<div
						key={field.key}
						style={{
							position: "absolute",
							left: 0,
							top: 0,
							width,
							height: fontSize * 1.35,
							transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`,
							transformOrigin: cell.col.right ? "right center" : "left center",
							opacity,
							zIndex: targetSpec.extra ? 4 : 5,
							pointerEvents: "none",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							filter: `blur(${Math.sin(lp * Math.PI) * 0.18}px)`,
							color: targetSpec.extra ? EX_C.s500 : EX_C.s900,
							fontFamily:
								isMoney ||
								field.key === "cuit" ||
								field.key === "fecha" ||
								field.key === "numero"
									? "var(--font-mono)"
									: "var(--font-sans)",
							fontSize,
							fontWeight:
								targetSpec.col === "total"
									? 700
									: targetSpec.col === "prov"
										? 650
										: 600,
							fontVariantNumeric: "tabular-nums",
							textAlign: cell.col.right ? "right" : "left",
						}}>
						{targetSpec.value}
					</div>
				);
			})}

			<div
				style={{
					position: "absolute",
					left: exTableCellFrame("estado").x + 8 * EX_TABLE_ROOT.scale,
					top: rowFrame.y + (rowFrame.height - 26 * EX_TABLE_ROOT.scale) / 2,
					transform: `scale(${EX_TABLE_ROOT.scale}) translateY(${(1 - exEase.outCubic(exClamp((p - 0.72) / 0.2, 0, 1))) * 8}px)`,
					transformOrigin: "left center",
					opacity:
						spriteOp *
						exClamp((p - 0.72) / 0.18, 0, 1) *
						exClamp((duration - localTime) / 0.2, 0, 1),
					zIndex: 5,
					pointerEvents: "none",
				}}>
				<ExtractionEstadoBadge kind={row.estado} />
			</div>
		</>
	);
}

function ExtractionActExtract({ localTime, duration }) {
	const op = exSceneOpacity(localTime, duration, 0.45, 1.15);
	const docIn = exEase.outCubic(exClamp(localTime / 0.5, 0, 1));
	const docScale =
		EX_EXTRACT_DOC.scaleStart +
		(EX_EXTRACT_DOC.scaleEnd - EX_EXTRACT_DOC.scaleStart) * docIn;
	const docW = EX_DOC_W * docScale;
	const docH = EX_DOC_H * docScale;
	const docX = EX_EXTRACT_DOC.x;
	const docY = EX_EXTRACT_DOC.y;
	const scanProg = exClamp(
		(localTime - EX_SCAN_T0) / (EX_SCAN_T1 - EX_SCAN_T0),
		0,
		1,
	);
	const scanY =
		localTime < EX_SCAN_T0
			? 0
			: localTime > EX_SCAN_T1 + 0.3
				? 0
				: scanProg * EX_DOC_H;
	const captured = new Set();
	EX_FIELDS.forEach((f) => {
		if (localTime >= exCaptureTimeFor(f)) captured.add(f.key);
	});
	const scanning = localTime < EX_SCAN_T1 + 0.2;
	const panelX = EX_EXTRACT_PANEL.x;
	const panelY = EX_EXTRACT_PANEL.y;
	const panelW = EX_EXTRACT_PANEL.w;
	const rowH = EX_EXTRACT_PANEL.rowH;
	const docSceneOp = exClamp((localTime - 0.58) / 0.14, 0, 1);

	return (
		<div
			style={{
				position: "absolute",
				left: EX_EXTRACT_ROOT.x,
				top: EX_EXTRACT_ROOT.y,
				width: EX_EXTRACT_ROOT.w,
				height: EX_EXTRACT_ROOT.h,
				opacity: op,
				transform: `scale(${EX_EXTRACT_ROOT.scale})`,
				transformOrigin: "center",
			}}>
			<div
				style={{
					position: "absolute",
					left: docX,
					top: docY,
					opacity: docSceneOp,
					transform: `scale(${docScale})`,
					transformOrigin: "top left",
				}}>
				<ExtractionFacturaDoc
					scanY={scanY || null}
					captured={captured}
				/>
			</div>

			<div
				style={{
					position: "absolute",
					left: docX,
					top: docY + docH + 16,
					width: docW,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					gap: 10,
					opacity: docSceneOp,
				}}>
				<ExtractionSpinner
					done={!scanning}
					t={localTime}
				/>
				<div
					style={{
						fontSize: 13,
						fontWeight: 600,
						color: scanning ? EX_C.s600 : EX_C.green,
					}}>
					{scanning ? "Analizando documento..." : "Documento procesado"}
				</div>
			</div>

			<div
				style={{
					position: "absolute",
					left: panelX,
					top: panelY,
					width: panelW,
				}}>
				<div
					style={{
						fontSize: 11,
						fontWeight: 700,
						letterSpacing: "0.14em",
						color: EX_C.orange,
					}}>
					EXTRACCION AUTOMATICA
				</div>
				<div
					style={{
						fontSize: 23,
						fontWeight: 300,
						color: EX_C.s900,
						marginTop: 6,
					}}>
					Datos detectados
				</div>

				<div style={{ marginTop: 20, position: "relative" }}>
					{EX_FIELDS.map((f, i) => {
						const ct = exCaptureTimeFor(f);
						const o = exClamp((localTime - (ct + 0.12)) / 0.3, 0, 1);
						const handoffGrab = exClamp(
							(localTime - (5.96 + i * 0.025)) / 0.08,
							0,
							1,
						);
						return (
							<div
								key={f.key}
								style={{
									position: "absolute",
									top: i * rowH,
									left: 0,
									right: 0,
									height: rowH - 8,
									display: "flex",
									alignItems: "center",
									opacity: o,
									transform: `translateY(${(1 - o) * 8}px)`,
								}}>
								<div
									style={{
										width: 8,
										height: 8,
										borderRadius: "50%",
										background: EX_C.orange,
										marginRight: 14,
										flexShrink: 0,
										boxShadow:
											o > 0.8 ? "none" : "0 0 8px 2px rgba(255,88,0,0.5)",
									}}
								/>
								<div
									style={{
										fontSize: 10,
										fontWeight: 700,
										letterSpacing: "0.1em",
										color: EX_C.s400,
										width: 150,
										flexShrink: 0,
									}}>
									{f.label}
								</div>
								<div
									style={{
										fontFamily:
											f.key === "cuit" ||
											f.key.includes("total") ||
											f.key === "subtotal" ||
											f.key === "iva"
												? "var(--font-mono)"
												: "var(--font-sans)",
										fontSize: 15,
										fontWeight: 600,
										color: EX_C.s900,
										opacity: 1 - handoffGrab,
									}}>
									{f.value}
								</div>
							</div>
						);
					})}
				</div>
			</div>

			{EX_FIELDS.map((f, i) => {
				const ct = exCaptureTimeFor(f);
				const t = exClamp((localTime - ct) / 0.45, 0, 1);
				if (t <= 0 || t >= 1) return null;
				const e = exEase.inOutCubic(t);
				const sx = docX + (f.x + f.w) * docScale;
				const sy = docY + (f.y + 8) * docScale;
				const ex = panelX;
				const ey = panelY + 68 + i * rowH + 12;
				const px = sx + (ex - sx) * e;
				const py = sy + (ey - sy) * e - Math.sin(e * Math.PI) * 24;
				return (
					<div
						key={"p" + f.key}
						style={{
							position: "absolute",
							left: px,
							top: py,
							width: 7,
							height: 7,
							borderRadius: "50%",
							background: EX_C.orange,
							boxShadow: "0 0 10px 2px rgba(255,88,0,0.6)",
							opacity: 1 - t * 0.3,
						}}
					/>
				);
			})}
		</div>
	);
}

function ExtractionSpinner({ done, t }) {
	if (done) {
		return (
			<div
				style={{
					width: 18,
					height: 18,
					borderRadius: "50%",
					background: EX_C.green,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					flexShrink: 0,
				}}>
				<svg
					width='11'
					height='11'
					viewBox='0 0 24 24'
					fill='none'>
					<path
						d='M5 13l4 4L19 7'
						stroke='#fff'
						strokeWidth='3'
						strokeLinecap='round'
						strokeLinejoin='round'
					/>
				</svg>
			</div>
		);
	}
	return (
		<div
			style={{
				width: 16,
				height: 16,
				borderRadius: "50%",
				border: `2px solid ${EX_C.s200}`,
				borderTopColor: EX_C.orange,
				transform: `rotate(${(t * 360 * 1.4) % 360}deg)`,
				flexShrink: 0,
			}}
		/>
	);
}

const EX_COLS = [
	{ key: "num", label: "NRO COMPROBANTE", w: 180, mono: true },
	{ key: "fecha", label: "FECHA", w: 110, mono: true },
	{ key: "prov", label: "PROVEEDOR", w: 240 },
	{ key: "cuit", label: "CUIT", w: 150, mono: true },
	{ key: "total", label: "TOTAL", w: 150, mono: true, right: true },
	{ key: "estado", label: "ESTADO", w: 140 },
];
const EX_ROWS = [
	{
		num: "0001-00004821",
		fecha: "14/05/2026",
		prov: "Aceros del Litoral S.A.",
		cuit: "30-71024588-4",
		total: 2226400,
		estado: "ok",
		isNew: true,
	},
	{
		num: "CERT-014",
		fecha: "Abril 2026",
		prov: "Vialidad Provincial",
		cuit: "-",
		total: 3714500,
		estado: "ok",
		isNew: true,
	},
	{
		num: "0003-00012094",
		fecha: "12/05/2026",
		prov: "Hormigones SRL",
		cuit: "30-68842210-9",
		total: 1515300,
		estado: "ok",
	},
	{
		num: "0001-00004790",
		fecha: "06/05/2026",
		prov: "Aridos del Norte",
		cuit: "30-71550098-1",
		total: 988450,
		estado: "desvio",
	},
	{
		num: "0002-00008871",
		fecha: "09/05/2026",
		prov: "Transporte Vial S.A.",
		cuit: "30-70993145-2",
		total: 642800,
		estado: "ok",
	},
	{
		num: "0004-00031125",
		fecha: "03/05/2026",
		prov: "Electro Obras SRL",
		cuit: "30-69014477-3",
		total: 1204000,
		estado: "ok",
	},
];
const exFmtMoney = (n) => "$ " + Math.round(n).toLocaleString("es-AR");

function ExtractionActTable({ localTime, duration }) {
	const op = exSceneOpacity(localTime, duration, 0.45, 0.6);
	const rowStart = 0.82;
	const rowStep = 0.26;
	const tableW = EX_TABLE_FRAME.w;
	const tableX = EX_TABLE_FRAME.x;
	const tableY = EX_TABLE_FRAME.y;
	const colTotalW = EX_COLS.reduce((a, c) => a + c.w, 0);
	const kb = 1;
	const allIn = rowStart + EX_ROWS.length * rowStep;
	const sumProg = exClamp((localTime - allIn) / 0.9, 0, 1);
	const sumVal =
		EX_ROWS.reduce((a, r) => a + r.total, 0) * exEase.outCubic(sumProg);
	const countVal = Math.round(
		EX_ROWS.length * exClamp((localTime - allIn) / 0.6, 0, 1),
	);

	return (
		<div
			style={{
				position: "absolute",
				left: EX_TABLE_ROOT.x,
				top: EX_TABLE_ROOT.y,
				width: EX_TABLE_ROOT.w,
				height: EX_TABLE_ROOT.h,
				opacity: op,
				transform: `scale(${EX_TABLE_ROOT.scale})`,
				transformOrigin: "center",
			}}>
			<div
				style={{
					position: "absolute",
					left: 0,
					right: 0,
					top: 40,
					textAlign: "center",
				}}>
				<div
					style={{
						fontSize: 11,
						fontWeight: 700,
						letterSpacing: "0.14em",
						color: EX_C.s400,
					}}>
					REGISTRO DE COMPROBANTES
				</div>
				<div
					style={{
						fontSize: 24,
						fontWeight: 300,
						color: EX_C.s900,
						marginTop: 6,
					}}>
					Datos extraidos a tu tabla
				</div>
			</div>

			<div
				style={{
					position: "absolute",
					left: tableX,
					top: tableY,
					width: tableW,
					transform: `scale(${kb})`,
					transformOrigin: "top center",
				}}>
				<div
					style={{
						background: EX_C.white,
						border: `1px solid ${EX_C.s200}`,
						borderRadius: 12,
						overflow: "hidden",
						boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
					}}>
					<div
						style={{
							display: "flex",
							background: EX_C.s100,
							borderBottom: `1px solid ${EX_C.s200}`,
							padding: "0 18px",
						}}>
						{EX_COLS.map((c) => (
							<div
								key={c.key}
								style={{
									width: `${(c.w / colTotalW) * 100}%`,
									padding: "11px 8px",
									fontSize: 9.5,
									fontWeight: 700,
									letterSpacing: "0.1em",
									color: EX_C.s500,
									textAlign: c.right ? "right" : "left",
								}}>
								{c.label}
							</div>
						))}
					</div>
					{EX_ROWS.map((r, i) => {
						const rowAppearStart = rowStart + i * rowStep;
						const rowAppearDuration = i === 0 ? 0.22 : 0.32;
						const ap = exClamp(
							(localTime - rowAppearStart) / rowAppearDuration,
							0,
							1,
						);
						const e = exEase.outCubic(ap);
						const flash = exClamp(1 - (localTime - rowAppearStart) / 0.7, 0, 1);
						return (
							<div
								key={i}
								style={{
									display: "flex",
									alignItems: "center",
									padding: "0 18px",
									height: EX_TABLE_FRAME.rowH,
									borderBottom:
										i < EX_ROWS.length - 1 ? `1px solid ${EX_C.s100}` : "none",
									opacity: ap,
									transform: i === 0 ? "none" : `translateX(${(1 - e) * 26}px)`,
									background: r.isNew
										? `rgba(255,88,0,${0.05 + 0.05 * flash})`
										: `rgba(255,88,0,${0.06 * flash})`,
								}}>
								{EX_COLS.map((c) => (
									<div
										key={c.key}
										style={{
											width: `${(c.w / colTotalW) * 100}%`,
											padding: "0 8px",
											textAlign: c.right ? "right" : "left",
										}}>
										{c.key === "estado" ? (
											<ExtractionEstadoBadge kind={r.estado} />
										) : (
											<span
												style={{
													fontFamily: c.mono
														? "var(--font-mono)"
														: "var(--font-sans)",
													fontSize: c.key === "total" ? 13.5 : 12.5,
													fontWeight:
														c.key === "total"
															? 600
															: c.key === "prov"
																? 600
																: 500,
													color: c.key === "prov" ? EX_C.s800 : EX_C.s700,
													fontVariantNumeric: "tabular-nums",
												}}>
												{c.key === "total" ? exFmtMoney(r.total) : r[c.key]}
											</span>
										)}
									</div>
								))}
							</div>
						);
					})}
					<div
						style={{
							display: "flex",
							alignItems: "center",
							padding: "0 18px",
							height: EX_TABLE_FRAME.footerH,
							background: EX_C.s100,
							borderTop: `1px solid ${EX_C.s200}`,
						}}>
						<div
							style={{
								fontSize: 12,
								fontWeight: 600,
								color: EX_C.s600,
								flex: 1,
							}}>
							<span style={{ fontVariantNumeric: "tabular-nums" }}>
								{countVal}
							</span>{" "}
							comprobantes procesados
						</div>
						<div
							style={{
								fontSize: 10,
								fontWeight: 700,
								letterSpacing: "0.1em",
								color: EX_C.s400,
								marginRight: 14,
							}}>
							TOTAL
						</div>
						<div
							style={{
								fontFamily: "var(--font-mono)",
								fontSize: 16,
								fontWeight: 700,
								color: EX_C.s900,
								fontVariantNumeric: "tabular-nums",
							}}>
							{exFmtMoney(sumVal)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

function ExtractionEstadoBadge({ kind }) {
	const ok = kind === "ok";
	return (
		<div
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: 7,
				padding: "4px 11px",
				borderRadius: 99,
				background: ok ? EX_C.greenSoft : EX_C.orangeMid,
				border: `1px solid ${ok ? "rgba(22,163,74,0.25)" : "rgba(255,88,0,0.35)"}`,
			}}>
			<div
				style={{
					width: 6,
					height: 6,
					borderRadius: "50%",
					background: ok ? EX_C.green : EX_C.orange,
				}}
			/>
			<span
				style={{
					fontSize: 11,
					fontWeight: 600,
					color: ok ? "#15803d" : "#c2410c",
				}}>
				{ok ? "Procesado" : "Desvio"}
			</span>
		</div>
	);
}

// ============================================================
// REPORTE PDF - skeumorphic paper report
// ============================================================
function ReporteDireccion() {
	return (
		<MockChrome
			breadcrumb='Generar Documentos / Cartera Mayo 2026'
			active='Generar Documentos'>
			<div
				style={{
					background: "linear-gradient(180deg, #fcfaf5 0%, #f5efe1 100%)",
					borderRadius: 8,
					padding: "28px 36px",
					boxShadow: "0 1px 0 rgba(0,0,0,.04)",
					border: "1px solid var(--stone-200)",
				}}>
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "flex-start",
						marginBottom: 18,
						paddingBottom: 16,
						borderBottom: "2px solid var(--stone-900)",
					}}>
					<div>
						<div
							style={{
								fontSize: 10,
								fontWeight: 700,
								letterSpacing: ".15em",
								textTransform: "uppercase",
								color: "var(--stone-500)",
							}}>
							Reporte de dirección
						</div>
						<div
							style={{
								fontFamily: "var(--font-serif)",
								fontSize: 28,
								color: "var(--stone-900)",
								marginTop: 4,
								lineHeight: 1.05,
							}}>
							Cartera Mayo 2026
						</div>
						<div
							style={{ fontSize: 11, color: "var(--stone-500)", marginTop: 4 }}>
							Constructora Norte S.A. · Generado 28/05/2026 11:42
						</div>
					</div>
					<div
						style={{
							width: 36,
							height: 36,
							borderRadius: 9999,
							background: "var(--orange-primary)",
						}}
					/>
				</div>

				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(3, 1fr)",
						gap: 14,
						marginBottom: 22,
					}}>
					{[
						{ l: "Cartera total", v: "$182.9M" },
						{ l: "Saldo a certificar", v: "$82.0M" },
						{ l: "Por cobrar", v: "$16.9M" },
					].map((k, i) => (
						<div
							key={i}
							style={{
								padding: "10px 12px",
								borderLeft: "2px solid var(--orange-primary)",
							}}>
							<div
								style={{
									fontSize: 9.5,
									fontWeight: 700,
									letterSpacing: ".1em",
									textTransform: "uppercase",
									color: "var(--stone-500)",
								}}>
								{k.l}
							</div>
							<div
								style={{
									fontFamily: "var(--font-serif)",
									fontSize: 22,
									color: "var(--stone-900)",
									marginTop: 4,
								}}>
								{k.v}
							</div>
						</div>
					))}
				</div>

				<div
					style={{ fontSize: 13, color: "var(--stone-800)", lineHeight: 1.6 }}>
					<p style={{ margin: "0 0 10px" }}>
						La cartera muestra dos obras para revisar por diferencia entre
						avance y plazo: <b>Escuela Técnica</b> (-14pp) y <b>Red Cloacal</b>{" "}
						(-19pp). El saldo a certificar registrado suma <b>$82.0M</b>.
					</p>
					<p style={{ margin: 0 }}>
						Se mantienen <b>14 certificados</b> facturados sin cobrar por un
						total de $16.9M. Pavimento Av. San Martín opera por encima del plan
						y compensa parcialmente el desvío agregado.
					</p>
				</div>

				<div
					style={{
						marginTop: 18,
						padding: "10px 0 0",
						borderTop: "1px solid var(--stone-200)",
						display: "flex",
						justifyContent: "space-between",
						fontSize: 10,
						color: "var(--stone-500)",
						fontWeight: 600,
						letterSpacing: ".1em",
						textTransform: "uppercase",
					}}>
					<span>Página 1 / 8</span>
					<span>Sintesis · Reporte exportable</span>
				</div>
			</div>
		</MockChrome>
	);
}

// ============================================================
// CARTERA / Dashboard executive
// ============================================================
function CarteraDashboard() {
	const bars = [22, 38, 31, 45, 52, 64, 70, 58, 66, 74, 81, 88];
	return (
		<MockChrome
			breadcrumb='Dashboard / Cartera'
			active='Dashboard'>
			<div
				style={{
					marginBottom: 14,
					display: "flex",
					justifyContent: "space-between",
					alignItems: "flex-end",
					gap: 12,
					flexWrap: "wrap",
				}}>
				<div>
					<div
						style={{
							fontSize: 10,
							fontWeight: 700,
							letterSpacing: ".15em",
							textTransform: "uppercase",
							color: "var(--stone-500)",
						}}>
						Resumen ejecutivo
					</div>
					<div
						style={{
							fontFamily: "var(--font-serif)",
							fontSize: 24,
							color: "var(--stone-900)",
							marginTop: 4,
						}}>
						Cartera de la organización
					</div>
				</div>
				<SegmentControl
					options={["6m", "12m", "YTD"]}
					value='12m'
				/>
			</div>
			<div
				style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 }}>
				<div style={{ ...cardStyle, padding: 18 }}>
					<div
						style={{
							fontSize: 11,
							color: "var(--stone-500)",
							marginBottom: 12,
						}}>
						Avance ponderado de cartera (%)
					</div>
					<div
						style={{
							display: "flex",
							alignItems: "flex-end",
							gap: 8,
							height: 140,
						}}>
						{bars.map((v, i) => (
							<div
								key={i}
								style={{
									flex: 1,
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									gap: 6,
									height: "100%",
									justifyContent: "flex-end",
								}}>
								<div
									style={{
										width: "100%",
										height: v + "%",
										background:
											i === bars.length - 1
												? "var(--orange-primary)"
												: "var(--stone-300)",
										borderRadius: 3,
									}}
								/>
								<div
									style={{
										fontSize: 9,
										color: "var(--stone-500)",
										fontFamily: "var(--font-mono)",
									}}>
									{
										[
											"E",
											"F",
											"M",
											"A",
											"M",
											"J",
											"J",
											"A",
											"S",
											"O",
											"N",
											"D",
										][i]
									}
								</div>
							</div>
						))}
					</div>
				</div>
				<div style={{ ...cardStyle, padding: 18 }}>
					<div
						style={{
							fontSize: 11,
							color: "var(--stone-500)",
							marginBottom: 12,
						}}>
						Riesgo por obra
					</div>
					{[
						{ l: "Crítico", v: 2, c: "#dc2626" },
						{ l: "Atención", v: 1, c: "#d97706" },
						{ l: "OK", v: 2, c: "#16a34a" },
					].map((r, i) => (
						<div
							key={i}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 12,
								padding: "10px 0",
								borderBottom: i < 2 ? "1px solid var(--stone-100)" : "none",
							}}>
							<Dot color={r.c} />
							<div
								style={{ flex: 1, fontSize: 12.5, color: "var(--stone-800)" }}>
								{r.l}
							</div>
							<div
								style={{
									fontFamily: "var(--font-serif)",
									fontSize: 22,
									color: "var(--stone-900)",
								}}>
								{r.v}
							</div>
						</div>
					))}
					<div
						style={{
							marginTop: 14,
							padding: "10px 12px",
							background: "var(--stone-50)",
							borderRadius: 8,
							border: "1px solid var(--stone-100)",
							fontSize: 11.5,
							color: "var(--stone-700)",
						}}>
						<b style={{ color: "var(--stone-900)" }}>2 obras para revisar</b>{" "}
						&mdash; saldo a certificar{" "}
						<b style={{ fontFamily: "var(--font-mono)" }}>$82M</b>.
					</div>
				</div>
			</div>
		</MockChrome>
	);
}


export {
	ObrasOverview,
	ObraDetail,
	PermisosMatrix,
	FlujoBoard,
	CertificadosTable,
	AvanceVsPlazo,
	AlertasFinancieras,
	VistaPorRol,
	AccionRapida,
	DocumentExtractionAnimation,
	ReporteDireccion,
	CarteraDashboard,
	UIButton,
	UITray,
	UIChip,
	StatusBadge,
	SegmentControl,
	PillTabs,
};
