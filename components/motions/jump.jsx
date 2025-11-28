import { useAnimationFrame, useMotionValue } from 'motion/react';

export function jump({ 
    startX = 0, 
    startY = 0, 
    endX = 100, 
    endY = 100, 
    duration = 2,
    jumpHeight = 100,
    agentSize = 100
  }) {
    const x = useMotionValue(startX);
    const y = useMotionValue(startY);
    const startTime = useMotionValue(null);

    // Calculate viewport bounds (accounting for agent size)
    const halfSize = agentSize / 2;
    const minX = halfSize;
    const maxX = window.innerWidth - halfSize;
    const minY = halfSize;
    const maxY = window.innerHeight - halfSize;

    // Calculate adaptive jump height to stay within bounds
    // The arc peaks at progress = 0.5, so we need to ensure the peak doesn't go outside
    const midY = (startY + endY) / 2;
    const maxAllowedHeight = Math.min(
      midY - minY,  // Distance from midpoint to top of screen
      maxY - midY   // Distance from midpoint to bottom of screen
    );
    // Use the smaller of requested height or maximum allowed
    const adaptiveJumpHeight = Math.min(jumpHeight, maxAllowedHeight);
  
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

      // Linear interpolation for X (horizontal movement)
      const finalX = startX + (endX - startX) * easedProgress;

      // Parabolic arc for Y (vertical movement with jump)
      // Arc formula: y = startY + (endY - startY) * progress - height * (4 * progress * (1 - progress))
      // This creates a symmetric arc that peaks at progress = 0.5
      const arcOffset = adaptiveJumpHeight * (4 * easedProgress * (1 - easedProgress));
      const finalY = startY + (endY - startY) * easedProgress - arcOffset;

      // Clamp to viewport bounds to ensure agent never goes outside
      const clampedX = Math.max(minX, Math.min(maxX, finalX));
      const clampedY = Math.max(minY, Math.min(maxY, finalY));
  
      x.set(clampedX);
      y.set(clampedY);
    })
  
    return {
      style: { position: 'absolute', x, y }
    }
  }

