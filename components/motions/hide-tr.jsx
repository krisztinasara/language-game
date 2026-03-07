import { useAnimationFrame, useMotionValue } from 'motion/react';

export function hideTr({
    startX = 0,
    startY = 0,
    endX = 100,
    endY = 100,
    duration = 2,
    startDelay = 0
  }) {
    const x = useMotionValue(startX);
    const y = useMotionValue(startY);
    const startTime = useMotionValue(null);
  
    useAnimationFrame((t) => {
      if (startTime.get() === null) startTime.set(t);
      const elapsed = (t - startTime.get()) / 1000;
      if (elapsed < startDelay) {
        x.set(startX);
        y.set(startY);
        return;
      }
      const effectiveElapsed = elapsed - startDelay;
      const rawProgress = Math.min(effectiveElapsed / duration, 1);

      // Easing function: slow at start, fast in middle, slow at end (easeInOutCubic)
      const easeInOutCubic = (t) => {
        return t < 0.5 
          ? 4 * t * t * t 
          : 1 - Math.pow(-2 * t + 2, 3) / 2;
      };
      const easedProgress = easeInOutCubic(rawProgress);

      // Linear interpolation from start to end position
      const finalX = startX + (endX - startX) * easedProgress;
      const finalY = startY + (endY - startY) * easedProgress;
  
      x.set(finalX);
      y.set(finalY);
    })
  
    return {
      style: { position: 'absolute', x, y }
    }
  }
