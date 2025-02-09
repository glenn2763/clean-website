// Data structure for predictions and results
const questions = [
    { id: 1, text: "Will the coin toss be heads?", options: ["Heads", "Tails"] },
    { id: 2, text: "Will the first score be a touchdown?", options: ["Yes", "No"] },
    { id: 3, text: "Will there be a score in the first 5 minutes?", options: ["Yes", "No"] },
    { id: 4, text: "Will there be a turnover in the first quarter?", options: ["Yes", "No"] },
    { id: 5, text: "Will there be a successful 2-point conversion?", options: ["Yes", "No"] },
    { id: 6, text: "Will there be a defensive/special teams touchdown?", options: ["Yes", "No"] },
    { id: 7, text: "Will the game go to overtime?", options: ["Yes", "No"] },
    { id: 8, text: "Will there be a successful field goal over 50 yards?", options: ["Yes", "No"] },
    { id: 9, text: "Will the total points be over 50.5?", options: ["Over", "Under"] },
    { id: 10, text: "Will Chiefs win the game?", options: ["Yes", "No"] }
];

const participants = [
    { name: "Player 1", predictions: [0, 1, 0, 0, 1, 1, 0, 0, 1, 1] },
    { name: "Player 2", predictions: [1, 0, 0, 1, 1, 0, 0, 1, 0, 1] },
    // Add more participants with their predictions
];

let results = new Array(10).fill(null); // Array to store actual results

// Initialize the page
window.onload = function() {
    createQuestionsInterface();
    updateScoreboard();
};

// Create the questions interface for updating results
function createQuestionsInterface() {
    const container = document.getElementById('questions-container');
    questions.forEach((question, index) => {
        const div = document.createElement('div');
        div.className = 'question-item';
        div.innerHTML = `
            <p>${question.text}</p>
            <select id="question-${index}">
                <option value="">Select result</option>
                <option value="0">${question.options[0]}</option>
                <option value="1">${question.options[1]}</option>
            </select>
        `;
        container.appendChild(div);
        
        // Set existing results if any
        if (results[index] !== null) {
            document.getElementById(`question-${index}`).value = results[index];
        }
    });
}

// Update scores when results are changed
function updateScores() {
    // Get current results
    results = questions.map((_, index) => {
        const select = document.getElementById(`question-${index}`);
        return select.value === "" ? null : parseInt(select.value);
    });

    updateScoreboard();
}

// Update the scoreboard display
function updateScoreboard() {
    const tbody = document.getElementById('predictions-body');
    tbody.innerHTML = '';

    const scores = participants.map(participant => {
        let score = 0;
        let details = [];
        
        participant.predictions.forEach((pred, index) => {
            if (results[index] !== null) {
                if (pred === results[index]) {
                    score++;
                    details.push(`<span class="correct">✓</span>`);
                } else {
                    details.push(`<span class="incorrect">✗</span>`);
                }
            } else {
                details.push("-");
            }
        });

        return {
            name: participant.name,
            score: score,
            details: details.join(" ")
        };
    });

    // Sort by score (highest first)
    scores.sort((a, b) => b.score - a.score);

    // Create table rows
    scores.forEach(score => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${score.name}</td>
            <td>${score.score}</td>
            <td>${score.details}</td>
        `;
        tbody.appendChild(row);
    });
} 