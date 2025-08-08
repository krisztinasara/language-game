// ------------------------------

// Configuration
const numConfig = {
  1: [0, 0, 0, 1, 0, 0, 0],
  2: [1, 0, 0, 0, 0, 0, 1],
  3: [1, 0, 0, 1, 0, 0, 1],
  4: [1, 0, 1, 0, 1, 0, 1],
  5: [1, 0, 1, 1, 1, 0, 1],
  6: [1, 1, 1, 0, 1, 1, 1],
};

// Media
var diceRollSound = new Audio("dice_roll_sound.mp3");

// Functions
function setDice(diceCircles, number) {
    const config = numConfig[number];
    diceCircles.forEach((circle, idx) => {
      circle.style.opacity = config[idx] ? "1" : "0";
    });
  }

function diceRoll() {
  // Dice roll sound effect
  diceRollSound.play();

  // Initial setup
  let dice1Number = Math.ceil(Math.random() * 6);
  let dice2Number = Math.ceil(Math.random() * 6);

  const dice1Circles = document.querySelectorAll("#dice1 circle");
  const dice2Circles = document.querySelectorAll("#dice2 circle");

  // Set initial dice
  setDice(dice1Circles, dice1Number);
  setDice(dice2Circles, dice2Number);

  // Set initial announcement
  let announceText;
  if (dice1Number > dice2Number) {
    announceText = "&#127775;Player 1 is the winner!&#127775;";
  } else if (dice1Number < dice2Number) {
    announceText = "&#127775;Player 2 is the winner!&#127775;";
  } else {
    announceText = "&#129335;It's a tie, roll again!&#129335;";
  }

  document.querySelector("#announce p").innerHTML = announceText;
}

function diceColor(event) {
  const dice = event.currentTarget; // Get the element that was clicked
  const colors = ["red", "blue", "yellow", "purple", "orange", "black", "green"];
  const rectangle = dice.querySelector("rect");
  rectangle.style.fill = colors[Math.floor(Math.random() * colors.length)];
}

// Functionality
document.querySelector("#control").addEventListener("click", diceRoll);
document.addEventListener("keydown", function(event){
  if (event.key === " ") {
    diceRoll();
  }
});

document.querySelectorAll(".dice").forEach(dice => {
  dice.addEventListener("click", function(event) {
    diceColor(event);
    console.log("Adding active_dom class");
    dice.classList.add("active_dom");
    setTimeout(function() {
      console.log("Removing active_dom class");
      dice.classList.remove("active_dom");
    }, 150);
  });
});

// Playing around
/* document.querySelector("#dice1").addEventListener("click", function(event) {
    console.log(event)
}) */