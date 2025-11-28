import { createRoot } from 'react-dom/client';
import { SequencePlayer } from './components/sequence/player';

/**
 * Sequence Player Entry Point
 * 
 * Define your sequence of JSON config files here.
 * The player will automatically load and play them one after another.
 */
const sequence = [
  './sequences/sequence1-go.json',      // Wavy "go" movement
  './sequences/sequence2-jump.json',    // Parabolic "jump" movement
  './sequences/sequence3-hide.json',    // Shrinking "hide" animation
  './sequences/sequence4-reveal.json',  // Growing "reveal" animation
  './sequences/sequence5-push.json',    // "Push" interaction
];

function SequenceApp() {
  const handleSequenceComplete = () => {
    console.log('All sequences completed!');
    // You can add any logic here when all sequences finish
  };

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

