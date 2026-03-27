import { useAnimationFrame, useMotionValue } from 'motion/react';

export function hideTr({
    preStartX = null,
    preStartY = null,
    startX = 0,
    startY = 0,
    endX = 100,
    endY = 100,
    duration = 2,
    startDelay = 0
  }) {
    const hasApproach = preStartX !== null && preStartY !== null && (preStartX !== startX || preStartY !== startY);
    const approachDuration = hasApproach ? 1.0 : 0; // slower approach, like HIDE-INTR
    const x = useMotionValue(hasApproach ? preStartX : startX);
    const y = useMotionValue(hasApproach ? preStartY : startY);
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
        x.set(hasApproach ? preStartX : startX);
        y.set(hasApproach ? preStartY : startY);
        scale.set(pulse);
        return;
      }
      const effectiveElapsed = elapsed - mainStart;
      scale.set(1);

      // Easing function: slow at start, fast in middle, slow at end (easeInOutCubic)
      const easeInOutCubic = (t) => {
        return t < 0.5 
          ? 4 * t * t * t 
          : 1 - Math.pow(-2 * t + 2, 3) / 2;
      };
      const easeOutCubic = (v) => 1 - Math.pow(1 - v, 3);

      // Optional initial approach movement (preStart -> start)
      if (hasApproach && effectiveElapsed < approachDuration) {
        const p = Math.min(effectiveElapsed / approachDuration, 1);
        const easedP = easeOutCubic(p);
        x.set(preStartX + (startX - preStartX) * easedP);
        y.set(preStartY + (startY - preStartY) * easedP);
        return;
      }

      const moveElapsed = hasApproach ? Math.max(0, effectiveElapsed - approachDuration) : effectiveElapsed;
      const rawProgress = Math.min(moveElapsed / duration, 1);
      const easedProgress = easeInOutCubic(rawProgress);

      // Linear interpolation from start to end position
      const finalX = startX + (endX - startX) * easedProgress;
      const finalY = startY + (endY - startY) * easedProgress;
  
      x.set(finalX);
      y.set(finalY);
    })
  
    return {
      style: { position: 'absolute', x, y, scale }
    }
  }
