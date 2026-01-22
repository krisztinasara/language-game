import { useAnimationFrame, useMotionValue } from 'motion/react';

export function reveal({ 
    positionX = 0, 
    positionY = 0, 
    duration = 1,
    agentSize = 100
  }) {
    const x = useMotionValue(positionX);
    const y = useMotionValue(positionY);
    const scale = useMotionValue(0);
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

      // Scale from 0 (invisible point) to 1 (full size)
      // Position stays the same - scale happens from center
      const currentScale = easedProgress;
  
      x.set(positionX);
      y.set(positionY);
      scale.set(currentScale);
    })
  
    // Calculate center point for sparkles (accounting for agent size)
    const centerX = positionX + agentSize / 2;
    const centerY = positionY + agentSize / 2;
    const sparkleRadius = agentSize * 0.6; // Sparkles appear around the agent
  
    return {
      style: { 
        position: 'absolute', 
        x, 
        y,
        scale,
        transformOrigin: 'center'
      },
      sparkles: {
        centerX,
        centerY,
        radius: sparkleRadius,
        duration,
        startDelay: 0
      }
    }
  }
