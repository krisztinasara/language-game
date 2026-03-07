import { useAnimationFrame, useMotionValue } from 'motion/react';

export function push({
    startX = 0,
    startY = 0,
    endX = 100,
    endY = 100,
    duration = 2,
    role = 'pusher',
    startDelay = 0
  }) {
    const x = useMotionValue(startX);
    const y = useMotionValue(startY);
    const startTime = useMotionValue(null);
  
    // Timing: pusher moves first, pushed starts with ~15% overlap so both move briefly together (more dynamic)
    const pusherPhaseDuration = duration * 0.5; // Pusher runs to contact point
    const overlap = duration * 0.15; // 15% overlap: pushed starts this much before pusher arrives
    const pushDelay = Math.max(0, pusherPhaseDuration - overlap);
  
    useAnimationFrame((t) => {
      if (startTime.get() === null) startTime.set(t);
      const elapsed = (t - startTime.get()) / 1000;
      if (elapsed < startDelay) {
        x.set(startX);
        y.set(startY);
        return;
      }
      const effectiveElapsed = elapsed - startDelay;

      if (role === 'pusher') {
        const rawProgress = Math.min(effectiveElapsed / pusherPhaseDuration, 1);

        // Pusher: starts slow, accelerates, then slows down (easeInOutCubic)
        const easeInOutCubic = (t) => {
          return t < 0.5 
            ? 4 * t * t * t 
            : 1 - Math.pow(-2 * t + 2, 3) / 2;
        };
        const easedProgress = easeInOutCubic(rawProgress);

        // Linear interpolation - pusher reaches endX/endY (pushed agent's position)
        const finalX = startX + (endX - startX) * easedProgress;
        const finalY = startY + (endY - startY) * easedProgress;

        x.set(finalX);
        y.set(finalY);
      } else {
        if (effectiveElapsed < pushDelay) {
          x.set(startX);
          y.set(startY);
        } else {
          const pushedElapsed = effectiveElapsed - pushDelay;
          const pushedDuration = duration - pushDelay; // Remaining duration
          const rawProgress = Math.min(pushedElapsed / pushedDuration, 1);

          // Pushed: starts fast (gets hit), then slows down (easeOutCubic)
          const easeOutCubic = (t) => {
            return 1 - Math.pow(1 - t, 3);
          };
          const easedProgress = easeOutCubic(rawProgress);

          // Linear interpolation
          const finalX = startX + (endX - startX) * easedProgress;
          const finalY = startY + (endY - startY) * easedProgress;

          x.set(finalX);
          y.set(finalY);
        }
      }
    })
  
    return {
      style: { 
        position: 'absolute', 
        x, 
        y
      }
    }
  }
