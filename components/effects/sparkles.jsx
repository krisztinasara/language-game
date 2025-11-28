import { motion } from 'motion/react';

// Individual sparkle component
function Sparkle({ x, y, delay, duration, size }) {
  return (
    <motion.div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: `${size}px`,
        height: `${size}px`,
        pointerEvents: 'none'
      }}
      initial={{ 
        scale: 0, 
        opacity: 0
      }}
      animate={{ 
        scale: [0, 1.5, 0],
        opacity: [0, 1, 0]
      }}
      transition={{
        duration: duration,
        delay: delay,
        repeat: 0,
        ease: 'easeOut'
      }}
    >
      <svg width={size} height={size} viewBox="0 0 8 8">
        <path
          d="M4 0 L4.5 3.5 L8 4 L4.5 4.5 L4 8 L3.5 4.5 L0 4 L3.5 3.5 Z"
          fill="yellow"
          stroke="gold"
          strokeWidth="0.5"
        />
      </svg>
    </motion.div>
  );
}

// Helper function to shuffle array (Fisher-Yates algorithm)
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Sparkles container that creates sparkles randomly scattered inside a radius
export function sparkles({ centerX, centerY, radius = 30, count = 8, duration = 1, startDelay = 0 }) {
  const sparkleData = [];
  
  // Generate random positions and sizes
  for (let i = 0; i < count; i++) {
    // Random angle and distance (within radius)
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * radius; // Random distance from center, up to radius
    const x = centerX + Math.cos(angle) * distance;
    const y = centerY + Math.sin(angle) * distance;
    
    // Random size between 10px and 18px
    const size = 10 + Math.random() * 8;
    
    sparkleData.push({
      x: x - size / 2, // Center the sparkle
      y: y - size / 2,
      size: size,
      index: i
    });
  }
  
  // Shuffle for random appearance order
  const shuffled = shuffleArray(sparkleData);
  
  const sparkles = shuffled.map((sparkle, i) => {
    // Random delay within the first 30% of duration
    const delay = startDelay + Math.random() * (duration * 0.3);
    
    return (
      <Sparkle
        key={sparkle.index}
        x={sparkle.x}
        y={sparkle.y}
        size={sparkle.size}
        delay={delay}
        duration={duration * 0.6}
      />
    );
  });
  
  return <>{sparkles}</>;
}
