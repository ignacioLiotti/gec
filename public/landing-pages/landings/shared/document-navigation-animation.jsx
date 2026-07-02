(() => {
	// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)

	/* BEGIN USAGE */
	// animations.jsx
	// Reusable animation starter: Stage, Timeline, Sprite, easing helpers.
	// Exports (to window): Stage, Sprite, PlaybackBar, TextSprite, ImageSprite, RectSprite,
	//   useTime, useTimeline, useSprite, Easing, interpolate, animate, clamp.
	//
	// Usage (in an HTML file that loads React + Babel):
	//
	//   <Stage width={1280} height={720} duration={10} background="#f6f4ef">
	//     <MyScene />
	//   </Stage>
	//
	// <Stage> auto-scales to the viewport and provides the scrubber, play/pause,
	// ←/→ seek, space, and 0-to-reset controls, and persists the playhead.
	// Inside <Stage>, any child can call useTime() to read the current
	// playhead (seconds). Or wrap content in <Sprite start={1} end={4}>...</Sprite>
	// to only render during that window -- children receive a `localTime` and
	// `progress` via the useSprite() hook. Use Easing + interpolate()/animate()
	// for tweens; TextSprite / ImageSprite / RectSprite have built-in entry/exit.
	// Build YOUR scenes by composing Sprites inside a Stage.
	/* END USAGE */
	// ─────────────────────────────────────────────────────────────────────────────

	// ── Easing functions (hand-rolled, Popmotion-style) ─────────────────────────
	// All easings take t ∈ [0,1] and return eased t ∈ [0,1] (may overshoot for back/elastic).
	const Easing = {
		linear: (t) => t,

		// Quad
		easeInQuad: (t) => t * t,
		easeOutQuad: (t) => t * (2 - t),
		easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),

		// Cubic
		easeInCubic: (t) => t * t * t,
		easeOutCubic: (t) => --t * t * t + 1,
		easeInOutCubic: (t) =>
			t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,

		// Quart
		easeInQuart: (t) => t * t * t * t,
		easeOutQuart: (t) => 1 - --t * t * t * t,
		easeInOutQuart: (t) =>
			t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t,

		// Expo
		easeInExpo: (t) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1))),
		easeOutExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
		easeInOutExpo: (t) => {
			if (t === 0) return 0;
			if (t === 1) return 1;
			if (t < 0.5) return 0.5 * Math.pow(2, 20 * t - 10);
			return 1 - 0.5 * Math.pow(2, -20 * t + 10);
		},

		// Sine
		easeInSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
		easeOutSine: (t) => Math.sin((t * Math.PI) / 2),
		easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,

		// Back (overshoot)
		easeOutBack: (t) => {
			const c1 = 1.70158,
				c3 = c1 + 1;
			return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
		},
		easeInBack: (t) => {
			const c1 = 1.70158,
				c3 = c1 + 1;
			return c3 * t * t * t - c1 * t * t;
		},
		easeInOutBack: (t) => {
			const c1 = 1.70158,
				c2 = c1 * 1.525;
			return t < 0.5
				? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
				: (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
		},

		// Elastic
		easeOutElastic: (t) => {
			const c4 = (2 * Math.PI) / 3;
			if (t === 0) return 0;
			if (t === 1) return 1;
			return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
		},
	};

	// ── Core interpolation helpers ──────────────────────────────────────────────

	// Clamp a value to [min, max]
	const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

	// interpolate([0, 0.5, 1], [0, 100, 50], ease?) -> fn(t)
	// Popmotion-style: linearly maps t across input keyframes to output values,
	// with optional easing per segment (single fn or array of fns).
	function interpolate(input, output, ease = Easing.linear) {
		return (t) => {
			if (t <= input[0]) return output[0];
			if (t >= input[input.length - 1]) return output[output.length - 1];
			for (let i = 0; i < input.length - 1; i++) {
				if (t >= input[i] && t <= input[i + 1]) {
					const span = input[i + 1] - input[i];
					const local = span === 0 ? 0 : (t - input[i]) / span;
					const easeFn = Array.isArray(ease) ? ease[i] || Easing.linear : ease;
					const eased = easeFn(local);
					return output[i] + (output[i + 1] - output[i]) * eased;
				}
			}
			return output[output.length - 1];
		};
	}

	// animate({from, to, start, end, ease})(t) — simpler single-segment tween.
	// Returns `from` before `start`, `to` after `end`.
	function animate({
		from = 0,
		to = 1,
		start = 0,
		end = 1,
		ease = Easing.easeInOutCubic,
	}) {
		return (t) => {
			if (t <= start) return from;
			if (t >= end) return to;
			const local = (t - start) / (end - start);
			return from + (to - from) * ease(local);
		};
	}

	// ── Timeline context ────────────────────────────────────────────────────────

	const TimelineContext = React.createContext({
		time: 0,
		duration: 10,
		playing: false,
	});

	const useTime = () => React.useContext(TimelineContext).time;
	const useTimeline = () => React.useContext(TimelineContext);

	// ── Sprite ──────────────────────────────────────────────────────────────────
	// Renders children only when the playhead is inside [start, end]. Provides
	// a sub-context with `localTime` (seconds since start) and `progress` (0..1).
	//
	//   <Sprite start={2} end={5}>
	//     {({ localTime, progress }) => <Thing x={progress * 100} />}
	//   </Sprite>
	//
	// Or as a plain wrapper — children can call useSprite() themselves.

	const SpriteContext = React.createContext({
		localTime: 0,
		progress: 0,
		duration: 0,
	});
	const useSprite = () => React.useContext(SpriteContext);

	function Sprite({
		start = 0,
		end = Infinity,
		children,
		keepMounted = false,
	}) {
		const { time } = useTimeline();
		const visible = time >= start && time <= end;
		if (!visible && !keepMounted) return null;

		const duration = end - start;
		const localTime = Math.max(0, time - start);
		const progress =
			duration > 0 && isFinite(duration)
				? clamp(localTime / duration, 0, 1)
				: 0;

		const value = { localTime, progress, duration, visible };

		return (
			<SpriteContext.Provider value={value}>
				{typeof children === "function" ? children(value) : children}
			</SpriteContext.Provider>
		);
	}

	// ── Sample sprite components ────────────────────────────────────────────────

	// TextSprite: fades/slides text in on entry, holds, then fades out on exit.
	// Props: text, x, y, size, color, font, entryDur, exitDur, align
	function TextSprite({
		text,
		x = 0,
		y = 0,
		size = 48,
		color = "#111",
		font = "Inter, system-ui, sans-serif",
		weight = 600,
		entryDur = 0.45,
		exitDur = 0.35,
		entryEase = Easing.easeOutBack,
		exitEase = Easing.easeInCubic,
		align = "left",
		letterSpacing = "-0.01em",
	}) {
		const { localTime, duration } = useSprite();
		const exitStart = Math.max(0, duration - exitDur);

		let opacity = 1;
		let ty = 0;

		if (localTime < entryDur) {
			const t = entryEase(clamp(localTime / entryDur, 0, 1));
			opacity = t;
			ty = (1 - t) * 16;
		} else if (localTime > exitStart) {
			const t = exitEase(clamp((localTime - exitStart) / exitDur, 0, 1));
			opacity = 1 - t;
			ty = -t * 8;
		}

		const translateX =
			align === "center" ? "-50%" : align === "right" ? "-100%" : "0";

		return (
			<div
				style={{
					position: "absolute",
					left: x,
					top: y,
					transform: `translate(${translateX}, ${ty}px)`,
					opacity,
					fontFamily: font,
					fontSize: size,
					fontWeight: weight,
					color,
					letterSpacing,
					whiteSpace: "pre",
					lineHeight: 1.1,
					willChange: "transform, opacity",
				}}>
				{text}
			</div>
		);
	}

	// ImageSprite: scales + fades in; optional Ken Burns drift during hold.
	function ImageSprite({
		src,
		x = 0,
		y = 0,
		width = 400,
		height = 300,
		entryDur = 0.6,
		exitDur = 0.4,
		kenBurns = false,
		kenBurnsScale = 1.08,
		radius = 12,
		fit = "cover",
		placeholder = null, // {label: string} for striped placeholder
	}) {
		const { localTime, duration } = useSprite();
		const exitStart = Math.max(0, duration - exitDur);

		let opacity = 1;
		let scale = 1;

		if (localTime < entryDur) {
			const t = Easing.easeOutCubic(clamp(localTime / entryDur, 0, 1));
			opacity = t;
			scale = 0.96 + 0.04 * t;
		} else if (localTime > exitStart) {
			const t = Easing.easeInCubic(
				clamp((localTime - exitStart) / exitDur, 0, 1),
			);
			opacity = 1 - t;
			scale = (kenBurns ? kenBurnsScale : 1) + 0.02 * t;
		} else if (kenBurns) {
			const holdSpan = exitStart - entryDur;
			const holdT = holdSpan > 0 ? (localTime - entryDur) / holdSpan : 0;
			scale = 1 + (kenBurnsScale - 1) * holdT;
		}

		const content = placeholder ? (
			<div
				style={{
					width: "100%",
					height: "100%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					background:
						"repeating-linear-gradient(135deg, #e9e6df 0 10px, #dcd8cf 10px 20px)",
					color: "#6b6458",
					fontFamily: "JetBrains Mono, ui-monospace, monospace",
					fontSize: 13,
					letterSpacing: "0.04em",
					textTransform: "uppercase",
				}}>
				{placeholder.label || "image"}
			</div>
		) : (
			<img
				src={src}
				alt=''
				style={{
					width: "100%",
					height: "100%",
					objectFit: fit,
					display: "block",
				}}
			/>
		);

		return (
			<div
				style={{
					position: "absolute",
					left: x,
					top: y,
					width,
					height,
					opacity,
					transform: `scale(${scale})`,
					transformOrigin: "center",
					borderRadius: radius,
					overflow: "hidden",
					willChange: "transform, opacity",
				}}>
				{content}
			</div>
		);
	}

	// RectSprite: simple rectangle that animates position/size/color via props.
	// Useful demo primitive — takes a `render` fn for per-frame customization.
	function RectSprite({
		x = 0,
		y = 0,
		width = 100,
		height = 100,
		color = "#111",
		radius = 8,
		entryDur = 0.4,
		exitDur = 0.3,
		render, // optional: (ctx) => style overrides
	}) {
		const spriteCtx = useSprite();
		const { localTime, duration } = spriteCtx;
		const exitStart = Math.max(0, duration - exitDur);

		let opacity = 1;
		let scale = 1;

		if (localTime < entryDur) {
			const t = Easing.easeOutBack(clamp(localTime / entryDur, 0, 1));
			opacity = clamp(localTime / entryDur, 0, 1);
			scale = 0.4 + 0.6 * t;
		} else if (localTime > exitStart) {
			const t = Easing.easeInQuad(
				clamp((localTime - exitStart) / exitDur, 0, 1),
			);
			opacity = 1 - t;
			scale = 1 - 0.15 * t;
		}

		const overrides = render ? render(spriteCtx) : {};

		return (
			<div
				style={{
					position: "absolute",
					left: x,
					top: y,
					width,
					height,
					background: color,
					borderRadius: radius,
					opacity,
					transform: `scale(${scale})`,
					transformOrigin: "center",
					willChange: "transform, opacity",
					...overrides,
				}}
			/>
		);
	}

	function Stage({
		width = 1280,
		height = 720,
		duration = 10,
		background = "#f6f4ef",
		fps = 60,
		loop = true,
		autoplay = true,
		active = true,
		persistKey = "animstage",
		children,
	}) {
		const [time, setTime] = React.useState(() => {
			if (!persistKey) return 0;
			try {
				const v = parseFloat(localStorage.getItem(persistKey + ":t") || "0");
				return isFinite(v) ? clamp(v, 0, duration) : 0;
			} catch {
				return 0;
			}
		});
		const [playing, setPlaying] = React.useState(active && autoplay);
		const [hoverTime, setHoverTime] = React.useState(null);
		const [scale, setScale] = React.useState(1);
		const wasActiveRef = React.useRef(false);

		const stageRef = React.useRef(null);
		const canvasRef = React.useRef(null);
		const rafRef = React.useRef(null);
		const lastTsRef = React.useRef(null);

		// Persist playhead
		React.useEffect(() => {
			if (!persistKey) return;
			try {
				localStorage.setItem(persistKey + ":t", String(time));
			} catch {}
		}, [time, persistKey]);

		React.useEffect(() => {
			const reduce =
				window.matchMedia &&
				window.matchMedia("(prefers-reduced-motion: reduce)").matches;
			if (reduce) {
				setTime(duration);
				setPlaying(false);
				wasActiveRef.current = active;
				return;
			}

			if (active && !wasActiveRef.current) {
				setTime(0);
				setHoverTime(null);
				setPlaying(autoplay);
			}
			if (!active && wasActiveRef.current) {
				setTime(0);
				setHoverTime(null);
				setPlaying(false);
			}
			wasActiveRef.current = active;
		}, [active, autoplay, duration]);

		// Auto-scale to fit viewport
		React.useEffect(() => {
			if (!stageRef.current) return;
			const el = stageRef.current;
			const measure = () => {
				const s = Math.min(el.clientWidth / width, el.clientHeight / height);
				setScale(Math.max(0.05, s));
			};
			measure();
			const ro = new ResizeObserver(measure);
			ro.observe(el);
			window.addEventListener("resize", measure);
			return () => {
				ro.disconnect();
				window.removeEventListener("resize", measure);
			};
		}, [width, height]);

		// Animation loop
		React.useEffect(() => {
			if (!active || !playing) {
				lastTsRef.current = null;
				return;
			}
			const step = (ts) => {
				if (lastTsRef.current == null) lastTsRef.current = ts;
				const dt = (ts - lastTsRef.current) / 1000;
				lastTsRef.current = ts;
				setTime((t) => {
					let next = t + dt;
					if (next >= duration) {
						if (loop) next = next % duration;
						else {
							next = duration;
							setPlaying(false);
						}
					}
					return next;
				});
				rafRef.current = requestAnimationFrame(step);
			};
			rafRef.current = requestAnimationFrame(step);
			return () => {
				if (rafRef.current) cancelAnimationFrame(rafRef.current);
				lastTsRef.current = null;
			};
		}, [active, playing, duration, loop]);

		// Keyboard: space = play/pause, ← → = seek
		React.useEffect(() => {
			const onKey = (e) => {
				if (!active) return;
				if (
					e.target &&
					(e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
				)
					return;
				if (e.code === "Space") {
					e.preventDefault();
					setPlaying((p) => !p);
				} else if (e.code === "ArrowLeft") {
					setTime((t) => clamp(t - (e.shiftKey ? 1 : 0.1), 0, duration));
				} else if (e.code === "ArrowRight") {
					setTime((t) => clamp(t + (e.shiftKey ? 1 : 0.1), 0, duration));
				} else if (e.key === "0" || e.code === "Home") {
					setTime(0);
				}
			};
			window.addEventListener("keydown", onKey);
			return () => window.removeEventListener("keydown", onKey);
		}, [active, duration]);

		const displayTime = hoverTime != null ? hoverTime : time;

		const ctxValue = React.useMemo(
			() => ({ time: displayTime, duration, playing, setTime, setPlaying }),
			[displayTime, duration, playing],
		);

		return (
			<div
				ref={stageRef}
				style={{
					position: "absolute",
					inset: 0,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					background: "#0a0a0a00",
					fontFamily: "Inter, system-ui, sans-serif",
				}}>
				{/* Canvas area — vertically centered in remaining space */}
				<div
					style={{
						flex: 1,
						width: "100%",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						overflow: "hidden",
						minHeight: 0,
					}}>
					<div
						ref={canvasRef}
						style={{
							width,
							height,
							background,
							position: "relative",
							transform: `scale(${scale})`,
							transformOrigin: "center",
							flexShrink: 0,
							overflow: "hidden",
						}}>
						<TimelineContext.Provider value={ctxValue}>
							{children}
						</TimelineContext.Provider>
					</div>
				</div>

				{/* Playback bar — stacked below canvas, never overlapping */}
				{false && (
					<PlaybackBar
						time={displayTime}
						actualTime={time}
						duration={duration}
						playing={playing}
						onPlayPause={() => {
							if (!active) return;
							setPlaying((p) => !p);
						}}
						onReset={() => {
							setTime(0);
						}}
						onSeek={(t) => {
							if (!active) return;
							setTime(t);
						}}
						onHover={(t) => setHoverTime(t)}
					/>
				)}
			</div>
		);
	}

	// ── Playback bar ────────────────────────────────────────────────────────────
	// Play/pause, return-to-begin, scrub track, time display.
	// Uses fixed-width time fields so layout doesn't thrash.

	function PlaybackBar({
		time,
		duration,
		playing,
		onPlayPause,
		onReset,
		onSeek,
		onHover,
	}) {
		const trackRef = React.useRef(null);
		const [dragging, setDragging] = React.useState(false);

		const timeFromEvent = React.useCallback(
			(e) => {
				const rect = trackRef.current.getBoundingClientRect();
				const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
				return x * duration;
			},
			[duration],
		);

		const onTrackMove = (e) => {
			if (!trackRef.current) return;
			const t = timeFromEvent(e);
			if (dragging) {
				onSeek(t);
			} else {
				onHover(t);
			}
		};

		const onTrackLeave = () => {
			if (!dragging) onHover(null);
		};

		const onTrackDown = (e) => {
			setDragging(true);
			const t = timeFromEvent(e);
			onSeek(t);
			onHover(null);
		};

		React.useEffect(() => {
			if (!dragging) return;
			const onUp = () => setDragging(false);
			const onMove = (e) => {
				if (!trackRef.current) return;
				const t = timeFromEvent(e);
				onSeek(t);
			};
			window.addEventListener("mouseup", onUp);
			window.addEventListener("mousemove", onMove);
			return () => {
				window.removeEventListener("mouseup", onUp);
				window.removeEventListener("mousemove", onMove);
			};
		}, [dragging, timeFromEvent, onSeek]);

		const pct = duration > 0 ? (time / duration) * 100 : 0;
		const fmt = (t) => {
			const total = Math.max(0, t);
			const m = Math.floor(total / 60);
			const s = Math.floor(total % 60);
			const cs = Math.floor((total * 100) % 100);
			return `${String(m).padStart(1, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
		};

		const mono = "JetBrains Mono, ui-monospace, SFMono-Regular, monospace";

		return (
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 12,
					padding: "8px 16px",
					background: "rgba(20,20,20,0.92)",
					borderTop: "1px solid rgba(255,255,255,0.08)",
					width: "100%",
					maxWidth: 680,
					alignSelf: "center",

					borderRadius: 8,
					color: "#f6f4ef",
					fontFamily: "Inter, system-ui, sans-serif",
					userSelect: "none",
					flexShrink: 0,
				}}>
				<IconButton
					onClick={onReset}
					title='Return to start (0)'>
					<svg
						width='14'
						height='14'
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
				</IconButton>
				<IconButton
					onClick={onPlayPause}
					title='Play/pause (space)'>
					{playing ? (
						<svg
							width='14'
							height='14'
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
							width='14'
							height='14'
							viewBox='0 0 14 14'
							fill='none'>
							<path
								d='M3 2l9 5-9 5V2z'
								fill='currentColor'
							/>
						</svg>
					)}
				</IconButton>

				{/* Current time: fixed width so it doesn't thrash */}
				<div
					style={{
						fontFamily: mono,
						fontSize: 12,
						fontVariantNumeric: "tabular-nums",
						width: 64,
						textAlign: "right",
						color: "#f6f4ef",
					}}>
					{fmt(time)}
				</div>

				{/* Scrub track */}
				<div
					ref={trackRef}
					onMouseMove={onTrackMove}
					onMouseLeave={onTrackLeave}
					onMouseDown={onTrackDown}
					style={{
						flex: 1,
						height: 22,
						position: "relative",
						cursor: "pointer",
						display: "flex",
						alignItems: "center",
					}}>
					<div
						style={{
							position: "absolute",
							left: 0,
							right: 0,
							height: 4,
							background: "rgba(255,255,255,0.12)",
							borderRadius: 2,
						}}
					/>
					<div
						style={{
							position: "absolute",
							left: 0,
							width: `${pct}%`,
							height: 4,
							background: "oklch(72% 0.12 250)",
							borderRadius: 2,
						}}
					/>
					<div
						style={{
							position: "absolute",
							left: `${pct}%`,
							top: "50%",
							width: 12,
							height: 12,
							marginLeft: -6,
							marginTop: -6,
							background: "#fff",
							borderRadius: 6,
							boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
						}}
					/>
				</div>

				{/* Duration: fixed width */}
				<div
					style={{
						fontFamily: mono,
						fontSize: 12,
						fontVariantNumeric: "tabular-nums",
						width: 64,
						textAlign: "left",
						color: "rgba(246,244,239,0.55)",
					}}>
					{fmt(duration)}
				</div>
			</div>
		);
	}

	function IconButton({ children, onClick, title }) {
		const [hover, setHover] = React.useState(false);
		return (
			<button
				onClick={onClick}
				title={title}
				onMouseEnter={() => setHover(true)}
				onMouseLeave={() => setHover(false)}
				style={{
					width: 28,
					height: 28,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					background: hover
						? "rgba(255,255,255,0.12)"
						: "rgba(255,255,255,0.04)",
					border: "1px solid rgba(255,255,255,0.1)",
					borderRadius: 6,
					color: "#f6f4ef",
					cursor: "pointer",
					padding: 0,
					transition: "background 120ms",
				}}>
				{children}
			</button>
		);
	}

	Object.assign(window, {
		Easing,
		interpolate,
		animate,
		clamp,
		TimelineContext,
		useTime,
		useTimeline,
		Sprite,
		SpriteContext,
		useSprite,
		TextSprite,
		ImageSprite,
		RectSprite,
		Stage,
		PlaybackBar,
	});

	// @ds-adherence-ignore -- animation scene code (raw elements/hex/px by design)
	// NAV FLOW — Sintesis "real navigation" extraction journey.
	// Concatenated AFTER animations.jsx, so Stage, Sprite, useTime, Easing,
	// interpolate, animate, clamp are already in lexical scope. Do NOT redeclare them.
	//
	// One continuous 14.5s sequence with bridge-object transitions:
	//   Tus Obras (row) → Obra detail (header)  ·  Folder → grid  ·  Document → preview
	// Everything is laid out at fixed coordinates; bridges interpolate between known
	// rects (deterministic, smooth under the scrubber) — the visual intent of the
	// "clones medidos con getBoundingClientRect" spec.

	// ── cubic-bezier easing (the spec's motion tokens) ──────────────────────────
	function cubicBezier(x1, y1, x2, y2) {
		const cx = 3 * x1,
			bx = 3 * (x2 - x1) - cx,
			ax = 1 - cx - bx;
		const cy = 3 * y1,
			by = 3 * (y2 - y1) - cy,
			ay = 1 - cy - by;
		const sx = (t) => ((ax * t + bx) * t + cx) * t;
		const sy = (t) => ((ay * t + by) * t + cy) * t;
		const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
		return (p) => {
			if (p <= 0) return 0;
			if (p >= 1) return 1;
			let t = p;
			for (let i = 0; i < 6; i++) {
				const x = sx(t) - p;
				const d = dx(t);
				if (Math.abs(x) < 1e-4) break;
				if (Math.abs(d) < 1e-6) break;
				t -= x / d;
			}
			return sy(Math.max(0, Math.min(1, t)));
		};
	}
	const easeOut = cubicBezier(0.23, 1, 0.32, 1);
	const easeInOut = cubicBezier(0.77, 0, 0.175, 1);
	const easeDrawer = cubicBezier(0.32, 0.72, 0, 1);

	// ── palette (Sintesis tokens as literals) ───────────────────────────────────
	const NC = {
		bg: "#e7e5e4",
		canvas: "#faf9f700",
		sidebar: "#f0efea",
		white: "#ffffff",
		s50: "#fafaf9",
		s100: "#f5f5f4",
		s200: "#e7e5e4",
		s300: "#d6d3d1",
		s400: "#a8a29e",
		s500: "#78716c",
		s600: "#57534e",
		s700: "#44403c",
		s800: "#292524",
		s900: "#1c1917",
		border: "rgba(13,13,13,0.08)",
		orange: "#ff5800",
		orange600: "#ea580c",
		orange400: "#fb923c",
		orange50: "#fff7ed",
		orange100: "#ffedd5",
		green: "#16a34a",
		blue: "#2563eb",
		purple: "#7c3aed",
		red: "#dc2626",
	};
	const NS = '"Geist", system-ui, sans-serif';
	const NM = '"Geist Mono", ui-monospace, monospace';
	const lerp = (a, b, t) => a + (b - a) * t;

	// ── stage geometry ──────────────────────────────────────────────────────────
	const W = 1440,
		H = 944;
	const SIDE = 0,
		TOP = 0,
		CX = 0;

	// Tus Obras table
	const TBL_X = 128,
		TBL_Y = 154,
		TBL_W = 1184,
		HEAD_H = 62,
		ROW_H = 54;
	const COLS = [
		{ k: "n", label: "N", w: 74, mono: true },
		{ k: "obra", label: "DESIGNACION Y UBICACION", w: 430 },
		{ k: "esp", label: "ESPECIALIDAD", w: 200 },
		{ k: "ent", label: "ENTIDAD CONTRATANTE", w: 270 },
		{ k: "av", label: "AVANCE", w: 210 },
	];
	const OBRAS = [
		{
			n: 1,
			obra: "Acceso Norte — Etapa II",
			sup: "1.840",
			esp: "Vialidad",
			ent: "Vialidad Provincial",
			av: 72,
		},
		{
			n: 2,
			obra: "Escuela Técnica N° 4",
			sup: "2.120",
			esp: "Arquitectura",
			ent: "MOySP",
			av: 45,
		},
		{
			n: 3,
			obra: "Ruta Prov. 12 — Tramo III",
			sup: "3.560",
			esp: "Vialidad",
			ent: "Vialidad Provincial",
			av: 38,
		},
		{
			n: 4,
			obra: "Hospital Modular Saladas",
			sup: "1.275",
			esp: "Arquitectura",
			ent: "Min. Salud",
			av: 61,
		},
		{
			n: 5,
			obra: "Planta Potabilizadora Sur",
			sup: "980",
			esp: "Hidráulica",
			ent: "AySA",
			av: 23,
		},
		{
			n: 6,
			obra: "Defensa Costera Río Paraná",
			sup: "2.450",
			esp: "Hidráulica",
			ent: "MOySP",
			av: 54,
		},
		{
			n: 7,
			obra: "Pavimentación B° Belgrano",
			sup: "1.610",
			esp: "Vialidad",
			ent: "Municipio",
			av: 88,
		},
		{
			n: 8,
			obra: "Red Cloacal Sector 7",
			sup: "720",
			esp: "Hidráulica",
			ent: "AySA",
			av: 12,
		},
	];
	const TARGET = 2;
	const TABLE_COLS = [
		{ k: "n", label: "N", w: 76, mono: true },
		{ k: "obra", label: "DESIGNACION Y UBICACION", w: 390 },
		{ k: "ent", label: "ENTIDAD CONTRATANTE", w: 180 },
		{ k: "fecha", label: "Iniciacion", w: 200 },
		{ k: "cert", label: "Certificado a la Fecha", w: 190, mono: true },
		{ k: "saldo", label: "Saldo a Certificar", w: 170, mono: true },
		{ k: "av", label: "% AVANCE", w: 202 },
	];
	const TABLE_ROWS = [
		{
			n: 1,
			obra: "LICITACION PRIVADA N 01/2016 - OBRA NUEVA - SECTOR I Y SECTOR II - ETAPA I",
			ent: "S.U.E.P",
			entTone: "blue",
			fecha: "28/1/2017",
			cert: "27.900.000,33",
			saldo: "0,00",
			av: 100,
		},
		{
			n: 2,
			obra: "CENTRO INTERPRETACION JESUITICO GUARANI",
			ent: "MOySP",
			entTone: "blue",
			fecha: "25/6/2020",
			cert: "24.055.568,41",
			saldo: "0,00",
			av: 100,
		},
		{
			n: 3,
			obra: "Ruta Prov. 12 - Tramo III",
			ent: "Vialidad Prov.",
			entTone: "blue",
			fecha: "24/7/2020",
			cert: "0,00",
			saldo: "0,00",
			av: 100,
		},
		{
			n: 4,
			obra: "HOSPITAL SAN ANTONIO DE PADUA - LA CRUZ",
			ent: "MOySP",
			entTone: "blue",
			fecha: "8/3/2021",
			cert: "0,00",
			saldo: "0,00",
			av: 100,
		},
		{
			n: 5,
			obra: "CONSTRUCCION DE 15 VIVIENDAS O.C. PROV. TERRENO URB. Y OB. INFR. P.",
			ent: "IN.VI.CO",
			entTone: "cyan",
			fecha: "1/7/2020",
			cert: "48.548.405,16",
			saldo: "0,00",
			av: 100,
		},
		{
			n: 6,
			obra: "CONSTRUCCION DE 20 VIVIENDAS, O. C., PROV. TERRENO DONDE SE EJECUTA",
			ent: "IN.VI.CO",
			entTone: "cyan",
			fecha: "1/2/2021",
			cert: "81.313.032,59",
			saldo: "0,00",
			av: 100,
		},
		{
			n: 7,
			obra: "CONSTRUCCION DE 20 VIVIENDAS, O. C. PROPIAS DEL CONJ. - MOCORETA",
			ent: "IN.VI.CO",
			entTone: "cyan",
			fecha: "23/2/2022",
			cert: "0,00",
			saldo: "0,00",
			av: 100,
		},
		{
			n: 8,
			obra: "LIC. PRIV N 01/2021 - ACONDICIONAMIENTO AMPLIACION TERMINACIONAL",
			ent: "Min. Seguridad",
			entTone: "blue",
			fecha: "1/7/2021",
			cert: "49.910.000,00",
			saldo: "0,00",
			av: 100,
		},
		{
			n: 9,
			obra: "PROYECTO DE OBRA JARDIN MATERNAL A EJECUTARSE EN LA CRUZ, PROV.",
			ent: "MOySP",
			entTone: "blue",
			fecha: "17/9/2021",
			cert: "123.127.356,00",
			saldo: "0,00",
			av: 100,
		},
		{
			n: 10,
			obra: "LICITACION PUBLICA N 07/2021 - CONSTRUCCION JIN N 36 EN ESCUELA",
			ent: "Min. Edu. Nac",
			entTone: "blue",
			fecha: "2/3/2022",
			cert: "59.999.999,80",
			saldo: "0,00",
			av: 100,
		},
		{
			n: 11,
			obra: "LIC.PUBLICA N 02/2021 - JIN EN ESC.419 - COLONIA SAN ANTONIO - ITUZ.",
			ent: "Min. Edu. Nac",
			entTone: "blue",
			fecha: "29/9/2021",
			cert: "61.716.829,97",
			saldo: "0,00",
			av: 100,
		},
		{
			n: 12,
			obra: "LIC. PRIVADA 06/22 - CONSTRUCCION DEL MODULO 3 DEL CENTRO DE FORM.",
			ent: "Min. Educacion",
			entTone: "green",
			fecha: "15/9/2022",
			cert: "75.474.246,43",
			saldo: "0,00",
			av: 100,
		},
		{
			n: 13,
			obra: "LICITACION PRIVADA N 05/22 - CONSTRUCCION DE INSTITUTO DE FORM.",
			ent: "Min. Edu. Infraest.",
			entTone: "blue",
			fecha: "15/9/2022",
			cert: "134.300.043,70",
			saldo: "0,00",
			av: 100,
		},
		{
			n: 14,
			obra: "COMP. DE PRECIOS N: PRINI II - ME-074-CP-O- JARDIN A CREAR - JUAN P.",
			ent: "Min. Educacion",
			entTone: "green",
			fecha: "21/12/2023",
			cert: "256.906.886,50",
			saldo: "0,00",
			av: 100,
		},
		{
			n: 15,
			obra: "OBRA: AMPLIACION Y REFUNCIONALIZACION DEL COLEGIO SECUNDARIO",
			ent: "Min. Educacion",
			entTone: "green",
			fecha: "27/10/2022",
			cert: "262.087.918,74",
			saldo: "0,00",
			av: 100,
		},
	];
	const FAKE_TABLE_COLS = [
		{ k: "n", label: "N", w: 74, mono: true },
		{ k: "obra", label: "DESIGNACION Y UBICACION", w: 430 },
		{ k: "esp", label: "ESPECIALIDAD", w: 200 },
		{ k: "ent", label: "ENTIDAD CONTRATANTE", w: 270 },
		{ k: "av", label: "AVANCE", w: 210 },
	];
	const FAKE_TABLE_ROWS = OBRAS;
	const colX = (() => {
		const xs = [];
		let acc = TBL_X;
		for (const c of FAKE_TABLE_COLS) {
			xs.push(acc);
			acc += c.w;
		}
		return xs;
	})();
	const targetRowTop = TBL_Y + HEAD_H + TARGET * ROW_H;

	// Detail header destination rects (stage coords)
	const HDR_NUM = { x: 70, y: 36, fs: 30 };
	const HDR_TITLE = { x: 116, y: 36, fs: 21 };

	// Documents content geometry
	const TREE_W = 0;
	const DOC_X = 36;
	const DETAIL_TABS_Y = 92;
	const BODY_Y = DETAIL_TABS_Y + 44 + 16;
	const DOC_HEAD_Y = BODY_Y + 26;
	const FOLDERS_Y = BODY_Y + 92;
	const FOLDER_W = 208,
		FOLDER_GAP = 32,
		FOLDER_H = 158;
	const FOLDERS = [
		{ k: "cert", name: "Certificados", tone: "orange" },
		{ k: "oc", name: "Órdenes de compra", tone: "dark" },
		{ k: "fotos", name: "Fotos de obra", tone: "dark" },
		{ k: "curva", name: "Curva de avance", tone: "dark" },
		{ k: "fact", name: "Facturas", tone: "orange" },
	];
	const FOLDER_ITEMS = [
		{ k: "cert", name: "Certificados", tone: "dark" },
		{ k: "doc", name: "Documentac...", tone: "dark" },
		{ k: "oferta", name: "Oferta", tone: "dark" },
		{ k: "oc", name: "Ordenes de C...", tone: "orange" },
		{ k: "polizas", name: "Polizas", tone: "dark" },
	];
	const FTARGET = 3;
	const folderX = (i) => DOC_X + i * (FOLDER_W + FOLDER_GAP);
	const folderCenter = (i) => ({
		x: folderX(i) + FOLDER_W / 2,
		y: FOLDERS_Y + FOLDER_H / 2,
	});
	const OPEN_ICON = { x: DOC_X + 16, y: DOC_HEAD_Y + 18 }; // header folder-icon spot

	// Document grid
	const GRID_Y = FOLDERS_Y;
	const CW = 120,
		CH = 145,
		CARD_GAP = 24;
	const gridPos = (i) => ({
		x: DOC_X + (i % 7) * (CW + CARD_GAP),
		y: GRID_Y + Math.floor(i / 7) * (CH + CARD_GAP),
	});
	const FILES = [
		{ name: "Factura_Aceros_14-05.pdf", sub: "Aceros del Litoral · 1,2 MB" },
		{ name: "OC_Validez_Provincial.pdf", sub: "Vialidad Prov. · 0,8 MB" },
		{ name: "Remito_Hormigones_12-05.pdf", sub: "Hormigones SRL · 1,1 MB" },
		{ name: "Factura_Hierros_09-05.pdf", sub: "Hierros del Sur · 0,9 MB" },
		{ name: "Factura_Cemento_07-05.pdf", sub: "Cementos Andinos · 1,4 MB" },
		{ name: "Remito_Aridos_05-05.pdf", sub: "Áridos del Norte · 0,7 MB" },
	];

	// Preview sheet
	const SHEET_L = 96,
		SHEET_T = 72,
		SHEET_W = W - SHEET_L * 2,
		SHEET_HEAD = 66;
	const VIEW_CY = SHEET_T + SHEET_HEAD + (H - SHEET_T - SHEET_HEAD) / 2; // viewer center y
	const VIEW_CX = W / 2;

	// PDF natural page size
	const PG_W = 360,
		PG_H = 466;

	// ── tiny stroke icons ────────────────────────────────────────────────────────
	function Ic({ d, size = 16, color = "currentColor", sw = 2, fill = "none" }) {
		return (
			<svg
				width={size}
				height={size}
				viewBox='0 0 24 24'
				fill={fill}
				stroke={color}
				strokeWidth={sw}
				strokeLinecap='round'
				strokeLinejoin='round'
				style={{ display: "block" }}>
				{d}
			</svg>
		);
	}
	const dChevL = <polyline points='15 18 9 12 15 6' />;
	const dChevR = <polyline points='9 18 15 12 9 6' />;
	const dChevD = <polyline points='6 9 12 15 18 9' />;
	const dSearch = (
		<>
			<circle
				cx='11'
				cy='11'
				r='8'
			/>
			<line
				x1='21'
				y1='21'
				x2='16.65'
				y2='16.65'
			/>
		</>
	);
	const dDownload = (
		<>
			<path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
			<polyline points='7 10 12 15 17 10' />
			<line
				x1='12'
				y1='15'
				x2='12'
				y2='3'
			/>
		</>
	);
	const dFolder = (
		<path d='M4 20a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3l2 3h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2z' />
	);
	const dFile = (
		<>
			<path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
			<polyline points='14 2 14 8 20 8' />
		</>
	);
	const dArrowOut = (
		<>
			<line
				x1='7'
				y1='17'
				x2='17'
				y2='7'
			/>
			<polyline points='7 7 17 7 17 17' />
		</>
	);
	const dSort = (
		<>
			<polyline points='7 15 12 20 17 15' />
			<polyline points='7 9 12 4 17 9' />
		</>
	);
	const dHome = (
		<>
			<path d='m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' />
			<polyline points='9 22 9 12 15 12 15 22' />
		</>
	);
	const dDb = (
		<>
			<ellipse
				cx='12'
				cy='5'
				rx='9'
				ry='3'
			/>
			<path d='M3 5v14a9 3 0 0 0 18 0V5' />
			<path d='M3 12a9 3 0 0 0 18 0' />
		</>
	);
	const dTable = (
		<>
			<rect
				x='3'
				y='3'
				width='18'
				height='18'
				rx='2'
			/>
			<path d='M3 9h18M3 15h18M9 3v18M15 3v18' />
		</>
	);
	const dBuilding = (
		<>
			<rect
				x='4'
				y='2'
				width='16'
				height='20'
				rx='2'
			/>
			<path d='M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01' />
		</>
	);
	const dBell = (
		<>
			<path d='M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9' />
			<path d='M10.3 21a1.94 1.94 0 0 0 3.4 0' />
		</>
	);
	const dBranch = (
		<>
			<line
				x1='6'
				y1='3'
				x2='6'
				y2='15'
			/>
			<circle
				cx='18'
				cy='6'
				r='3'
			/>
			<circle
				cx='6'
				cy='18'
				r='3'
			/>
			<path d='M18 9a9 9 0 0 1-9 9' />
		</>
	);
	const dShield = <path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' />;
	const dX = (
		<>
			<line
				x1='18'
				y1='6'
				x2='6'
				y2='18'
			/>
			<line
				x1='6'
				y1='6'
				x2='18'
				y2='18'
			/>
		</>
	);
	const dDataList = (
		<>
			<line
				x1='8'
				y1='6'
				x2='21'
				y2='6'
			/>
			<line
				x1='8'
				y1='12'
				x2='21'
				y2='12'
			/>
			<line
				x1='8'
				y1='18'
				x2='21'
				y2='18'
			/>
			<line
				x1='3'
				y1='6'
				x2='3.01'
				y2='6'
			/>
			<line
				x1='3'
				y1='12'
				x2='3.01'
				y2='12'
			/>
			<line
				x1='3'
				y1='18'
				x2='3.01'
				y2='18'
			/>
		</>
	);

	// ════════════════════════════════════════════════════════════════════════════
	// APP CHROME — left sidebar + topbar (persistent)
	// ════════════════════════════════════════════════════════════════════════════
	function Sidebar() {
		const nav = [
			{ ic: dHome, l: "Dashboard" },
			{ ic: dDb, l: "Excel", on: true },
			{ ic: dTable, l: "Tablas" },
			{ ic: dBuilding, l: "Obras" },
			{ ic: dFolder, l: "Documentos" },
			{ ic: dBell, l: "Alertas", badge: 3 },
		];
		return (
			<div
				style={{
					position: "absolute",
					left: 0,
					top: 0,
					bottom: 0,
					width: SIDE,
					background: NC.sidebar,
					borderRight: "1px solid rgba(220,213,203,.6)",
					padding: 14,
					boxSizing: "border-box",
					display: "flex",
					flexDirection: "column",
					gap: 12,
				}}>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 10,
						padding: "6px 8px",
					}}>
					<div
						style={{
							width: 30,
							height: 30,
							borderRadius: "50%",
							background: NC.orange,
						}}
					/>
					<div>
						<div
							style={{
								fontFamily: NM,
								fontWeight: 600,
								fontSize: 16,
								color: NC.s900,
								lineHeight: 1,
							}}>
							Sintesis
						</div>
						<div style={{ fontSize: 10, color: NC.s500, marginTop: 3 }}>
							Plataforma de gestión
						</div>
					</div>
				</div>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						padding: "8px 10px",
						background: "rgba(255,255,255,.55)",
						border: "1px solid rgba(220,213,203,.9)",
						borderRadius: 7,
					}}>
					<div>
						<div style={{ fontSize: 9.5, color: NC.s500 }}>Organización</div>
						<div style={{ fontSize: 12, fontWeight: 500, color: NC.s800 }}>
							Constructora Norte S.A.
						</div>
					</div>
					<Ic
						d={dChevD}
						size={14}
						color={NC.s500}
					/>
				</div>
				<div
					style={{
						fontSize: 9.5,
						textTransform: "uppercase",
						letterSpacing: ".15em",
						color: NC.s500,
						fontWeight: 700,
						padding: "8px 10px 2px",
					}}>
					Principal
				</div>
				{nav.map((n, i) => (
					<div
						key={i}
						style={{
							display: "flex",
							alignItems: "center",
							gap: 10,
							padding: "8px 10px",
							borderRadius: 7,
							marginTop: i === 0 ? 0 : -6,
							background: n.on ? NC.white : "transparent",
							boxShadow: n.on ? "0 1px 0 rgba(0,0,0,.04)" : "none",
							color: n.on ? NC.s900 : NC.s700,
							fontSize: 13,
						}}>
						<span
							style={{
								color: n.on ? NC.s900 : NC.s500,
								display: "inline-flex",
							}}>
							<Ic
								d={n.ic}
								size={17}
							/>
						</span>
						<span>{n.l}</span>
						{n.badge && (
							<span
								style={{
									marginLeft: "auto",
									background: "#c9323a",
									color: "#fff",
									borderRadius: 99,
									padding: "1px 6px",
									fontSize: 10,
									fontWeight: 700,
								}}>
								{n.badge}
							</span>
						)}
					</div>
				))}
				<div
					style={{
						marginTop: "auto",
						padding: 10,
						borderTop: "1px solid rgba(220,213,203,.6)",
						display: "flex",
						alignItems: "center",
						gap: 10,
					}}>
					<div
						style={{
							width: 28,
							height: 28,
							borderRadius: "50%",
							background: NC.s700,
							color: "#fff",
							fontSize: 11,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}>
						IL
					</div>
					<div>
						<div style={{ fontSize: 12, fontWeight: 500, color: NC.s800 }}>
							Ignacio L.
						</div>
						<div style={{ fontSize: 10, color: NC.s500 }}>
							ignacio@constnorte.ar
						</div>
					</div>
				</div>
			</div>
		);
	}

	function Topbar({ detailOp }) {
		return (
			<div
				style={{
					position: "absolute",
					left: CX,
					right: 0,
					top: 0,
					height: TOP,
					background: NC.white,
					borderBottom: `1px solid ${NC.s200}`,
					display: "flex",
					alignItems: "center",
					padding: "0 24px",
				}}>
				<div
					style={{
						position: "relative",
						fontSize: 13,
						color: NC.s500,
						height: 18,
						flex: 1,
					}}>
					<span style={{ position: "absolute", opacity: 1 - detailOp }}>
						Excel <span style={{ color: NC.s300, margin: "0 6px" }}>/</span>{" "}
						<span style={{ color: NC.s900, fontWeight: 600 }}>Tus Obras</span>
					</span>
					<span style={{ position: "absolute", opacity: detailOp }}>
						Obras <span style={{ color: NC.s300, margin: "0 6px" }}>/</span>{" "}
						Ruta Prov. 12{" "}
						<span style={{ color: NC.s300, margin: "0 6px" }}>/</span>{" "}
						<span style={{ color: NC.s900, fontWeight: 600 }}>Documentos</span>
					</span>
				</div>
				<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: 7,
							height: 32,
							padding: "0 12px 0 32px",
							borderRadius: 6,
							border: `1px solid ${NC.s200}`,
							fontSize: 12,
							color: NC.s400,
							position: "relative",
							width: 240,
						}}>
						<span style={{ position: "absolute", left: 10 }}>
							<Ic
								d={dSearch}
								size={14}
								color={NC.s400}
							/>
						</span>
						Buscar obra, certificado…
					</div>
					<div
						style={{
							fontSize: 11,
							fontWeight: 700,
							letterSpacing: ".12em",
							color: NC.s400,
						}}>
						DEMO
					</div>
					<div
						style={{
							width: 30,
							height: 30,
							borderRadius: "50%",
							background: NC.s200,
						}}
					/>
				</div>
			</div>
		);
	}

	// ════════════════════════════════════════════════════════════════════════════
	// TUS OBRAS — table screen
	// ════════════════════════════════════════════════════════════════════════════
	function AvanceBar({ v, dim }) {
		return (
			<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
				<div
					style={{
						flex: 1,
						height: 6,
						background: NC.s100,
						borderRadius: 99,
						overflow: "hidden",
					}}>
					<div
						style={{
							height: "100%",
							width: `${v}%`,
							background: dim ? NC.s400 : "#0891b2",
							borderRadius: 99,
						}}
					/>
				</div>
				<span
					style={{
						width: 30,
						textAlign: "right",
						fontSize: 10.5,
						color: NC.s600,
						fontVariantNumeric: "tabular-nums",
					}}>
					{v}%
				</span>
			</div>
		);
	}

	function TusObras({ t }) {
		// row attention pulse (≈420ms, once)
		const pulseRise = clamp((t - 0.35) / 0.42, 0, 1);
		const pulseFall = 1 - clamp((t - 0.95) / 0.5, 0, 1);
		const pulse = easeOut(pulseRise) * pulseFall;
		// hover (cursor arrives ~2.2)
		const hover = clamp((t - 1.7) / 0.45, 0, 1);
		const selected = t >= 2.2 ? 1 : 0;
		// click feedback 2.2–2.45
		const press =
			clamp((t - 2.2) / 0.12, 0, 1) * (1 - clamp((t - 2.34) / 0.12, 0, 1));
		// once the bridge starts the target row's bridging cells are hidden (the clone takes over)
		const bridging = t >= 2.45;

		const colPct = (c) => (c.w / TBL_W) * 100;
		const tableHeight = HEAD_H + OBRAS.length * ROW_H;
		const denseRows = FAKE_TABLE_ROWS;
		const denseColumns = FAKE_TABLE_COLS;
		const denseTableHeight = HEAD_H + denseRows.length * ROW_H;
		const localX = (i) => colX[i] - TBL_X;
		const colW = (i) => denseColumns[i].w;
		const HeaderMainCell = ({ i, label, center = false }) => (
			<div
				style={{
					position: "absolute",
					left: localX(i),
					top: 0,
					width: colW(i),
					height: HEAD_H,
					borderRight:
						i < denseColumns.length - 1 ? "1px solid #d9d9d9" : "none",
					display: "flex",
					alignItems: "center",
					justifyContent: center ? "center" : "space-between",
					padding: "0 18px",
					boxSizing: "border-box",
					fontSize: 17.5,
					fontWeight: 650,
					color: "#111827",
				}}>
				<span>{label}</span>
				<Ic
					d={dSort}
					size={15}
					color={NC.s500}
				/>
			</div>
		);
		const HeaderGroup = ({ left, width, label }) => (
			<div
				style={{
					position: "absolute",
					left,
					top: 0,
					width,
					height: 31,
					borderRight: "1px solid #d9d9d9",
					borderBottom: "1px solid #d9d9d9",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontSize: 13,
					fontWeight: 750,
					color: "#000",
				}}>
				{label}
			</div>
		);
		const HeaderSubCell = ({ i, label }) => (
			<div
				style={{
					position: "absolute",
					left: localX(i),
					top: 31,
					width: colW(i),
					height: HEAD_H - 31,
					borderRight:
						i < denseColumns.length - 1 ? "1px solid #d9d9d9" : "none",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					padding: "0 16px",
					boxSizing: "border-box",
					fontSize: 12,
					fontWeight: 600,
					color: NC.s700,
				}}>
				<span>{label}</span>
				<Ic
					d={dSort}
					size={14}
					color={NC.s500}
				/>
			</div>
		);
		const EntityPill = ({ row }) => {
			const tones = {
				blue: { bg: "#eff6ff", bd: "#bfdbfe", fg: "#0f172a", dot: "#1d4ed8" },
				cyan: { bg: "#dbeafe", bd: "#93c5fd", fg: "#1e3a8a", dot: "#2563eb" },
				green: { bg: "#d1fae5", bd: "#6ee7b7", fg: "#065f46", dot: "#059669" },
			};
			const tone = tones[row.entTone] || tones.blue;
			return (
				<span
					style={{
						display: "inline-flex",
						alignItems: "center",
						gap: 7,
						maxWidth: 142,
						height: 20,
						padding: "0 9px",
						borderRadius: 99,
						border: `1px solid ${tone.bd}`,
						background: tone.bg,
						color: tone.fg,
						fontSize: 12,
						fontWeight: 500,
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
					}}>
					<span
						style={{
							width: 10,
							height: 10,
							borderRadius: 99,
							border: `1.5px solid ${tone.dot}`,
							flex: "0 0 auto",
						}}
					/>
					<span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
						{row.ent}
					</span>
				</span>
			);
		};

		return (
			<div style={{ position: "absolute", inset: 0, background: "#fafafa" }}>
				<div style={{ position: "absolute", left: TBL_X, top: 76 }}>
					<div
						style={{
							fontFamily: NS,
							fontSize: 42,
							fontWeight: 500,
							lineHeight: 1,
							letterSpacing: "-.02em",
							color: "#111827",
						}}>
						Tus Obras
					</div>
					<div style={{ marginTop: 9, fontSize: 15, color: "#8b8b95" }}>
						Filtra, busca y actualiza tus obras desde una vista unificada.
					</div>
				</div>

				<div
					style={{
						position: "absolute",
						right: W - TBL_X - TBL_W,
						top: 72,
						height: 50,
						display: "inline-flex",
						alignItems: "center",
						gap: 4,
						padding: 5,
						borderRadius: 12,
						border: "1px solid #d9d9d9",
						background: "#f5f5f5",
					}}>
					{[
						["Todas", "101", true],
						["En proceso", "10", false],
						["Completadas", "91", false],
					].map(([label, count, active]) => (
						<span
							key={label}
							style={{
								height: 40,
								minWidth: active ? 106 : 116,
								display: "inline-flex",
								alignItems: "center",
								justifyContent: "center",
								gap: 10,
								padding: "0 15px",
								borderRadius: 9,
								border: active ? "1px solid #ea580c" : "1px solid #d6d3d1",
								background: active ? NC.orange : NC.white,
								color: active ? NC.white : "#030712",
								fontSize: 13,
								fontWeight: 750,
								boxShadow: active
									? "0 9px 18px rgba(255,88,0,.25)"
									: "0 2px 5px rgba(28,25,23,.07)",
							}}>
							{label}
							<b
								style={{
									minWidth: 26,
									height: 21,
									display: "inline-flex",
									alignItems: "center",
									justifyContent: "center",
									borderRadius: 99,
									background: active ? "rgba(153,45,0,.28)" : NC.s200,
									color: active ? NC.white : NC.s600,
									fontSize: 11,
									fontWeight: 800,
								}}>
								{count}
							</b>
						</span>
					))}
				</div>

				<div
					style={{
						position: "absolute",
						left: TBL_X,
						top: TBL_Y,
						width: TBL_W,
						height: denseTableHeight,
						border: "1px solid #d9d9d9",
						borderRadius: 8,
						background: NC.white,
						overflow: "hidden",
						boxShadow: "0 12px 24px rgba(28,25,23,.06)",
					}}>
					<div
						style={{
							position: "relative",
							height: HEAD_H,
							background: "#f0f0f0",
							borderBottom: "1px solid #d9d9d9",
						}}>
						{denseColumns.map((c, i) => (
							<HeaderMainCell
								key={c.k}
								i={i}
								label={c.label}
							/>
						))}
					</div>

					{denseRows.map((r, i) => {
						const isT = i === TARGET;
						const aLvl = isT
							? Math.max(pulse * 0.65, hover * 0.55, selected * 0.38)
							: 0;
						const bg =
							aLvl > 0.01
								? `rgba(255,88,0,${0.11 * aLvl})`
								: i % 2
									? "#fbfbfb"
									: "#fff";
						const scaleY = isT ? 1 - press * 0.012 : 1;
						return (
							<div
								key={r.n}
								style={{
									height: ROW_H,
									display: "flex",
									alignItems: "center",
									borderBottom:
										i < denseRows.length - 1 ? "1px solid #d9d9d9" : "none",
									background: bg,
									transform: `scaleY(${scaleY})`,
									transformOrigin: "center",
									boxShadow:
										isT && aLvl > 0.02
											? `inset 0 0 0 1px rgba(255,88,0,${0.22 * aLvl})`
											: "none",
								}}>
								{denseColumns.map((c, ci) => {
									const hideForBridge =
										isT && bridging && (c.k === "n" || c.k === "obra");
									return (
										<div
											key={c.k}
											style={{
												width: c.w,
												height: "100%",
												borderRight:
													ci < denseColumns.length - 1
														? "1px solid #e4e4e7"
														: "none",
												display: "flex",
												alignItems: "center",
												padding: c.k === "av" ? "0 28px 0 14px" : "0 14px",
												boxSizing: "border-box",
												opacity: hideForBridge ? 0 : 1,
												overflow: "hidden",
											}}>
											{c.k === "n" && (
												<span
													style={{
														fontFamily: NM,
														fontSize: 16.5,
														color: "#030712",
													}}>
													{r.n}
												</span>
											)}
											{c.k === "obra" && (
												<span
													style={{
														minWidth: 0,
														display: "inline-flex",
														alignItems: "center",
														gap: 10,
													}}>
													<span
														style={{
															width: 26,
															height: 26,
															borderRadius: 6,
															border: "1px solid #d6d3d1",
															color: NC.s500,
															display: "inline-flex",
															alignItems: "center",
															justifyContent: "center",
															flex: "0 0 auto",
														}}>
														<Ic
															d={dArrowOut}
															size={13}
															color={NC.s500}
														/>
													</span>
													<span
														style={{
															fontSize: 18,
															fontWeight: 500,
															color: "#030712",
															whiteSpace: "nowrap",
															overflow: "hidden",
															textOverflow: "ellipsis",
														}}>
														{r.obra}
													</span>
												</span>
											)}
											{c.k === "esp" && (
												<Pill
													tone={r.esp === "Vialidad" ? "orange" : "neutral"}>
													{r.esp}
												</Pill>
											)}
											{c.k === "ent" && <Pill tone='neutral'>{r.ent}</Pill>}
											{c.k === "av" && (
												<span
													style={{
														width: "100%",
														display: "flex",
														alignItems: "center",
														gap: 14,
													}}>
													<span
														style={{
															flex: 1,
															height: 8,
															borderRadius: 99,
															background: NC.s200,
															overflow: "hidden",
														}}>
														<span
															style={{
																display: "block",
																width: `${r.av}%`,
																height: "100%",
																borderRadius: 99,
																background: NC.orange,
															}}
														/>
													</span>
													<span
														style={{
															width: 38,
															textAlign: "right",
															fontFamily: NM,
															fontSize: 16.5,
															color: "#030712",
														}}>
														{r.av}%
													</span>
												</span>
											)}
										</div>
									);
								})}
							</div>
						);
					})}
					<div
						style={{
							position: "absolute",
							right: 5,
							top: HEAD_H + 8,
							bottom: 8,
							width: 8,
							borderRadius: 99,
							background: "#d4d4d8",
						}}>
						<span
							style={{
								display: "block",
								width: "100%",
								height: 320,
								borderRadius: 99,
								background: "#71717a",
							}}
						/>
					</div>
				</div>
			</div>
		);

		return (
			<div style={{ position: "absolute", inset: 0 }}>
				{/* heading */}
				<div
					style={{
						display: "none",
						position: "absolute",
						left: TBL_X,
						top: 84,
					}}>
					<div
						style={{
							fontFamily: NS,
							fontSize: 28,
							fontWeight: 800,
							letterSpacing: "-.015em",
							color: NC.s900,
						}}>
						Tus Obras
					</div>
					<div style={{ fontSize: 13, color: NC.s500, marginTop: 5 }}>
						Filtrá, buscá y abrí tus obras desde una vista unificada.
					</div>
				</div>

				{/* page heading */}
				<div
					style={{
						position: "absolute",
						left: TBL_X,
						top: 72,
						right: W - TBL_X - TBL_W,
						display: "flex",
						alignItems: "flex-start",
						justifyContent: "space-between",
						gap: 24,
					}}>
					<div>
						<div
							style={{
								fontFamily: NS,
								fontSize: 38,
								fontWeight: 650,
								lineHeight: 1,
								letterSpacing: "-.018em",
								color: "#1a1a1a",
							}}>
							Tus Obras
						</div>
						<div style={{ fontSize: 14, color: NC.s500, marginTop: 10 }}>
							Filtra, busca y actualiza tus obras desde una vista unificada.
						</div>
					</div>
					<div
						style={{
							height: 44,
							display: "inline-flex",
							alignItems: "center",
							gap: 4,
							padding: 4,
							borderRadius: 10,
							border: `1px solid ${NC.s200}`,
							background: NC.white,
							boxShadow: "0 1px 2px rgba(28,25,23,.04)",
						}}>
						{["Todas", "En proceso", "Finalizadas"].map((label, i) => (
							<span
								key={label}
								style={{
									height: 34,
									display: "inline-flex",
									alignItems: "center",
									padding: "0 14px",
									borderRadius: 8,
									background: i === 0 ? "#1a1a1a" : "transparent",
									color: i === 0 ? "#fff" : NC.s500,
									fontSize: 12.5,
									fontWeight: 600,
								}}>
								{label}
							</span>
						))}
					</div>
				</div>

				{/* form-table style toolbar tray */}
				<div
					style={{
						position: "absolute",
						left: TBL_X - 12,
						top: TBL_Y - 62,
						width: TBL_W + 24,
						height: 68,
						border: `1px solid ${NC.border}`,
						borderBottom: 0,
						borderRadius: "14px 14px 0 0",
						background: NC.white,
						boxShadow: "0 18px 42px rgba(28,25,23,.07)",
						padding: 10,
						boxSizing: "border-box",
						display: "flex",
						alignItems: "flex-start",
						gap: 8,
					}}>
					<div
						style={{
							position: "relative",
							width: 292,
							height: 38,
							border: `1px solid ${NC.s200}`,
							borderRadius: 8,
							background: NC.s50,
							display: "flex",
							alignItems: "center",
							color: NC.s400,
							fontSize: 13,
							paddingLeft: 36,
							boxSizing: "border-box",
						}}>
						<span style={{ position: "absolute", left: 12 }}>
							<Ic
								d={dSearch}
								size={15}
								color={NC.s400}
							/>
						</span>
						Buscar obra...
					</div>
					{[
						["Especialidad", dDataList],
						["Columnas", dTable],
						["Filtros", dSort],
					].map(([label, icon]) => (
						<div
							key={label}
							style={{
								height: 38,
								display: "inline-flex",
								alignItems: "center",
								gap: 7,
								padding: "0 12px",
								border: `1px solid ${NC.s200}`,
								borderRadius: 8,
								background: NC.white,
								fontSize: 12.5,
								fontWeight: 500,
								color: NC.s700,
							}}>
							<Ic
								d={icon}
								size={14}
								color={NC.s500}
							/>
							{label}
						</div>
					))}
					<div style={{ flex: 1 }} />
					<div
						style={{
							height: 38,
							display: "inline-flex",
							alignItems: "center",
							gap: 7,
							padding: "0 13px",
							border: `1px solid ${NC.s200}`,
							borderRadius: 8,
							background: NC.white,
							fontSize: 12.5,
							fontWeight: 600,
							color: NC.s700,
						}}>
						<Ic
							d={dDownload}
							size={14}
							color={NC.s700}
						/>
						Exportar
					</div>
					<div
						style={{
							height: 38,
							display: "inline-flex",
							alignItems: "center",
							gap: 7,
							padding: "0 14px",
							border: "1px solid #1a1a1a",
							borderRadius: 8,
							background: "#1a1a1a",
							fontSize: 12.5,
							fontWeight: 650,
							color: NC.white,
						}}>
						<Ic
							d={dArrowOut}
							size={14}
							color={NC.white}
						/>
						Nueva obra
					</div>
				</div>

				{/* table card */}
				<div
					style={{
						position: "absolute",
						left: TBL_X,
						top: TBL_Y,
						width: TBL_W,
						background: NC.white,
						border: `1px solid ${NC.border}`,
						borderRadius: 10,
						overflow: "hidden",
						boxShadow: "0 18px 42px rgba(28,25,23,.08)",
					}}>
					{/* header */}
					<div
						style={{
							display: "flex",
							background: NC.s50,
							borderBottom: `1px solid ${NC.s200}`,
							height: HEAD_H,
						}}>
						{COLS.map((c) => (
							<div
								key={c.k}
								style={{
									width: `${colPct(c)}%`,
									display: "flex",
									alignItems: "center",
									justifyContent: c.right ? "flex-end" : "flex-start",
									gap: 5,
									padding: "0 12px",
									fontFamily: NS,
									fontSize: 9,
									fontWeight: 750,
									letterSpacing: ".12em",
									color: NC.s500,
								}}>
								{c.label}
								<span style={{ color: NC.s400, display: "inline-flex" }}>
									<Ic
										d={dSort}
										size={10}
										color={NC.s400}
									/>
								</span>
							</div>
						))}
					</div>
					{/* rows */}
					{OBRAS.map((r, i) => {
						const isT = i === TARGET;
						let bg = i % 2 ? "#fafaf9" : "#fff";
						if (isT) {
							const aLvl = Math.max(pulse * 0.9, hover, selected * 0.55);
							if (aLvl > 0.01) bg = `rgba(255,88,0,${0.1 * aLvl})`;
						}
						const scaleY = isT ? 1 - press * 0.015 : 1;
						return (
							<div
								key={i}
								style={{
									position: "relative",
									display: "flex",
									alignItems: "center",
									height: ROW_H,
									borderBottom:
										i < OBRAS.length - 1 ? `1px solid ${NC.s200}` : "none",
									background: bg,
									transform: `scaleY(${scaleY})`,
									boxShadow:
										isT && press > 0.1
											? "inset 0 1px 3px rgba(28,25,23,.08)"
											: "none",
								}}>
								{isT && pulse > 0.02 && (
									<div
										style={{
											position: "absolute",
											inset: 3,
											border: `1.5px solid rgba(255,88,0,${0.28 * pulse})`,
											borderRadius: 7,
											pointerEvents: "none",
										}}
									/>
								)}
								{COLS.map((c) => {
									const hideForBridge =
										isT && bridging && (c.k === "n" || c.k === "obra");
									return (
										<div
											key={c.k}
											style={{
												width: `${colPct(c)}%`,
												padding: "0 12px",
												textAlign: c.right ? "right" : "left",
												opacity: hideForBridge ? 0 : 1,
											}}>
											{c.k === "av" ? (
												<AvanceBar
													v={r.av}
													dim={r.av < 30}
												/>
											) : c.k === "esp" ? (
												<Pill
													tone={r.esp === "Vialidad" ? "orange" : "neutral"}>
													{r.esp}
												</Pill>
											) : c.k === "ent" ? (
												<Pill tone='neutral'>{r.ent}</Pill>
											) : c.k === "obra" ? (
												<span
													style={{
														display: "inline-flex",
														alignItems: "center",
														gap: 9,
													}}>
													<span
														style={{
															width: 19,
															height: 19,
															borderRadius: 5,
															background: NC.s100,
															display: "inline-flex",
															alignItems: "center",
															justifyContent: "center",
															color: NC.s500,
															opacity: isT && hover > 0 ? 1 : 0.55,
															transition: "none",
														}}>
														<Ic
															d={dArrowOut}
															size={11}
															color={isT && hover > 0.4 ? NC.orange : NC.s500}
														/>
													</span>
													<span
														style={{
															fontFamily: NS,
															fontSize: 13,
															fontWeight:
																isT && (hover > 0.3 || selected) ? 650 : 500,
															color: NC.s900,
														}}>
														{r.obra}
													</span>
												</span>
											) : (
												<span
													style={{
														fontFamily: c.mono ? NM : NS,
														fontSize: 12.5,
														fontWeight: 500,
														color: NC.s700,
														fontVariantNumeric: "tabular-nums",
													}}>
													{r[c.k]}
												</span>
											)}
										</div>
									);
								})}
							</div>
						);
					})}
				</div>

				{/* pagination hint */}
				<div
					style={{
						position: "absolute",
						left: TBL_X + 10,
						top: TBL_Y + tableHeight + 16,
						display: "flex",
						alignItems: "center",
						gap: 12,
						fontSize: 12,
						color: NC.s500,
					}}>
					Mostrando <b style={{ color: NC.s900 }}>8</b> de{" "}
					<b style={{ color: NC.s900 }}>98</b> obras
				</div>
			</div>
		);
	}

	function Pill({ tone, children }) {
		const t =
			tone === "orange"
				? { bg: "#fff7ed", bd: "#fed7aa", fg: "#9a3412", dot: "#f97316" }
				: { bg: "#fff", bd: NC.s200, fg: NC.s700, dot: NC.s300 };
		return (
			<span
				style={{
					display: "inline-flex",
					alignItems: "center",
					gap: 7,
					padding: "3px 12px",
					borderRadius: 99,
					fontSize: 14.5,
					border: `1px solid ${t.bd}`,
					background: t.bg,
					color: t.fg,
				}}>
				<span
					style={{ width: 8, height: 8, borderRadius: 99, background: t.dot }}
				/>
				{children}
			</span>
		);
	}

	// ════════════════════════════════════════════════════════════════════════════
	// OBRA DETAIL — header + notched tabs + documents body
	// ════════════════════════════════════════════════════════════════════════════
	function NotchTail({
		side,
		w = 26,
		h = 16,
		fill = NC.white,
		stroke = NC.border,
	}) {
		const isLeft = side === "left";
		return (
			<svg
				width={w}
				height={h}
				viewBox='0 0 60 42'
				preserveAspectRatio='none'
				style={{
					position: "absolute",
					bottom: -1,
					height: h,
					width: w,
					[isLeft ? "left" : "right"]: -(w - 1),
					transform: isLeft ? "scaleX(-1)" : undefined,
					pointerEvents: "none",
				}}>
				<path
					d='M0 1H7.0783C14.772 1 21.7836 5.41324 25.111 12.3501L33.8889 30.6498C37.2164 37.5868 44.228 42 51.9217 42H60H0V1Z'
					fill={fill}
				/>
				<path
					d='M0 1H7.0783C14.772 1 21.7836 5.41324 25.111 12.3501L33.8889 30.6498C37.2164 37.5868 44.228 42 51.9217 42H60'
					fill='none'
					stroke={stroke}
				/>
			</svg>
		);
	}

	function ObraDetail({ t, tabReveal }) {
		const tabs = [
			{ k: "general", l: "General", ic: dBuilding },
			{ k: "polizas", l: "Pólizas", ic: dShield },
			{ k: "flujo", l: "Flujo", ic: dBranch },
			{ k: "docs", l: "Documentos", ic: dFolder, on: true, nuevo: true },
		];
		return (
			<div style={{ position: "absolute", inset: 0 }}>
				{/* obra header bar */}
				<div
					style={{
						position: "absolute",
						left: CX,
						right: 0,
						top: TOP,
						height: 72,
						background: NC.white,
						borderBottom: `1px solid ${NC.border}`,
						display: "flex",
						alignItems: "center",
						padding: "0 24px",
						gap: 14,
					}}>
					<div
						style={{
							width: 32,
							height: 32,
							borderRadius: "50%",
							border: `1px solid ${NC.s200}`,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							color: NC.s500,
						}}>
						<Ic
							d={dChevL}
							size={15}
							color={NC.s500}
						/>
					</div>
					{/* number + title placeholders — the bridge clone lands exactly here, real text fades in under it */}
					<span
						style={{
							fontSize: 30,
							fontWeight: 700,
							color: NC.orange,
							fontVariantNumeric: "tabular-nums",
							letterSpacing: "-.01em",
							lineHeight: 1,
						}}>
						{FAKE_TABLE_ROWS[TARGET].n}
					</span>
					<span
						style={{
							fontSize: 21,
							fontWeight: 700,
							letterSpacing: "-.01em",
							color: NC.s900,
						}}>
						{FAKE_TABLE_ROWS[TARGET].obra}
					</span>
					<span
						style={{
							display: "inline-flex",
							alignItems: "center",
							gap: 7,
							padding: "7px 13px",
							borderRadius: 99,
							border: `1px solid ${NC.s200}`,
							fontSize: 12,
							color: NC.s700,
							boxShadow: "0 1px 0 rgba(0,0,0,.03)",
						}}>
						<Ic
							d={dSearch}
							size={13}
							color={NC.s500}
						/>
						Ir a obra
					</span>
					<div style={{ flex: 1 }} />
					<span style={{ fontSize: 12, color: NC.s500 }}>
						Vialidad Provincial · Mayo 2026
					</span>
				</div>

				{/* notched tabs */}
				<div
					style={{
						display: "none",
						position: "absolute",
						left: CX,
						right: 0,
						top: DETAIL_TABS_Y,
						background: NC.s100,
					}}>
					<div
						style={{
							display: "flex",
							alignItems: "flex-end",
							gap: 34,
							padding: "0 24px",
						}}>
						{tabs.map((tb) => (
							<div
								key={tb.k}
								style={{
									position: "relative",
									display: "inline-flex",
									alignItems: "center",
									gap: 8,
									padding: "11px 18px 12px",
									background: tb.on ? NC.white : "transparent",
									border: tb.on
										? `1px solid ${NC.border}`
										: "1px solid transparent",
									borderBottom: 0,
									borderRadius: "10px 10px 0 0",
									fontSize: 13,
									fontWeight: tb.on ? 600 : 500,
									color: tb.on ? NC.s900 : NC.s500,
									marginBottom: -1,
									zIndex: tb.on ? 3 : 1,
									opacity: tb.on ? tabReveal : 1,
								}}>
								{tb.on && <NotchTail side='left' />}
								<Ic
									d={tb.ic}
									size={14}
									color={tb.on ? NC.s900 : NC.s500}
								/>
								{tb.l}
								{tb.nuevo && (
									<span
										style={{
											marginLeft: 4,
											fontSize: 8.5,
											fontWeight: 700,
											letterSpacing: ".08em",
											color: NC.orange,
											background: NC.orange50,
											border: `1px solid ${NC.orange100}`,
											borderRadius: 5,
											padding: "2px 5px",
										}}>
										NUEVO
									</span>
								)}
								{tb.on && <NotchTail side='right' />}
							</div>
						))}
					</div>
					<div
						style={{
							height: 16,
							background: NC.white,
							borderTop: `1px solid ${NC.border}`,
							marginTop: -1,
						}}
					/>
				</div>

				{/* obra tabs */}
				<div
					style={{
						position: "absolute",
						left: CX,
						right: 0,
						top: DETAIL_TABS_Y,
						height: 44,
						background: NC.canvas,
						display: "flex",
						alignItems: "center",
						padding: "0 42px",
						boxSizing: "border-box",
					}}>
					<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
						{[
							{ l: "General", ic: dBuilding },
							{ l: "Polizas", ic: dShield },
							{ l: "Flujo", ic: dBranch },
							{ l: "Documentos New", ic: dFolder, on: true },
						].map((tb) => (
							<div
								key={tb.l}
								style={{
									height: 36,
									display: "inline-flex",
									alignItems: "center",
									gap: 8,
									padding: "0 14px",
									borderRadius: 12,
									background: tb.on ? "#1a1a1a" : "transparent",
									color: tb.on ? NC.white : NC.s500,
									fontSize: 13,
									fontWeight: 600,
									opacity: tb.on ? tabReveal : 1,
								}}>
								<Ic
									d={tb.ic}
									size={14}
									color={tb.on ? NC.white : NC.s500}
								/>
								{tb.l}
							</div>
						))}
					</div>
				</div>

				{/* documents body background */}
				<div
					style={{
						position: "absolute",
						left: CX,
						right: 0,
						top: BODY_Y,
						bottom: 0,
						background: NC.canvas,
					}}
				/>
				<div
					style={{
						position: "absolute",
						left: DOC_X - 24,
						right: 48,
						top: BODY_Y + 8,
						bottom: 42,
						background: NC.white,
						border: "1px solid #d9d9d9",
						borderRadius: 10,
						boxShadow: "0 1px 2px rgba(28,25,23,.06)",
						overflow: "hidden",
					}}
				/>
				<div
					style={{
						position: "absolute",
						left: DOC_X - 24,
						right: 48,
						top: FOLDERS_Y + FOLDER_H + 12,
						height: 1,
						background: "#d9d9d9",
					}}
				/>
			</div>
		);
	}

	function DocTree() {
		const items = [
			{ l: "Certificados", n: 6, src: NC.purple },
			{ l: "Órdenes de compra", n: 12, src: NC.purple },
			{ l: "Fotos de obra", n: 34, src: NC.blue },
			{ l: "Curva de avance", n: 1, src: NC.green },
			{ l: "Facturas", n: 6, src: NC.green, on: true },
			{ l: "Pólizas", n: 2, src: NC.blue },
			{ l: "Pliego", n: 4 },
		];
		return (
			<aside
				style={{
					position: "absolute",
					left: CX,
					top: BODY_Y,
					bottom: 0,
					width: TREE_W,
					background: NC.s50,
					borderRight: `1px solid ${NC.s200}`,
					padding: 14,
					boxSizing: "border-box",
					display: "flex",
					flexDirection: "column",
					gap: 8,
				}}>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 6,
						padding: "8px 11px",
						background: NC.white,
						border: `1px solid ${NC.s200}`,
						borderRadius: 8,
						fontSize: 12,
						color: NC.s400,
					}}>
					<Ic
						d={dSearch}
						size={13}
						color={NC.s400}
					/>
					Buscar…
				</div>
				<div
					style={{
						fontSize: 9.5,
						textTransform: "uppercase",
						letterSpacing: ".15em",
						color: NC.s500,
						fontWeight: 700,
						padding: "6px 6px 0",
					}}>
					Carpetas
				</div>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 6,
						padding: "6px 8px",
						fontSize: 12,
						fontWeight: 500,
						color: NC.s900,
					}}>
					<Ic
						d={dChevD}
						size={14}
						color={NC.s700}
					/>
					<Ic
						d={dFolder}
						size={14}
						color={NC.s700}
					/>
					<span>Documentos</span>
				</div>
				{items.map((it, i) => (
					<div
						key={i}
						style={{
							display: "flex",
							alignItems: "center",
							gap: 6,
							padding: "6px 8px 6px 22px",
							borderRadius: 7,
							fontSize: 12,
							marginTop: -3,
							background: it.on ? NC.s100 : "transparent",
							color: it.on ? NC.s900 : NC.s700,
							fontWeight: it.on ? 500 : 400,
						}}>
						<Ic
							d={dChevR}
							size={13}
							color={NC.s400}
						/>
						<Ic
							d={dFolder}
							size={14}
							color={it.on ? NC.s700 : NC.s500}
						/>
						<span
							style={{
								flex: 1,
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
							}}>
							{it.l}
						</span>
						{it.src && (
							<span
								style={{
									width: 6,
									height: 6,
									borderRadius: 99,
									background: it.src,
								}}
							/>
						)}
						<span
							style={{
								fontSize: 10,
								color: NC.s500,
								background: NC.s100,
								padding: "1px 7px",
								borderRadius: 99,
								fontVariantNumeric: "tabular-nums",
							}}>
							{it.n}
						</span>
					</div>
				))}
				<div style={{ marginTop: "auto", padding: "8px 6px" }}>
					<div
						style={{
							fontSize: 9.5,
							textTransform: "uppercase",
							letterSpacing: ".15em",
							color: NC.s500,
							fontWeight: 700,
							marginBottom: 8,
						}}>
						Leyenda
					</div>
					{[
						["Extracción", NC.green],
						["Manual", NC.blue],
						["Mixta", NC.purple],
					].map(([l, c]) => (
						<div
							key={l}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 8,
								fontSize: 11,
								color: NC.s600,
								padding: "2px 0",
							}}>
							<span
								style={{ width: 9, height: 9, borderRadius: 3, background: c }}
							/>
							{l}
						</div>
					))}
				</div>
			</aside>
		);
	}

	// ── FolderFront SVG (mirrors components/ui/FolderFront.tsx) ───────────────────
	function NavFolderFront({
		gradientId,
		firstStopColor,
		secondStopColor,
		style,
	}) {
		return (
			<svg
				width='240'
				height='143'
				viewBox='0 0 222 143'
				fill='none'
				xmlns='http://www.w3.org/2000/svg'
				style={{
					...style,
					left: typeof style?.left === "number" ? style.left - 2 : -24,
				}}>
				<path
					d='M0.00815868 18.4548C0.00815868 14.5399 -0.394053 8.94031 4.44962 4.32699C9.29329 -0.286336 15.1502 0.00361544 19.172 0.00361544L83.8802 0.926173C88.3031 0.926173 98.0937 2.15625 101.253 4.6164C101.253 4.6164 129.06 18.8807 136.998 19.3773C144.371 19.8386 200.828 20.2999 200.828 20.2999C206.85 20.2999 212.707 20.0099 217.55 24.6232C222.394 29.2366 221.992 34.8362 221.992 38.751L218.992 128.239C218.992 132.154 217.394 135.908 214.551 138.677C211.707 141.445 207.85 143 203.828 143H18.172C14.1503 143 10.2932 141.445 7.4494 138.677C4.60558 135.908 3.00794 132.154 3.00794 128.239L0.00815868 18.4548Z'
					fill={`url(#${gradientId})`}
				/>
				<path
					d='M3.50781 128.226L0.507812 18.4414C0.506971 14.4838 0.136272 9.12655 4.79492 4.68945C9.46896 0.237731 15.1074 0.502626 19.165 0.50293V0.503906L83.873 1.42578H83.8799C86.057 1.42578 89.5805 1.73028 92.9512 2.34082C94.635 2.64583 96.2703 3.02522 97.6738 3.47754C98.9107 3.87617 99.9367 4.3219 100.656 4.80273L100.945 5.01074L100.982 5.04004L101.024 5.06152L101.253 4.61621C101.025 5.06109 101.025 5.0614 101.025 5.06152H101.026C101.027 5.06197 101.029 5.0636 101.03 5.06445C101.034 5.0662 101.038 5.06897 101.045 5.07227C101.058 5.07919 101.079 5.08897 101.105 5.10254C101.159 5.12967 101.238 5.17023 101.341 5.22266C101.547 5.32752 101.85 5.4811 102.238 5.67676C103.015 6.06836 104.134 6.62849 105.501 7.30176C108.235 8.64817 111.964 10.449 115.941 12.2656C119.918 14.0817 124.15 15.9164 127.888 17.3291C131.372 18.646 134.484 19.6186 136.564 19.8418L136.967 19.876C140.67 20.1077 156.647 20.3389 171.673 20.5117C179.191 20.5982 186.479 20.6702 191.887 20.7207C194.591 20.7459 196.826 20.7658 198.384 20.7793C199.163 20.7861 199.773 20.7914 200.188 20.7949C200.396 20.7967 200.555 20.7979 200.662 20.7988C200.716 20.7993 200.756 20.7996 200.783 20.7998H200.823C200.824 20.7998 200.824 20.7998 200.828 20.2998L200.824 20.7998H200.828C206.904 20.7998 212.533 20.5354 217.205 24.9854C221.862 29.4212 221.493 34.7771 221.492 38.7344L218.492 128.223V128.239C218.492 132.017 216.951 135.643 214.202 138.318C211.453 140.994 207.722 142.5 203.828 142.5H18.1719C14.2785 142.5 10.5469 140.994 7.79785 138.318C5.04936 135.643 3.50786 132.017 3.50781 128.239V128.226Z'
					stroke='white'
					strokeOpacity='0.25'
				/>
				<defs>
					<linearGradient
						id={gradientId}
						x1='2.00816'
						y1='14.7645'
						x2='2.00816'
						y2='143'
						gradientUnits='userSpaceOnUse'>
						<stop stopColor={firstStopColor} />
						<stop
							offset='1'
							stopColor={secondStopColor}
						/>
					</linearGradient>
				</defs>
			</svg>
		);
	}

	// ── Folder thumbnail (mirrors documents-new-tab FolderThumbnail) ──────────────
	function Folder3D({
		name,
		tone,
		folderKey = "folder",
		open = 0,
		opacity = 1,
		blur = 0,
		scale = 1.13,
		dimLabel = false,
		hasContent = true,
	}) {
		const isOcr = tone === "orange";
		const backGradient = isOcr
			? "linear-gradient(180deg, #f59e0b, #b45309)"
			: "linear-gradient(180deg, #78716c, #44403c)";
		const frontFirst = isOcr ? "#fe9a00" : "#79716b";
		const frontSecond = isOcr ? "#fb8634" : "#57534d";
		const frontTilt = -open * 30;
		const paperTop = -10 - open * 18;
		return (
			<div
				style={{
					width: FOLDER_W,
					height: FOLDER_H,
					opacity,
					filter: blur ? `blur(${blur}px)` : "none",
					transform: `scale(${scale})`,
					transformOrigin: "center",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "flex-end",
				}}>
				<div
					style={{
						position: "relative",
						marginLeft: 4,
						marginBottom: 7,
						display: "flex",
						height: 98,
						width: 140,
						flexDirection: "column",
						alignItems: "flex-start",
						gap: 8,
						borderRadius: 9,
						border: "1px solid rgba(0,0,0,0.12)",
						padding: "14px 14px 6px",
						background: backGradient,
						boxSizing: "border-box",
						boxShadow: "0 16px 26px rgba(28,25,23,.15)",
						overflow: "visible",
					}}>
					<div
						style={{
							position: "relative",
							display: "flex",
							height: "100%",
							width: "100%",
							flexDirection: "column",
							alignItems: "center",
							justifyContent: "flex-end",
						}}>
						{hasContent ? (
							<span
								style={{
									position: "absolute",
									top: paperTop,
									left: "50%",
									height: 94,
									width: 120,
									transform: "translateX(-50%)",
									border: `1px solid ${NC.s200}`,
									background: `linear-gradient(180deg, ${NC.s50}, ${NC.s200})`,
								}}
							/>
						) : null}
						<NavFolderFront
							gradientId={`nav-folder-${folderKey}`}
							firstStopColor={frontFirst}
							secondStopColor={frontSecond}
							style={{
								position: "absolute",
								bottom: -8,
								left: -29,
								height: 94,
								width: 168,
								transformOrigin: "50% 100%",
								transform: `perspective(800px) rotateX(${frontTilt}deg)`,
							}}
						/>
						{isOcr ? (
							<div style={{ position: "absolute", top: 25, zIndex: 10 }}>
								<Ic
									d={dTable}
									size={22}
									color='rgba(255,255,255,0.9)'
								/>
							</div>
						) : null}
						<div
							style={{
								position: "relative",
								zIndex: 10,
								width: "100%",
								textAlign: "center",
								fontSize: 16,
								lineHeight: "20px",
								fontWeight: 600,
								color: "#fff",
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
								opacity: dimLabel ? 0.5 : 1,
							}}>
							{name}
						</div>
					</div>
				</div>
			</div>
		);
	}

	// ── PDF page (invoice) — scalable, used for thumbnails, clone & viewer ───────
	function PdfPage({ scale = 1, settle = 1, origin = "top left" }) {
		const lbl = {
			fontFamily: NS,
			fontSize: 7.5,
			fontWeight: 700,
			letterSpacing: ".1em",
			color: NC.s400,
		};
		const val = {
			fontFamily: NS,
			fontSize: 12,
			fontWeight: 600,
			color: NC.s800,
			marginTop: 2,
			whiteSpace: "nowrap",
		};
		const fields = [
			["N° COMPROBANTE", "0001-00004821", 24, 78, false],
			["FECHA", "14/05/2026", 232, 78, false],
			["PROVEEDOR", "Aceros del Litoral S.A.", 24, 128, false],
			["CUIT", "30-71024588-4", 24, 178, true],
			["OBRA", "Ruta Prov. 12 · Tramo III", 188, 178, false],
			["TOTAL", "$ 2.226.400", 188, 392, true],
		];
		return (
			<div
				style={{
					width: PG_W,
					height: PG_H,
					transform: `scale(${scale * settle})`,
					transformOrigin: origin,
					background: "#fff",
					borderRadius: 8,
					border: `1px solid ${NC.s200}`,
					boxShadow:
						"0 18px 40px -12px rgba(28,25,23,.28), 0 2px 6px rgba(28,25,23,.08)",
					position: "relative",
					overflow: "hidden",
				}}>
				<div
					style={{
						position: "absolute",
						top: 22,
						left: 24,
						right: 24,
						display: "flex",
						alignItems: "center",
						gap: 10,
					}}>
					<div
						style={{
							width: 22,
							height: 22,
							borderRadius: 5,
							background: NC.orange,
						}}
					/>
					<div
						style={{
							fontFamily: NS,
							fontSize: 16,
							fontWeight: 700,
							letterSpacing: ".04em",
							color: NC.s900,
						}}>
						FACTURA
					</div>
					<div
						style={{
							marginLeft: "auto",
							width: 25,
							height: 25,
							borderRadius: 5,
							border: `1.5px solid ${NC.s300}`,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							fontFamily: NS,
							fontWeight: 700,
							fontSize: 12,
							color: NC.s600,
						}}>
						A
					</div>
				</div>
				<div
					style={{
						position: "absolute",
						top: 56,
						left: 24,
						right: 24,
						height: 1,
						background: NC.s200,
					}}
				/>
				{fields.map((f, i) => (
					<div
						key={i}
						style={{ position: "absolute", left: f[2], top: f[3] }}>
						<div style={lbl}>{f[0]}</div>
						<div
							style={{
								...val,
								fontFamily: f[4] ? NM : NS,
								fontSize: f[0] === "TOTAL" ? 17 : 12,
								color: f[0] === "TOTAL" ? NC.s900 : NC.s800,
							}}>
							{f[1]}
						</div>
					</div>
				))}
				<div style={{ position: "absolute", left: 24, top: 226, right: 24 }}>
					<div style={{ ...lbl, marginBottom: 8 }}>DETALLE</div>
					{[5, 4, 6].map((fl, i) => (
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
									background: NC.s200,
									flex: fl,
								}}
							/>
							<div
								style={{
									height: 7,
									width: 50,
									borderRadius: 3,
									background: NC.s100,
								}}
							/>
						</div>
					))}
				</div>
				<div
					style={{
						position: "absolute",
						left: 24,
						top: 372,
						right: 24,
						height: 1,
						background: NC.s200,
					}}
				/>
			</div>
		);
	}

	// ── document grid card ────────────────────────────────────────────────────────
	function FileCard({ file, hover = 0, press = 0, thumbHidden = false }) {
		const bg = `rgb(${Math.round(lerp(245, 255, hover))},${Math.round(lerp(245, 255, hover))},${Math.round(lerp(244, 255, hover))})`;
		const thumbScale = 0.23;
		return (
			<div
				style={{
					position: "relative",
					width: CW,
					height: CH,
					background: bg,
					border: `1px solid ${NC.s200}`,
					borderRadius: 0,
					overflow: "hidden",
					boxShadow:
						hover > 0.05
							? `0 12px 28px rgba(28,25,23,${0.13 * hover})`
							: "0 1px 0 rgba(0,0,0,.03)",
					transform: `scale(${1 - press * 0.02})`,
					transformOrigin: "center",
				}}>
				<span
					style={{
						position: "absolute",
						top: 0,
						right: 0,
						zIndex: 10,
						width: 0,
						height: 0,
						borderTop: "16px solid #d6d3d1",
						borderLeft: "16px solid transparent",
					}}
				/>
				<span
					style={{
						position: "absolute",
						top: -1,
						right: -1,
						zIndex: 11,
						width: 0,
						height: 0,
						borderTop: "17px solid #fff",
						borderLeft: "17px solid transparent",
						filter: "drop-shadow(-1px 1px 0 rgba(120,113,108,.35))",
					}}
				/>
				<div
					style={{
						position: "absolute",
						inset: 0,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						paddingBottom: 12,
						boxSizing: "border-box",
					}}>
					{!thumbHidden && (
						<div
							style={{
								position: "relative",
								width: PG_W * thumbScale,
								height: PG_H * thumbScale,
								transform: `translateY(${-2 - hover * 4}px)`,
								transition: "none",
							}}>
							<div style={{ position: "absolute", left: 0, top: 0 }}>
								<PdfPage scale={thumbScale} />
							</div>
						</div>
					)}
					<div
						style={{
							position: "absolute",
							right: 8,
							top: 30,
							zIndex: 20,
							width: 22,
							height: 22,
							borderRadius: 99,
							border: "1px solid #86efac",
							background: "#dcfce7",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}>
						<span
							style={{
								width: 7,
								height: 7,
								borderRadius: 99,
								background: NC.green,
							}}
						/>
					</div>
				</div>
				<div
					style={{
						position: "absolute",
						left: 0,
						right: 0,
						bottom: 0,
						zIndex: 20,
						background: "rgba(231,229,228,.76)",
						backdropFilter: "blur(4px)",
						WebkitBackdropFilter: "blur(4px)",
						padding: "7px 8px",
						boxSizing: "border-box",
					}}>
					<div
						style={{
							fontFamily: NS,
							fontSize: 12,
							fontWeight: 500,
							color: NC.s700,
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							textAlign: "center",
						}}>
						{file.name}
					</div>
				</div>
			</div>
		);
	}

	// ── documents header (folder name + counter) ─────────────────────────────────
	function DocsHeader({ openedP }) {
		const allOp = 1 - clamp((openedP - 0.12) / 0.28, 0, 1);
		const folderOp = clamp((openedP - 0.58) / 0.28, 0, 1);
		return (
			<div
				style={{
					position: "absolute",
					left: DOC_X,
					top: DOC_HEAD_Y,
					right: 72,
					height: 48,
					display: "flex",
					alignItems: "center",
					gap: 12,
				}}>
				<div style={{ minWidth: 0, flex: 1 }}>
					<div style={{ position: "relative", height: 24 }}>
						<span
							style={{
								position: "absolute",
								top: 0,
								fontFamily: NS,
								fontSize: 22,
								fontWeight: 650,
								color: NC.s900,
								opacity: allOp,
								whiteSpace: "nowrap",
							}}>
							Documentos
						</span>
						<span
							style={{
								position: "absolute",
								top: 0,
								fontFamily: NS,
								fontSize: 22,
								fontWeight: 650,
								color: NC.s900,
								opacity: folderOp,
								whiteSpace: "nowrap",
							}}>
							Ordenes de Compra
						</span>
					</div>
					<div style={{ position: "relative", height: 18, marginTop: 2 }}>
						<span
							style={{
								position: "absolute",
								top: 0,
								fontSize: 13,
								color: NC.s500,
								opacity: allOp,
							}}>
							0 archivos - 5 carpetas - 0 GB
						</span>
						<span
							style={{
								position: "absolute",
								top: 0,
								fontSize: 13,
								color: NC.s500,
								opacity: folderOp,
								fontVariantNumeric: "tabular-nums",
							}}>
							6 archivos - 0 carpetas - 12,4 MB
						</span>
					</div>
				</div>
				<div
					style={{
						position: "relative",
						width: 250,
						height: 36,
						border: `1px solid ${NC.s200}`,
						borderRadius: 8,
						background: NC.white,
						display: "flex",
						alignItems: "center",
						color: NC.s400,
						fontSize: 13,
						paddingLeft: 34,
						boxSizing: "border-box",
						opacity: folderOp,
					}}>
					<span style={{ position: "absolute", left: 11 }}>
						<Ic
							d={dSearch}
							size={14}
							color={NC.s400}
						/>
					</span>
					Buscar documento...
				</div>
				<div
					style={{
						width: 36,
						height: 36,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						borderRadius: 8,
						border: `1px solid ${NC.s200}`,
						background: NC.white,
						opacity: folderOp,
					}}>
					<Ic
						d={dDownload}
						size={15}
						color={NC.s700}
					/>
				</div>
				<div
					style={{
						height: 36,
						display: "inline-flex",
						alignItems: "center",
						gap: 4,
						padding: 3,
						borderRadius: 8,
						border: "1px solid #d9d9d9",
						background: NC.s50,
						opacity: folderOp,
					}}>
					<span
						style={{
							height: 28,
							display: "inline-flex",
							alignItems: "center",
							gap: 6,
							padding: "0 10px",
							borderRadius: 6,
							background: "#1a1a1a",
							color: NC.white,
							fontSize: 12,
							fontWeight: 600,
						}}>
						<Ic
							d={dFile}
							size={13}
							color={NC.white}
						/>
						Archivos
					</span>
					<span
						style={{
							height: 28,
							display: "inline-flex",
							alignItems: "center",
							gap: 6,
							padding: "0 10px",
							borderRadius: 6,
							color: NC.s500,
							fontSize: 12,
							fontWeight: 600,
						}}>
						<Ic
							d={dTable}
							size={13}
							color={NC.s500}
						/>
						Tabla
					</span>
				</div>
				<span
					style={{
						display: "none",
						color: openedP > 0.5 ? NC.orange : NC.s700,
					}}>
					<Ic
						d={dFolder}
						size={20}
						color={openedP > 0.5 ? NC.orange : NC.s700}
					/>
				</span>
				<div
					style={{
						display: "none",
						position: "relative",
						height: 26,
						flex: 1,
					}}>
					<span
						style={{
							position: "absolute",
							top: 0,
							fontFamily: NS,
							fontSize: 19,
							fontWeight: 700,
							color: NC.s900,
							opacity: 1 - openedP,
						}}>
						Todos los documentos{" "}
						<span style={{ fontSize: 12, fontWeight: 400, color: NC.s500 }}>
							· 5 carpetas
						</span>
					</span>
					<span
						style={{
							position: "absolute",
							top: 0,
							fontFamily: NS,
							fontSize: 19,
							fontWeight: 700,
							color: NC.s900,
							opacity: openedP,
						}}>
						Facturas{" "}
						<span
							style={{
								fontSize: 12,
								fontWeight: 400,
								color: NC.s500,
								fontVariantNumeric: "tabular-nums",
							}}>
							· 6 archivos · 0 carpetas · 12,4 MB
						</span>
					</span>
				</div>
				<div
					style={{
						display: "none",
						alignItems: "center",
						gap: 6,
						padding: "7px 13px",
						borderRadius: 9,
						background: NC.white,
						border: `1px solid ${NC.s200}`,
						fontSize: 12,
						fontWeight: 500,
						color: NC.s700,
						boxShadow: "0 1px 0 rgba(0,0,0,.03)",
					}}>
					<Ic
						d={dDownload}
						size={14}
						color={NC.s700}
					/>
					Descargar todos
				</div>
			</div>
		);
	}

	// ── cursor ────────────────────────────────────────────────────────────────────
	function Cursor({ x, y, scale = 1, opacity = 1, press = 0, intent = 0 }) {
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
							background: NC.orange,
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
						transform: `translate(${press * 1.6}px, ${press * 1.6}px) scale(${scale * (1 - press * 0.04)})`,
						transformOrigin: "top left",
						filter: "drop-shadow(0 2px 4px rgba(0,0,0,.35))",
						zIndex: 60,
						pointerEvents: "none",
					}}>
					<path
						d='M2 2l7 20 3.5-8.5L21 10 2 2z'
						fill='#1c1917'
						stroke='#fff'
						strokeWidth='1.6'
						strokeLinejoin='round'
					/>
				</svg>
			</React.Fragment>
		);
	}

	// ════════════════════════════════════════════════════════════════════════════
	// ROOT — orchestrates layers, bridges, preview from the global playhead
	// ════════════════════════════════════════════════════════════════════════════
	function NavRoot() {
		const t = useTime();

		// ── transition P4: Tus Obras → detail (2.45–3.65) ─────────────────────────
		const p4 = clamp((t - 2.45) / 1.2, 0, 1);
		const detailOp = clamp((p4 - 0.6) / 0.4, 0, 1); // detail appears 60→100%
		const tusOp = 1 - clamp((p4 - 0.5) / 0.32, 0, 1); // table fades 50→82%
		const tabReveal = clamp((t - 3.65) / 0.18, 0, 1); // Documentos pill reveal
		const bridge1On = t >= 2.45 && detailOp < 0.999;

		// ── folders → grid (folder click 6.3, clone 6.3–7.0, grid 7.0+) ───────────
		const folderClick = 6.3;
		const fDim = clamp((t - folderClick) / 0.22, 0, 1); // others dim
		const fCloneP = easeInOut(clamp((t - folderClick) / 0.7, 0, 1));
		const foldersGone = clamp((t - 6.95) / 0.4, 0, 1); // folders fade fully
		const openedP = clamp((t - 6.45) / 0.4, 0, 1); // header text swap
		const folderPress =
			clamp((t - folderClick) / 0.1, 0, 1) *
			(1 - clamp((t - folderClick - 0.12) / 0.12, 0, 1));

		// ── document → preview (hover 9.2, click 10.0, sheet 10.25–11.5) ──────────
		const cardHover =
			clamp((t - 9.55) / 0.4, 0, 1) * (1 - clamp((t - 10.0) / 0.05, 0, 1)) +
			(t >= 10.0 ? 1 : 0) * 0;
		const cardHoverHold = t >= 9.55 ? clamp((t - 9.55) / 0.3, 0, 1) : 0; // stays hovered through click
		const cardPress =
			clamp((t - 10.0) / 0.09, 0, 1) * (1 - clamp((t - 10.12) / 0.12, 0, 1));
		const sheetStart = 10.25;
		const overlayP = clamp((t - sheetStart) / 0.26, 0, 1);
		const sheetP = easeDrawer(clamp((t - sheetStart) / 0.52, 0, 1));
		const cloneP = easeInOut(clamp((t - sheetStart) / 1.25, 0, 1)); // thumbnail → viewer
		const cloneAlive = t >= sheetStart && cloneP < 0.985;
		const realDocOp = clamp((t - 11.42) / 0.18, 0, 1);
		const docSettle = lerp(0.985, 1, clamp((t - 11.5) / 0.24, 0, 1));

		// ── cursor path ────────────────────────────────────────────────────────────
		const CT = [0, 1.4, 2.2, 4.7, 6.1, 7.0, 9.6, 10.0, 11.0, 16];
		const CXk = [
			1140,
			1140,
			560,
			560,
			folderCenter(FTARGET).x,
			folderCenter(FTARGET).x,
			gridPos(0).x + 92,
			gridPos(0).x + 92,
			gridPos(0).x + 92,
			gridPos(0).x + 92,
		];
		const CYk = [
			724,
			724,
			targetRowTop + 26,
			targetRowTop + 26,
			folderCenter(FTARGET).y,
			folderCenter(FTARGET).y,
			gridPos(0).y + 72,
			gridPos(0).y + 72,
			gridPos(0).y + 78,
			gridPos(0).y + 78,
		];
		const curX = interpolate(CT, CXk, easeInOut)(t);
		const curY = interpolate(CT, CYk, easeInOut)(t);
		const rowPress =
			clamp((t - 2.2) / 0.09, 0, 1) * (1 - clamp((t - 2.32) / 0.13, 0, 1));
		const cursorPress = Math.max(rowPress, folderPress, cardPress);
		const clickCue = (at, lead = 0.48) => {
			const cueIn = easeOut(clamp((t - (at - lead)) / (lead * 0.58), 0, 1));
			const cueOut = 1 - clamp((t - (at + 0.18)) / 0.24, 0, 1);
			return cueIn * cueOut;
		};
		const cursorIntent = Math.max(
			clickCue(2.2, 0.46),
			clickCue(folderClick, 0.48),
			clickCue(10.0, 0.56),
		);
		const curScale = 1 - 0.1 * cursorPress;
		const curOp =
			(1 - clamp((t - 10.25) / 0.4, 0, 1)) *
			(1 - clamp((t - 14.3) / 0.4, 0, 1));

		// folder lid opens as cursor arrives
		const factLid =
			clamp((t - 5.6) / 0.5, 0, 1) *
			(1 - clamp((t - folderClick) / 0.15, 0, 1));

		// bridge-1 clone position (row cells → header)
		const b1 = easeInOut(clamp(p4 / 0.9, 0, 1));
		const numSrcX = colX[0] + 12,
			numSrcY = targetRowTop + ROW_H / 2;
		const numX = lerp(numSrcX, HDR_NUM.x, b1),
			numY = lerp(numSrcY, HDR_NUM.y, b1),
			numFs = lerp(12.5, HDR_NUM.fs, b1);
		const titleSrcX = colX[1] + 12 + 28,
			titleSrcY = targetRowTop + ROW_H / 2;
		const titleX = lerp(titleSrcX, HDR_TITLE.x, b1),
			titleY = lerp(titleSrcY, HDR_TITLE.y, b1),
			titleFs = lerp(13, HDR_TITLE.fs, b1);
		const b1Fade = 1 - clamp((p4 - 0.85) / 0.15, 0, 1);

		return (
			<div
				style={{
					position: "absolute",
					inset: 0,
					background: NC.canvas,
					fontFamily: NS,
					overflow: "hidden",
				}}>
				{/* TUS OBRAS layer */}
				{tusOp > 0.001 && (
					<div
						style={{
							position: "absolute",
							left: CX,
							right: 0,
							top: TOP,
							bottom: 0,
							opacity: tusOp,
						}}>
						<div
							style={{
								position: "absolute",
								left: -CX,
								right: 0,
								top: -TOP,
								bottom: 0,
							}}>
							<TusObras t={t} />
						</div>
					</div>
				)}

				{/* DETAIL layer (prerendered, fades in 60→100% of transition) */}
				{detailOp > 0.001 && (
					<div style={{ position: "absolute", inset: 0, opacity: detailOp }}>
						<ObraDetail
							t={t}
							tabReveal={tabReveal}
						/>

						{/* documents header */}
						<DocsHeader openedP={openedP} />

						{/* folders (fade out as grid arrives) */}
						{foldersGone < 0.999 &&
							FOLDER_ITEMS.map((f, i) => {
								if (i === FTARGET && t >= folderClick) return null; // replaced by clone
								const isT = i === FTARGET;
								const dim = !isT ? fDim : 0;
								const op = (1 - foldersGone) * (1 - dim * 0.82);
								const blur = !isT ? dim * 1.5 : 0;
								const open = isT ? factLid : i === 0 ? 0 : 0;
								const press = isT ? folderPress : 0;
								return (
									<div
										key={f.k}
										style={{
											position: "absolute",
											left: folderX(i),
											top: FOLDERS_Y,
											transform: `scale(${1 - press * 0.02})`,
											transformOrigin: "center",
										}}>
										<Folder3D
											folderKey={f.k}
											name={f.name}
											tone={f.tone}
											open={open}
											opacity={op}
											blur={blur}
											dimLabel={dim > 0.3}
										/>
									</div>
								);
							})}

						{/* folder clone: travels from grid slot → header folder icon, shrinking */}
						{t >= folderClick && fCloneP < 0.999 && (
							<div
								style={{
									position: "absolute",
									left: lerp(folderX(FTARGET), OPEN_ICON.x, fCloneP),
									top: lerp(FOLDERS_Y, OPEN_ICON.y, fCloneP),
									transform: `scale(${lerp(1, 0.16, fCloneP)})`,
									transformOrigin: "top left",
									opacity: 1 - clamp((fCloneP - 0.8) / 0.2, 0, 1),
								}}>
								<Folder3D
									folderKey='clone'
									name=''
									tone='orange'
									open={lerp(factLidAtClick(), 0.1, fCloneP)}
								/>
							</div>
						)}

						{/* document grid cards (emerge from folder centre, distribute to grid) */}
						{t >= 7.0 &&
							FILES.map((f, i) => {
								const ap = easeInOut(
									clamp((t - (7.0 + i * 0.06)) / 0.65, 0, 1),
								);
								if (ap <= 0) return null;
								const gp = gridPos(i);
								const sx = folderCenter(FTARGET).x - CW / 2,
									sy = folderCenter(FTARGET).y - CH / 2;
								const x = lerp(sx, gp.x, ap),
									y = lerp(sy, gp.y, ap);
								const sc = lerp(0.4, 1, ap);
								const isFirst = i === 0;
								const hov = isFirst ? cardHoverHold : 0;
								const prs = isFirst ? cardPress : 0;
								const thumbHidden = isFirst && cloneAlive; // its thumbnail flew into the viewer
								return (
									<div
										key={f.name}
										style={{
											position: "absolute",
											left: x,
											top: y,
											transform: `scale(${sc})`,
											transformOrigin: "top left",
											opacity: clamp(ap / 0.4, 0, 1),
										}}>
										<FileCard
											file={f}
											hover={hov}
											press={prs}
											thumbHidden={thumbHidden}
										/>
									</div>
								);
							})}
					</div>
				)}

				{/* ── BRIDGE 1: row cells → obra header (drawn above both layers) ─────── */}
				{bridge1On && (
					<div
						style={{
							position: "absolute",
							inset: 0,
							opacity: b1Fade,
							pointerEvents: "none",
						}}>
						<div
							style={{
								position: "absolute",
								left: numX,
								top: numY,
								transform: "translate(0,-50%)",
								fontFamily: NM,
								fontSize: numFs,
								fontWeight: 700,
								color: NC.orange,
								fontVariantNumeric: "tabular-nums",
								lineHeight: 1,
							}}>
							{FAKE_TABLE_ROWS[TARGET].n}
						</div>
						<div
							style={{
								position: "absolute",
								left: titleX,
								top: titleY,
								transform: "translate(0,-50%)",
								fontFamily: NS,
								fontSize: titleFs,
								fontWeight: 700,
								color: NC.s900,
								letterSpacing: "-.01em",
								whiteSpace: "nowrap",
							}}>
							{FAKE_TABLE_ROWS[TARGET].obra}
						</div>
					</div>
				)}

				{/* ── PREVIEW: overlay + sheet + bridge-3 clone ────────────────────────── */}
				{overlayP > 0.001 && (
					<div
						style={{
							position: "absolute",
							inset: 0,
							background: `rgba(0,0,0,${0.4 * overlayP})`,
							backdropFilter: `blur(${2 * overlayP}px)`,
							WebkitBackdropFilter: `blur(${2 * overlayP}px)`,
						}}
					/>
				)}

				{/* bridge-3 clone: card thumbnail → viewer */}
				{cloneAlive &&
					(() => {
						const gp = gridPos(0);
						const srcCx = gp.x + CW / 2,
							srcCy = gp.y + 70; // thumbnail centre in card
						const srcScale = 0.23; // matches the visible card thumbnail (PdfPage@0.23)
						const cx = lerp(srcCx, VIEW_CX, cloneP),
							cy = lerp(srcCy, VIEW_CY, cloneP);
						const sc = lerp(srcScale, 1.5, cloneP);
						return (
							<div
								style={{
									position: "absolute",
									left: cx,
									top: cy,
									transform: `translate(-50%,-50%)`,
									zIndex: 40,
								}}>
								<div
									style={{
										transform: `scale(${sc})`,
										transformOrigin: "center",
										filter: "drop-shadow(0 24px 50px rgba(0,0,0,.35))",
									}}>
									<div
										style={{
											transform: "translate(-50%,-50%)",
											position: "absolute",
										}}>
										<PdfPage scale={1} />
									</div>
								</div>
							</div>
						);
					})()}

				{/* sheet */}
				{sheetP > 0.001 && (
					<div
						style={{
							position: "absolute",
							left: SHEET_L,
							width: SHEET_W,
							top: SHEET_T,
							bottom: 0,
							background: NC.s50,
							borderRadius: "16px 16px 0 0",
							boxShadow: "0 -20px 60px rgba(0,0,0,.30)",
							transform: `translateY(${(1 - sheetP) * 100}%)`,
							overflow: "hidden",
							border: `1px solid ${NC.s200}`,
							borderBottom: 0,
						}}>
						{/* sheet header */}
						<div
							style={{
								height: SHEET_HEAD,
								background: NC.white,
								borderBottom: `1px solid ${NC.s200}`,
								display: "flex",
								alignItems: "center",
								padding: "0 22px",
								gap: 14,
								boxSizing: "border-box",
							}}>
							<div
								style={{
									width: 38,
									height: 46,
									borderRadius: 6,
									background: NC.s100,
									border: `1px solid ${NC.s200}`,
									position: "relative",
									flexShrink: 0,
								}}>
								<div
									style={{
										position: "absolute",
										top: 9,
										left: 7,
										right: 7,
										height: 4,
										borderRadius: 2,
										background: NC.orange,
									}}
								/>
								<div
									style={{
										position: "absolute",
										top: 19,
										left: 7,
										right: 13,
										height: 3,
										borderRadius: 2,
										background: NC.s300,
									}}
								/>
								<div
									style={{
										position: "absolute",
										top: 27,
										left: 7,
										right: 10,
										height: 3,
										borderRadius: 2,
										background: NC.s300,
									}}
								/>
							</div>
							<div>
								<div
									style={{
										fontFamily: NS,
										fontSize: 15,
										fontWeight: 700,
										color: NC.s900,
									}}>
									Factura_Aceros_14-05.pdf
								</div>
								<div
									style={{
										fontFamily: NS,
										fontSize: 12,
										color: NC.s500,
										marginTop: 2,
									}}>
									Subido por Ignacio L. · 14/05/2026 · Aceros del Litoral S.A.
								</div>
							</div>
							<div style={{ flex: 1 }} />
							<div
								style={{
									display: "inline-flex",
									alignItems: "center",
									gap: 7,
									padding: "9px 16px",
									borderRadius: 9,
									background: NC.white,
									border: `1px solid ${NC.s200}`,
									fontSize: 13,
									fontWeight: 500,
									color: NC.s700,
									boxShadow: "0 1px 0 rgba(0,0,0,.03)",
								}}>
								<Ic
									d={dDataList}
									size={15}
									color={NC.orange}
								/>
								Ver datos
							</div>
							<div
								style={{
									display: "inline-flex",
									alignItems: "center",
									gap: 7,
									padding: "9px 16px",
									borderRadius: 9,
									background: NC.orange,
									border: "1px solid #ea580c",
									fontSize: 13,
									fontWeight: 600,
									color: "#fff",
								}}>
								<Ic
									d={dDownload}
									size={15}
									color='#fff'
								/>
								Descargar
							</div>
							<div
								style={{
									width: 36,
									height: 36,
									borderRadius: 9,
									border: `1px solid ${NC.s200}`,
									background: NC.white,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									color: NC.s500,
									marginLeft: 4,
								}}>
								<Ic
									d={dX}
									size={16}
									color={NC.s500}
								/>
							</div>
						</div>
						{/* viewer */}
						<div
							style={{
								position: "absolute",
								left: 0,
								right: 0,
								top: SHEET_HEAD,
								bottom: 0,
								background: NC.s100,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
							}}>
							<div
								style={{
									opacity: realDocOp,
									transform: `scale(${docSettle})`,
									transformOrigin: "center",
								}}>
								<PdfPage
									scale={1.5}
									origin='center'
								/>
							</div>
						</div>
					</div>
				)}

				{/* cursor (above everything except sheet content it sits on) */}
				<Cursor
					x={curX}
					y={curY}
					scale={curScale}
					opacity={curOp}
					press={cursorPress}
					intent={cursorIntent}
				/>
			</div>
		);
	}
	function factLidAtClick() {
		return 0.92;
	}

	function useNavigationCurrentAnchorStep(ref) {
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

	function DocumentNavigationAnimation() {
		const shellRef = React.useRef(null);
		const isCurrentStep = useNavigationCurrentAnchorStep(shellRef);

		return (
			<div
				ref={shellRef}
				style={{
					position: "relative",
					width: "100%",
					height: "100%",
					minHeight: 0,
					overflow: "hidden",
					background: "#0a0a0a00",
				}}>
				<Stage
					width={W}
					height={H}
					duration={16}
					background={NC.bg}
					active={isCurrentStep}
					persistKey={null}>
					<NavRoot />
				</Stage>
			</div>
		);
	}
	window.DocumentNavigationAnimation = DocumentNavigationAnimation;
})();
