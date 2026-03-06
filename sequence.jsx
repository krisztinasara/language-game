import { createRoot } from 'react-dom/client';
import { useState, useEffect } from 'react';
import { SequencePlayer } from './components/sequence/player';

const SEQUENCE_LIST_URL = './sequences/sequence-list.txt';
const SEQUENCES_BASE = './sequences/';

/**
 * Sequence Player Entry Point
 *
 * Loads the sequence list from sequence-list.txt (written by translator/translate.py).
 * Each line is a JSON filename; paths are built as ./sequences/<filename>.
 */
function SequenceApp() {
  const [sequence, setSequence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(SEQUENCE_LIST_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load sequence list: ${res.status}`);
        return res.text();
      })
      .then((text) => {
        const names = text
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
        setSequence(names.map((name) => `${SEQUENCES_BASE}${name}`));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSequenceComplete = () => {
    console.log('All sequences completed!');
  };

  if (loading) return <div>Loading sequence list...</div>;
  if (error) return <div>Error: {error}</div>;
  if (sequence.length === 0) return <div>No sequences in sequence-list.txt</div>;

  return (
    <SequencePlayer
      sequence={sequence}
      onSequenceComplete={handleSequenceComplete}
    />
  );
}

// Render the sequence player
createRoot(document.getElementById('root')).render(
  <SequenceApp />
);

