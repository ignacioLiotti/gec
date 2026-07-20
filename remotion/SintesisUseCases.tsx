import type { CSSProperties, ReactNode } from "react";
import {
	AbsoluteFill,
	Easing,
	Sequence,
	interpolate,
	spring,
	useCurrentFrame,
} from "remotion";

const FPS = 30;
const ORANGE = "#ff5800";
const STONE_900 = "#1c1917";
const STONE_500 = "#78716c";
const STONE_400 = "#a8a29e";
const STONE_200 = "#e7e5e4";
const STONE_100 = "#f5f5f4";
const STONE_50 = "#fafaf9";
const GREEN = "#16a34a";
const BLUE = "#2563eb";

const easeOut = Easing.bezier(0.23, 1, 0.32, 1);
const easeInOut = Easing.bezier(0.77, 0, 0.175, 1);

const clamp = {
	extrapolateLeft: "clamp" as const,
	extrapolateRight: "clamp" as const,
};

const progress = (frame: number, start: number, duration: number, easing = easeOut) =>
	interpolate(frame, [start, start + duration], [0, 1], { ...clamp, easing });

const fade = (frame: number, start: number, duration: number) =>
	progress(frame, start, duration);

const fadeOut = (frame: number, start: number, duration: number) =>
	interpolate(frame, [start, start + duration], [1, 0], clamp);

const move = (
	frame: number,
	start: number,
	duration: number,
	from: number,
	to: number,
	easing = easeOut,
) =>
	interpolate(frame, [start, start + duration], [from, to], { ...clamp, easing });

const formatMiles = (value: number) =>
	Math.round(value)
		.toString()
		.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

const formatMillones = (value: number) => {
	const [entero, decimal] = value.toFixed(1).split(".");
	return `${entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${decimal}`;
};

const page: CSSProperties = {
	background: STONE_50,
	color: STONE_900,
	fontFamily:
		'Geist, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
	overflow: "hidden",
};

const darkPage: CSSProperties = {
	...page,
	background: "#050505",
	color: STONE_50,
};

const cardStyle: CSSProperties = {
	background: "white",
	border: `1px solid ${STONE_200}`,
	borderRadius: 16,
	boxShadow: "0 30px 90px rgba(28,25,23,0.14)",
};

const Scene = ({ children, dark = false }: { children: ReactNode; dark?: boolean }) => (
	<AbsoluteFill style={dark ? darkPage : page}>{children}</AbsoluteFill>
);

const BrandMark = ({ size = 54, light = false }: { size?: number; light?: boolean }) => (
	<div style={{ display: "flex", alignItems: "center", gap: size * 0.28 }}>
		<div
			style={{
				width: size,
				height: size,
				borderRadius: size,
				background: ORANGE,
				boxShadow: `0 0 0 ${size * 0.22}px rgba(255, 88, 0, 0.14)`,
			}}
		/>
		<div
			style={{
				fontSize: size * 0.45,
				fontWeight: 850,
				letterSpacing: size * 0.12,
				textTransform: "uppercase",
				color: light ? STONE_50 : STONE_900,
			}}
		>
			Sintesis
		</div>
	</div>
);

const Chip = ({
	children,
	color = ORANGE,
	style,
}: {
	children: ReactNode;
	color?: string;
	style?: CSSProperties;
}) => (
	<div
		style={{
			display: "inline-flex",
			alignItems: "center",
			gap: 10,
			padding: "10px 18px",
			borderRadius: 999,
			background: `${color}1c`,
			color,
			fontSize: 20,
			fontWeight: 800,
			whiteSpace: "nowrap",
			...style,
		}}
	>
		{children}
	</div>
);

const UseCaseCaption = ({
	frame,
	kicker,
	title,
	sub,
	dark = false,
	maxWidth = 1360,
}: {
	frame: number;
	kicker: string;
	title: string;
	sub?: string;
	dark?: boolean;
	maxWidth?: number;
}) => (
	<div style={{ position: "absolute", top: 74, left: 96, maxWidth, zIndex: 20 }}>
		<div
			style={{
				fontSize: 22,
				fontWeight: 850,
				letterSpacing: 4,
				textTransform: "uppercase",
				color: ORANGE,
				marginBottom: 18,
				opacity: fade(frame, 6, 18),
				transform: `translateY(${move(frame, 6, 18, 16, 0)}px)`,
			}}
		>
			{kicker}
		</div>
		<div
			style={{
				fontSize: 66,
				lineHeight: 1.04,
				fontWeight: 780,
				color: dark ? STONE_50 : STONE_900,
				opacity: fade(frame, 14, 22),
				transform: `translateY(${move(frame, 14, 22, 24, 0)}px)`,
			}}
		>
			{title}
		</div>
		{sub ? (
			<div
				style={{
					fontSize: 30,
					lineHeight: 1.3,
					fontWeight: 500,
					color: dark ? "rgba(250,250,249,0.62)" : STONE_500,
					marginTop: 18,
					opacity: fade(frame, 32, 20),
					transform: `translateY(${move(frame, 32, 20, 18, 0)}px)`,
				}}
			>
				{sub}
			</div>
		) : null}
	</div>
);

/* ------------------------------------------------------------------ */
/* 1. Hook — la información dispersa                                   */
/* ------------------------------------------------------------------ */

const HookScene = () => {
	const frame = useCurrentFrame();
	const chips = [
		{ text: "presupuesto_FINAL_v7 (2).xlsx", x: 150, y: 620, rotate: -2.4, at: 86 },
		{ text: "WhatsApp — «te paso el avance por acá»", x: 664, y: 706, rotate: 1.8, at: 102 },
		{ text: "certificado-abril.pdf, escaneado en algún mail", x: 1250, y: 612, rotate: -1.2, at: 118 },
	];

	return (
		<Scene dark>
			<div
				style={{
					position: "absolute",
					inset: 0,
					background:
						"radial-gradient(circle at 78% 14%, rgba(255,88,0,0.15), transparent 32%), #050505",
				}}
			/>
			<div
				style={{
					position: "absolute",
					left: 150,
					top: 236,
					fontSize: 100,
					lineHeight: 1.06,
					fontWeight: 780,
					opacity: fade(frame, 10, 24),
					transform: `translateY(${move(frame, 10, 24, 32, 0)}px)`,
				}}
			>
				Tus obras avanzan.
			</div>
			<div
				style={{
					position: "absolute",
					left: 150,
					top: 366,
					fontSize: 100,
					lineHeight: 1.06,
					fontWeight: 780,
					color: ORANGE,
					opacity: fade(frame, 48, 24),
					transform: `translateY(${move(frame, 48, 24, 32, 0)}px)`,
				}}
			>
				Tu información, no.
			</div>
			{chips.map((chip) => {
				const enter = spring({
					frame: frame - chip.at,
					fps: FPS,
					config: { damping: 15, stiffness: 90 },
				});
				return (
					<div
						key={chip.text}
						style={{
							position: "absolute",
							left: chip.x,
							top: chip.y,
							padding: "22px 30px",
							borderRadius: 12,
							background: "rgba(250,250,249,0.08)",
							border: "1px solid rgba(250,250,249,0.14)",
							fontSize: 26,
							fontWeight: 600,
							color: "rgba(250,250,249,0.84)",
							opacity: fade(frame, chip.at, 14),
							transform: `translateY(${(1 - enter) * 42}px) rotate(${chip.rotate}deg)`,
						}}
					>
						{chip.text}
					</div>
				);
			})}
			<div
				style={{
					position: "absolute",
					left: 150,
					bottom: 96,
					fontSize: 36,
					fontWeight: 650,
					color: "rgba(250,250,249,0.72)",
					opacity: fade(frame, 158, 22),
					transform: `translateY(${move(frame, 158, 22, 18, 0)}px)`,
				}}
			>
				Síntesis la pone toda en un solo lugar. Mirá.
			</div>
		</Scene>
	);
};

/* ------------------------------------------------------------------ */
/* 2. Panel multi-obra                                                 */
/* ------------------------------------------------------------------ */

const obrasPanel = [
	{ nombre: "Torre Mitre", estado: "En curso", estadoColor: GREEN, avance: 68, monto: "$ 412,3 M" },
	{ nombre: "Ruta 40 · Tramo II", estado: "En curso", estadoColor: GREEN, avance: 42, monto: "$ 618,0 M" },
	{ nombre: "Hospital Regional", estado: "Por certificar", estadoColor: ORANGE, avance: 91, monto: "$ 254,2 M" },
] as const;

const curvaPoints = "0,112 62,100 124,90 186,74 248,66 310,48 372,40 434,24 496,14";

const PanelScene = () => {
	const frame = useCurrentFrame();
	const panelIn = fade(frame, 24, 20);
	const curvaReveal = progress(frame, 140, 62, easeInOut);
	const inversion = 1571.5 * progress(frame, 96, 64);

	return (
		<Scene>
			<UseCaseCaption
				frame={frame}
				kicker="Panel multi-obra"
				title="Todas tus obras en una sola pantalla."
				sub="Avance, curva de inversión y estado. Sin perseguir planillas."
			/>
			<div
				style={{
					position: "absolute",
					left: 96,
					right: 96,
					top: 336,
					bottom: 64,
					...cardStyle,
					opacity: panelIn,
					transform: `translateY(${move(frame, 24, 26, 44, 0)}px)`,
				}}
			>
				<div
					style={{
						height: 88,
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						padding: "0 32px",
						borderBottom: `1px solid ${STONE_200}`,
					}}
				>
					<div style={{ fontSize: 28, fontWeight: 820 }}>Panel de obras</div>
					<Chip>12 obras activas</Chip>
				</div>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "1.4fr 1fr",
						gap: 28,
						padding: 28,
					}}
				>
					<div>
						{obrasPanel.map((obra, index) => {
							const start = 66 + index * 18;
							const fill = progress(frame, start, 48);
							const pct = Math.round(obra.avance * fill);
							return (
								<div
									key={obra.nombre}
									style={{
										border: `1px solid ${STONE_200}`,
										borderRadius: 12,
										padding: "22px 28px",
										marginBottom: index < 2 ? 18 : 0,
										display: "grid",
										gridTemplateColumns: "300px 1fr 150px",
										alignItems: "center",
										gap: 26,
										opacity: fade(frame, start - 12, 14),
										transform: `translateY(${move(frame, start - 12, 14, 20, 0)}px)`,
									}}
								>
									<div>
										<div style={{ fontSize: 29, fontWeight: 800 }}>{obra.nombre}</div>
										<Chip color={obra.estadoColor} style={{ marginTop: 12, fontSize: 17, padding: "7px 14px" }}>
											{obra.estado}
										</Chip>
									</div>
									<div style={{ height: 18, borderRadius: 999, background: STONE_100, overflow: "hidden" }}>
										<div
											style={{
												height: "100%",
												width: `${obra.avance * fill}%`,
												borderRadius: 999,
												background: obra.estadoColor,
											}}
										/>
									</div>
									<div style={{ textAlign: "right" }}>
										<div style={{ fontSize: 48, fontWeight: 850, fontVariantNumeric: "tabular-nums" }}>
											{pct} %
										</div>
										<div style={{ fontSize: 21, color: STONE_500, marginTop: 2 }}>{obra.monto}</div>
									</div>
								</div>
							);
						})}
					</div>
					<div
						style={{
							background: STONE_50,
							border: `1px solid ${STONE_200}`,
							borderRadius: 12,
							padding: 30,
							opacity: fade(frame, 88, 16),
							transform: `translateY(${move(frame, 88, 16, 20, 0)}px)`,
						}}
					>
						<div
							style={{
								fontSize: 18,
								fontWeight: 850,
								letterSpacing: 2.4,
								textTransform: "uppercase",
								color: STONE_500,
							}}
						>
							Inversión acumulada
						</div>
						<div
							style={{
								fontSize: 68,
								fontWeight: 850,
								marginTop: 14,
								fontVariantNumeric: "tabular-nums",
							}}
						>
							$ {formatMillones(inversion)} M
						</div>
						<div style={{ marginTop: 28, overflow: "hidden", width: curvaReveal * 496 }}>
							<svg width={496} height={126} viewBox="0 0 496 126">
								<polygon
									points={`${curvaPoints} 496,126 0,126`}
									fill="rgba(255,88,0,0.10)"
								/>
								<polyline
									points={curvaPoints}
									fill="none"
									stroke={ORANGE}
									strokeWidth={5}
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
						</div>
						<div style={{ marginTop: 26, opacity: fade(frame, 212, 16) }}>
							<Chip color={GREEN}>+9,2 % este mes</Chip>
						</div>
					</div>
				</div>
			</div>
		</Scene>
	);
};

/* ------------------------------------------------------------------ */
/* 3. Importá tu Excel                                                 */
/* ------------------------------------------------------------------ */

const presupuestoRows = [
	{ item: "01", desc: "Movimiento de suelos", un: "gl", cant: "1", precio: "4.800.000", subtotal: "4.800.000" },
	{ item: "02", desc: "Hormigón H-21", un: "m³", cant: "", precio: "185.000", subtotal: "" },
	{ item: "03", desc: "Mampostería ladrillo hueco", un: "m²", cant: "940", precio: "38.500", subtotal: "36.190.000" },
	{ item: "04", desc: "Instalación eléctrica", un: "boca", cant: "260", precio: "42.000", subtotal: "10.920.000" },
	{ item: "05", desc: "Carpintería de aluminio", un: "m²", cant: "210", precio: "156.000", subtotal: "32.760.000" },
	{ item: "06", desc: "Pintura látex interior", un: "m²", cant: "2.400", precio: "9.800", subtotal: "23.520.000" },
] as const;

const ExcelScene = () => {
	const frame = useCurrentFrame();
	const dragT = progress(frame, 40, 68, easeInOut);
	const fileX = interpolate(dragT, [0, 1], [150, 830]);
	const fileY = interpolate(dragT, [0, 1], [400, 560]);
	const dropHot = fade(frame, 100, 12);
	const dropGone = fadeOut(frame, 142, 16);
	const tableIn = fade(frame, 156, 18);

	// Live cell edit: 120 -> 140 m3 de hormigón
	const cantEdit = Math.round(move(frame, 262, 16, 120, 140));
	const subtotalEdit = move(frame, 264, 18, 22200000, 25900000);
	const totalEdit = move(frame, 266, 22, 130390000, 134090000);
	const editGlow = fade(frame, 252, 10) * fadeOut(frame, 312, 22);

	return (
		<Scene>
			<UseCaseCaption
				frame={frame}
				kicker="Importá tu Excel"
				title="Arrastrá el presupuesto que ya usás."
				sub="Se convierte en una tabla viva. Editás como en Excel, nadie migra nada."
			/>
			{/* Dropzone */}
			<div
				style={{
					position: "absolute",
					left: 460,
					top: 360,
					width: 1000,
					height: 540,
					borderRadius: 16,
					border: `3px dashed ${STONE_400}`,
					background: "rgba(255,255,255,0.6)",
					opacity: fade(frame, 20, 16) * dropGone,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					gap: 16,
				}}
			>
				<div
					style={{
						position: "absolute",
						inset: -3,
						borderRadius: 16,
						border: `3px dashed ${ORANGE}`,
						opacity: dropHot,
						boxShadow: "0 0 60px rgba(255,88,0,0.18)",
					}}
				/>
				<div style={{ fontSize: 40, fontWeight: 780, color: STONE_500 }}>
					Soltá tu archivo acá
				</div>
				<div style={{ fontSize: 24, color: STONE_400 }}>.xlsx · .xls · tal cual está</div>
				<div
					style={{
						position: "absolute",
						left: 60,
						right: 60,
						bottom: 52,
						height: 14,
						borderRadius: 999,
						background: STONE_200,
						overflow: "hidden",
						opacity: fade(frame, 116, 10),
					}}
				>
					<div
						style={{
							height: "100%",
							width: `${progress(frame, 116, 28, easeInOut) * 100}%`,
							background: ORANGE,
							borderRadius: 999,
						}}
					/>
				</div>
			</div>
			{/* File chip being dragged */}
			<div
				style={{
					position: "absolute",
					left: fileX,
					top: fileY,
					width: 420,
					display: "flex",
					alignItems: "center",
					gap: 18,
					padding: "20px 24px",
					...cardStyle,
					borderRadius: 12,
					opacity: fade(frame, 28, 14) * fadeOut(frame, 116, 14),
					transform: `rotate(${interpolate(dragT, [0, 1], [-3, 0])}deg) scale(${interpolate(
						dragT,
						[0.9, 1],
						[1, 0.94],
						clamp,
					)})`,
					zIndex: 30,
				}}
			>
				<div
					style={{
						width: 54,
						height: 54,
						borderRadius: 10,
						background: "#15803d",
						color: "white",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						fontSize: 26,
						fontWeight: 900,
					}}
				>
					X
				</div>
				<div>
					<div style={{ fontSize: 24, fontWeight: 800 }}>presupuesto-obra-norte.xlsx</div>
					<div style={{ fontSize: 18, color: STONE_500, marginTop: 4 }}>148 KB · hoja «Cómputo»</div>
				</div>
			</div>
			{/* Live table */}
			<div
				style={{
					position: "absolute",
					left: 280,
					top: 322,
					width: 1360,
					height: 668,
					...cardStyle,
					overflow: "hidden",
					opacity: tableIn,
					transform: `translateY(${move(frame, 156, 22, 34, 0)}px)`,
					zIndex: 25,
				}}
			>
				<div
					style={{
						height: 78,
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						padding: "0 30px",
						borderBottom: `1px solid ${STONE_200}`,
					}}
				>
					<div style={{ fontSize: 26, fontWeight: 820 }}>Presupuesto · Obra Norte</div>
					<div style={{ display: "flex", gap: 12 }}>
						<Chip color={GREEN}>Importado</Chip>
						<Chip>Tabla viva</Chip>
					</div>
				</div>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "80px 1fr 90px 140px 200px 220px",
						padding: "0 30px",
						height: 52,
						alignItems: "center",
						background: STONE_50,
						borderBottom: `1px solid ${STONE_200}`,
						fontSize: 16,
						fontWeight: 850,
						letterSpacing: 1.6,
						textTransform: "uppercase",
						color: STONE_500,
					}}
				>
					<div>Ítem</div>
					<div>Descripción</div>
					<div>Un.</div>
					<div style={{ textAlign: "right" }}>Cant.</div>
					<div style={{ textAlign: "right" }}>P. unitario</div>
					<div style={{ textAlign: "right" }}>Subtotal</div>
				</div>
				{presupuestoRows.map((row, index) => {
					const isEdited = index === 1;
					const rowIn = fade(frame, 172 + index * 10, 12);
					return (
						<div
							key={row.item}
							style={{
								display: "grid",
								gridTemplateColumns: "80px 1fr 90px 140px 200px 220px",
								padding: "0 30px",
								height: 74,
								alignItems: "center",
								borderBottom: `1px solid ${STONE_200}`,
								fontSize: 24,
								opacity: rowIn,
								transform: `translateX(${move(frame, 172 + index * 10, 12, 22, 0)}px)`,
							}}
						>
							<div style={{ color: STONE_500, fontWeight: 700 }}>{row.item}</div>
							<div style={{ fontWeight: 700 }}>{row.desc}</div>
							<div style={{ color: STONE_500 }}>{row.un}</div>
							<div
								style={{
									textAlign: "right",
									fontVariantNumeric: "tabular-nums",
									fontWeight: isEdited ? 850 : 500,
									borderRadius: 8,
									padding: "10px 12px",
									background: isEdited ? `rgba(255,88,0,${0.14 * editGlow})` : undefined,
									boxShadow: isEdited ? `inset 0 0 0 ${3 * editGlow}px ${ORANGE}` : undefined,
								}}
							>
								{isEdited ? formatMiles(cantEdit) : row.cant}
							</div>
							<div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.precio}</div>
							<div
								style={{
									textAlign: "right",
									fontVariantNumeric: "tabular-nums",
									fontWeight: 800,
									color: isEdited && editGlow > 0.02 ? ORANGE : STONE_900,
								}}
							>
								{isEdited ? formatMiles(subtotalEdit) : row.subtotal}
							</div>
						</div>
					);
				})}
				<div
					style={{
						height: 86,
						display: "flex",
						alignItems: "center",
						justifyContent: "flex-end",
						gap: 22,
						padding: "0 30px",
						background: STONE_50,
						opacity: fade(frame, 236, 14),
					}}
				>
					<div style={{ fontSize: 20, fontWeight: 850, letterSpacing: 2, textTransform: "uppercase", color: STONE_500 }}>
						Total
					</div>
					<div style={{ fontSize: 38, fontWeight: 850, fontVariantNumeric: "tabular-nums" }}>
						$ {formatMiles(totalEdit)}
					</div>
				</div>
			</div>
		</Scene>
	);
};

/* ------------------------------------------------------------------ */
/* 4. OCR de documentos                                                */
/* ------------------------------------------------------------------ */

const camposOcr = [
	{ campo: "Proveedor", valor: "Corralón San Justo", conf: "99 %" },
	{ campo: "CUIT", valor: "30-58462117-9", conf: "98 %" },
	{ campo: "Fecha", valor: "12/05/2026", conf: "98 %" },
	{ campo: "Obra asignada", valor: "Torre Mitre", conf: "96 %" },
	{ campo: "Total", valor: "$ 3.481.200", conf: "95 %" },
] as const;

const OcrScene = () => {
	const frame = useCurrentFrame();
	const scanY = move(frame, 70, 100, 96, 560, easeInOut);

	return (
		<Scene>
			<UseCaseCaption
				frame={frame}
				kicker="OCR de documentos"
				title="Subí el escaneo. Los datos se cargan solos."
				sub="Facturas, certificados y planos: de PDF escaneado a tabla estructurada."
			/>
			{/* Documento escaneado */}
			<div
				style={{
					position: "absolute",
					left: 130,
					top: 358,
					width: 590,
					height: 620,
					...cardStyle,
					borderRadius: 10,
					transform: `rotate(-1.6deg) translateY(${move(frame, 28, 22, 40, 0)}px)`,
					opacity: fade(frame, 28, 18),
					overflow: "hidden",
				}}
			>
				<div style={{ padding: "36px 42px 0" }}>
					<div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
						<div style={{ fontSize: 34, fontWeight: 850 }}>FACTURA A</div>
						<div style={{ fontSize: 20, color: STONE_500 }}>N.º 0003-00001084</div>
					</div>
					<div style={{ fontSize: 20, color: STONE_500, marginTop: 8 }}>Corralón San Justo S.R.L.</div>
				</div>
				<div style={{ padding: "30px 42px" }}>
					{[86, 62, 74, 58, 80, 52, 68, 44].map((width, index) => (
						<div
							key={index}
							style={{
								height: 16,
								width: `${width}%`,
								borderRadius: 4,
								background: index === 4 ? "rgba(255,88,0,0.20)" : STONE_200,
								marginTop: index === 0 ? 0 : 24,
							}}
						/>
					))}
					<div
						style={{
							marginTop: 36,
							paddingTop: 22,
							borderTop: `2px solid ${STONE_200}`,
							display: "flex",
							justifyContent: "space-between",
							fontSize: 26,
							fontWeight: 850,
						}}
					>
						<div>TOTAL</div>
						<div style={{ fontVariantNumeric: "tabular-nums" }}>$ 3.481.200</div>
					</div>
				</div>
				<div
					style={{
						position: "absolute",
						left: 0,
						right: 0,
						top: scanY,
						height: 4,
						background: ORANGE,
						boxShadow: "0 0 34px rgba(255,88,0,0.75)",
						opacity: fade(frame, 66, 10) * fadeOut(frame, 174, 12),
					}}
				/>
			</div>
			<div
				style={{
					position: "absolute",
					left: 130,
					top: 300,
					opacity: fade(frame, 44, 14),
				}}
			>
				<Chip color={STONE_500}>factura-corralon-1084.pdf · escaneada</Chip>
			</div>
			{/* Panel de datos extraídos */}
			<div
				style={{
					position: "absolute",
					left: 860,
					top: 366,
					width: 940,
					height: 604,
					...cardStyle,
					overflow: "hidden",
					opacity: fade(frame, 96, 18),
					transform: `translateY(${move(frame, 96, 18, 30, 0)}px)`,
				}}
			>
				<div
					style={{
						height: 74,
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						padding: "0 30px",
						borderBottom: `1px solid ${STONE_200}`,
					}}
				>
					<div
						style={{
							fontSize: 19,
							fontWeight: 850,
							letterSpacing: 2.4,
							textTransform: "uppercase",
							color: STONE_500,
						}}
					>
						Datos extraídos
					</div>
					<Chip>OCR automático</Chip>
				</div>
				{camposOcr.map((campo, index) => (
					<div
						key={campo.campo}
						style={{
							display: "grid",
							gridTemplateColumns: "270px 1fr 110px",
							alignItems: "center",
							gap: 20,
							padding: "0 30px",
							height: 82,
							borderBottom: index < 4 ? `1px solid ${STONE_200}` : "none",
							opacity: fade(frame, 118 + index * 22, 14),
							transform: `translateX(${move(frame, 118 + index * 22, 14, 28, 0)}px)`,
						}}
					>
						<div style={{ fontSize: 22, color: STONE_500 }}>{campo.campo}</div>
						<div style={{ fontSize: 30, fontWeight: 820 }}>{campo.valor}</div>
						<div style={{ fontSize: 20, color: ORANGE, fontWeight: 850, textAlign: "right" }}>{campo.conf}</div>
					</div>
				))}
				<div
					style={{
						height: 118,
						display: "flex",
						alignItems: "center",
						padding: "0 30px",
						background: STONE_50,
						opacity: fade(frame, 262, 16),
					}}
				>
					<Chip color={GREEN}>5 campos listos para revisar · sin tipear nada</Chip>
				</div>
			</div>
		</Scene>
	);
};

/* ------------------------------------------------------------------ */
/* 5. Consolidación macro (dark)                                       */
/* ------------------------------------------------------------------ */

const macroRows = [
	{ obra: "Torre Mitre", monto: 412300000, avance: 68 },
	{ obra: "Ruta 40 · Tramo II", monto: 618000000, avance: 42 },
	{ obra: "Hospital Regional", monto: 254200000, avance: 91 },
	{ obra: "Barrio Los Álamos", monto: 189600000, avance: 55 },
	{ obra: "Planta Río Cuarto", monto: 97400000, avance: 23 },
] as const;

const MacroScene = () => {
	const frame = useCurrentFrame();
	const total = 1571500000 * progress(frame, 168, 58);

	return (
		<Scene dark>
			<div
				style={{
					position: "absolute",
					inset: 0,
					background:
						"radial-gradient(circle at 24% 0%, rgba(255,88,0,0.14), transparent 34%), #070604",
				}}
			/>
			<UseCaseCaption
				frame={frame}
				kicker="Consolidación macro"
				title="El total de todas tus obras, ya calculado."
				sub="Un reporte cruzado, siempre al día. Sin copiar y pegar entre archivos."
				dark
			/>
			<div
				style={{
					position: "absolute",
					left: 96,
					right: 96,
					top: 346,
					height: 610,
					borderRadius: 16,
					background: "rgba(250,250,249,0.05)",
					border: "1px solid rgba(250,250,249,0.12)",
					overflow: "hidden",
					opacity: fade(frame, 30, 20),
					transform: `translateY(${move(frame, 30, 24, 44, 0)}px)`,
				}}
			>
				<div
					style={{
						height: 80,
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						padding: "0 34px",
						borderBottom: "1px solid rgba(250,250,249,0.12)",
					}}
				>
					<div style={{ fontSize: 26, fontWeight: 820 }}>Macro · Certificado a la fecha</div>
					<Chip>5 obras · actualizado hoy</Chip>
				</div>
				{macroRows.map((row, index) => {
					const start = 78 + index * 14;
					const fill = progress(frame, start, 42);
					return (
						<div
							key={row.obra}
							style={{
								display: "grid",
								gridTemplateColumns: "1fr 430px 300px",
								alignItems: "center",
								gap: 30,
								padding: "0 34px",
								height: 76,
								borderBottom: "1px solid rgba(250,250,249,0.08)",
								opacity: fade(frame, start - 10, 12),
								transform: `translateX(${move(frame, start - 10, 12, 24, 0)}px)`,
							}}
						>
							<div style={{ fontSize: 27, fontWeight: 700 }}>{row.obra}</div>
							<div
								style={{
									fontSize: 30,
									fontWeight: 800,
									textAlign: "right",
									fontVariantNumeric: "tabular-nums",
								}}
							>
								$ {formatMiles(row.monto * fill)}
							</div>
							<div style={{ display: "flex", alignItems: "center", gap: 16 }}>
								<div
									style={{
										flex: 1,
										height: 12,
										borderRadius: 999,
										background: "rgba(250,250,249,0.12)",
										overflow: "hidden",
									}}
								>
									<div
										style={{
											height: "100%",
											width: `${row.avance * fill}%`,
											background: ORANGE,
											borderRadius: 999,
										}}
									/>
								</div>
								<div
									style={{
										fontSize: 21,
										fontWeight: 800,
										width: 66,
										textAlign: "right",
										color: "rgba(250,250,249,0.72)",
										fontVariantNumeric: "tabular-nums",
									}}
								>
									{Math.round(row.avance * fill)} %
								</div>
							</div>
						</div>
					);
				})}
				<div
					style={{
						height: 148,
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						padding: "0 34px",
						borderTop: "1px solid rgba(250,250,249,0.22)",
						opacity: fade(frame, 160, 16),
					}}
				>
					<div
						style={{
							fontSize: 22,
							fontWeight: 850,
							letterSpacing: 2.6,
							textTransform: "uppercase",
							color: "rgba(250,250,249,0.56)",
						}}
					>
						Total consolidado
					</div>
					<div
						style={{
							fontSize: 62,
							fontWeight: 850,
							color: ORANGE,
							fontVariantNumeric: "tabular-nums",
						}}
					>
						$ {formatMiles(total)}
					</div>
				</div>
			</div>
			<div
				style={{
					position: "absolute",
					right: 120,
					bottom: 44,
					opacity: fade(frame, 252, 18),
				}}
			>
				<Chip style={{ fontSize: 24 }}>Sin abrir un solo Excel.</Chip>
			</div>
		</Scene>
	);
};

/* ------------------------------------------------------------------ */
/* 6. Certificados y mediciones                                        */
/* ------------------------------------------------------------------ */

const pasos = [
	{ titulo: "Presupuesto", meta: "412 ítems cargados", at: 40 },
	{ titulo: "Medición", meta: "Mayo 2026 · 42,8 %", at: 108 },
	{ titulo: "Certificado", meta: "N.º 5 · $ 84,2 M", at: 178 },
] as const;

const CertScene = () => {
	const frame = useCurrentFrame();
	const lineFill = progress(frame, 46, 150, easeInOut);
	const nodeXs = [160, 864, 1568];

	return (
		<Scene>
			<UseCaseCaption
				frame={frame}
				kicker="Certificados y mediciones"
				title="Del presupuesto al certificado, sin recalcular nada."
				sub="Cada período se compara solo contra el anterior. Los números cierran."
			/>
			<div
				style={{
					position: "absolute",
					left: 96,
					right: 96,
					top: 372,
					height: 270,
					opacity: fade(frame, 24, 18),
				}}
			>
				<div
					style={{
						position: "absolute",
						left: nodeXs[0],
						width: nodeXs[2] - nodeXs[0],
						top: 43,
						height: 6,
						borderRadius: 999,
						background: STONE_200,
					}}
				/>
				<div
					style={{
						position: "absolute",
						left: nodeXs[0],
						width: (nodeXs[2] - nodeXs[0]) * lineFill,
						top: 43,
						height: 6,
						borderRadius: 999,
						background: ORANGE,
					}}
				/>
				{pasos.map((paso, index) => {
					const activo = fade(frame, paso.at, 8);
					const pulse = interpolate(Math.abs(frame - paso.at), [0, 10, 26], [0.5, 0.22, 0], clamp);
					const cx = nodeXs[index];
					return (
						<div key={paso.titulo}>
							<div
								style={{
									position: "absolute",
									left: cx - 66,
									top: -20,
									width: 132,
									height: 132,
									borderRadius: 999,
									background: `rgba(255,88,0,${pulse})`,
								}}
							/>
							<div
								style={{
									position: "absolute",
									left: cx - 46,
									top: 0,
									width: 92,
									height: 92,
									borderRadius: 999,
									background: "white",
									border: `3px solid ${STONE_200}`,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									fontSize: 36,
									fontWeight: 850,
									color: STONE_400,
								}}
							>
								{index + 1}
							</div>
							<div
								style={{
									position: "absolute",
									left: cx - 46,
									top: 0,
									width: 92,
									height: 92,
									borderRadius: 999,
									background: ORANGE,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									fontSize: 36,
									fontWeight: 850,
									color: "white",
									opacity: activo,
								}}
							>
								{index + 1}
							</div>
							<div
								style={{
									position: "absolute",
									left: cx - 220,
									top: 122,
									width: 440,
									textAlign: "center",
									opacity: fade(frame, paso.at + 4, 14),
									transform: `translateY(${move(frame, paso.at + 4, 14, 14, 0)}px)`,
								}}
							>
								<div style={{ fontSize: 38, fontWeight: 820 }}>{paso.titulo}</div>
								<div style={{ fontSize: 24, color: STONE_500, marginTop: 8 }}>{paso.meta}</div>
							</div>
						</div>
					);
				})}
			</div>
			<div
				style={{
					position: "absolute",
					left: 96,
					right: 96,
					top: 692,
					height: 314,
					...cardStyle,
					padding: "34px 40px",
					opacity: fade(frame, 196, 18),
					transform: `translateY(${move(frame, 196, 20, 36, 0)}px)`,
				}}
			>
				<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
					<div style={{ fontSize: 27, fontWeight: 820 }}>Avance certificado · Mayo vs. Abril</div>
					<div style={{ opacity: fade(frame, 276, 14) }}>
						<Chip color={GREEN}>+4,6 puntos en el mes</Chip>
					</div>
				</div>
				{[
					{ label: "Abril", pct: "38,2 %", width: 76.4, color: STONE_400, at: 216 },
					{ label: "Mayo", pct: "42,8 %", width: 85.6, color: ORANGE, at: 234 },
				].map((bar) => (
					<div
						key={bar.label}
						style={{
							display: "grid",
							gridTemplateColumns: "130px 1fr 150px",
							alignItems: "center",
							gap: 28,
							marginTop: 40,
						}}
					>
						<div style={{ fontSize: 26, fontWeight: 700, color: STONE_500 }}>{bar.label}</div>
						<div style={{ height: 30, borderRadius: 999, background: STONE_100, overflow: "hidden" }}>
							<div
								style={{
									height: "100%",
									width: `${bar.width * progress(frame, bar.at, 40, easeInOut)}%`,
									borderRadius: 999,
									background: bar.color,
								}}
							/>
						</div>
						<div
							style={{
								fontSize: 36,
								fontWeight: 850,
								textAlign: "right",
								fontVariantNumeric: "tabular-nums",
								opacity: fade(frame, bar.at + 26, 14),
							}}
						>
							{bar.pct}
						</div>
					</div>
				))}
			</div>
		</Scene>
	);
};

/* ------------------------------------------------------------------ */
/* 7. Cierre                                                           */
/* ------------------------------------------------------------------ */

const ClosingScene = () => {
	const frame = useCurrentFrame();
	const ctaPop = spring({
		frame: frame - 112,
		fps: FPS,
		config: { damping: 14, stiffness: 120, mass: 0.8 },
	});

	return (
		<Scene dark>
			<div
				style={{
					position: "absolute",
					inset: 0,
					background:
						"radial-gradient(circle at 50% 10%, rgba(255,88,0,0.22), transparent 36%), #050505",
				}}
			/>
			<div
				style={{
					position: "absolute",
					inset: 0,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					textAlign: "center",
				}}
			>
				<div style={{ opacity: fade(frame, 14, 22), transform: `translateY(${move(frame, 14, 22, 26, 0)}px)` }}>
					<BrandMark size={76} light />
				</div>
				<div
					style={{
						fontSize: 96,
						lineHeight: 1.02,
						fontWeight: 780,
						maxWidth: 1200,
						marginTop: 66,
						opacity: fade(frame, 46, 26),
						transform: `translateY(${move(frame, 46, 26, 30, 0)}px)`,
					}}
				>
					Tus obras, bajo control.
				</div>
				<div
					style={{
						marginTop: 60,
						padding: "22px 52px",
						borderRadius: 999,
						background: ORANGE,
						color: "white",
						fontSize: 38,
						fontWeight: 850,
						opacity: fade(frame, 112, 12),
						transform: `scale(${0.8 + ctaPop * 0.2})`,
						boxShadow: "0 24px 80px rgba(255,88,0,0.35)",
					}}
				>
					Empezá hoy
				</div>
				<div
					style={{
						fontSize: 28,
						color: "rgba(250,250,249,0.66)",
						marginTop: 44,
						opacity: fade(frame, 152, 22),
						transform: `translateY(${move(frame, 152, 22, 16, 0)}px)`,
					}}
				>
					Invitá a tu equipo cuando quieras. Cada empresa, su propio espacio.
				</div>
			</div>
		</Scene>
	);
};

/* ------------------------------------------------------------------ */
/* Composición                                                         */
/* ------------------------------------------------------------------ */

const SCENES = [
	{ Component: HookScene, duration: 210 },
	{ Component: PanelScene, duration: 360 },
	{ Component: ExcelScene, duration: 360 },
	{ Component: OcrScene, duration: 360 },
	{ Component: MacroScene, duration: 330 },
	{ Component: CertScene, duration: 330 },
	{ Component: ClosingScene, duration: 210 },
] as const;

export const USE_CASES_DURATION_IN_FRAMES = SCENES.reduce(
	(sum, scene) => sum + scene.duration,
	0,
); // 2160 frames = 72 s @ 30 fps

export const SintesisUseCases = () => {
	return (
		<AbsoluteFill style={page}>
			{SCENES.map(({ Component, duration }, index) => {
				const from = SCENES.slice(0, index).reduce(
					(sum, scene) => sum + scene.duration,
					0,
				);

				return (
					<Sequence key={index} from={from} durationInFrames={duration} premountFor={FPS}>
						<Component />
					</Sequence>
				);
			})}
		</AbsoluteFill>
	);
};
