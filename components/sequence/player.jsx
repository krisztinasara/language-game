import { useState, useEffect, useRef } from 'react';
import { MyApp } from '../../main';
import { gridToPixels } from '../board/grid';
import {
  getJumpEffectiveTotalDurationSec,
  JUMP_DEFAULT_DURATION,
  JUMP_DEFAULT_JUMP_HEIGHT
} from '../motions/jump-intr';
import { getGoEffectiveDurationSec } from '../motions/go-intr';

/** Duration of the divider screen (solid black) between animations, in ms. Used by a Python script to detect segment boundaries. */
const DIVIDER_DURATION_MS = 1500;
/** Hold start position before animation and end position after animation (ms). */
const PRE_HOLD_MS = 1500;
const POST_HOLD_MS = 1500;
/** Lead-in inside each motion (`pauseAfterPulse`). Part of one play, not a gap between loops. */
const MOTION_PAUSE_AFTER_PULSE_SEC = 0.5;
/** Approach move used by hide-intr and hide-tr before the main duration. */
const HIDE_APPROACH_SEC = 1;

/**
 * Wall-clock length of one scene play, including each motion's own lead-in.
 * No sequence pre-hold, post-hold, or pause.
 */
function getScenePlayDurationMs(config) {
  if (!config || !config.agents) return 0;
  const agentSize = config.agentSize ?? 100;
  const halfSize = agentSize / 2;
  let maxSec = 0;

  config.agents.forEach((agent) => {
    const anim = agent.animation;
    if (!anim) return;

    if (agent.animationType === 'jump-intr') {
      const start = gridToPixels(anim.startX ?? 0, anim.startY ?? 0);
      const end = gridToPixels(anim.endX ?? 0, anim.endY ?? 0);
      const sec = getJumpEffectiveTotalDurationSec({
        startX: start.x - halfSize,
        startY: start.y - halfSize,
        endX: end.x - halfSize,
        endY: end.y - halfSize,
        duration: anim.duration ?? JUMP_DEFAULT_DURATION,
        jumpHeight: anim.jumpHeight ?? JUMP_DEFAULT_JUMP_HEIGHT,
        agentSize
      });
      maxSec = Math.max(maxSec, MOTION_PAUSE_AFTER_PULSE_SEC + sec);
      return;
    }

    if (agent.animationType === 'go-intr') {
      const start = gridToPixels(anim.startX ?? 0, anim.startY ?? 0);
      const end = gridToPixels(anim.endX ?? 0, anim.endY ?? 0);
      const sec = getGoEffectiveDurationSec({
        startX: start.x - halfSize,
        startY: start.y - halfSize,
        endX: end.x - halfSize,
        endY: end.y - halfSize
      });
      maxSec = Math.max(maxSec, MOTION_PAUSE_AFTER_PULSE_SEC + sec);
      return;
    }

    if (agent.animationType === 'hide-intr') {
      const position = gridToPixels(anim.X ?? 0, anim.Y ?? 0);
      const start = gridToPixels(anim.startX ?? anim.X ?? 0, anim.startY ?? anim.Y ?? 0);
      const approach = start.x !== position.x || start.y !== position.y ? HIDE_APPROACH_SEC : 0;
      const pause = agent.pulseAtStart ? MOTION_PAUSE_AFTER_PULSE_SEC : 0;
      const extra = anim.startDelay ?? 0;
      maxSec = Math.max(maxSec, extra + pause + approach + (anim.duration ?? 1));
      return;
    }

    if (agent.animationType === 'reveal-intr') {
      const pause = agent.pulseAtStart ? MOTION_PAUSE_AFTER_PULSE_SEC : 0;
      const extra = anim.startDelay ?? 0;
      maxSec = Math.max(maxSec, extra + pause + (anim.duration ?? 1));
      return;
    }

    if (agent.animationType === 'push-tr') {
      const extra = anim.startDelay ?? 0;
      maxSec = Math.max(maxSec, extra + MOTION_PAUSE_AFTER_PULSE_SEC + (anim.duration ?? 2));
      return;
    }

    if (agent.animationType === 'hide-tr') {
      const start = gridToPixels(anim.startX ?? 0, anim.startY ?? 0);
      const preStart = gridToPixels(
        anim.preStartX ?? anim.startX ?? 0,
        anim.preStartY ?? anim.startY ?? 0
      );
      const approach = preStart.x !== start.x || preStart.y !== start.y ? HIDE_APPROACH_SEC : 0;
      const extra = anim.startDelay ?? 0;
      maxSec = Math.max(maxSec, extra + MOTION_PAUSE_AFTER_PULSE_SEC + approach + (anim.duration ?? 2));
      return;
    }

    if (agent.animationType === 'reveal-tr') {
      const extra = anim.startDelay ?? 0;
      maxSec = Math.max(maxSec, extra + MOTION_PAUSE_AFTER_PULSE_SEC + (anim.duration ?? 2));
      return;
    }

    if (anim.duration) {
      maxSec = Math.max(maxSec, anim.duration);
    }
  });

  return maxSec * 1000;
}

/**
 * Full-screen black divider. Easy to detect in video (e.g. mean frame luminance ≈ 0) for automated splitting.
 */
function DividerScreen() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000000',
        zIndex: 9999,
      }}
      aria-hidden
    />
  );
}

/**
 * Sequence Player - Plays multiple JSON config files sequentially.
 * Shows a solid black divider screen between each animation for later video splitting (Option 1).
 *
 * @param {Array<string>} sequence - Array of paths to JSON config files
 * @param {Function} onSequenceComplete - Callback when all sequences are done
 * @param {boolean} single - Loop the first scene, with no holds or divider
 */
export function SequencePlayer({ sequence = [], onSequenceComplete, single = false }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentConfig, setCurrentConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showDivider, setShowDivider] = useState(false);
  const [pendingNextIndex, setPendingNextIndex] = useState(null);
  const [playKey, setPlayKey] = useState(0);
  const singleRef = useRef(single);
  singleRef.current = single;
  const sequenceRef = useRef(sequence);
  const onCompleteRef = useRef(onSequenceComplete);
  const indexRef = useRef(0);

  useEffect(() => {
    indexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    sequenceRef.current = sequence;
    onCompleteRef.current = onSequenceComplete;
    singleRef.current = single;
  }, [sequence, onSequenceComplete, single]);

  const loadConfig = async (configPath, showLoading = true, nextIndex = undefined) => {
    if (showLoading) setIsLoading(true);
    try {
      const response = await fetch(configPath);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const config = await response.json();
      setCurrentConfig(config);
      if (nextIndex !== undefined) setCurrentIndex(nextIndex);
      setIsLoading(false);
    } catch (error) {
      console.error(`Error loading config ${configPath}:`, error);
      setIsLoading(false);
      if (singleRef.current) {
        setLoadError(error.message || String(error));
        return;
      }
      moveToNext();
    }
  };

  const moveToNext = () => {
    const nextIndex = indexRef.current + 1;
    if (nextIndex < sequenceRef.current.length) {
      setShowDivider(true);
      setPendingNextIndex(nextIndex);
    } else {
      if (onCompleteRef.current) onCompleteRef.current();
    }
  };

  const getMaxDuration = (config) => {
    if (!config || !config.agents) return 0;
    const agentSize = config.agentSize ?? 100;
    const halfSize = agentSize / 2;
    let maxDuration = 0;
    config.agents.forEach(agent => {
      if (!agent.animation) return;
      if (agent.animationType === 'jump-intr') {
        const anim = agent.animation;
        const start = gridToPixels(anim.startX ?? 0, anim.startY ?? 0);
        const end = gridToPixels(anim.endX ?? 0, anim.endY ?? 0);
        const sec = getJumpEffectiveTotalDurationSec({
          startX: start.x - halfSize,
          startY: start.y - halfSize,
          endX: end.x - halfSize,
          endY: end.y - halfSize,
          duration: anim.duration ?? JUMP_DEFAULT_DURATION,
          jumpHeight: anim.jumpHeight ?? JUMP_DEFAULT_JUMP_HEIGHT,
          agentSize
        });
        maxDuration = Math.max(maxDuration, sec);
        return;
      }
      if (agent.animationType === 'go-intr') {
        const anim = agent.animation;
        const start = gridToPixels(anim.startX ?? 0, anim.startY ?? 0);
        const end = gridToPixels(anim.endX ?? 0, anim.endY ?? 0);
        const sec = getGoEffectiveDurationSec({
          startX: start.x - halfSize,
          startY: start.y - halfSize,
          endX: end.x - halfSize,
          endY: end.y - halfSize
        });
        maxDuration = Math.max(maxDuration, sec);
        return;
      }
      if (agent.animation.duration) {
        maxDuration = Math.max(maxDuration, agent.animation.duration);
      }
    });
    return maxDuration * 1000;
  };

  // Initial load
  useEffect(() => {
    if (sequence.length === 0) {
      setIsLoading(false);
      return;
    }
    loadConfig(sequence[0], true);
  }, []);

  // Playlist: pre-hold + animation + post-hold + pause, then the divider.
  // Single scene: one play, then the same scene starts again with no gap.
  useEffect(() => {
    if (currentConfig && sequenceRef.current.length > 0 && !showDivider) {
      const maxDuration = getMaxDuration(currentConfig);
      const totalMs = singleRef.current
        ? getScenePlayDurationMs(currentConfig)
        : (maxDuration > 0 ? PRE_HOLD_MS + maxDuration + POST_HOLD_MS + 1000 : 0);
      if (totalMs > 0) {
        const timer = setTimeout(() => {
          if (singleRef.current) {
            window.parent.postMessage({ source: 'brocanto-scene', type: 'loop' }, '*');
            setPlayKey((k) => k + 1);
          } else {
            moveToNext();
          }
        }, totalMs);
        return () => clearTimeout(timer);
      }
    }
  }, [currentConfig, showDivider, playKey]);

  // While divider is shown: after DIVIDER_DURATION_MS, load next config (hide divider only after load completes)
  useEffect(() => {
    if (single) return;
    if (!showDivider || pendingNextIndex === null) return;
    const list = sequenceRef.current;
    if (pendingNextIndex >= list.length) return;
    const idx = pendingNextIndex;
    const path = list[idx];
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(path);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const config = await response.json();
          setCurrentConfig(config);
          setCurrentIndex(idx);
          setShowDivider(false);
          setPendingNextIndex(null);
        } catch (error) {
          console.error(`Error loading config ${path}:`, error);
          indexRef.current = idx;
          setCurrentIndex(idx);
          setShowDivider(false);
          setPendingNextIndex(null);
          moveToNext();
        }
      })();
    }, DIVIDER_DURATION_MS);
    return () => clearTimeout(timer);
  }, [showDivider, pendingNextIndex, single]);

  if (isLoading) {
    return <div>{single ? 'Loading scene...' : 'Loading sequence...'}</div>;
  }

  if (loadError) {
    return <div>Error: {loadError}</div>;
  }

  if (showDivider) {
    return <DividerScreen />;
  }

  if (!currentConfig) {
    return <div>No sequence to play</div>;
  }

  if (single) {
    return (
      <div style={{ position: 'absolute', inset: 0 }}>
        <MyApp
          key={playKey}
          config={currentConfig}
          startDelayMs={0}
          sceneMode
        />
      </div>
    );
  }

  return (
    <MyApp
      key={currentIndex}
      config={currentConfig}
      startDelayMs={PRE_HOLD_MS}
    />
  );
}
