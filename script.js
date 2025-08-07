// Functions

function setDice(diceCircles, number) {
  const config = numConfig[number];
  diceCircles.forEach((circle, idx) => {
    circle.style.opacity = config[idx] ? "1" : "0";
  });
}

// ------------------------------

// Functionality

const numConfig = {
  1: [0, 0, 0, 1, 0, 0, 0],
  2: [1, 0, 0, 0, 0, 0, 1],
  3: [1, 0, 0, 1, 0, 0, 1],
  4: [1, 0, 1, 0, 1, 0, 1],
  5: [1, 0, 1, 1, 1, 0, 1],
  6: [1, 1, 1, 0, 1, 1, 1],
};

dice1Number = Math.ceil(Math.random() * 6);
dice2Number = Math.ceil(Math.random() * 6);

const dice1Circles = document.querySelectorAll("#dice1 circle");
const dice2Circles = document.querySelectorAll("#dice2 circle");

setDice(dice1Circles, dice1Number);
setDice(dice2Circles, dice2Number);

let announceText;
if (dice1Number > dice2Number) {
  announceText = "&#127775;Player 1 is the winner!&#127775;";
} else if (dice1Number < dice2Number) {
  announceText = "&#127775;Player 2 is the winner!&#127775;";
} else {
  announceText = "&#129335;It's a tie, roll again!&#129335;";
}

document.querySelector("#announce p").innerHTML = announceText;
