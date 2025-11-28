import { useAnimationFrame, useMotionValue } from 'motion/react';

export function go({ 
    startX = 0, 
    startY = 0, 
    endX = 100, 
    endY = 100, 
    duration = 2, 
    amplitude = 50, 
    frequency = 2 
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

      // Amplitude modulation: smaller at start/end, larger in middle (bell curve)
      // Using sin(π * progress) gives 0 at start/end, peaks at 0.5
      const amplitudeModulation = Math.sin(rawProgress * Math.PI);

      // Calculate direction vector from start to end
      const dx = endX - startX;
      const dy = endY - startY;
      
      // Calculate perpendicular direction for wave (rotate 90 degrees)
      const perpX = -dy;
      const perpY = dx;
      const perpLength = Math.sqrt(perpX * perpX + perpY * perpY);
      const perpUnitX = perpLength > 0 ? perpX / perpLength : 0;
      const perpUnitY = perpLength > 0 ? perpY / perpLength : 0;

      // Interpolate along the straight line from start to end using eased progress
      const baseX = startX + dx * easedProgress;
      const baseY = startY + dy * easedProgress;

      // Add sinusoidal wave perpendicular to the path with modulated amplitude
      const modulatedAmplitude = amplitude * amplitudeModulation;
      const waveOffset = modulatedAmplitude * Math.sin(easedProgress * frequency * 2 * Math.PI);
      const finalX = baseX + perpUnitX * waveOffset;
      const finalY = baseY + perpUnitY * waveOffset;
  
      x.set(finalX);
      y.set(finalY);
    })
  
    return {
      style: { position: 'absolute', x, y }
    }
  }