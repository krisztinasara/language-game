import { createRoot } from 'react-dom/client';
import { motion } from 'motion/react';

/*
The screen will have a grid-like layout
(also from practical reasons for calibration and for starting to work in the game framework).
This will be a 6x8 layout.
For the time being, we start with a viewport percentages and not a gameboard with absolute positions.
*/

const circle = <circle cx="50" cy="50" r="40" stroke="green" strokeWidth="4" fill="yellow" />
const square = <rect width="75" height="75" />

function Item1({ agent }) {
    return(
        <motion.svg
            width="100" 
            height="100"
            style={{ position: 'absolute' }}
            initial={{ left: '25%', top: '35%' }}
            animate={{ left: '50%', top: '50%', transition: {duration: 2} }}
        >
            {agent}
        </motion.svg>
    )
}

function Item2({ agent }) {
    return(
        <motion.svg
            width="100" 
            height="100"
            style={{ position: 'absolute' }}
            initial={{ left: '50%', top: '65%' }}
            animate={{ left: '50%', top: '65%' }}
        >
            {agent}
        </motion.svg>
    )
}

function MyApp() {
    return(
        <div style={{ 
            width: '100vw', 
            height: '100vh', 
            position: 'relative',
            overflow: 'hidden',  // Prevents scrolling/viewport expansion
            margin: 0,
            padding: 0
        }}>
            <Item1 agent={circle} />
            <Item2 agent={circle}/>
        </div>
    )
}

createRoot(document.getElementById('root')).render(
    <MyApp />
);