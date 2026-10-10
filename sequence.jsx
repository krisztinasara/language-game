import { createRoot } from 'react-dom/client';
import { useState, useEffect } from 'react';
import { SequencePlayer } from './components/sequence/player';

const SEQUENCE_LIST_URL = './sequences/sequence_list.txt';
const SEQUENCES_BASE = './sequences/';

const scenePageStyle = {
  position: 'fixed',
  inset: 0,
  backgroundColor: '#ffffff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
};

/**
 * ?scene= is one JSON address relative to this page.
 * Missing param means the playlist.
 */
function sceneRequest() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('scene')) return null;
  const raw = (params.get('scene') ?? '').trim();
  if (!raw) return { error: 'Scene address is empty.' };
  try {
    return { url: new URL(raw, window.location.href).href };
  } catch {
    return { error: 'Scene address is not a valid URL.' };
  }
}

const requestedScene = sceneRequest();

if (requestedScene) {
  document.documentElement.style.backgroundColor = '#ffffff';
  document.body.style.backgroundColor = '#ffffff';
}

function ScenePage({ children }) {
  return <div style={scenePageStyle}>{children}</div>;
}

/**
 * One scene, looped. Does not read sequences/sequence_list.txt.
 * No audio: the parent page plays the sentence.
 */
function SingleSceneApp() {
  if (requestedScene.error) {
    return <ScenePage>Error: {requestedScene.error}</ScenePage>;
  }

  return (
    <ScenePage>
      <SequencePlayer sequence={[requestedScene.url]} single />
    </ScenePage>
  );
}

/**
 * Sequence Player Entry Point
 *
 * Loads the sequence list from sequence_list.txt (one JSON filename per line).
 * Paths are built as ./sequences/<filename>.
 */
function PlaylistApp() {
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
        const trimmed = text.trimStart();
        if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
          throw new Error(
            'Sequence list URL returned HTML instead of a text list. Check SEQUENCE_LIST_URL matches a real file (e.g. sequence_list.txt).'
          );
        }
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
  if (sequence.length === 0) return <div>No sequences in sequence_list.txt</div>;

  return (
    <SequencePlayer
      sequence={sequence}
      onSequenceComplete={handleSequenceComplete}
    />
  );
}

function SequenceApp() {
  if (requestedScene) return <SingleSceneApp />;
  return <PlaylistApp />;
}

createRoot(document.getElementById('root')).render(
  <SequenceApp />
);
