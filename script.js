// Button elements
const buttons = ["green_button", "red_button", "yellow_button", "blue_button"];
let sampleSequence = [];

// Set up sounds
const sounds = {
    "green_button": new Audio('sounds/green.mp3'),
    "red_button": new Audio('sounds/red.mp3'),
    "yellow_button": new Audio('sounds/yellow.mp3'),
    "blue_button": new Audio('sounds/blue.mp3'),
    "wrong": new Audio('sounds/wrong.mp3')
};

// Functions

// Random small stuff
function animateButton(button) {
    button.animate({ opacity: 0 }, 100, function() {
        button.animate({ opacity: 1 }, 200, function() {
        });
    });
}

// Real stuff

function newGame() {
    if (start === false) {
        setTimeout(() => {
            $('body').removeClass('game_over');
            $('#text').text("Press any key to start");
        }, 1000);
        sounds['wrong'].play();
        $('body').addClass('game_over');
        $('#text').text("Game over!");
    }
    level = -1;
    userChosenSequenceIndex = -1;
    userChosenSequence = [];    
}

function startGame() {
    if (level === -1) {
        setTimeout(() => {
            nextSequence();
        }, 1000);
    }
}

function nextSequence() {
    // Functionality
    level++;
    userChosenSequence = [];
    userChosenSequenceIndex = -1;
    sampleSequence.push(buttons[Math.floor(Math.random()*buttons.length)]);
    index = sampleSequence.length - 1
    $('#text').text(" ");
    // Display
    setTimeout(() => {
        $('#text').text("Level " + level);
        sounds[sampleSequence[index]].play();
        animateButton($("#" + sampleSequence[index]));
    }, 1000);
}

function sequenceCheck(i) {
    return userChosenSequence[i] === sampleSequence[i];
}

function clickCollection(event) {
    if (level > -1) {
        const target = event.currentTarget;
        sounds[target.id].play();
        animateButton(target);
        userChosenSequence.push(target.id);
        userChosenSequenceIndex++;
        correct = sequenceCheck(userChosenSequenceIndex);
        console.log(correct);
        console.log(level);
        console.log(userChosenSequenceIndex);
        if (correct === false) {
            newGame();
        } else if (userChosenSequenceIndex === level) {
            nextSequence();
        }
    }   
}

// Event listeners

// Level and stuff
let start = true;
let level = undefined;
let userChosenSequenceIndex = undefined;
let userChosenSequence = undefined;

newGame();
start = false;

$(document).on('keypress', startGame);

// User sequence

$("#green_button, #red_button, #yellow_button, #blue_button").on('click', clickCollection);