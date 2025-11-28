import { useState, useEffect, useRef } from 'react';
import { MyApp } from '../../main';

/**
 * Sequence Player - Plays multiple JSON config files sequentially
 * 
 * @param {Array<string>} sequence - Array of paths to JSON config files
 * @param {Function} onSequenceComplete - Callback when all sequences are done
 */
export function SequencePlayer({ sequence = [], onSequenceComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentConfig, setCurrentConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const sequenceRef = useRef(sequence);
  const onCompleteRef = useRef(onSequenceComplete);

  // Keep refs updated
  useEffect(() => {
    sequenceRef.current = sequence;
    onCompleteRef.current = onSequenceComplete;
  }, [sequence, onSequenceComplete]);

  const loadConfig = async (configPath) => {
    setIsLoading(true);
    try {
      const response = await fetch(configPath);
      const config = await response.json();
      setCurrentConfig(config);
      setIsLoading(false);
    } catch (error) {
      console.error(`Error loading config ${configPath}:`, error);
      setIsLoading(false);
      // Move to next config on error
      moveToNext();
    }
  };

  const moveToNext = () => {
    setCurrentIndex(prevIndex => {
      const nextIndex = prevIndex + 1;
      if (nextIndex < sequenceRef.current.length) {
        loadConfig(sequenceRef.current[nextIndex]);
        return nextIndex;
      } else {
        // All sequences complete
        if (onCompleteRef.current) {
          onCompleteRef.current();
        }
        return prevIndex; // Stay at last index
      }
    });
  };

  // Calculate max duration from current config to know when to move to next
  const getMaxDuration = (config) => {
    if (!config || !config.agents) return 0;
    
    let maxDuration = 0;
    config.agents.forEach(agent => {
      if (agent.animation && agent.animation.duration) {
        maxDuration = Math.max(maxDuration, agent.animation.duration);
      }
    });
    return maxDuration * 1000; // Convert to milliseconds
  };

  useEffect(() => {
    if (sequence.length === 0) {
      setIsLoading(false);
      return;
    }

    // Load the first config
    loadConfig(sequence[0]);
  }, []);

  useEffect(() => {
    if (currentConfig && sequenceRef.current.length > 0) {
      const maxDuration = getMaxDuration(currentConfig);
      if (maxDuration > 0) {
        const pauseBetweenSequences = 1000; // 1 second pause
        const timer = setTimeout(() => {
          moveToNext();
        }, maxDuration + pauseBetweenSequences);

        return () => clearTimeout(timer);
      }
    }
  }, [currentConfig]);

  if (isLoading) {
    return <div>Loading sequence...</div>;
  }

  if (!currentConfig) {
    return <div>No sequence to play</div>;
  }

  return <MyApp config={currentConfig} />;
}
