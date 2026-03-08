import { createRoot } from 'react-dom/client';
import { motion } from 'motion/react';
import { agent1a, agent1b, agent2a, agent2b, agent3a, agent3b, agent4a, agent4b, agent5a, agent5b, go, jump, hide, reveal, push, hideTr, revealTr } from './components';
import { sparkles } from './components/effects/sparkles';
import { SvgUniqueIds } from './components/effects/svg-unique-ids';
import configData from './config.json';
import { gridToPixels } from './components/board/grid';

/*
The screen will have a grid-like layout
(also from practical reasons for calibration and for starting to work in the game framework).
This will be a 6x8 layout.
For the time being, we start with a viewport percentages and not a gameboard with absolute positions.
*/

// Agent registry - maps agent names to components
const agentRegistry = {
  'agent-1-a': agent1a,
  'agent-1-b': agent1b,
  'agent-2-a': agent2a,
  'agent-2-b': agent2b,
  'agent-3-a': agent3a,
  'agent-3-b': agent3b,
  'agent-4-a': agent4a,
  'agent-4-b': agent4b,
  'agent-5-a': agent5a,
  'agent-5-b': agent5b
};

// Helper function to convert JSON config to runtime config with pixel values
function processConfig(jsonConfig) {
  const defaultSize = jsonConfig.agentSize ?? 100; // Default to 100 if not specified
  const startDelaySec = (jsonConfig.startDelayMs ?? 0) / 1000;

  return jsonConfig.agents.map(agentConfig => {
    // Get size for this agent (per-agent override or use default)
    const agentSize = agentConfig.size ?? defaultSize;
    const halfSize = agentSize / 2;

    if (agentConfig.animationType === 'go-intr' && agentConfig.animation) {
      const anim = agentConfig.animation;
      const start = gridToPixels(anim.startX ?? 0, anim.startY ?? 0);
      const end = gridToPixels(anim.endX ?? 0, anim.endY ?? 0);

      return {
        ...agentConfig,
        size: agentSize,
        animation: {
          startX: start.x - halfSize,
          startY: start.y - halfSize,
          endX: end.x - halfSize,
          endY: end.y - halfSize,
          duration: anim.duration,
          amplitude: anim.amplitude,
          frequency: anim.frequency,
          startDelay: startDelaySec
        }
      };
    }

    if (agentConfig.animationType === 'jump-intr' && agentConfig.animation) {
      const anim = agentConfig.animation;
      const start = gridToPixels(anim.startX ?? 0, anim.startY ?? 0);
      const end = gridToPixels(anim.endX ?? 0, anim.endY ?? 0);

      return {
        ...agentConfig,
        size: agentSize,
        animation: {
          startX: start.x - halfSize,
          startY: start.y - halfSize,
          endX: end.x - halfSize,
          endY: end.y - halfSize,
          duration: anim.duration ?? 2,
          jumpHeight: anim.jumpHeight ?? 100,
          agentSize: agentSize,
          startDelay: startDelaySec
        }
      };
    }

    if (agentConfig.animationType === 'hide-intr' && agentConfig.animation) {
      const anim = agentConfig.animation;
      const position = gridToPixels(anim.X ?? 0, anim.Y ?? 0);

      return {
        ...agentConfig,
        size: agentSize,
        animation: {
          positionX: position.x - halfSize,
          positionY: position.y - halfSize,
          duration: anim.duration ?? 1,
          agentSize: agentSize,
          startDelay: startDelaySec
        }
      };
    }

    if (agentConfig.animationType === 'reveal-intr' && agentConfig.animation) {
      const anim = agentConfig.animation;
      const position = gridToPixels(anim.X ?? 0, anim.Y ?? 0);

      return {
        ...agentConfig,
        size: agentSize,
        animation: {
          positionX: position.x - halfSize,
          positionY: position.y - halfSize,
          duration: anim.duration ?? 1,
          agentSize: agentSize,
          startDelay: startDelaySec
        }
      };
    }

    if (agentConfig.animationType === 'push-tr' && agentConfig.animation) {
      const anim = agentConfig.animation;
      const start = gridToPixels(anim.startX ?? 0, anim.startY ?? 0);
      const end = gridToPixels(anim.endX ?? 0, anim.endY ?? 0);

      return {
        ...agentConfig,
        size: agentSize,
        animation: {
          startX: start.x - halfSize,
          startY: start.y - halfSize,
          endX: end.x - halfSize,
          endY: end.y - halfSize,
          duration: anim.duration ?? 2,
          role: anim.role ?? 'pusher',
          startDelay: startDelaySec
        }
      };
    }

    if (agentConfig.animationType === 'hide-tr' && agentConfig.animation) {
      const anim = agentConfig.animation;
      const start = gridToPixels(anim.startX ?? 0, anim.startY ?? 0);
      const end = gridToPixels(anim.endX ?? 0, anim.endY ?? 0);

      return {
        ...agentConfig,
        size: agentSize,
        animation: {
          startX: start.x - halfSize,
          startY: start.y - halfSize,
          endX: end.x - halfSize,
          endY: end.y - halfSize,
          duration: anim.duration ?? 2,
          startDelay: startDelaySec
        }
      };
    }

    if (agentConfig.animationType === 'reveal-tr' && agentConfig.animation) {
      const anim = agentConfig.animation;
      const start = gridToPixels(anim.startX ?? 0, anim.startY ?? 0);
      const end = gridToPixels(anim.endX ?? 0, anim.endY ?? 0);

      return {
        ...agentConfig,
        size: agentSize,
        animation: {
          startX: start.x - halfSize,
          startY: start.y - halfSize,
          endX: end.x - halfSize,
          endY: end.y - halfSize,
          duration: anim.duration ?? 2,
          startDelay: startDelaySec
        }
      };
    }

    if (agentConfig.type === 'static' && agentConfig.position) {
      const { X = 0, Y = 0 } = agentConfig.position;
      const position = gridToPixels(X, Y);

      return {
        ...agentConfig,
        size: agentSize,
        staticProps: {
          style: {
            position: 'absolute',
            x: position.x - halfSize,
            y: position.y - halfSize
          }
        }
      };
    }

    return agentConfig;
  });
}

function GoAgent({ agent, animationConfig, size = 100 }) {
  const animationProps = go(animationConfig);
  return(
    <motion.div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...animationProps.style
      }}
    >
      <SvgUniqueIds style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {agent}
      </SvgUniqueIds>
    </motion.div>
  );
}

function JumpAgent({ agent, animationConfig, size = 100 }) {
  const animationProps = jump(animationConfig);
  return(
    <motion.div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...animationProps.style
      }}
    >
      <SvgUniqueIds style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {agent}
      </SvgUniqueIds>
    </motion.div>
  );
}

function HideAgent({ agent, animationConfig, size = 100 }) {
  const animationResult = hide(animationConfig);
  const { style, sparkles: sparklesConfig } = animationResult;
  
  return(
    <>
      <motion.div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style
        }}
      >
        <SvgUniqueIds style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {agent}
        </SvgUniqueIds>
      </motion.div>
      {sparklesConfig && sparkles({
        centerX: sparklesConfig.centerX,
        centerY: sparklesConfig.centerY,
        radius: sparklesConfig.radius,
        duration: sparklesConfig.duration,
        startDelay: sparklesConfig.startDelay
      })}
    </>
  );
}

function RevealAgent({ agent, animationConfig, size = 100 }) {
  const animationResult = reveal(animationConfig);
  const { style, sparkles: sparklesConfig } = animationResult;
  
  return(
    <>
      <motion.div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style
        }}
      >
        <SvgUniqueIds style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {agent}
        </SvgUniqueIds>
      </motion.div>
      {sparklesConfig && sparkles({
        centerX: sparklesConfig.centerX,
        centerY: sparklesConfig.centerY,
        radius: sparklesConfig.radius,
        duration: sparklesConfig.duration,
        startDelay: sparklesConfig.startDelay
      })}
    </>
  );
}

function PushAgent({ agent, animationConfig, size = 100 }) {
  const animationProps = push(animationConfig);
  return(
    <motion.div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...animationProps.style
      }}
    >
      <SvgUniqueIds style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {agent}
      </SvgUniqueIds>
    </motion.div>
  );
}

function HideTrAgent({ agent, animationConfig, size = 100 }) {
  const animationProps = hideTr(animationConfig);
  return(
    <motion.div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...animationProps.style
      }}
    >
      <SvgUniqueIds style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {agent}
      </SvgUniqueIds>
    </motion.div>
  );
}

function RevealTrAgent({ agent, animationConfig, size = 100 }) {
  const animationProps = revealTr(animationConfig);
  return(
    <motion.div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...animationProps.style
      }}
    >
      <SvgUniqueIds style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {agent}
      </SvgUniqueIds>
    </motion.div>
  );
}

function StaticAgent({ agent, staticProps, size = 100 }) {
  return(
    <motion.div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...staticProps.style
      }}
    >
      <SvgUniqueIds style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {agent}
      </SvgUniqueIds>
    </motion.div>
  );
}

export function MyApp({ config = configData, startDelayMs }) {
  const configWithDelay = startDelayMs != null ? { ...config, startDelayMs } : config;
  const agentConfigs = processConfig(configWithDelay);

  return (
    <div style={{ 
        width: '100vw', 
        height: '100vh', 
        position: 'relative',
        overflow: 'hidden',  // Prevents scrolling/viewport expansion
        margin: 0,
        padding: 0
    }}>
      {agentConfigs.map((agentConfig, index) => {
        const agent = agentRegistry[agentConfig.agent];
        
        if (agentConfig.animationType === 'go-intr') {
          return (
            <GoAgent 
              key={index}
              agent={agent} 
              animationConfig={agentConfig.animation}
              size={agentConfig.size}
            />
          );
        } else if (agentConfig.animationType === 'jump-intr') {
          return (
            <JumpAgent 
              key={index}
              agent={agent} 
              animationConfig={agentConfig.animation}
              size={agentConfig.size}
            />
          );
        } else if (agentConfig.animationType === 'hide-intr') {
          return (
            <HideAgent 
              key={index}
              agent={agent} 
              animationConfig={agentConfig.animation}
              size={agentConfig.size}
            />
          );
        } else if (agentConfig.animationType === 'reveal-intr') {
          return (
            <RevealAgent 
              key={index}
              agent={agent} 
              animationConfig={agentConfig.animation}
              size={agentConfig.size}
            />
          );
        } else if (agentConfig.animationType === 'push-tr') {
          return (
            <PushAgent 
              key={index}
              agent={agent} 
              animationConfig={agentConfig.animation}
              size={agentConfig.size}
            />
          );
        } else if (agentConfig.animationType === 'hide-tr') {
          return (
            <HideTrAgent 
              key={index}
              agent={agent} 
              animationConfig={agentConfig.animation}
              size={agentConfig.size}
            />
          );
        } else if (agentConfig.animationType === 'reveal-tr') {
          return (
            <RevealTrAgent 
              key={index}
              agent={agent} 
              animationConfig={agentConfig.animation}
              size={agentConfig.size}
            />
          );
        } else if (agentConfig.type === 'static') {
          return (
            <StaticAgent 
              key={index}
              agent={agent} 
              staticProps={agentConfig.staticProps}
              size={agentConfig.size}
            />
          );
        }
        return null;
      })}
    </div>
  );
}

// Default render (for standalone use)
createRoot(document.getElementById('root')).render(
    <MyApp />
);