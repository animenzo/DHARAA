// SensorGauge.jsx — Speedometer-style SVG gauge component
// =============================================================================
// Props:
//   value      number | null   Current reading
//   min        number          Scale minimum  (default 0)
//   max        number          Scale maximum  (default 100)
//   label      string          e.g. "Soil Moisture"
//   unit       string          e.g. "%"
//   color      string          Hex color for needle + arc
//   size       number          SVG size in px (default 180)
//   isLoading  boolean
//   showSlider boolean         Show demo slider (default false)
// =============================================================================

import { useState, useEffect, useRef } from "react";

// ─── Geometry helpers ───────────────────────────────────────────────────────

const GAP_DEG  = 60;               // gap at the bottom of the dial
const START_DEG = 180 + GAP_DEG / 2; // 120° → bottom-left
const SPAN_DEG  = 360 - GAP_DEG;   // 300° of usable arc

function deg2rad(d) {
  return (d * Math.PI) / 180;
}

/** Polar → Cartesian, with 0° at top (12 o'clock) */
function polar(cx, cy, r, deg) {
  const rad = deg2rad(deg - 90);
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

/** SVG arc path string */
function arcPath(cx, cy, r, startDeg, endDeg) {
  const [sx, sy] = polar(cx, cy, r, startDeg);
  const [ex, ey] = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M${sx.toFixed(2)} ${sy.toFixed(2)} A${r} ${r} 0 ${large} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
}

/** Fraction [0,1] → rotation angle in degrees */
function fracToDeg(frac) {
  return START_DEG + Math.min(1, Math.max(0, frac)) * SPAN_DEG;
}

/** Value → fraction */
function toFrac(value, min, max) {
  return (value - min) / (max - min);
}

// ─── Tick marks ─────────────────────────────────────────────────────────────

function Ticks({ cx, cy, trackR, count = 10 }) {
  const ticks = [];
  for (let i = 0; i <= count; i++) {
    const frac   = i / count;
    const deg    = fracToDeg(frac);
    const major  = i % (count / 2) === 0;
    const outer  = trackR + 3;
    const inner  = trackR - (major ? 10 : 5);
    const [ox, oy] = polar(cx, cy, outer, deg);
    const [ix, iy] = polar(cx, cy, inner, deg);
    ticks.push(
      <line
        key={i}
        x1={ox.toFixed(2)} y1={oy.toFixed(2)}
        x2={ix.toFixed(2)} y2={iy.toFixed(2)}
        stroke="#9ca3af"
        strokeWidth={major ? 1.5 : 0.8}
        strokeLinecap="round"
      />
    );
  }
  return <>{ticks}</>;
}

// ─── Needle ──────────────────────────────────────────────────────────────────

function Needle({ cx, cy, length, baseWidth, angleDeg, color }) {
  const tip    = polar(cx, cy, length, angleDeg);
  const left   = polar(cx, cy, baseWidth / 2, angleDeg - 90);
  const right  = polar(cx, cy, baseWidth / 2, angleDeg + 90);
  const back   = polar(cx, cy, 14, angleDeg + 180);

  const pts = (pts) => pts.map((p) => p.map((n) => n.toFixed(2)).join(",")).join(" ");

  return (
    <g>
      {/* Shadow */}
      <polygon
        points={pts([tip, left, back, right])}
        fill="#000"
        opacity="0.10"
        transform="translate(1.5,1.5)"
      />
      {/* Needle body */}
      <polygon
        points={pts([tip, left, back, right])}
        fill={color}
      />
    </g>
  );
}

// ─── Color zone gradient ──────────────────────────────────────────────────────

function getZoneColor(frac, color) {
  // Optionally tint toward red in the danger zone (>85%)
  if (frac > 0.85) return "#ef4444";
  if (frac < 0.15) return "#f59e0b";
  return color;
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function SensorGauge({
  value     = null,
  min       = 0,
  max       = 100,
  label     = "Sensor",
  unit      = "%",
  color     = "#10b981",
  size      = 180,
  isLoading = false,
  showSlider = false,
}) {
  const [animatedValue, setAnimatedValue] = useState(min);
  const animRef  = useRef(null);
  const prevRef  = useRef(min);

  // Animate value changes with easing
  useEffect(() => {
    if (value == null) return;
    const target = Math.min(Math.max(value, min), max);
    const start  = prevRef.current;
    const dur    = 500; // ms
    const t0     = performance.now();

    cancelAnimationFrame(animRef.current);

    function step(now) {
      const elapsed = now - t0;
      const progress = Math.min(elapsed / dur, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (target - start) * eased;
      setAnimatedValue(current);
      if (progress < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        prevRef.current = target;
      }
    }

    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  }, [value, min, max]);

  // ── Loading skeleton
  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: size }}>
        <div style={{
          width: size, height: size,
          borderRadius: "50%",
          background: "linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.4s infinite",
        }} />
        <div style={{ height: 12, width: 100, borderRadius: 6, background: "#e5e7eb" }} />
        <style>{`@keyframes shimmer { to { background-position: -200% 0 } }`}</style>
      </div>
    );
  }

  // ── Geometry
  const cx = size / 2;
  const cy = size / 2;
  const trackR  = size * 0.36;
  const fillR   = trackR - 6;
  const needleL = size * 0.30;
  const needleB = size * 0.045;

  const isNull  = value == null;
  const frac    = isNull ? 0 : toFrac(animatedValue, min, max);
  const ndeg    = fracToDeg(frac);
  const fillColor = isNull ? "#9ca3af" : getZoneColor(frac, color);

  const trackD  = arcPath(cx, cy, fillR, START_DEG, START_DEG + SPAN_DEG);
  const fillD   = isNull ? null : arcPath(cx, cy, fillR, START_DEG, ndeg);

  const [minX, minY] = polar(cx, cy, trackR + 16, START_DEG);
  const [maxX, maxY] = polar(cx, cy, trackR + 16, START_DEG + SPAN_DEG);

  // ── Render
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${label}: ${isNull ? "no data" : Math.round(animatedValue) + unit}`}
      >
        {/* Subtle ambient glow behind dial */}
        <circle cx={cx} cy={cy} r={trackR + 8} fill={fillColor} opacity="0.08" />

        {/* Track (background arc) */}
        <path d={trackD} fill="none" stroke="#e5e7eb" strokeWidth={size * 0.042} strokeLinecap="round" />

        {/* Filled arc */}
        {fillD && (
          <path d={fillD} fill="none" stroke={fillColor} strokeWidth={size * 0.042} strokeLinecap="round" opacity="0.9" />
        )}

        {/* Tick marks */}
        <Ticks cx={cx} cy={cy} trackR={trackR} count={10} />

        {/* Min / Max labels */}
        <text x={minX.toFixed(1)} y={(minY + 2).toFixed(1)} textAnchor="middle"
          fontSize={size * 0.072} fill="#9ca3af" fontFamily="system-ui, sans-serif">{min}</text>
        <text x={maxX.toFixed(1)} y={(maxY + 2).toFixed(1)} textAnchor="middle"
          fontSize={size * 0.072} fill="#9ca3af" fontFamily="system-ui, sans-serif">{max}</text>

        {/* Needle */}
        {!isNull && (
          <Needle
            cx={cx} cy={cy}
            length={needleL}
            baseWidth={needleB}
            angleDeg={ndeg}
            color={fillColor}
          />
        )}

        {/* Hub cap */}
        <circle cx={cx} cy={cy} r={size * 0.055} fill="white" stroke={fillColor} strokeWidth={1.5} />
        <circle cx={cx} cy={cy} r={size * 0.025} fill={fillColor} />

        {/* Centre value display */}
        <text
          x={cx} y={cy + size * 0.2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.17}
          fontWeight="600"
          fill={isNull ? "#9ca3af" : "#111827"}
          fontFamily="system-ui, sans-serif"
        >
          {isNull ? "—" : Math.round(animatedValue)}
        </text>
        <text
          x={cx} y={cy + size * 0.33}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.085}
          fill="#6b7280"
          fontFamily="system-ui, sans-serif"
        >
          {unit}
        </text>
      </svg>

      {/* Label */}
      <p style={{
        margin: 0,
        fontSize: 13,
        fontWeight: 500,
        color: "#4b5563",
        textAlign: "center",
        lineHeight: 1.3,
      }}>
        {label}
      </p>

      {/* Optional demo slider */}
      {showSlider && (
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          defaultValue={value ?? min}
          onChange={(e) => {
            // If you want slider to drive value externally, lift this up.
            // Here we call the internal animatedValue directly for demo purposes.
            prevRef.current = animatedValue;
            setAnimatedValue(Number(e.target.value));
          }}
          style={{ width: size * 0.75, marginTop: 4, accentColor: color }}
        />
      )}
    </div>
  );
}


