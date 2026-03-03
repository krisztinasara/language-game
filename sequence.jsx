import { createRoot } from 'react-dom/client';
import { SequencePlayer } from './components/sequence/player';

/**
 * Sequence Player Entry Point
 * 
 * Define your sequence of JSON config files here.
 * The player will automatically load and play them one after another.
 */
const sequence = [
  './sequences/sequence1-go-intr.json',       // Wavy "go-intr" movement
  './sequences/sequence2-jump-intr.json',    // Parabolic "jump-intr" movement
  './sequences/sequence3-hide-intr.json',    // Shrinking "hide-intr" animation
  './sequences/sequence4-reveal-intr.json',  // Growing "reveal-intr" animation
  './sequences/sequence5-push-tr.json',      // "push-tr" interaction
  './sequences/sequence6-hide-tr.json',     // "hide-tr" covering movement
  './sequences/sequence7-reveal-tr.json'     // "reveal-tr" revealing movement
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

