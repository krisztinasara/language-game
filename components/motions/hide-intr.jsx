import { useAnimationFrame, useMotionValue } from 'motion/react';

export function hide({
    positionX = 0,
    positionY = 0,
    startX = positionX,
    startY = positionY,
    duration = 1,
    agentSize = 100,
    startDelay = 0,
    pulseEnabled = true
  }) {
    const x = useMotionValue(startX);
    const y = useMotionValue(startY);
    const scale = useMotionValue(1);
    const startTime = useMotionValue(null);
    const hasApproach = startX !== positionX || startY !== positionY;
    // 0.5x speed for initial movement => double the previous approach duration.
    const approachDuration = hasApproach ? 1.0 : 0;
  
    const pulseDur = 0.45;
    const pauseAfterPulse = pulseEnabled ? 0.5 : 0;
    const mainStart = startDelay + pauseAfterPulse;

    useAnimationFrame((t) => {
      if (startTime.get() === null) startTime.set(t);
      const elapsed = (t - startTime.get()) / 1000;
      if (elapsed < mainStart) {
        const pulseStart = Math.max(0, startDelay - pulseDur);
        const pulseP = Math.min(Math.max((elapsed - pulseStart) / pulseDur, 0), 1);
        const pulse = pulseEnabled ? (1 + 0.2 * Math.sin(Math.PI * pulseP)) : 1;
        x.set(startX);
        y.set(startY);
        scale.set(pulse);
        return;
      }
      const effectiveElapsed = elapsed - mainStart;
      const pulse = 1;

      // Easing function: slow at start, fast in middle, slow at end (easeInOutCubic)
      const easeInOutCubic = (t) => {
        return t < 0.5 
          ? 4 * t * t * t 
          : 1 - Math.pow(-2 * t + 2, 3) / 2;
      };
      const easeOutCubic = (v) => 1 - Math.pow(1 - v, 3);

      // Optional initial movement to hide position (used for HIDE-INTR + LOC)
      if (hasApproach && effectiveElapsed < approachDuration) {
        const moveP = Math.min(effectiveElapsed / approachDuration, 1);
        const easedMoveP = easeOutCubic(moveP);
        x.set(startX + (positionX - startX) * easedMoveP);
        y.set(startY + (positionY - startY) * easedMoveP);
        scale.set(pulse);
        return;
      }

      const hideElapsed = hasApproach ? Math.max(0, effectiveElapsed - approachDuration) : effectiveElapsed;
      const rawProgress = Math.min(hideElapsed / duration, 1);
      const easedProgress = easeInOutCubic(rawProgress);

      // Scale from 1 (full size) to 0 (invisible point) at hide position.
      x.set(positionX);
      y.set(positionY);
      scale.set((1 - easedProgress) * pulse);
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
        startDelay: mainStart + approachDuration
      }
    }
  }
