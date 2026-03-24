import { useAnimationFrame, useMotionValue } from 'motion/react';

/**
 * Constant speed along the chord (px/s). Lower = slower. Tuned toward the slower end of typical GO-INTR.
 */
export const GO_SPEED_PX_PER_SEC = 240;

/** Defaults when JSON omits them; perpendicular wave (px). */
export const GO_DEFAULT_AMPLITUDE = 65;
/**
 * Waves per `GO_SPATIAL_REF_LEN_PX` of chord — longer moves get more wiggles, shorter moves fewer.
 * Total cycles for a move are snapped to a half-integer so the path still ends on the chord.
 * Density ~0.67× the earlier 3.25 default (`3.25 * 0.67`).
 */
export const GO_DEFAULT_FREQUENCY = 3.25 * 0.67;

/**
 * Chord length (px) that `frequency` counts waves against. Tune together with `GO_DEFAULT_FREQUENCY`.
 */
export const GO_SPATIAL_REF_LEN_PX = 400;

const MIN_GO_MOVE_SEC = 0.2;

/**
 * Nearest half-integer cycle count so sin(p·N·2π) === 0 at p === 1 (agent on chord end).
 */
export function snapGoTotalCyclesForChordEnd(desiredCycles) {
  const d = Number(desiredCycles);
  const safe = Number.isFinite(d) && d >= 0 ? d : 0;
  const k = Math.round(safe * 2);
  return k / 2;
}

/**
 * Move time for sequence player / tooling — same formula as `go()` (distance / constant speed).
 */
export function getGoEffectiveDurationSec({
  startX = 0,
  startY = 0,
  endX = 100,
  endY = 100
} = {}) {
  const pathLen = Math.hypot(endX - startX, endY - startY);
  return Math.max(MIN_GO_MOVE_SEC, pathLen / GO_SPEED_PX_PER_SEC);
}

export function go({
    startX = 0,
    startY = 0,
    endX = 100,
    endY = 100,
    amplitude = GO_DEFAULT_AMPLITUDE,
    frequency = GO_DEFAULT_FREQUENCY,
    startDelay = 0
  }) {
    const x = useMotionValue(startX);
    const y = useMotionValue(startY);
    const startTime = useMotionValue(null);

    const dx = endX - startX;
    const dy = endY - startY;
    const pathLen = Math.hypot(dx, dy);
    const moveDuration = Math.max(MIN_GO_MOVE_SEC, pathLen / GO_SPEED_PX_PER_SEC);
    const freq = Number(frequency);
    const freqSafe =
      Number.isFinite(freq) && freq >= 0 ? freq : GO_DEFAULT_FREQUENCY;
    const desiredCycles =
      pathLen > 0 && GO_SPATIAL_REF_LEN_PX > 0
        ? (pathLen / GO_SPATIAL_REF_LEN_PX) * freqSafe
        : 0;
    const totalCycles = snapGoTotalCyclesForChordEnd(desiredCycles);

    useAnimationFrame((t) => {
      if (startTime.get() === null) startTime.set(t);
      const elapsed = (t - startTime.get()) / 1000;
      if (elapsed < startDelay) {
        x.set(startX);
        y.set(startY);
        return;
      }
      const effectiveElapsed = elapsed - startDelay;
      const p = Math.min(effectiveElapsed / moveDuration, 1);

      const perpX = -dy;
      const perpY = dx;
      const perpLength = Math.sqrt(perpX * perpX + perpY * perpY);
      const perpUnitX = perpLength > 0 ? perpX / perpLength : 0;
      const perpUnitY = perpLength > 0 ? perpY / perpLength : 0;

      // Uniform motion along the chord: linear in time
      const baseX = startX + dx * p;
      const baseY = startY + dy * p;

      // totalCycles = snapped (pathLen/ref)·frequency → sin(2π·p·N) === 0 at p === 1.
      const waveOffset =
        amplitude * Math.sin(p * totalCycles * 2 * Math.PI);
      const finalX = baseX + perpUnitX * waveOffset;
      const finalY = baseY + perpUnitY * waveOffset;

      x.set(finalX);
      y.set(finalY);
    });

    return {
      style: { position: 'absolute', x, y }
    };
  }
