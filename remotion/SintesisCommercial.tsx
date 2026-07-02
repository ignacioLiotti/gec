import type { CSSProperties, ReactNode } from "react";
import {
	AbsoluteFill,
	Easing,
	Img,
	Sequence,
	interpolate,
	spring,
	staticFile,
	useCurrentFrame,
} from "remotion";

const FPS = 30;
const ORANGE = "#ff5800";
const INK = "#16130f";
const STONE_900 = "#1c1917";
const STONE_700 = "#44403c";
const STONE_500 = "#78716c";
const STONE_200 = "#e7e5e4";
const STONE_50 = "#fafaf9";
const BLUE = "#2563eb";
const GREEN = "#16a34a";
const PURPLE = "#8b5cf6";

const easeOut = Easing.bezier(0.23, 1, 0.32, 1);
const easeInOut = Easing.bezier(0.77, 0, 0.175, 1);

const shot = {
	dashboard: "commercial/screens/dashboard-home.png",
	excel: "commercial/screens/excel-obras.png",
	documents: "commercial/screens/documents-folders.png",
	macro: "commercial/screens/macro-reports.png",
};

const clamp = {
	extrapolateLeft: "clamp" as const,
	extrapolateRight: "clamp" as const,
};

const progress = (frame: number, start: number, duration: number, easing = easeOut) =>
	interpolate(frame, [start, start + duration], [0, 1], {
		...clamp,
		easing,
	});

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
	interpolate(frame, [start, start + duration], [from, to], {
		...clamp,
		easing,
	});

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

const BrandMark = ({
	size = 54,
	light = false,
}: {
	size?: number;
	light?: boolean;
}) => (
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

const Scene = ({ children, dark = false }: { children: ReactNode; dark?: boolean }) => (
	<AbsoluteFill style={dark ? darkPage : page}>{children}</AbsoluteFill>
);

const Caption = ({
	frame,
	kicker,
	title,
	top = 82,
	left = 96,
	dark = false,
	maxWidth = 980,
	delay = 0,
	fontSize = 72,
	exitAt,
}: {
	frame: number;
	kicker?: string;
	title: string;
	top?: number;
	left?: number;
	dark?: boolean;
	maxWidth?: number;
	delay?: number;
	fontSize?: number;
	exitAt?: number;
}) => {
	const enter = fade(frame, delay + 8, 24) * (exitAt == null ? 1 : fadeOut(frame, exitAt, 18));

	return (
		<div
			style={{
				position: "absolute",
				top,
				left,
				maxWidth,
				opacity: enter,
				transform: `translateY(${move(frame, delay + 8, 24, 26, 0)}px)`,
				zIndex: 20,
			}}
		>
			{kicker ? (
				<div
					style={{
						fontSize: 22,
						fontWeight: 850,
						letterSpacing: 4,
						textTransform: "uppercase",
						color: dark ? "rgba(250,250,249,0.52)" : STONE_500,
						marginBottom: 20,
					}}
				>
					{kicker}
				</div>
			) : null}
			<div
				style={{
					fontSize,
					lineHeight: 1.04,
					fontWeight: 760,
					letterSpacing: 0,
					color: dark ? STONE_50 : STONE_900,
				}}
			>
				{title}
			</div>
		</div>
	);
};

const ProductShot = ({
	src,
	scale = 1,
	x = 0,
	y = 0,
	opacity = 1,
	radius = 0,
	shadow = false,
	style,
}: {
	src: string;
	scale?: number;
	x?: number;
	y?: number;
	opacity?: number;
	radius?: number;
	shadow?: boolean;
	frame?: number;
	style?: CSSProperties;
}) => (
	<div
		style={{
			position: "absolute",
			inset: 0,
			overflow: "hidden",
			borderRadius: radius,
			boxShadow: shadow ? "0 44px 120px rgba(28,25,23,0.22)" : undefined,
			transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`,
			transformOrigin: "center center",
			opacity,
			...style,
		}}
	>
		<Img
			src={staticFile(src)}
			style={{
				position: "absolute",
				width: 2007,
				height: 1338,
				left: -67,
				top: -10,
				objectFit: "cover",
			}}
		/>
		<div
			style={{
				position: "absolute",
				inset: 0,
				boxShadow: "inset 0 0 0 1px rgba(28,25,23,0.08)",
				pointerEvents: "none",
			}}
		/>
	</div>
);

const Cursor = ({
	frame,
	points,
	showAt = 0,
	hideAt = 999,
}: {
	frame: number;
	points: { at: number; x: number; y: number }[];
	showAt?: number;
	hideAt?: number;
}) => {
	const current = points.reduce((prev, next) => {
		if (frame >= next.at) return next;
		return prev;
	}, points[0]);
	const next = points.find((point) => point.at > frame) ?? current;
	const amount = current === next ? 1 : progress(frame, current.at, next.at - current.at, easeInOut);
	const x = interpolate(amount, [0, 1], [current.x, next.x]);
	const y = interpolate(amount, [0, 1], [current.y, next.y]);
	const click = Math.max(
		...points.map((point) =>
			interpolate(Math.abs(frame - point.at), [0, 8, 18], [0.72, 0.18, 0], clamp),
		),
	);

	return (
		<div
			style={{
				position: "absolute",
				left: x,
				top: y,
				width: 42,
				height: 42,
				zIndex: 50,
				opacity: fade(frame, showAt, 12) * fadeOut(frame, hideAt, 10),
				transform: `scale(${1 - click * 0.08})`,
			}}
		>
			<div
				style={{
					position: "absolute",
					width: 34,
					height: 34,
					borderRadius: 999,
					background: `rgba(255, 88, 0, ${click})`,
					transform: `translate(-7px, -7px) scale(${1 + click * 1.7})`,
				}}
			/>
			<div
				style={{
					width: 0,
					height: 0,
					borderTop: "24px solid white",
					borderRight: "16px solid transparent",
					filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.34))",
					transform: "rotate(-18deg)",
				}}
			/>
		</div>
	);
};

const Spotlight = ({
	frame,
	start,
	x,
	y,
	width,
	height,
	label,
}: {
	frame: number;
	start: number;
	x: number;
	y: number;
	width: number;
	height: number;
	label?: string;
}) => {
	const enter = fade(frame, start, 16) * fadeOut(frame, start + 92, 18);
	return (
		<div
			style={{
				position: "absolute",
				left: x,
				top: y,
				width,
				height,
				borderRadius: 12,
				border: `4px solid ${ORANGE}`,
				boxShadow: "0 0 0 999px rgba(5,5,5,0.18), 0 18px 50px rgba(255,88,0,0.18)",
				opacity: enter,
				transform: `scale(${move(frame, start, 18, 0.98, 1)})`,
				zIndex: 30,
			}}
		>
			{label ? (
				<div
					style={{
						position: "absolute",
						left: 16,
						top: -62,
						background: INK,
						color: "white",
						borderRadius: 8,
						padding: "12px 16px",
						fontSize: 24,
						fontWeight: 760,
						whiteSpace: "nowrap",
					}}
				>
					{label}
				</div>
			) : null}
		</div>
	);
};

const FloatingPanel = ({
	frame,
	start,
	children,
	x,
	y,
	width,
}: {
	frame: number;
	start: number;
	children: ReactNode;
	x: number;
	y: number;
	width: number;
}) => {
	const enter = spring({
		frame: frame - start,
		fps: FPS,
		config: { damping: 18, stiffness: 110, mass: 0.9 },
	});

	return (
		<div
			style={{
				position: "absolute",
				left: x,
				top: y,
				width,
				borderRadius: 12,
				background: "rgba(255,255,255,0.96)",
				border: "1px solid rgba(28,25,23,0.10)",
				boxShadow: "0 28px 80px rgba(28,25,23,0.20)",
				padding: 24,
				zIndex: 35,
				opacity: fade(frame, start, 12),
				transform: `translateY(${(1 - enter) * 26}px) scale(${0.98 + enter * 0.02})`,
			}}
		>
			{children}
		</div>
	);
};

const IntroScene = () => {
	const frame = useCurrentFrame();
	const first = fade(frame, 14, 24) * fadeOut(frame, 112, 22);
	const second = fade(frame, 156, 26);
	const search = progress(frame, 208, 34, easeInOut);

	return (
		<Scene dark>
			<div
				style={{
					position: "absolute",
					inset: 0,
					background:
						"radial-gradient(circle at 74% 18%, rgba(255,88,0,0.16), transparent 30%), #050505",
				}}
			/>
			<div
				style={{
					position: "absolute",
					left: 150,
					top: 285,
					fontSize: 88,
					lineHeight: 1.08,
					fontWeight: 700,
					letterSpacing: 0,
					maxWidth: 1180,
					opacity: first,
					transform: `translateY(${move(frame, 14, 24, 34, 0)}px)`,
				}}
			>
				La documentación de tus obras ya existe.
			</div>
			<div
				style={{
					position: "absolute",
					left: 150,
					top: 285,
					fontSize: 84,
					lineHeight: 1.08,
					fontWeight: 700,
					letterSpacing: 0,
					maxWidth: 1260,
					opacity: second,
					transform: `translateY(${move(frame, 156, 26, 34, 0)}px)`,
				}}
			>
				El problema es encontrarla cuando la necesitás.
			</div>
			<div
				style={{
					position: "absolute",
					left: 150,
					bottom: 122,
					width: 860,
					height: 74,
					borderRadius: 12,
					background: "rgba(250,250,249,0.08)",
					border: "1px solid rgba(250,250,249,0.12)",
					overflow: "hidden",
					opacity: fade(frame, 206, 18),
				}}
			>
				<div
					style={{
						position: "absolute",
						inset: 0,
						width: `${interpolate(search, [0, 1], [0, 100])}%`,
						background: "rgba(255,88,0,0.18)",
					}}
				/>
				<div style={{ position: "absolute", left: 26, top: 18, fontSize: 28, color: "rgba(250,250,249,0.74)" }}>
					Buscar: certificado abril obra norte...
				</div>
			</div>
		</Scene>
	);
};

const ScatteredToolsScene = () => {
	const frame = useCurrentFrame();
	const cardY = [180, 280, 188, 300];
	const cards = [
		["WhatsApp", "mensajes, fotos, audios", "#25d366", 128],
		["Excel", "planillas y avances", "#15803d", 482],
		["PDF", "certificados, contratos", "#dc2626", 840],
		["Carpetas", "versiones y adjuntos", STONE_700, 1198],
	] as const;
	const merge = progress(frame, 196, 42, easeInOut);

	return (
		<Scene>
			<Caption
				frame={frame}
				kicker="Información dispersa"
				title="La información suele estar repartida entre múltiples herramientas."
				maxWidth={1120}
			/>
			<ProductShot
				src={shot.excel}
				frame={frame}
				opacity={fade(frame, 200, 22)}
				scale={move(frame, 200, 50, 1.04, 1)}
				style={{ filter: `blur(${move(frame, 200, 34, 8, 0)}px)` }}
			/>
			{cards.map(([title, meta, color, x], index) => {
				const enter = spring({ frame: frame - (48 + index * 12), fps: FPS, config: { damping: 16, stiffness: 86 } });
				const tx = interpolate(merge, [0, 1], [x, 620 + index * 60], { ...clamp, easing: easeInOut });
				const ty = interpolate(merge, [0, 1], [cardY[index], 655], { ...clamp, easing: easeInOut });
				return (
					<div
						key={title}
						style={{
							position: "absolute",
							left: tx,
							top: ty,
							width: 300,
							height: 205,
							borderRadius: 12,
							background: "white",
							border: `1px solid ${STONE_200}`,
							boxShadow: "0 24px 70px rgba(28,25,23,0.14)",
							padding: 26,
							zIndex: 25,
							opacity: fade(frame, 48 + index * 12, 16) * fadeOut(frame, 226, 20),
							transform: `scale(${0.96 + enter * 0.04}) rotate(${interpolate(merge, [0, 1], [index % 2 ? -1.4 : 1.2, 0])}deg)`,
						}}
					>
						<div
							style={{
								width: 52,
								height: 52,
								borderRadius: 12,
								background: color,
								color: "white",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								fontSize: 24,
								fontWeight: 900,
							}}
						>
							{title.slice(0, 1)}
						</div>
						<div style={{ fontSize: 30, fontWeight: 820, marginTop: 28 }}>{title}</div>
						<div style={{ fontSize: 18, color: STONE_500, marginTop: 8 }}>{meta}</div>
					</div>
				);
			})}
			<Spotlight frame={frame} start={226} x={130} y={144} width={460} height={72} label="Todo entra a una vista unificada" />
		</Scene>
	);
};

const DocumentsDemoScene = () => {
	const frame = useCurrentFrame();
	const scale = move(frame, 0, 210, 1.08, 1.24, easeInOut);
	const x = move(frame, 0, 210, 0, -135, easeInOut);
	const y = move(frame, 0, 210, 0, -22, easeInOut);

	return (
		<Scene>
			<ProductShot src={shot.documents} frame={frame} scale={scale} x={x} y={y} />
			<div
				style={{
					position: "absolute",
					inset: 0,
					background: "linear-gradient(90deg, rgba(250,250,249,0.86), rgba(250,250,249,0.14) 48%, rgba(250,250,249,0))",
					opacity: fade(frame, 12, 18) * fadeOut(frame, 238, 22),
				}}
			/>
			<Caption
				frame={frame}
				kicker="Demo de producto"
				title="Cada documento vive dentro de una obra, una carpeta y un historial."
				maxWidth={760}
				fontSize={52}
				exitAt={82}
			/>
			<Spotlight frame={frame} start={86} x={94} y={293} width={340} height={300} label="Árbol documental por obra" />
			<Spotlight frame={frame} start={162} x={1040} y={190} width={330} height={64} label="Subida y trazabilidad" />
			<Cursor
				frame={frame}
				showAt={46}
				hideAt={236}
				points={[
					{ at: 48, x: 238, y: 472 },
					{ at: 96, x: 244, y: 388 },
					{ at: 154, x: 1185, y: 210 },
					{ at: 198, x: 700, y: 343 },
				]}
			/>
			<FloatingPanel frame={frame} start={196} x={1030} y={688} width={560}>
				<div style={{ fontSize: 18, color: STONE_500, fontWeight: 780, letterSpacing: 2, textTransform: "uppercase" }}>
					Historial
				</div>
				<div style={{ fontSize: 34, lineHeight: 1.14, fontWeight: 820, marginTop: 12 }}>
					Subido, extraído y revisado sin perder contexto.
				</div>
			</FloatingPanel>
		</Scene>
	);
};

const ExtractionDemoScene = () => {
	const frame = useCurrentFrame();
	const scan = move(frame, 68, 132, 295, 742, easeInOut);
	const split = progress(frame, 190, 42, easeInOut);

	return (
		<Scene>
			<ProductShot src={shot.documents} frame={frame} scale={1.18} x={-112} y={-16} opacity={1 - split * 0.2} />
			<div style={{ position: "absolute", inset: 0, background: `rgba(250,250,249,${0.18 + split * 0.68})` }} />
			<Caption
				frame={frame}
				kicker="Documento a dato"
				title="Síntesis transforma documentos en información utilizable."
				maxWidth={900}
				fontSize={56}
				exitAt={108}
			/>
			<div
				style={{
					position: "absolute",
					left: move(frame, 24, 36, 188, 132),
					top: 330,
					width: 650,
					height: 620,
					borderRadius: 14,
					background: "white",
					border: `1px solid ${STONE_200}`,
					boxShadow: "0 34px 100px rgba(28,25,23,0.18)",
					overflow: "hidden",
					opacity: fade(frame, 24, 22),
					transform: `scale(${move(frame, 24, 36, 0.98, 1)})`,
				}}
			>
				<div style={{ height: 72, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", borderBottom: `1px solid ${STONE_200}` }}>
					<div style={{ fontSize: 24, fontWeight: 820 }}>Certificado mensual - Abril.pdf</div>
					<div style={{ fontSize: 16, color: ORANGE, fontWeight: 900 }}>PDF</div>
				</div>
				<div style={{ position: "relative", margin: 30, height: 488, border: `1px solid ${STONE_200}`, borderRadius: 10, background: STONE_50, padding: 42, overflow: "hidden" }}>
					<div style={{ fontSize: 38, fontWeight: 820 }}>Certificado de avance</div>
					{[0, 1, 2, 3, 4, 5].map((row) => (
						<div
							key={row}
							style={{
								height: 18,
								width: `${82 - row * 8}%`,
								background: row === 3 ? "rgba(255,88,0,0.22)" : STONE_200,
								borderRadius: 4,
								marginTop: row === 0 ? 42 : 22,
							}}
						/>
					))}
					<div
						style={{
							position: "absolute",
							left: 0,
							right: 0,
							top: scan,
							height: 4,
							background: ORANGE,
							boxShadow: "0 0 30px rgba(255,88,0,0.72)",
							opacity: fade(frame, 54, 14) * fadeOut(frame, 208, 18),
						}}
					/>
				</div>
			</div>
			<div
				style={{
					position: "absolute",
					left: 860,
					top: 330,
					width: 885,
					height: 620,
					borderRadius: 14,
					background: "white",
					border: `1px solid ${STONE_200}`,
					boxShadow: "0 34px 100px rgba(28,25,23,0.18)",
					overflow: "hidden",
					opacity: fade(frame, 146, 24),
					transform: `translateY(${move(frame, 146, 24, 28, 0)}px)`,
				}}
			>
				<div style={{ height: 74, padding: "24px 30px", borderBottom: `1px solid ${STONE_200}`, fontSize: 18, color: STONE_500, fontWeight: 850, letterSpacing: 2.4, textTransform: "uppercase" }}>
					Datos extraídos
				</div>
				{[
					["Periodo", "Abril 2026", "99%"],
					["Avance certificado", "42,8%", "96%"],
					["Monto certificado", "$ 84.250.000", "94%"],
					["Saldo a certificar", "$ 112.900.000", "91%"],
					["Documento fuente", "Certificado mensual - Abril.pdf", "100%"],
				].map(([field, value, confidence], index) => (
					<div
						key={field}
						style={{
							display: "grid",
							gridTemplateColumns: "300px 1fr 110px",
							alignItems: "center",
							gap: 20,
							padding: "25px 30px",
							borderBottom: index < 4 ? `1px solid ${STONE_200}` : "none",
							opacity: fade(frame, 172 + index * 14, 12),
							transform: `translateX(${move(frame, 172 + index * 14, 12, 18, 0)}px)`,
						}}
					>
						<div style={{ fontSize: 22, color: STONE_500 }}>{field}</div>
						<div style={{ fontSize: 30, fontWeight: 820 }}>{value}</div>
						<div style={{ fontSize: 20, color: ORANGE, fontWeight: 850, textAlign: "right" }}>{confidence}</div>
					</div>
				))}
			</div>
			<Cursor
				frame={frame}
				showAt={38}
				hideAt={250}
				points={[
					{ at: 42, x: 710, y: 432 },
					{ at: 112, x: 704, y: 688 },
					{ at: 174, x: 1086, y: 462 },
				]}
			/>
		</Scene>
	);
};

const ReportsDemoScene = () => {
	const frame = useCurrentFrame();
	const switchToMacro = progress(frame, 204, 18, easeInOut);

	return (
		<Scene>
			<ProductShot
				src={shot.dashboard}
				frame={frame}
				scale={move(frame, 0, 220, 1.07, 1.18, easeInOut)}
				x={move(frame, 0, 220, -10, -112, easeInOut)}
				y={move(frame, 0, 220, 0, -34, easeInOut)}
				opacity={1 - switchToMacro}
			/>
			<ProductShot
				src={shot.macro}
				frame={frame}
				scale={move(frame, 218, 42, 1.06, 1.1, easeInOut)}
				x={move(frame, 218, 42, 90, -28, easeInOut)}
				y={-18}
				opacity={switchToMacro}
			/>
			<div
				style={{
					position: "absolute",
					inset: 0,
					background: "linear-gradient(90deg, rgba(250,250,249,0.90), rgba(250,250,249,0.16) 48%, rgba(250,250,249,0))",
					opacity: fade(frame, 12, 18) * fadeOut(frame, 252, 26),
				}}
			/>
			<Caption
				frame={frame}
				kicker="Alertas y reportes"
				title="La información se convierte en alertas, seguimiento y reportes para dirección."
				maxWidth={810}
				fontSize={54}
				exitAt={112}
			/>
			<Spotlight frame={frame} start={92} x={1288} y={198} width={492} height={320} label="Alertas accionables" />
			<Spotlight frame={frame} start={166} x={766} y={350} width={460} height={360} label="Resumen de obra" />
			<Spotlight frame={frame} start={230} x={1560} y={178} width={210} height={52} label="Reportes" />
			<Cursor
				frame={frame}
				showAt={68}
				hideAt={266}
				points={[
					{ at: 70, x: 1674, y: 287 },
					{ at: 146, x: 1080, y: 826 },
					{ at: 226, x: 1652, y: 220 },
				]}
			/>
		</Scene>
	);
};

const AreasScene = () => {
	const frame = useCurrentFrame();
	const items = [
		["Dirección", "Panel de Control", shot.dashboard, 0, BLUE],
		["Administración", "Macro tablas", shot.macro, 14, GREEN],
		["Obra", "Documentos", shot.documents, 28, ORANGE],
		["Oficina Técnica", "Panel de obras", shot.excel, 42, PURPLE],
	] as const;

	return (
		<Scene dark>
			<div
				style={{
					position: "absolute",
					inset: 0,
					background:
						"radial-gradient(circle at 50% 0%, rgba(255,88,0,0.16), transparent 32%), #090806",
				}}
			/>
			<Caption
				frame={frame}
				kicker="Un mismo sistema"
				title="Dirección, Administración, Obra y Oficina Técnica trabajando sobre la misma información."
				dark
				maxWidth={1280}
			/>
			<div
				style={{
					position: "absolute",
					left: 110,
					right: 110,
					bottom: 96,
					display: "grid",
					gridTemplateColumns: "repeat(4, 1fr)",
					gap: 22,
				}}
			>
				{items.map(([area, detail, src, delay, color]) => {
					const enter = spring({ frame: frame - (62 + delay), fps: FPS, config: { damping: 18, stiffness: 95 } });
					return (
						<div
							key={area}
							style={{
								height: 500,
								borderRadius: 14,
								border: "1px solid rgba(250,250,249,0.12)",
								background: "rgba(250,250,249,0.07)",
								overflow: "hidden",
								opacity: fade(frame, 62 + delay, 16),
								transform: `translateY(${(1 - enter) * 46}px) scale(${0.97 + enter * 0.03})`,
							}}
						>
							<div style={{ height: 232, overflow: "hidden", position: "relative", borderBottom: "1px solid rgba(250,250,249,0.10)" }}>
								<Img
									src={staticFile(src)}
									style={{
										position: "absolute",
										width: 640,
										height: 427,
										left: -70,
										top: -14,
										objectFit: "cover",
										filter: "saturate(0.96)",
									}}
								/>
								<div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, transparent, ${color}22)` }} />
							</div>
							<div style={{ padding: 28 }}>
								<div style={{ fontSize: 18, color, fontWeight: 850, letterSpacing: 2.4, textTransform: "uppercase" }}>
									{detail}
								</div>
								<div style={{ fontSize: 42, lineHeight: 1.02, fontWeight: 820, color: "white", marginTop: 20 }}>
									{area}
								</div>
								<div style={{ fontSize: 22, lineHeight: 1.35, color: "rgba(250,250,249,0.62)", marginTop: 18 }}>
									Consulta, carga y decide sin duplicar documentación.
								</div>
							</div>
						</div>
					);
				})}
			</div>
		</Scene>
	);
};

const ClosingScene = () => {
	const frame = useCurrentFrame();
	return (
		<Scene dark>
			<div
				style={{
					position: "absolute",
					inset: 0,
					background:
						"radial-gradient(circle at 50% 8%, rgba(255,88,0,0.22), transparent 34%), #050505",
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
				<div style={{ opacity: fade(frame, 16, 26), transform: `translateY(${move(frame, 16, 26, 28, 0)}px)` }}>
					<BrandMark size={78} light />
				</div>
				<div
					style={{
						fontSize: 92,
						lineHeight: 1.02,
						fontWeight: 780,
						letterSpacing: 0,
						maxWidth: 1120,
						marginTop: 72,
						opacity: fade(frame, 54, 28),
						transform: `translateY(${move(frame, 54, 28, 32, 0)}px)`,
					}}
				>
					Convertí documentación en control.
				</div>
				<div
					style={{
						fontSize: 40,
						color: "rgba(250,250,249,0.72)",
						marginTop: 46,
						opacity: fade(frame, 116, 26),
						transform: `translateY(${move(frame, 116, 26, 22, 0)}px)`,
					}}
				>
					Solicitá una demostración.
				</div>
			</div>
		</Scene>
	);
};

export const SintesisCommercial = () => (
	<AbsoluteFill style={page}>
		<Sequence from={0} durationInFrames={10 * FPS} premountFor={FPS}>
			<IntroScene />
		</Sequence>
		<Sequence from={10 * FPS} durationInFrames={10 * FPS} premountFor={FPS}>
			<ScatteredToolsScene />
		</Sequence>
		<Sequence from={20 * FPS} durationInFrames={15 * FPS} premountFor={FPS}>
			<DocumentsDemoScene />
		</Sequence>
		<Sequence from={35 * FPS} durationInFrames={15 * FPS} premountFor={FPS}>
			<ExtractionDemoScene />
		</Sequence>
		<Sequence from={50 * FPS} durationInFrames={15 * FPS} premountFor={FPS}>
			<ReportsDemoScene />
		</Sequence>
		<Sequence from={65 * FPS} durationInFrames={15 * FPS} premountFor={FPS}>
			<AreasScene />
		</Sequence>
		<Sequence from={80 * FPS} durationInFrames={10 * FPS} premountFor={FPS}>
			<ClosingScene />
		</Sequence>
	</AbsoluteFill>
);
