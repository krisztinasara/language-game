// Import the SVG file as a React component
import Agent1Svg from '../../assets/agent-1.svg?react';

// Export the SVG component with proper sizing
// The SVG has viewBox="0 0 82.042007 133.91539" (taller than wide)
export const agent1 = (
  <Agent1Svg 
    style={{ 
      width: '100%', 
      height: '100%',
      display: 'block'
    }}
    preserveAspectRatio="xMidYMid meet"
  />
);
