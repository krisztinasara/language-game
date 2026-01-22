import { useAnimationFrame, useMotionValue } from 'motion/react';

export function hideTr({ 
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
      // Initialize start time on first frame
      if (startTime.get() === null) {
        startTime.set(t);
      }
  
      const elapsed = (t - startTime.get()) / 1000; // Convert to seconds
      const rawProgress = Math.min(elapsed / duration, 1); // Clamp to 0-1

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
