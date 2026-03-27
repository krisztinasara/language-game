import { useAnimationFrame, useMotionValue } from 'motion/react';

/** Arc length of parabolic jump from (sx,sy) to (ex,ey) with peak offset h. */
function buildJumpArcTable(sx, sy, ex, ey, h, steps = 48) {
  const dx = ex - sx;
  const dy = ey - sy;
  const pointAtP = (p) => ({
    x: sx + dx * p,
    y: sy + dy * p - h * 4 * p * (1 - p)
  });
  const cum = [0];
  for (let i = 1; i <= steps; i++) {
    const a = pointAtP((i - 1) / steps);
    const b = pointAtP(i / steps);
    cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  return { cum, total: cum[steps], pointAtP };
}

/**
 * Vertical extent of y(p) = y0 + dy·p − h·4p(1−p) for p ∈ [0,1] (agent-center path).
 * Smaller y = higher on screen.
 */
function arcVerticalBounds(y0, dy, h) {
  const ys = [y0, y0 + dy];
  if (h !== 0) {
    const pV = 0.5 - dy / (8 * h);
    if (pV > 0 && pV < 1) {
      ys.push(y0 + dy * pV - h * 4 * pV * (1 - pV));
    }
  }
  return { top: Math.min(...ys), bottom: Math.max(...ys) };
}

/** Largest h in [0, requested] so the full arc stays within [minY, maxY]. */
function clampJumpHeightToViewport(yCrouch, endY, minY, maxY, requested) {
  const req = Math.max(0, requested);
  if (req === 0) return 0;
  let lo = 0;
  let hi = req;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    const dy = endY - yCrouch;
    const { top, bottom } = arcVerticalBounds(yCrouch, dy, mid);
    if (top >= minY - 1e-9 && bottom <= maxY + 1e-9) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Map arc length s in [0, total] to parameter p in [0, 1]. */
function pFromArcLength(cum, total, s) {
  if (s <= 0) return 0;
  if (s >= total) return 1;
  const steps = cum.length - 1;
  let lo = 0;
  let hi = steps;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cum[mid] <= s) lo = mid;
    else hi = mid - 1;
  }
  if (lo >= steps) return 1;
  const s0 = cum[lo];
  const s1 = cum[lo + 1];
  const alpha = (s - s0) / (s1 - s0);
  return (lo + alpha) / steps;
}

/** Sinusoidal ease in-out: slow at ends, faster mid-segment (0..1 → 0..1). */
const sineEase = (t) => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, t)))) / 2;

const L_REF = 500;

/**
 * Jump-only timing: < 1 = slower (config duration is divided by this). Not applied to other motions.
 */
export const JUMP_GLOBAL_SPEED = 0.75;

/** Wind-timing baseline when JSON omits `duration` (must match `main` / sequence player). */
export const JUMP_DEFAULT_DURATION = 2;
/** Arc height (px) when JSON omits `jumpHeight` (viewport-clamped to fit the arc). */
export const JUMP_DEFAULT_JUMP_HEIGHT = 700;

/**
 * Final scale: wind + arc times are divided by this (1.25 → 1.25× faster overall).
 */
export const JUMP_OVERALL_SPEED_MULTIPLIER = 1.25;

/** Wind-up takes this factor longer than its path-length share of base duration. */
const WIND_TIME_SCALE = 1.5;
/**
 * Wind-up only: effective speed vs arc (lower = slower wind-up).
 * 0.5 → wind-up lasts 2× (half the speed); 1 = match global jump speed scaling.
 */
export const WIND_UP_REL_SPEED = 0.2;

/**
 * Arc time = ARC_BASE_SEC * (L_jump / ARC_L_REF) ^ ARC_EXPONENT
 *
 * ARC_BASE_SEC: time in seconds when L_jump equals ARC_L_REF.
 * ARC_EXPONENT: 0 < exp < 1 → sublinear (long routes visually faster, short slower).
 *   - 1.0 = constant speed (linear time vs distance)
 *   - 0.0 = constant time regardless of distance
 *   - ~0.15 = good balance: short hops deliberate, long arcs visually snappy
 * No thresholds or caps — one smooth function for all distances.
 */
const ARC_BASE_SEC = 0.6;
const ARC_L_REF = 500;
const ARC_EXPONENT = 0.15;

/**
 * Arc time remap: t^exp with exp > 1 → slower start, faster finish along the curve.
 */
const BALLISTIC_ARC_EXPONENT = 1.08;

/**
 * Shared timing/geometry for jump-intr (motion + sequence player).
 * Arc follows the power law; wind uses config duration (default `JUMP_DEFAULT_DURATION`). Both ÷ JUMP_OVERALL_SPEED_MULTIPLIER; wind ÷ WIND_UP_REL_SPEED.
 */
export function computeJumpMotion({
  startX = 0,
  startY = 0,
  endX = 100,
  endY = 100,
  duration = JUMP_DEFAULT_DURATION,
  jumpHeight = JUMP_DEFAULT_JUMP_HEIGHT,
  agentSize = 100,
  innerWidth = typeof window !== 'undefined' ? window.innerWidth : 1920,
  innerHeight = typeof window !== 'undefined' ? window.innerHeight : 1080
}) {
  const timingDuration = duration / JUMP_GLOBAL_SPEED;

  const halfSize = agentSize / 2;
  const minX = halfSize;
  const maxX = innerWidth - halfSize;
  const minY = halfSize;
  const maxY = innerHeight - halfSize;

  const upLift = agentSize * 0.06;
  const downAmt = agentSize * 0.12;
  const yPeak = startY - upLift;
  const yCrouch = startY + downAmt;

  // Arc runs yCrouch → endY; cap h so the parabola (not just its midpoint) stays on-screen.
  const adaptiveJumpHeight = clampJumpHeightToViewport(
    yCrouch,
    endY,
    minY,
    maxY,
    jumpHeight
  );
  const L_w = upLift + (upLift + downAmt);

  const { cum: cumArc, total: L_jump, pointAtP } = buildJumpArcTable(
    startX,
    yCrouch,
    endX,
    endY,
    adaptiveJumpHeight
  );

  const L_total = L_w + L_jump;
  const rw = L_w / L_total;
  const baseDuration = Math.max(0.2, timingDuration * 0.9);
  const speedInv = 1 / JUMP_OVERALL_SPEED_MULTIPLIER;
  const t_wind = ((baseDuration * rw * WIND_TIME_SCALE) * speedInv) / WIND_UP_REL_SPEED;
  const t_main = Math.max(0.05, ARC_BASE_SEC * Math.pow(L_jump / ARC_L_REF, ARC_EXPONENT) * speedInv);
  const effectiveTotalDuration = t_wind + t_main;
  const t_up = t_wind * (upLift / L_w);
  const t_down = t_wind - t_up;

  return {
    effectiveTotalDuration,
    t_wind,
    t_main,
    t_up,
    t_down,
    yPeak,
    yCrouch,
    startY,
    cumArc,
    L_jump,
    pointAtP,
    minX,
    maxX,
    minY,
    maxY,
    upLift,
    downAmt,
    L_w
  };
}

/** Total motion time in seconds (for sequence timing). */
export function getJumpEffectiveTotalDurationSec(params) {
  return computeJumpMotion(params).effectiveTotalDuration;
}

export function jump({
    startX = 0,
    startY = 0,
    endX = 100,
    endY = 100,
    duration = JUMP_DEFAULT_DURATION,
    jumpHeight = JUMP_DEFAULT_JUMP_HEIGHT,
    agentSize = 100,
    startDelay = 0
  }) {
    const x = useMotionValue(startX);
    const y = useMotionValue(startY);
    const scaleX = useMotionValue(1);
    const scaleY = useMotionValue(1);
    const startTime = useMotionValue(null);

    const model = computeJumpMotion({
      startX,
      startY,
      endX,
      endY,
      duration,
      jumpHeight,
      agentSize
    });

    const {
      effectiveTotalDuration,
      t_wind,
      t_main,
      t_up,
      t_down,
      yPeak,
      yCrouch,
      startY: sy,
      cumArc,
      L_jump,
      pointAtP,
      minX,
      maxX,
      minY,
      maxY
    } = model;

    const squashAmount = 0.1;
    const launchStretch = 0.06;

    function windUpY(ew) {
      if (ew <= 0) return sy;
      if (ew < t_up) {
        const k = sineEase(ew / t_up);
        return sy + (yPeak - sy) * k;
      }
      if (ew < t_wind) {
        const k = sineEase((ew - t_up) / t_down);
        return yPeak + (yCrouch - yPeak) * k;
      }
      return yCrouch;
    }

    const pulseDur = 0.45;
    const pauseAfterPulse = 0.5;
    const mainStart = startDelay + pauseAfterPulse;

    useAnimationFrame((t) => {
      if (startTime.get() === null) startTime.set(t);
      const elapsed = (t - startTime.get()) / 1000;
      if (elapsed < mainStart) {
        const pulseStart = Math.max(0, startDelay - pulseDur);
        const pulseP = Math.min(Math.max((elapsed - pulseStart) / pulseDur, 0), 1);
        const pulse = 1 + 0.2 * Math.sin(Math.PI * pulseP);
        x.set(startX);
        y.set(startY);
        scaleX.set(pulse);
        scaleY.set(pulse);
        return;
      }

      const totalElapsed = elapsed - mainStart;
      const pulse = 1;
      let finalX;
      let finalY;
      let sxv = 1;
      let syv = 1;

      if (totalElapsed >= effectiveTotalDuration) {
        finalX = endX;
        finalY = endY;
      } else if (totalElapsed < t_wind) {
        finalX = startX;
        const windFrac = totalElapsed / t_wind;
        const windEased = Math.pow(windFrac, BALLISTIC_ARC_EXPONENT);
        finalY = windUpY(windEased * t_wind);
        if (windEased * t_wind < t_up) {
          const phaseK = (windEased * t_wind) / t_up;
          const widen = 0.04 * Math.sin(Math.PI * sineEase(phaseK));
          sxv = 1 + widen;
          syv = 1 - widen * 0.5;
        } else {
          const we = windEased * t_wind;
          const downK = (we - t_up) / t_down;
          const squash = squashAmount * sineEase(downK);
          sxv = 1 + squash * 0.35;
          syv = 1 - squash;
        }
      } else {
        const ew = totalElapsed - t_wind;
        const linearFrac = Math.min(ew / t_main, 1);
        const arcFrac = Math.pow(linearFrac, BALLISTIC_ARC_EXPONENT);
        const s = arcFrac * L_jump;
        const p = pFromArcLength(cumArc, L_jump, s);
        const pt = pointAtP(p);
        finalX = pt.x;
        finalY = pt.y;
        if (p < 0.12) {
          const v = p / 0.12;
          const bump = Math.sin(Math.PI * v);
          sxv = 1 - launchStretch * 0.25 * bump;
          syv = 1 + launchStretch * bump;
        }
      }

      const clampedX = Math.max(minX, Math.min(maxX, finalX));
      const clampedY = Math.max(minY, Math.min(maxY, finalY));

      x.set(clampedX);
      y.set(clampedY);
      scaleX.set(sxv * pulse);
      scaleY.set(syv * pulse);
    });

    return {
      style: {
        position: 'absolute',
        x,
        y,
        scaleX,
        scaleY,
        transformOrigin: 'center bottom'
      }
    };
  }
