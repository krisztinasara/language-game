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
  duration = 2
}) {
  const x = useMotionValue(startX);
  const y = useMotionValue(startY);
  const startTime = useMotionValue(null);

  useAnimationFrame((t) => {
    if (startTime.get() === null) {
      startTime.set(t);
    }

    const elapsed = (t - startTime.get()) / 1000;
    const rawProgress = Math.min(elapsed / duration, 1);

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
    style: { position: 'absolute', x, y }
  };
}
