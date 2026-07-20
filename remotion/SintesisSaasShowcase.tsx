import type {ReactNode} from "react";
import {
	AbsoluteFill,
	Easing,
	Img,
	Sequence,
	interpolate,
	spring,
	staticFile,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";

const FPS = 30;
const ORANGE = "#ff5a1f";
const INK = "#17120e";
const PAPER = "#f7f4f0";
const MUTED = "#766e67";
const LINE = "rgba(23,18,14,.12)";
const clamp = {extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const};
const ease = Easing.bezier(0.22, 1, 0.36, 1);

const lerp = (frame: number, input: number[], output: number[]) =>
	interpolate(frame, input, output, {...clamp, easing: ease});
const fade = (frame: number, at = 0, duration = 12) => lerp(frame, [at, at + duration], [0, 1]);
const fadeOut = (frame: number, at: number, duration = 12) => lerp(frame, [at, at + duration], [1, 0]);
const rise = (frame: number, at = 0, amount = 28) => lerp(frame, [at, at + 20], [amount, 0]);

const Brand = ({small = false}: {small?: boolean}) => (
	<div style={{display: "flex", alignItems: "center", gap: small ? 12 : 18}}>
		<div style={{width: small ? 26 : 46, height: small ? 26 : 46, borderRadius: 999, background: ORANGE, boxShadow: `0 0 0 ${small ? 7 : 12}px rgba(255,90,31,.13)`}} />
		<div style={{fontSize: small ? 18 : 27, fontWeight: 850, letterSpacing: small ? 3 : 4.5}}>SÍNTESIS</div>
	</div>
);

const Scene = ({children, dark = false}: {children: ReactNode; dark?: boolean}) => {
	const frame = useCurrentFrame();
	const {durationInFrames} = useVideoConfig();
	return (
		<AbsoluteFill style={{background: dark ? "#0b0908" : PAPER, color: dark ? "white" : INK, fontFamily: 'Inter, Geist, "Segoe UI", sans-serif', overflow: "hidden", opacity: fade(frame) * fadeOut(frame, durationInFrames - 10, 10)}}>
			{children}
		</AbsoluteFill>
	);
};

const Kicker = ({children}: {children: ReactNode}) => (
	<div style={{fontSize: 17, fontWeight: 850, letterSpacing: 3.2, color: ORANGE, textTransform: "uppercase"}}>{children}</div>
);

const BrowserFrame = ({
	src,
	x,
	y,
	width,
	height,
	zoom = [1, 1.012],
	panX = [0, 0],
	panY = [0, 0],
	darkShadow = false,
}: {
	src: string;
	x: number;
	y: number;
	width: number;
	height: number;
	zoom?: [number, number];
	panX?: [number, number];
	panY?: [number, number];
	darkShadow?: boolean;
}) => {
	const frame = useCurrentFrame();
	const {durationInFrames} = useVideoConfig();
	const reveal = spring({frame, fps: FPS, config: {damping: 200}, durationInFrames: 24});
	const z = lerp(frame, [0, durationInFrames], zoom);
	const px = lerp(frame, [0, durationInFrames], panX);
	const py = lerp(frame, [0, durationInFrames], panY);
	return (
		<div style={{position: "absolute", left: x, top: y, width, height, borderRadius: 26, overflow: "hidden", background: "white", border: `1px solid ${LINE}`, boxShadow: darkShadow ? "0 44px 130px rgba(0,0,0,.48)" : "0 42px 100px rgba(35,26,18,.17)", opacity: reveal, transform: `translateY(${(1 - reveal) * 32}px)`}}>
			<div style={{height: 42, display: "flex", alignItems: "center", gap: 8, paddingLeft: 17, background: "#fbfaf8", borderBottom: `1px solid ${LINE}`, zIndex: 3, position: "relative"}}>
				{["#ff605c", "#ffbd44", "#00ca4e"].map((c) => <div key={c} style={{width: 10, height: 10, borderRadius: 99, background: c}} />)}
			</div>
			<div style={{position: "absolute", left: 0, right: 0, top: 42, bottom: 0, overflow: "hidden", background: "#f0f0ef"}}>
				<Img src={staticFile(`commercial/saas-showcase/${src}`)} style={{position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", transform: `translate(${px}px, ${py}px) scale(${z})`, transformOrigin: "center"}} />
			</div>
		</div>
	);
};

const Cursor = ({points, clickAt = []}: {points: {at: number; x: number; y: number}[]; clickAt?: number[]}) => {
	const frame = useCurrentFrame();
	let index = 0;
	for (let i = 0; i < points.length; i++) if (frame >= points[i].at) index = i;
	const current = points[index];
	const next = points[Math.min(index + 1, points.length - 1)];
	const p = current === next ? 1 : lerp(frame, [current.at, next.at], [0, 1]);
	const x = interpolate(p, [0, 1], [current.x, next.x]);
	const y = interpolate(p, [0, 1], [current.y, next.y]);
	const click = Math.max(0, ...clickAt.map((at) => interpolate(Math.abs(frame - at), [0, 6, 15], [1, .35, 0], clamp)));
	return (
		<div style={{position: "absolute", left: x, top: y, width: 34, height: 34, zIndex: 30, opacity: fade(frame, points[0].at - 6, 8)}}>
			<div style={{position: "absolute", left: -12, top: -12, width: 46, height: 46, borderRadius: 99, border: `3px solid rgba(255,90,31,${click})`, transform: `scale(${1 + click * .7})`}} />
			<div style={{width: 0, height: 0, borderTop: "24px solid white", borderRight: "15px solid transparent", filter: "drop-shadow(0 2px 4px rgba(0,0,0,.55))", transform: "rotate(-18deg)"}} />
		</div>
	);
};

const FloatingTag = ({children, x, y, at, dark = false}: {children: ReactNode; x: number; y: number; at: number; dark?: boolean}) => {
	const frame = useCurrentFrame();
	const s = spring({frame: frame - at, fps: FPS, config: {damping: 18, stiffness: 180}});
	return <div style={{position: "absolute", left: x, top: y, zIndex: 25, padding: "13px 18px", borderRadius: 999, background: dark ? INK : "white", color: dark ? "white" : INK, border: `1px solid ${dark ? "rgba(255,255,255,.18)" : LINE}`, boxShadow: "0 16px 42px rgba(20,15,10,.16)", fontSize: 19, fontWeight: 760, opacity: fade(frame, at, 10), transform: `translateY(${(1 - s) * 20}px) scale(${.94 + s * .06})`}}>{children}</div>;
};

const ProgressRail = ({active}: {active: number}) => (
	<div style={{position: "absolute", left: 82, right: 82, bottom: 34, zIndex: 50, display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 9}}>
		{[0,1,2,3,4].map((n) => <div key={n} style={{height: 4, borderRadius: 99, background: n <= active ? ORANGE : "rgba(120,110,100,.2)"}} />)}
	</div>
);

const Intro = () => {
	const frame = useCurrentFrame();
	return (
		<Scene dark>
			<div style={{position: "absolute", inset: 0, background: "radial-gradient(circle at 75% 22%, rgba(255,90,31,.23), transparent 29%), radial-gradient(circle at 20% 90%, rgba(255,255,255,.06), transparent 24%)"}} />
			<div style={{position: "absolute", left: 110, top: 90, opacity: fade(frame, 5), transform: `translateY(${rise(frame, 5)}px)`}}><Brand /></div>
			<div style={{position: "absolute", left: 110, top: 310, width: 1500}}>
				<div style={{fontSize: 98, lineHeight: .97, letterSpacing: -4, fontWeight: 780, opacity: fade(frame, 18), transform: `translateY(${rise(frame, 18, 38)}px)`}}>Toda la operación de una obra.<br /><span style={{color: ORANGE}}>Una sola fuente de verdad.</span></div>
				<div style={{fontSize: 29, color: "rgba(255,255,255,.62)", marginTop: 40, opacity: fade(frame, 48)}}>Del documento al dato. Del dato a la decisión.</div>
			</div>
	</Scene>
	);
};

const FindObra = () => {
	const frame = useCurrentFrame();
	return (
		<Scene>
			<div style={{position: "absolute", left: 86, top: 64, zIndex: 5, opacity: fade(frame, 4), transform: `translateY(${rise(frame, 4)}px)`}}><Kicker>01 · Encontrá lo importante</Kicker><div style={{fontSize: 56, fontWeight: 780, marginTop: 10}}>112 obras. Una búsqueda.</div></div>
			<BrowserFrame src="obras-filters-clean.png" x={80} y={205} width={1760} height={790} zoom={[1,1.01]} />
			<div style={{position: "absolute", left: 315, top: 340, width: 460, height: 54, borderRadius: 12, background: "white", boxShadow: `0 0 0 4px ${ORANGE}, 0 18px 50px rgba(255,90,31,.25)`, opacity: fade(frame, 35), zIndex: 20}}>
				<div style={{fontSize: 20, padding: "14px 18px", color: MUTED}}>Hospital pediátrico</div>
			</div>
			<FloatingTag x={1160} y={280} at={70}>Filtros por estado, fechas y montos</FloatingTag>
			<FloatingTag x={1200} y={870} at={108} dark>Configuración por usuario</FloatingTag>
			<Cursor points={[{at:20,x:520,y:560},{at:44,x:490,y:365},{at:80,x:1580,y:360},{at:118,x:1450,y:880}]} clickAt={[44,80,118]} />
			<ProgressRail active={0} />
		</Scene>
	);
};

const UnderstandObra = () => {
	const frame = useCurrentFrame();
	const metric = Math.round(lerp(frame, [48, 100], [0, 37]));
	return (
		<Scene dark>
			<div style={{position: "absolute", left: 86, top: 58, zIndex: 5, opacity: fade(frame, 4)}}><Kicker>02 · Entendé la situación</Kicker><div style={{fontSize: 54, fontWeight: 780, marginTop: 10}}>Avance, dinero y plazo. Juntos.</div></div>
			<BrowserFrame src="obra-general-clean.png" x={95} y={190} width={1730} height={790} zoom={[1,1.018]} panX={[0,-6]} darkShadow />
			<div style={{position: "absolute", left: 132, top: 300, width: 190, height: 122, borderRadius: 20, background: ORANGE, color: "white", padding: 24, zIndex: 20, opacity: fade(frame, 38), transform: `translateY(${rise(frame, 38)}px)`}}><div style={{fontSize: 18, opacity: .75}}>AVANCE</div><div style={{fontSize: 48, fontWeight: 850, marginTop: 8}}>{metric}%</div></div>
		<FloatingTag x={1050} y={655} at={72}>Contrato · Certificado · Saldo</FloatingTag>
		<FloatingTag x={1310} y={820} at={108} dark>Alertas antes del desvío</FloatingTag>
		<Cursor points={[{at:18,x:760,y:300},{at:58,x:1350,y:700},{at:102,x:1500,y:840}]} clickAt={[58,102]} />
		<ProgressRail active={1} />
	</Scene>
	);
};

const Documents = () => {
	const frame = useCurrentFrame();
	const switchAt = 92;
	return (
		<Scene>
			<div style={{position: "absolute", left: 86, top: 58, zIndex: 8, opacity: fade(frame, 4)}}><Kicker>03 · Recuperá el contexto</Kicker><div style={{fontSize: 54, fontWeight: 780, marginTop: 10}}>Preguntale a tus documentos.</div></div>
		<div style={{opacity: fadeOut(frame, switchAt, 16)}}><BrowserFrame src="documents-new-clean.png" x={85} y={190} width={1750} height={800} zoom={[1,1.012]} /></div>
		<div style={{opacity: fade(frame, switchAt, 16)}}><BrowserFrame src="document-ai-clean.png" x={85} y={190} width={1750} height={800} zoom={[1,1.015]} /></div>
		<div style={{position: "absolute", left: 370, bottom: 145, width: 800, height: 68, borderRadius: 18, background: "white", border: `2px solid ${ORANGE}`, boxShadow: "0 24px 70px rgba(20,15,10,.18)", zIndex: 20, opacity: fade(frame, 35) * fadeOut(frame, 122, 12), padding: "20px 26px", fontSize: 21, color: MUTED}}>¿Cuál fue el último certificado y qué monto tiene?</div>
		<FloatingTag x={1220} y={245} at={122}>Respuesta con trazabilidad a la fuente</FloatingTag>
		<Cursor points={[{at:18,x:600,y:520},{at:52,x:800,y:885},{at:92,x:1490,y:360},{at:132,x:1260,y:270}]} clickAt={[52,92]} />
		<ProgressRail active={2} />
	</Scene>
	);
};

const Extract = () => {
	const frame = useCurrentFrame();
	const scan = lerp(frame, [32, 122], [375, 730]);
	return (
		<Scene dark>
			<div style={{position: "absolute", left: 82, top: 60, zIndex: 8, opacity: fade(frame, 4)}}><Kicker>04 · Convertí documento en dato</Kicker><div style={{fontSize: 54, fontWeight: 780, marginTop: 10}}>OCR que termina en una tabla revisable.</div></div>
		<BrowserFrame src="document-ai-clean.png" x={80} y={190} width={1080} height={800} zoom={[1,1.012]} darkShadow />
		<div style={{position: "absolute", right: 90, top: 205, width: 650, height: 750, borderRadius: 26, background: "white", color: INK, padding: 36, boxShadow: "0 44px 120px rgba(0,0,0,.45)", opacity: fade(frame, 22), transform: `translateX(${lerp(frame,[22,48],[70,0])}px)`}}>
			<div style={{fontSize: 17, fontWeight: 850, color: ORANGE, letterSpacing: 2.4}}>CERTIFICADO ABRIL.PDF</div>
			<div style={{position: "relative", height: 260, borderRadius: 18, background: "#f0ece8", marginTop: 24, padding: 28, overflow: "hidden"}}>
				{[90,72,84,62,78,68].map((w,i)=><div key={i} style={{height: 13,width:`${w}%`,borderRadius:8,background:i===3?"rgba(255,90,31,.3)":"#d5cec8",marginTop:i?18:0}}/>)}
				<div style={{position:"absolute",left:0,right:0,top:scan-375,height:3,background:ORANGE,boxShadow:"0 0 26px rgba(255,90,31,.9)"}}/>
			</div>
			<div style={{marginTop: 26}}>{[["Período","Abril 2026","99%"],["Avance","42,8%","96%"],["Monto","$84.250.000","94%"],["Saldo","$112.900.000","91%"]].map(([a,b,c],i)=><div key={a} style={{display:"grid",gridTemplateColumns:"1fr 1.2fr 70px",padding:"17px 0",borderBottom:`1px solid ${LINE}`,fontSize:20,opacity:fade(frame,70+i*12),transform:`translateX(${rise(frame,70+i*12,18)}px)`}}><span style={{color:MUTED}}>{a}</span><strong>{b}</strong><strong style={{color:ORANGE,textAlign:"right"}}>{c}</strong></div>)}</div>
		</div>
		<ProgressRail active={3} />
	</Scene>
	);
};

const Report = () => {
	const frame = useCurrentFrame();
	const report = spring({frame: frame - 85, fps: FPS, config: {damping: 17, stiffness: 130}});
	return (
		<Scene>
			<div style={{position:"absolute",left:86,top:58,zIndex:8,opacity:fade(frame,4)}}><Kicker>05 · Consolidá y reportá</Kicker><div style={{fontSize:54,fontWeight:780,marginTop:10}}>De 1.077 filas a una decisión.</div></div>
		<BrowserFrame src="macro-tables-clean.png" x={80} y={200} width={1760} height={770} zoom={[1,1.015]} />
		<FloatingTag x={1420} y={255} at={40} dark>Generar reporte</FloatingTag>
		<div style={{position:"absolute",right:130,top:340,width:390,height:510,borderRadius:22,background:"white",border:`1px solid ${LINE}`,boxShadow:"0 35px 100px rgba(20,15,10,.25)",padding:30,zIndex:26,opacity:report,transform:`translateY(${(1-report)*55}px) rotate(${(1-report)*3}deg)`}}>
			<div style={{fontSize:16,color:ORANGE,fontWeight:850,letterSpacing:2}}>REPORTE EJECUTIVO</div><div style={{fontSize:31,fontWeight:780,marginTop:18}}>Materiales y pólizas</div>
			<div style={{height:120,display:"flex",alignItems:"end",gap:13,marginTop:38}}>{[55,88,68,105,78,112].map((h,i)=><div key={i} style={{height:h,width:34,borderRadius:"8px 8px 2px 2px",background:i===5?ORANGE:"#ddd7d1"}}/>)}</div>
			{["Riesgos detectados","Variación mensual","Detalle verificable"].map((t,i)=><div key={t} style={{marginTop:25,paddingTop:18,borderTop:`1px solid ${LINE}`,fontSize:19,fontWeight:700,opacity:fade(frame,105+i*10)}}>{t}</div>)}
		</div>
		<Cursor points={[{at:18,x:580,y:500},{at:50,x:1570,y:305},{at:90,x:1590,y:390}]} clickAt={[50]} />
		<ProgressRail active={4} />
	</Scene>
	);
};

const Governance = () => {
	const frame = useCurrentFrame();
	return (
		<Scene dark>
			<div style={{position:"absolute",left:86,top:70,width:590,zIndex:8,opacity:fade(frame,4),transform:`translateY(${rise(frame,4)}px)`}}><Kicker>Configuración sin fricción</Kicker><div style={{fontSize:67,fontWeight:780,lineHeight:1.03,marginTop:15}}>Cada cliente empieza con una base sólida.</div><div style={{fontSize:26,color:"rgba(255,255,255,.62)",lineHeight:1.45,marginTop:28}}>Personas, responsabilidades, permisos y modelos de obra configurables.</div></div>
		<BrowserFrame src="people-access-clean.png" x={690} y={115} width={1150} height={850} zoom={[1,1.015]} darkShadow />
		<FloatingTag x={780} y={760} at={52}>Roles simples</FloatingTag><FloatingTag x={1280} y={690} at={78} dark>38 permisos auditables</FloatingTag>
		<Cursor points={[{at:20,x:1100,y:470},{at:58,x:1350,y:720},{at:92,x:1500,y:800}]} clickAt={[58,92]} />
	</Scene>
	);
};

const Closing = () => {
	const frame = useCurrentFrame();
	return <Scene dark><div style={{position:"absolute",inset:0,background:"radial-gradient(circle at 50% 35%, rgba(255,90,31,.24), transparent 30%)"}}/><div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center"}}><div style={{opacity:fade(frame,5),transform:`translateY(${rise(frame,5)}px)`}}><Brand/></div><div style={{fontSize:94,lineHeight:.98,fontWeight:790,letterSpacing:-4,marginTop:65,opacity:fade(frame,20),transform:`translateY(${rise(frame,20,38)}px)`}}>La obra completa.<br/><span style={{color:ORANGE}}>Sintetizada.</span></div><div style={{fontSize:28,color:"rgba(255,255,255,.62)",marginTop:35,opacity:fade(frame,48)}}>Menos búsqueda. Más control.</div></div></Scene>;
};

export const SintesisSaasShowcase = () => (
	<AbsoluteFill style={{background: PAPER}}>
		<Sequence from={0} durationInFrames={4*FPS} premountFor={FPS}><Intro/></Sequence>
		<Sequence from={4*FPS} durationInFrames={6*FPS} premountFor={FPS}><FindObra/></Sequence>
		<Sequence from={10*FPS} durationInFrames={6*FPS} premountFor={FPS}><UnderstandObra/></Sequence>
		<Sequence from={16*FPS} durationInFrames={6*FPS} premountFor={FPS}><Documents/></Sequence>
		<Sequence from={22*FPS} durationInFrames={6*FPS} premountFor={FPS}><Extract/></Sequence>
		<Sequence from={28*FPS} durationInFrames={6*FPS} premountFor={FPS}><Report/></Sequence>
		<Sequence from={34*FPS} durationInFrames={5*FPS} premountFor={FPS}><Governance/></Sequence>
		<Sequence from={39*FPS} durationInFrames={4*FPS} premountFor={FPS}><Closing/></Sequence>
	</AbsoluteFill>
);
