import { useAnimationFrame, useMotionValue } from 'motion/react';

/**
 * reveal-tr: inverse of hide-tr. The agent (revealer) starts on top of another
 * and moves away to reveal the one underneath. Same motion as hide-tr but
 * start = on top, end = away.
 */
export function revealTr({
  startX = 0,
  startY = 0,
  endX = 100,
  endY = 100,
  duration = 2,
  startDelay = 0
}) {
  const x = useMotionValue(startX);
  const y = useMotionValue(startY);
  const scale = useMotionValue(1);
  const startTime = useMotionValue(null);

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
      scale.set(pulse);
      return;
    }
    const effectiveElapsed = elapsed - mainStart;
    scale.set(1);
    const rawProgress = Math.min(effectiveElapsed / duration, 1);

    const easeInOutCubic = (t) => {
      return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };
    const easedProgress = easeInOutCubic(rawProgress);

    const finalX = startX + (endX - startX) * easedProgress;
    const finalY = startY + (endY - startY) * easedProgress;

    x.set(finalX);
    y.set(finalY);
  });

  return {
    style: { position: 'absolute', x, y, scale }
  };
}
