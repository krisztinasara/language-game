const svgNS = "http://www.w3.org/2000/svg";
const spacing = 30;
const squareSize = 120;
const rows = 4;
const cols = 6;

document.addEventListener("DOMContentLoaded", () => {
    const svg = document.querySelector("svg");
  
    // Example: Create squares dynamically
    for (let i = 0; i < 5; i++) {
        for (let j = 0; j < rows; j++) {
            const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            rect.setAttribute("x", i * (squareSize + spacing)); // Position squares horizontally
            rect.setAttribute("y", j * (squareSize + spacing));
            rect.setAttribute("width", squareSize);
            rect.setAttribute("height", squareSize);
            rect.setAttribute("fill", "green");
            rect.setAttribute("stroke", "black");
            rect.setAttribute("stroke-width", 2);
        
            // Assign a name to each square
            const squareName = `Square (${i + 1}, ${j + 1})`;
            rect.setAttribute("data-name", squareName);
        
            svg.appendChild(rect);
        }
    }
  });
