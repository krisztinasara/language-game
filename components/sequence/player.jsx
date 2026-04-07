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
 */
export function SequencePlayer({ sequence = [], onSequenceComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentConfig, setCurrentConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDivider, setShowDivider] = useState(false);
  const [pendingNextIndex, setPendingNextIndex] = useState(null);
  const sequenceRef = useRef(sequence);
  const onCompleteRef = useRef(onSequenceComplete);
  const indexRef = useRef(0);

  useEffect(() => {
    indexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    sequenceRef.current = sequence;
    onCompleteRef.current = onSequenceComplete;
  }, [sequence, onSequenceComplete]);

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

  // After pre-hold + animation + post-hold + pause: show divider, then load next
  useEffect(() => {
    if (currentConfig && sequenceRef.current.length > 0 && !showDivider) {
      const maxDuration = getMaxDuration(currentConfig);
      if (maxDuration > 0) {
        const pauseBetweenSequences = 1000;
        const totalMs = PRE_HOLD_MS + maxDuration + POST_HOLD_MS + pauseBetweenSequences;
        const timer = setTimeout(() => moveToNext(), totalMs);
        return () => clearTimeout(timer);
      }
    }
  }, [currentConfig, showDivider]);

  // While divider is shown: after DIVIDER_DURATION_MS, load next config (hide divider only after load completes)
  useEffect(() => {
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
  }, [showDivider, pendingNextIndex]);

  if (isLoading) {
    return <div>Loading sequence...</div>;
  }

  if (showDivider) {
    return <DividerScreen />;
  }

  if (!currentConfig) {
    return <div>No sequence to play</div>;
  }

  return (
    <MyApp
      key={currentIndex}
      config={currentConfig}
      startDelayMs={PRE_HOLD_MS}
    />
  );
}
