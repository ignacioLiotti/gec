/* eslint-disable react/jsx-no-undef */
/* global React */
(function () {
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
				setIsCurrent(Math.abs(blockCenter - viewportCenter) < 54);
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
			try {
				const v = parseFloat(localStorage.getItem(persistKey + ":t") || "0");
				return isFinite(v) ? clamp(v, 0, duration) : 0;
			} catch {
				return 0;
			}
		});
		const [playing, setPlaying] = React.useState(autoplay);
		const [hoverTime, setHoverTime] = React.useState(null);
		const [scale, setScale] = React.useState(1);

		const stageRef = React.useRef(null);
		const canvasRef = React.useRef(null);
		const rafRef = React.useRef(null);
		const lastTsRef = React.useRef(null);
		const wasActiveRef = React.useRef(active);

		// Persist playhead
		React.useEffect(() => {
			try {
				localStorage.setItem(persistKey + ":t", String(time));
			} catch {}
		}, [time, persistKey]);

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

		React.useEffect(() => {
			if (active && !wasActiveRef.current) {
				setHoverTime(null);
				setTime(0);
				setPlaying(autoplay);
			}
			if (!active && wasActiveRef.current) {
				setHoverTime(null);
				setTime(0);
				setPlaying(false);
				lastTsRef.current = null;
			}
			if (!active && !wasActiveRef.current) {
				setHoverTime(null);
				setTime(0);
				setPlaying(false);
			}
			wasActiveRef.current = active;
		}, [active, autoplay]);

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
			if (!active) return undefined;
			const onKey = (e) => {
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
				data-pendientes-stage='true'
				data-active={active ? "true" : "false"}
				data-playing={playing ? "true" : "false"}
				data-time={displayTime.toFixed(2)}
				style={{
					position: "absolute",
					inset: 0,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					background: "#0a0a0a",
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
							boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
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
						onPlayPause={() => setPlaying((p) => !p)}
						onReset={() => {
							setTime(0);
						}}
						onSeek={(t) => setTime(t)}
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

	// @ds-adherence-ignore -- animation scene code (raw elements/hex/px by design)
	// PENDIENTES FLOW — Sintesis "Vencimientos y pendientes que avisan a tiempo".
	// Concatenated AFTER animations.jsx, so Stage, Sprite, useTime, Easing,
	// interpolate, animate, clamp are already in lexical scope. Do NOT redeclare them.
	//
	// One continuous ~16s sequence, INSIDE an obra (no global sidebar/topbar):
	//   tabs morph (Documentos→Pendientes) · pendientes list (stagger) ·
	//   documento→preview (bridge clone + detected date) · calendar (date flies in) ·
	//   toast a tiempo · resolución (Pendiente→Programado, alerta→aviso activo).

	// ── cubic-bezier easing (motion tokens) ─────────────────────────────────────
	function cbz(x1, y1, x2, y2) {
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
	const pEaseOut = cbz(0.23, 1, 0.32, 1);
	const pEaseInOut = cbz(0.77, 0, 0.175, 1);
	const lerpP = (a, b, t) => a + (b - a) * t;

	// ── palette (Sintesis tokens as literals) ───────────────────────────────────
	const C = {
		canvas: "#faf9f700",
		white: "#ffffff",
		tray: "#f1f0ec",
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
		green50: "#f0fdf4",
		green600: "#15803d",
		greenBd: "#bbf7d0",
		red: "#dc2626",
		red50: "#fef2f2",
		redBd: "#fecaca",
		red700: "#991b1b",
		blue: "#2563eb",
	};
	const FS = '"Geist", system-ui, sans-serif';
	const FM = '"Geist Mono", ui-monospace, monospace';

	// ── stage geometry ──────────────────────────────────────────────────────────
	const W = 1440,
		H = 944,
		PAD = 24;
	const HEADER_H = 72,
		BODY_Y = 132;
	const LIST_X = PAD,
		LIST_W = 716,
		LIST_Y = 174;
	const DETAIL_X = LIST_X + LIST_W + 22; // 992
	const DETAIL_W = W - DETAIL_X - PAD; // 424
	const DETAIL_Y = LIST_Y; // 196

	// table
	const HEAD_H = 56,
		ROW_H = 96;
	const ESTADO_COL_W = 150;
	const VENCE_COL_W = 205;
	const COLS = [
		{ k: "estado", label: "ESTADO", w: ESTADO_COL_W },
		{
			k: "pend",
			label: "PENDIENTE",
			w: LIST_W - ESTADO_COL_W - VENCE_COL_W,
		},
		{ k: "vence", label: "VENCE", w: VENCE_COL_W },
	];
	const colX = (() => {
		const xs = [];
		let acc = 0;
		for (const c of COLS) {
			xs.push(acc);
			acc += c.w;
		}
		return xs;
	})();
	const ROWS = [
		{
			titulo: "Póliza de caución por vencer",
			doc: "Poliza_caucion.pdf",
			vence: "Vence en 5 días",
			venceTone: "orange",
			resp: "Administración",
		},
		{
			titulo: "Certificado mensual sin cargar",
			doc: "Certificado_Abril.pdf",
			vence: "Hoy",
			venceTone: "red",
			resp: "Oficina técnica",
		},
		{
			titulo: "Factura sin validar",
			doc: "Factura_Aceros.pdf",
			vence: "Atrasado 2 días",
			venceTone: "red",
			resp: "Compras",
		},
	];
	const DOC_FOLDERS = [
		{ k: "cert", name: "Certificados", tone: "dark" },
		{ k: "doc", name: "Documentac...", tone: "dark" },
		{ k: "oferta", name: "Oferta", tone: "dark" },
		{ k: "oc", name: "Ordenes de ...", tone: "orange" },
		{ k: "polizas", name: "Polizas", tone: "dark" },
	];
	const DOC_ROWS = [
		{
			name: "Poliza_caucion.pdf",
			type: "PDF",
			date: "24/05/2026",
			area: "Administracion",
			status: "Vigente",
		},
		{
			name: "Certificado_Abril.pdf",
			type: "PDF",
			date: "19/05/2026",
			area: "Oficina tecnica",
			status: "Pendiente",
		},
		{
			name: "Factura_Aceros.pdf",
			type: "PDF",
			date: "17/05/2026",
			area: "Compras",
			status: "A validar",
		},
		{
			name: "Contrato_Ruta_12.pdf",
			type: "PDF",
			date: "02/05/2026",
			area: "Legal",
			status: "Archivado",
		},
	];
	const TARGET = 0;
	const ROW0_CY = LIST_Y + HEAD_H + ROW_H / 2;
	const PEND_SOURCE_X = LIST_X + colX[1] + 22;
	const VENCE_LINE_X = LIST_X + colX[2] + COLS[2].w - 22;
	const VENCE_LINE_END = { x: DETAIL_X + 64, y: DETAIL_Y + 276 };

	// tabs
	const TABS = [
		{ k: "docs", l: "Documentos" },
		{ k: "pend", l: "Pendientes" },
		{ k: "cal", l: "Calendario" },
		{ k: "alert", l: "Alertas" },
	];
	const TAB_W = [148, 140, 140, 116];
	const TAB_GAP = 6;
	const tabX = (() => {
		const xs = [];
		let acc = PAD;
		for (let i = 0; i < TABS.length; i++) {
			xs.push(acc);
			acc += TAB_W[i] + TAB_GAP;
		}
		return xs;
	})();
	const TAB_TOP = 88,
		TAB_H = 44;

	// detail card anchors
	const TITLE_LAND = { x: DETAIL_X + 18, y: DETAIL_Y + 16 }; // chip clone lands here
	const DETECTED = { x: DETAIL_X + DETAIL_W - 112, y: 536 }; // detected-date token home

	// calendar geometry — Mayo 2026 (1 May = Friday; Mon-start grid)
	const CAL_X = DETAIL_X + 18,
		CAL_Y = DETAIL_Y + 18;
	const CAL_GRID_Y = CAL_Y + 64; // after month + weekday header
	const CELL = 49,
		CELL_GAP = 4;
	const dayPos = (d) => {
		const idx = d - 1 + 4; // 1 May -> Friday (col index 4)
		const col = idx % 7,
			row = Math.floor(idx / 7);
		return {
			x: CAL_X + col * (CELL + CELL_GAP),
			y: CAL_GRID_Y + row * (CELL + CELL_GAP),
		};
	};
	const day24 = dayPos(24);
	const DAY24_C = { x: day24.x + CELL / 2, y: day24.y + CELL / 2 };

	// ── stroke icons ─────────────────────────────────────────────────────────────
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
	const dFolder = (
		<path d='M4 20a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3l2 3h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2z' />
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
			<line
				x1='3'
				y1='9'
				x2='21'
				y2='9'
			/>
			<line
				x1='3'
				y1='15'
				x2='21'
				y2='15'
			/>
			<line
				x1='9'
				y1='3'
				x2='9'
				y2='21'
			/>
			<line
				x1='15'
				y1='3'
				x2='15'
				y2='21'
			/>
		</>
	);
	const dCal = (
		<>
			<rect
				x='3'
				y='4'
				width='18'
				height='18'
				rx='2'
			/>
			<line
				x1='16'
				y1='2'
				x2='16'
				y2='6'
			/>
			<line
				x1='8'
				y1='2'
				x2='8'
				y2='6'
			/>
			<line
				x1='3'
				y1='10'
				x2='21'
				y2='10'
			/>
		</>
	);
	const dBell = (
		<>
			<path d='M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9' />
			<path d='M10.3 21a1.94 1.94 0 0 0 3.4 0' />
		</>
	);
	const dAlert = (
		<>
			<path d='M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' />
			<line
				x1='12'
				y1='9'
				x2='12'
				y2='13'
			/>
			<line
				x1='12'
				y1='17'
				x2='12.01'
				y2='17'
			/>
		</>
	);
	const dFile = (
		<>
			<path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
			<polyline points='14 2 14 8 20 8' />
		</>
	);
	const dCheck = <polyline points='20 6 9 17 4 12' />;
	const dClock = (
		<>
			<circle
				cx='12'
				cy='12'
				r='9'
			/>
			<polyline points='12 7 12 12 15 14' />
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
	const dArrowR = (
		<>
			<line
				x1='5'
				y1='12'
				x2='19'
				y2='12'
			/>
			<polyline points='12 5 19 12 12 19' />
		</>
	);
	const dShield = <path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' />;
	const TAB_IC = { docs: dFolder, pend: dAlert, cal: dCal, alert: dBell };

	// ── notch tail (signature) ───────────────────────────────────────────────────
	function NotchTail({
		side,
		w = 24,
		h = 15,
		fill = C.white,
		stroke = C.border,
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

	// ── status chip ───────────────────────────────────────────────────────────────
	const CHIP_TONE = {
		gray: { bg: C.s100, bd: C.s200, fg: C.s600, dot: C.s400 },
		orange: { bg: C.orange50, bd: C.orange100, fg: "#9a3412", dot: C.orange },
		red: { bg: C.red50, bd: C.redBd, fg: C.red700, dot: C.red },
		green: { bg: C.green50, bd: C.greenBd, fg: C.green600, dot: C.green },
	};
	function StatusChip({ tone, label, icon }) {
		const T = CHIP_TONE[tone];
		return (
			<span
				style={{
					display: "inline-flex",
					alignItems: "center",
					gap: 8,
					padding: "6px 13px",
					borderRadius: 99,
					fontSize: 14,
					fontWeight: 650,
					border: `1px solid ${T.bd}`,
					background: T.bg,
					color: T.fg,
					whiteSpace: "nowrap",
					maxWidth: "100%",
					minWidth: 0,
					boxSizing: "border-box",
				}}>
				{icon ? (
					<Ic
						d={icon}
						size={14}
						color={T.dot}
					/>
				) : (
					<span
						style={{ width: 8, height: 8, borderRadius: 99, background: T.dot }}
					/>
				)}
				<span
					style={{
						minWidth: 0,
						overflow: "hidden",
						textOverflow: "ellipsis",
					}}>
					{label}
				</span>
			</span>
		);
	}
	function DocChip({ name }) {
		return (
			<span
				style={{
					display: "inline-flex",
					alignItems: "center",
					gap: 8,
					padding: "6px 11px",
					borderRadius: 9,
					border: `1px solid ${C.s200}`,
					background: C.white,
					boxShadow: "0 1px 0 rgba(0,0,0,.03)",
					maxWidth: 194,
				}}>
				<Ic
					d={dFile}
					size={14}
					color={C.orange}
				/>
				<span
					style={{
						fontFamily: FM,
						fontSize: 12.5,
						color: C.s700,
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
					}}>
					{name}
				</span>
			</span>
		);
	}

	// ── header (obra context, no global chrome) ───────────────────────────────────
	function FolderFront({ gradientId, firstStopColor, secondStopColor, style }) {
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

	function Folder3D({ name, tone, folderKey, open = 0 }) {
		const isOrange = tone === "orange";
		const backGradient = isOrange
			? "linear-gradient(180deg, #f59e0b, #b45309)"
			: "linear-gradient(180deg, #78716c, #44403c)";
		const frontFirst = isOrange ? "#fe9a00" : "#79716b";
		const frontSecond = isOrange ? "#fb8634" : "#57534d";
		const frontTilt = -open * 30;
		const paperTop = -10 - open * 18;
		return (
			<div
				style={{
					width: 208,
					height: 158,
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
						<span
							style={{
								position: "absolute",
								top: paperTop,
								left: "50%",
								height: 94,
								width: 120,
								transform: "translateX(-50%)",
								border: `1px solid ${C.s200}`,
								background: `linear-gradient(180deg, ${C.s50}, ${C.s200})`,
							}}
						/>
						<FolderFront
							gradientId={`pend-folder-${folderKey}`}
							firstStopColor={frontFirst}
							secondStopColor={frontSecond}
							style={{
								position: "absolute",
								bottom: -5,
								left: -29,
								height: 94,
								width: 168,
								transformOrigin: "50% 100%",
								transform: `perspective(800px) rotateX(${frontTilt}deg)`,
							}}
						/>
						{isOrange ? (
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
								fontFamily: FS,
								fontSize: 16,
								lineHeight: "20px",
								fontWeight: 650,
								color: "#fff",
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
							}}>
							{name}
						</div>
					</div>
				</div>
			</div>
		);
	}

	function Header({ finalP }) {
		return (
			<div
				style={{
					position: "absolute",
					left: 0,
					right: 0,
					top: 0,
					height: HEADER_H,
					background: C.white,
					borderBottom: `1px solid ${C.border}`,
					display: "flex",
					alignItems: "center",
					padding: "0 48px",
					gap: 16,
				}}>
				<div
					style={{
						width: 34,
						height: 34,
						borderRadius: "50%",
						border: `1px solid ${C.s200}`,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: C.s500,
					}}>
					<Ic
						d={dChevL}
						size={16}
						color={C.s500}
					/>
				</div>
				<span
					style={{
						fontSize: 30,
						fontWeight: 700,
						color: C.orange,
						fontVariantNumeric: "tabular-nums",
						letterSpacing: "-.01em",
						lineHeight: 1,
					}}>
					3
				</span>
				<span
					style={{
						fontSize: 22,
						fontWeight: 700,
						letterSpacing: "-.01em",
						color: C.s900,
						whiteSpace: "nowrap",
						flexShrink: 0,
					}}>
					Ruta Prov. 12 — Tramo III
				</span>
				<span
					style={{
						display: "inline-flex",
						alignItems: "center",
						gap: 7,
						padding: "5px 12px",
						borderRadius: 99,
						border: `1px solid ${C.s200}`,
						fontSize: 12,
						color: C.s600,
					}}>
					Vialidad Provincial
				</span>
				<div style={{ flex: 1 }} />
				<div style={{ position: "relative", height: 24, width: 320 }}>
					<span
						style={{
							position: "absolute",
							right: 0,
							top: 3,
							fontSize: 13,
							color: C.s500,
							opacity: 1 - finalP,
							whiteSpace: "nowrap",
						}}>
						Mayo 2026
					</span>
					<div
						style={{
							position: "absolute",
							right: 0,
							top: 0,
							display: "flex",
							alignItems: "center",
							gap: 16,
							opacity: finalP,
							whiteSpace: "nowrap",
						}}>
						<span
							style={{
								display: "inline-flex",
								alignItems: "center",
								gap: 7,
								fontSize: 13,
								color: C.s700,
							}}>
							<span
								style={{
									width: 8,
									height: 8,
									borderRadius: 99,
									background: C.green,
								}}
							/>
							<b style={{ color: C.s900, fontWeight: 600 }}>3</b> avisos activos
						</span>
						<span
							style={{
								display: "inline-flex",
								alignItems: "center",
								gap: 7,
								fontSize: 13,
								color: C.s700,
							}}>
							<span
								style={{
									width: 8,
									height: 8,
									borderRadius: 99,
									background: C.red,
								}}
							/>
							<b style={{ color: C.s900, fontWeight: 600 }}>1</b> atrasado
						</span>
					</div>
				</div>
			</div>
		);
	}

	// ── tabs (notched active panel morphs Documentos -> Pendientes) ───────────────
	function Tabs({ morph, hover, press }) {
		const activeX = lerpP(tabX[0], tabX[1], morph);
		const activeW = lerpP(TAB_W[0], TAB_W[1], morph);
		const pscale = 1 - press * 0.03;
		const hoverBg = hover * (1 - morph) * 0.55;
		const pillTop = TAB_TOP + 4;
		const pillH = 36;
		return (
			<>
				<div
					style={{
						position: "absolute",
						left: 0,
						right: 0,
						top: HEADER_H,
						height: BODY_Y - HEADER_H,
						background: C.canvas,
						borderBottom: `1px solid ${C.s200}`,
					}}
				/>
				{hoverBg > 0.01 && (
					<div
						style={{
							position: "absolute",
							left: tabX[1] + 6,
							top: pillTop,
							width: TAB_W[1] - 12,
							height: pillH,
							borderRadius: 12,
							background: `rgba(120,113,108,${0.12 * hoverBg})`,
						}}
					/>
				)}
				<div
					style={{
						position: "absolute",
						left: activeX + 6,
						top: pillTop,
						width: activeW - 12,
						height: pillH,
						background: C.s900,
						borderRadius: 12,
						boxShadow: "0 8px 20px -16px rgba(28,25,23,.65)",
						transform: `scale(${pscale})`,
						transformOrigin: "center",
						zIndex: 3,
					}}
				/>
				{TABS.map((tb, i) => {
					const act = i === 0 ? 1 - morph : i === 1 ? morph : 0;
					const on = act > 0.5;
					const labelTone = lerpP(0, 1, act);
					return (
						<div
							key={tb.k}
							style={{
								position: "absolute",
								left: tabX[i],
								top: pillTop,
								width: TAB_W[i],
								height: pillH,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								gap: 8,
								zIndex: 4,
								fontFamily: FS,
								fontSize: 13,
								fontWeight: 600,
								color: labelTone > 0.45 ? C.white : C.s500,
							}}>
							<Ic
								d={TAB_IC[tb.k]}
								size={14}
								color={labelTone > 0.45 ? C.white : C.s500}
							/>
							{tb.l}
						</div>
					);
				})}
			</>
		);
	}

	// ── pendientes list ────────────────────────────────────────────────────────────
	function DocumentsView({ exit }) {
		const op = 1 - exit;
		const panelX = 36;
		const panelTop = BODY_Y + 20;
		const panelW = W - panelX * 2;
		const panelBottom = 76;
		const foldersTop = panelTop + 88;
		return (
			<div
				style={{
					position: "absolute",
					inset: 0,
					opacity: op,
					transform: `translateY(${exit * 16}px)`,
					filter: `blur(${exit * 1.2}px)`,
					zIndex: 1,
				}}>
				<div
					style={{
						position: "absolute",
						left: panelX,
						top: panelTop,
						width: panelW,
						bottom: panelBottom,
						background: C.white,
						border: "1px solid #d9d9d9",
						borderRadius: 10,
						boxShadow: "0 1px 2px rgba(28,25,23,.06)",
						overflow: "hidden",
					}}>
					<div style={{ position: "absolute", left: 20, top: 22 }}>
						<div
							style={{
								fontFamily: FS,
								fontSize: 22,
								fontWeight: 650,
								color: C.s900,
								letterSpacing: "-.01em",
							}}>
							Documentos
						</div>
						<div
							style={{
								fontFamily: FS,
								fontSize: 13,
								color: C.s500,
								marginTop: 2,
							}}>
							0 archivos - 5 carpetas - 0 GB
						</div>
					</div>

					<div
						style={{
							position: "absolute",
							left: 66,
							right: 66,
							top: foldersTop - panelTop,
							height: 158,
							display: "flex",
							alignItems: "flex-end",
							justifyContent: "space-between",
						}}>
						{DOC_FOLDERS.map((f, i) => {
							return (
								<div
									key={f.k}
									style={{ width: 208, height: 158, flexShrink: 0 }}>
									<Folder3D
										folderKey={f.k}
										name={f.name}
										tone={f.tone}
										open={0}
									/>
								</div>
							);
						})}
					</div>

					<div
						style={{
							position: "absolute",
							left: 0,
							right: 0,
							top: foldersTop - panelTop + 174,
							height: 1,
							background: "#d9d9d9",
						}}
					/>
				</div>
			</div>
		);
	}

	function PendList({ t, rowSel, estadoMorph, venceMorph }) {
		return (
			<div
				style={{
					position: "absolute",
					left: LIST_X,
					top: LIST_Y,
					width: LIST_W,
					background: C.white,
					border: `1px solid ${C.s200}`,
					borderRadius: 15,
					boxShadow: "0 1px 0 rgba(0,0,0,.03)",
					overflow: "hidden",
				}}>
				<div
					style={{
						display: "flex",
						height: HEAD_H,
						background: "#f7f6f3",
						borderBottom: `1px solid ${C.s200}`,
					}}>
					{COLS.map((c) => (
						<div
							key={c.k}
							style={{
								width: c.w,
								flex: `0 0 ${c.w}px`,
								padding: "0 20px",
								boxSizing: "border-box",
								display: "flex",
								alignItems: "center",
								fontFamily: FS,
								fontSize: 12.5,
								fontWeight: 750,
								letterSpacing: ".095em",
								color: C.s500,
							}}>
							{c.label}
						</div>
					))}
				</div>
				{ROWS.map((r, i) => {
					const rin = pEaseOut(clamp((t - (2.55 + i * 0.18)) / 0.46, 0, 1));
					const isT = i === TARGET;
					const sel = isT ? rowSel : 0;
					const bg =
						isT && sel > 0.01
							? `rgba(255,88,0,${0.07 * sel})`
							: i % 2
								? "#fcfbfa"
								: "#fff";
					return (
						<div
							key={i}
							style={{
								position: "relative",
								display: "flex",
								alignItems: "center",
								height: ROW_H,
								borderBottom:
									i < ROWS.length - 1 ? `1px solid ${C.s100}` : "none",
								background: bg,
								opacity: rin,
								transform: `translateY(${(1 - rin) * 10}px)`,
							}}>
							{isT && sel > 0.02 && (
								<div
									style={{
										position: "absolute",
										left: 0,
										top: 0,
										bottom: 0,
										width: 3,
										background: C.orange,
										opacity: sel,
									}}
								/>
							)}
							<div
								style={{
									width: COLS[0].w,
									flex: `0 0 ${COLS[0].w}px`,
									padding: "0 12px",
									boxSizing: "border-box",
								}}>
								{isT ? (
									<div style={{ position: "relative", height: 31 }}>
										<div
											style={{
												position: "absolute",
												width: "100%",
												opacity: 1 - estadoMorph,
											}}>
											<StatusChip
												tone='gray'
												label='Pendiente'
											/>
										</div>
										<div
											style={{
												position: "absolute",
												width: "100%",
												opacity: estadoMorph,
											}}>
											<StatusChip
												tone='green'
												label='Programado'
											/>
										</div>
									</div>
								) : (
									<StatusChip
										tone='gray'
										label='Pendiente'
									/>
								)}
							</div>
							<div
								style={{
									width: COLS[1].w,
									flex: `0 0 ${COLS[1].w}px`,
									minWidth: 0,
									padding: "0 18px",
									boxSizing: "border-box",
									fontFamily: FS,
									fontSize: 18,
									fontWeight: 450,
									color: C.s900,
									lineHeight: 1.16,
									letterSpacing: "-.01em",
									whiteSpace: "nowrap",
									overflow: "hidden",
									textOverflow: "ellipsis",
								}}>
								{r.titulo}
							</div>
							<div
								style={{
									width: COLS[2].w,
									flex: `0 0 ${COLS[2].w}px`,
									minWidth: 0,
									padding: "0 10px",
									boxSizing: "border-box",
								}}>
								{isT ? (
									<div
										style={{ position: "relative", height: 31, width: "100%" }}>
										<div
											style={{
												position: "absolute",
												width: "100%",
												opacity: 1 - venceMorph,
											}}>
											<StatusChip
												tone='orange'
												icon={dClock}
												label='Vence en 5 días'
											/>
										</div>
										<div
											style={{
												position: "absolute",
												width: "100%",
												opacity: venceMorph,
											}}>
											<StatusChip
												tone='green'
												icon={dCheck}
												label='Aviso activo'
											/>
										</div>
									</div>
								) : (
									<StatusChip
										tone={r.venceTone}
										icon={r.vence === "Hoy" ? dClock : dAlert}
										label={r.vence}
									/>
								)}
							</div>
						</div>
					);
				})}
			</div>
		);
	}

	// ── póliza preview sheet ──────────────────────────────────────────────────────
	function PolizaSheet({ highlight }) {
		const lbl = {
			fontFamily: FS,
			fontSize: 8.8,
			fontWeight: 750,
			letterSpacing: ".1em",
			color: C.s400,
		};
		const val = {
			fontFamily: FS,
			fontSize: 13.2,
			fontWeight: 650,
			color: C.s800,
			marginTop: 3,
		};
		return (
			<div
				style={{
					width: "100%",
					background: "#fff",
					borderRadius: 10,
					border: `1px solid ${C.s200}`,
					boxShadow: "0 14px 30px -16px rgba(28,25,23,.26)",
					padding: "20px 22px",
					boxSizing: "border-box",
					position: "relative",
				}}>
				<div style={{ display: "flex", alignItems: "center", gap: 11 }}>
					<div
						style={{
							width: 28,
							height: 28,
							borderRadius: 7,
							background: C.orange,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}>
						<Ic
							d={dShield}
							size={15}
							color='#fff'
						/>
					</div>
					<div
						style={{
							fontFamily: FS,
							fontSize: 13,
							fontWeight: 700,
							letterSpacing: ".04em",
							color: C.s900,
						}}>
						PÓLIZA DE CAUCIÓN
					</div>
				</div>
				<div style={{ height: 1, background: C.s200, margin: "16px 0" }} />
				<div style={{ display: "flex", gap: 28 }}>
					<div>
						<div style={lbl}>ASEGURADO</div>
						<div style={val}>Constructora Norte S.A.</div>
					</div>
					<div>
						<div style={lbl}>N° PÓLIZA</div>
						<div style={{ ...val, fontFamily: FM }}>884.512</div>
					</div>
				</div>
				<div style={{ display: "flex", gap: 28, marginTop: 15 }}>
					<div>
						<div style={lbl}>RAMO</div>
						<div style={val}>Garantía de oferta</div>
					</div>
					<div>
						<div style={lbl}>MONTO</div>
						<div style={{ ...val, fontFamily: FM }}>$ 4.180.000</div>
					</div>
				</div>
				{/* highlighted vencimiento field */}
				<div
					style={{
						marginTop: 18,
						borderRadius: 10,
						padding: "11px 13px",
						background:
							lerpP(0, 1, highlight) > 0.02 ? C.orange50 : "transparent",
						border: `1px solid ${highlight > 0.02 ? C.orange100 : "transparent"}`,
						transition: "none",
					}}>
					<div
						style={{ ...lbl, color: highlight > 0.2 ? C.orange600 : C.s400 }}>
						VENCIMIENTO
					</div>
					<div
						style={{
							...val,
							fontFamily: FM,
							color: highlight > 0.2 ? C.orange600 : C.s800,
							fontSize: 15.5,
						}}>
						24/05/2026
					</div>
				</div>
			</div>
		);
	}

	// ── calendar (Mayo 2026) ──────────────────────────────────────────────────────
	const CAL_MARKS = [
		{ d: 17, tone: "red", label: "Factura atrasada" },
		{ d: 19, tone: "red", label: "Certificado (hoy)", today: true },
		{ d: 24, tone: "orange", label: "Póliza vence" },
	];
	function Calendar({ enter, mark24, markFact, markCert }) {
		const week = ["L", "M", "X", "J", "V", "S", "D"];
		const markOf = (d) => {
			if (d === 24) return mark24;
			if (d === 19) return markCert;
			if (d === 17) return markFact;
			return 0;
		};
		const days = [];
		for (let d = 1; d <= 31; d++) days.push(d);
		return (
			<div
				style={{
					position: "absolute",
					left: DETAIL_X,
					top: DETAIL_Y,
					width: DETAIL_W,
					opacity: enter,
					transform: `translateX(${(1 - enter) * 36}px)`,
				}}>
				<div
					style={{
						background: C.white,
						border: `1px solid ${C.s200}`,
						borderRadius: 14,
						boxShadow: "0 1px 0 rgba(0,0,0,.03)",
						padding: "16px 16px 18px",
						boxSizing: "border-box",
					}}>
					{/* month header */}
					<div
						style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
						<Ic
							d={dCal}
							size={16}
							color={C.s700}
						/>
						<span
							style={{
								marginLeft: 10,
								fontFamily: FS,
								fontSize: 15,
								fontWeight: 700,
								color: C.s900,
							}}>
							Mayo 2026
						</span>
						<div style={{ flex: 1 }} />
						<div style={{ display: "flex", gap: 6 }}>
							<div
								style={{
									width: 26,
									height: 26,
									borderRadius: 7,
									border: `1px solid ${C.s200}`,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									color: C.s500,
								}}>
								<Ic
									d={dChevL}
									size={13}
									color={C.s500}
								/>
							</div>
							<div
								style={{
									width: 26,
									height: 26,
									borderRadius: 7,
									border: `1px solid ${C.s200}`,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									color: C.s500,
								}}>
								<Ic
									d={dChevR}
									size={13}
									color={C.s500}
								/>
							</div>
						</div>
					</div>
					{/* weekday header */}
					<div style={{ display: "flex" }}>
						{week.map((w, i) => (
							<div
								key={i}
								style={{
									width: CELL,
									marginRight: i < 6 ? CELL_GAP : 0,
									textAlign: "center",
									fontFamily: FS,
									fontSize: 10,
									fontWeight: 700,
									letterSpacing: ".08em",
									color: C.s400,
									paddingBottom: 8,
								}}>
								{w}
							</div>
						))}
					</div>
					{/* grid */}
					<div style={{ display: "flex", flexWrap: "wrap", gap: CELL_GAP }}>
						{/* leading blanks: 1 May = Fri -> 4 blanks */}
						{[0, 1, 2, 3].map((b) => (
							<div
								key={"b" + b}
								style={{ width: CELL, height: CELL }}
							/>
						))}
						{days.map((d) => {
							const m = CAL_MARKS.find((x) => x.d === d);
							const mp = markOf(d);
							const tone = m ? (m.tone === "orange" ? C.orange : C.red) : null;
							const today = m && m.today;
							return (
								<div
									key={d}
									style={{
										width: CELL,
										height: CELL,
										borderRadius: 9,
										display: "flex",
										flexDirection: "column",
										alignItems: "center",
										justifyContent: "center",
										position: "relative",
										background:
											m && mp > 0.05
												? m.tone === "orange"
													? C.orange50
													: C.red50
												: "transparent",
										border:
											today && mp > 0.05
												? `1.5px solid ${C.red}`
												: m && mp > 0.05
													? `1px solid ${m.tone === "orange" ? C.orange100 : C.redBd}`
													: "1px solid transparent",
									}}>
									<span
										style={{
											fontFamily: FM,
											fontSize: 13,
											fontWeight: today ? 700 : 500,
											color:
												m && mp > 0.05
													? m.tone === "orange"
														? C.orange600
														: C.red700
													: C.s600,
											fontVariantNumeric: "tabular-nums",
										}}>
										{d}
									</span>
									{m && (
										<span
											style={{
												position: "absolute",
												bottom: 6,
												width: 5,
												height: 5,
												borderRadius: 99,
												background: tone,
												opacity: mp,
												transform: `scale(${mp})`,
											}}
										/>
									)}
								</div>
							);
						})}
					</div>
					{/* legend */}
					<div
						style={{
							marginTop: 14,
							paddingTop: 12,
							borderTop: `1px solid ${C.s100}`,
							display: "flex",
							flexDirection: "column",
							gap: 8,
						}}>
						{CAL_MARKS.slice()
							.sort((a, b) => a.d - b.d)
							.map((m) => {
								const mp = markOf(m.d);
								const tone = m.tone === "orange" ? C.orange : C.red;
								return (
									<div
										key={m.d}
										style={{
											display: "flex",
											alignItems: "center",
											gap: 9,
											opacity: mp,
											transform: `translateX(${(1 - mp) * 6}px)`,
										}}>
										<span
											style={{
												width: 8,
												height: 8,
												borderRadius: 99,
												background: tone,
												flexShrink: 0,
											}}
										/>
										<span
											style={{
												fontFamily: FM,
												fontSize: 11,
												color: C.s500,
												width: 26,
											}}>
											{m.d} may
										</span>
										<span
											style={{
												fontFamily: FS,
												fontSize: 12.5,
												fontWeight: 500,
												color: C.s800,
											}}>
											{m.label}
										</span>
									</div>
								);
							})}
					</div>
				</div>
			</div>
		);
	}

	// ── empty detail state (scene 2) ──────────────────────────────────────────────
	function EmptyDetail({ op }) {
		return (
			<div
				style={{
					position: "absolute",
					left: DETAIL_X,
					top: DETAIL_Y,
					width: DETAIL_W,
					height: 430,
					opacity: op,
					border: `1.5px dashed ${C.s200}`,
					borderRadius: 14,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					gap: 14,
					boxSizing: "border-box",
					padding: 24,
				}}>
				<div
					style={{
						width: 46,
						height: 46,
						borderRadius: 12,
						background: C.s100,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: C.s400,
					}}>
					<Ic
						d={dFile}
						size={20}
						color={C.s400}
					/>
				</div>
				<div
					style={{
						fontFamily: FS,
						fontSize: 13.5,
						color: C.s500,
						textAlign: "center",
						maxWidth: 240,
						lineHeight: 1.4,
					}}>
					Seleccioná un pendiente para ver el documento atado
				</div>
			</div>
		);
	}

	// ── preview card (scene 3) ─────────────────────────────────────────────────────
	function PreviewCard({ op, sheetHl, detectedIn }) {
		return (
			<div
				style={{
					position: "absolute",
					left: DETAIL_X,
					top: DETAIL_Y,
					width: DETAIL_W,
					opacity: op,
				}}>
				<div
					style={{
						background: C.white,
						border: `1px solid ${C.s200}`,
						borderRadius: 14,
						boxShadow: "0 14px 36px -10px rgba(28,25,23,.18)",
						overflow: "hidden",
					}}>
					{/* title strip — chip clone lands here; subtitle + PDF badge */}
					<div
						style={{
							height: 64,
							padding: "0 18px",
							display: "flex",
							alignItems: "flex-end",
							borderBottom: `1px solid ${C.s100}`,
							position: "relative",
						}}>
						<div
							style={{
								fontFamily: FS,
								fontSize: 11,
								color: C.s400,
								paddingBottom: 9,
							}}>
							Documento adjunto · Administración
						</div>
						<span
							style={{
								position: "absolute",
								top: 16,
								right: 18,
								fontSize: 9.5,
								fontWeight: 750,
								letterSpacing: ".06em",
								color: "#fff",
								background: C.red,
								borderRadius: 5,
								padding: "3px 7px",
							}}>
							PDF
						</span>
					</div>
					<div style={{ padding: 18 }}>
						<PolizaSheet highlight={sheetHl} />
					</div>
					{/* detected box */}
					<div
						style={{
							margin: "0 18px 18px",
							borderRadius: 12,
							background: C.orange50,
							border: `1px solid ${C.orange100}`,
							padding: "14px 15px",
							display: "flex",
							alignItems: "center",
							gap: 13,
							opacity: detectedIn,
							transform: `translateY(${(1 - detectedIn) * 8}px)`,
						}}>
						<Ic
							d={dAlert}
							size={20}
							color={C.orange}
						/>
						<div style={{ flex: 1 }}>
							<div
								style={{
									fontFamily: FS,
									fontSize: 10.5,
									fontWeight: 750,
									letterSpacing: ".1em",
									color: C.orange600,
								}}>
								VENCIMIENTO DETECTADO
							</div>
							<div
								style={{
									fontFamily: FM,
									fontSize: 18,
									fontWeight: 700,
									color: C.s900,
									marginTop: 3,
								}}>
								24/05/2026
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// ── toast (scene 5) ────────────────────────────────────────────────────────────
	function Toast({ p, press }) {
		const TW = 340,
			TX = W - PAD - TW;
		return (
			<div
				style={{
					position: "absolute",
					left: TX,
					top: 148,
					width: TW,
					opacity: p,
					transform: `translateY(${(1 - p) * -130}px)`,
					zIndex: 50,
				}}>
				<div
					style={{
						background: C.white,
						borderRadius: 14,
						border: `1px solid ${C.s200}`,
						boxShadow: "0 20px 48px -12px rgba(28,25,23,.28)",
						overflow: "hidden",
						display: "flex",
					}}>
					<div style={{ width: 4, background: C.orange, flexShrink: 0 }} />
					<div style={{ padding: "14px 16px", flex: 1 }}>
						<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
							<Ic
								d={dBell}
								size={14}
								color={C.orange}
							/>
							<span
								style={{
									fontFamily: FS,
									fontSize: 9.5,
									fontWeight: 700,
									letterSpacing: ".12em",
									color: C.s400,
								}}>
								RECORDATORIO PROGRAMADO
							</span>
						</div>
						<div
							style={{
								fontFamily: FS,
								fontSize: 14.5,
								fontWeight: 600,
								color: C.s900,
								marginTop: 9,
								lineHeight: 1.35,
							}}>
							Póliza de caución vence en 5 días
						</div>
						<div
							style={{
								fontFamily: FS,
								fontSize: 12,
								color: C.s500,
								marginTop: 3,
							}}>
							Ruta Prov. 12 · Administración
						</div>
						<div
							style={{
								display: "flex",
								justifyContent: "flex-end",
								marginTop: 12,
							}}>
							<span
								style={{
									display: "inline-flex",
									alignItems: "center",
									gap: 7,
									padding: "7px 13px",
									borderRadius: 9,
									background: C.s900,
									color: "#fff",
									fontFamily: FS,
									fontSize: 12.5,
									fontWeight: 600,
									transform: `scale(${1 - press * 0.05})`,
								}}>
								Ver pendiente{" "}
								<Ic
									d={dArrowR}
									size={13}
									color='#fff'
								/>
							</span>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// ── cursor ──────────────────────────────────────────────────────────────────
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
							zIndex: 69,
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
							background: C.orange,
							opacity: dotOpacity,
							transform: `scale(${0.75 + press * 0.5})`,
							transformOrigin: "center",
							zIndex: 69,
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
						zIndex: 70,
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
	// ROOT
	// ════════════════════════════════════════════════════════════════════════════
	function PendRoot() {
		const t = useTime();
		const calendarHold = 2.0;

		// ── scene 1: tab morph ─────────────────────────────────────────────────────
		const tabHover = clamp((t - 0.95) / 0.38, 0, 1);
		const tabPress =
			clamp((t - 1.52) / 0.1, 0, 1) * (1 - clamp((t - 1.64) / 0.14, 0, 1));
		const tabMorph = pEaseInOut(clamp((t - 1.66) / 0.72, 0, 1));
		const docOut = pEaseInOut(clamp((t - 1.78) / 0.78, 0, 1));
		const pendIn = pEaseOut(clamp((t - 2.28) / 0.66, 0, 1));

		// ── scene 3: select póliza + bridge ────────────────────────────────────────
		const rowClick = 5.72;
		const rowSel = clamp((t - rowClick) / 0.3, 0, 1);
		const rowPress =
			clamp((t - rowClick) / 0.09, 0, 1) *
			(1 - clamp((t - rowClick - 0.12) / 0.12, 0, 1));
		const chipFly = pEaseInOut(clamp((t - 5.84) / 0.82, 0, 1));
		const chipAlive = t >= 5.84;
		const previewForm = pEaseOut(clamp((t - 6.34) / 0.52, 0, 1));
		const sheetHl = clamp((t - 6.82) / 0.42, 0, 1);
		const detectedIn = pEaseOut(clamp((t - 7.06) / 0.46, 0, 1));

		// ── scene 4: calendar ──────────────────────────────────────────────────────
		const dateFly = pEaseInOut(clamp((t - 8.34) / 0.8, 0, 1));
		const dateAlive = t >= 8.34 && dateFly < 0.985;
		const previewOut = clamp((t - 8.34) / 0.48, 0, 1);
		const calIn = pEaseOut(clamp((t - 8.58) / 0.72, 0, 1));
		const mark24 = clamp((t - 9.02) / 0.32, 0, 1);
		const markFact = clamp((t - 10.2) / 0.32, 0, 1);
		const markCert = clamp((t - 10.5) / 0.32, 0, 1);

		// ── scene 5: toast ─────────────────────────────────────────────────────────
		const toastIn = pEaseOut(clamp((t - (11.55 + calendarHold)) / 0.36, 0, 1));
		const verPress =
			clamp((t - (13.08 + calendarHold)) / 0.09, 0, 1) *
			(1 - clamp((t - (13.2 + calendarHold)) / 0.12, 0, 1));
		const toastOut = clamp((t - (13.34 + calendarHold)) / 0.32, 0, 1);
		const toastP = toastIn * (1 - toastOut);

		// ── scene 6: resolution ────────────────────────────────────────────────────
		const listRaise = clamp((t - (13.5 + calendarHold)) / 0.5, 0, 1);
		const estadoMorph = pEaseInOut(
			clamp((t - (14.02 + calendarHold)) / 0.5, 0, 1),
		);
		const venceMorph = pEaseInOut(
			clamp((t - (14.26 + calendarHold)) / 0.5, 0, 1),
		);
		const finalP = pEaseOut(clamp((t - (14.9 + calendarHold)) / 0.5, 0, 1));

		// list opacity through the timeline
		let listOp = pendIn;
		if (t >= 8.45) listOp = lerpP(pendIn, 0.2, clamp((t - 8.45) / 0.72, 0, 1));
		if (t >= 13.5 + calendarHold) listOp = lerpP(0.2, 1, listRaise);

		// detail content opacities
		const listAppeared = pendIn > 0.02;
		const detailIn = pEaseOut(clamp((t - 2.65) / 0.45, 0, 1));
		const emptyOp = listAppeared
			? pendIn * detailIn * (1 - clamp((t - 5.78) / 0.42, 0, 1))
			: 0;
		const previewOp = previewForm * (1 - previewOut);
		const calShow = t >= 8.34;

		// ── cursor ──────────────────────────────────────────────────────────────────
		const CT = [
			0,
			0.78,
			1.52,
			1.78,
			5.26,
			5.72,
			7.72,
			11.36 + calendarHold,
			13.0 + calendarHold,
			16 + calendarHold,
		];
		const CXk = [
			1300,
			1300,
			tabX[1] + TAB_W[1] / 2,
			tabX[1] + TAB_W[1] / 2,
			320,
			320,
			320,
			1180,
			1316,
			1316,
		];
		const CYk = [
			852,
			852,
			TAB_TOP + TAB_H / 2,
			TAB_TOP + TAB_H / 2,
			ROW0_CY,
			ROW0_CY,
			ROW0_CY,
			150,
			240,
			240,
		];
		const curX = interpolate(CT, CXk, pEaseInOut)(t);
		const curY = interpolate(CT, CYk, pEaseInOut)(t);
		let curOp = 1;
		curOp *= 1 - clamp((t - 7.72) / 0.42, 0, 1);
		curOp = Math.max(curOp, clamp((t - 11.36) / 0.45, 0, 1));
		curOp *= 1 - clamp((t - 13.32) / 0.35, 0, 1);
		const cursorPress = Math.max(tabPress, rowPress, verPress);
		const clickCue = (at, lead = 0.48) => {
			const cueIn = pEaseOut(clamp((t - (at - lead)) / (lead * 0.58), 0, 1));
			const cueOut = 1 - clamp((t - (at + 0.18)) / 0.24, 0, 1);
			return cueIn * cueOut;
		};
		const cursorIntent = Math.max(
			clickCue(1.52, 0.46),
			clickCue(rowClick, 0.5),
			clickCue(13.08 + calendarHold, 0.54),
		);
		const curScale = 1 - 0.1 * cursorPress;

		// connector line draw-on (vence chip -> detected box)
		const connDash = 360;
		const connOff = connDash * (1 - detectedIn) * (1 - previewOut);

		return (
			<div
				style={{
					position: "absolute",
					inset: 0,
					background: C.canvas,
					fontFamily: FS,
					overflow: "hidden",
				}}>
				{/* white work body */}
				<div
					style={{
						position: "absolute",
						left: 0,
						right: 0,
						top: BODY_Y,
						bottom: 0,
						background: C.white,
					}}
				/>

				{docOut < 0.999 && <DocumentsView exit={docOut} />}

				{/* list */}
				{pendIn > 0.01 && (
					<div
						style={{
							position: "absolute",
							inset: 0,
							opacity: listOp,
							transform: `translateY(${(1 - pendIn) * 18}px)`,
							zIndex: 2,
						}}>
						<PendList
							t={t}
							rowSel={rowSel * (1 - rowPress * 0.0)}
							estadoMorph={estadoMorph}
							venceMorph={venceMorph}
						/>
					</div>
				)}

				{/* detail: empty -> preview -> calendar */}
				{emptyOp > 0.01 && <EmptyDetail op={emptyOp} />}
				{previewOp > 0.01 && (
					<PreviewCard
						op={previewOp}
						sheetHl={sheetHl}
						detectedIn={detectedIn}
					/>
				)}
				{calShow && (
					<Calendar
						enter={calIn}
						mark24={mark24}
						markFact={markFact}
						markCert={markCert}
					/>
				)}

				{/* connector line (scene 3) */}
				{detectedIn > 0.01 && previewOut < 0.999 && (
					<svg
						width={W}
						height={H}
						style={{
							position: "absolute",
							inset: 0,
							pointerEvents: "none",
							opacity: 1 - previewOut,
							zIndex: 25,
						}}>
						<path
							d={`M ${VENCE_LINE_X} ${ROW0_CY} C ${VENCE_LINE_X + 70} ${ROW0_CY}, ${DETAIL_X - 36} ${VENCE_LINE_END.y - 34}, ${VENCE_LINE_END.x} ${VENCE_LINE_END.y}`}
							fill='none'
							stroke={C.orange}
							strokeWidth='1.6'
							strokeDasharray={connDash}
							strokeDashoffset={connOff}
							strokeLinecap='round'
						/>
						<circle
							cx={VENCE_LINE_X}
							cy={ROW0_CY}
							r='4'
							fill={C.orange}
							opacity={detectedIn}
						/>
					</svg>
				)}

				{/* chip clone: pending row -> preview title */}
				{chipAlive && chipFly < 1 && (
					<div
						style={{
							position: "absolute",
							left: lerpP(PEND_SOURCE_X, TITLE_LAND.x, chipFly),
							top: lerpP(ROW0_CY - 13, TITLE_LAND.y, chipFly),
							transformOrigin: "top left",
							zIndex: 35,
						}}>
						<DocChip name='Poliza_caucion.pdf' />
					</div>
				)}
				{/* settled chip title once landed (stays through preview) */}
				{t >= 6.66 && previewOut < 0.999 && (
					<div
						style={{
							position: "absolute",
							left: TITLE_LAND.x,
							top: TITLE_LAND.y,
							zIndex: 35,
							opacity: 1 - previewOut,
						}}>
						<DocChip name='Poliza_caucion.pdf' />
					</div>
				)}

				{/* date token flies: detected box -> calendar day 24 */}
				{dateAlive && (
					<div
						style={{
							position: "absolute",
							left: lerpP(DETECTED.x, DAY24_C.x, dateFly),
							top: lerpP(DETECTED.y, DAY24_C.y, dateFly),
							transform: "translate(-50%,-50%)",
							zIndex: 45,
						}}>
						<span
							style={{
								display: "inline-flex",
								alignItems: "center",
								gap: 6,
								padding: "4px 9px",
								borderRadius: 8,
								background: C.orange,
								color: "#fff",
								fontFamily: FM,
								fontSize: 12,
								fontWeight: 600,
								boxShadow: "0 8px 20px -4px rgba(255,88,0,.5)",
								transform: `scale(${lerpP(1, 0.7, dateFly)})`,
							}}>
							24/05
						</span>
					</div>
				)}

				{/* header + tabs (above body so tray reads on top) */}
				<Header finalP={finalP} />
				<Tabs
					morph={tabMorph}
					hover={tabHover}
					press={tabPress}
				/>

				{/* toast */}
				{toastP > 0.01 && (
					<Toast
						p={toastP}
						press={verPress}
					/>
				)}

				{/* cursor */}
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

	function PendientesFlowVideo() {
		const shellRef = React.useRef(null);
		const isCurrentStep = useCurrentAnchorStep(shellRef);

		return (
			<div
				ref={shellRef}
				style={{ position: "absolute", inset: 0 }}>
				<Stage
					width={W}
					height={H}
					duration={18}
					background={C.canvas}
					active={isCurrentStep}
					persistKey='sintesis-pendientes-flow-v9'>
					<PendRoot />
				</Stage>
			</div>
		);
	}
	window.PendientesFlowVideo = PendientesFlowVideo;
})();
