// Data structure to hold the events and predictions
const eventData = {
    events: [
        {
            name: "Anthem",
            options: ["under", "over"],
            predictions: {
                "under": ["Nick", "Kent", "Ryan", "Jeff", "Paavo", "Connor", "Jshu", "Emmett", "Jake"],
                "over": ["Glenn", "Isaac", "Cormac"]
            },
            result: null
        },
        {
            name: "Penalty",
            options: ["KC", "PHI"],
            predictions: {
                "KC": ["Jeff", "Connor", "Jshu", "Emmett"],
                "PHI": ["Kent", "Nick", "Ryan", "Paavo", "Jake", "Glenn", "Isaac", "Cormac"]
            },
            result: null
        },
        // Add other events similarly...
    ]
};

// Keep track of scores
let scores = {};

// Initialize scores for all participants
function initializeScores() {
    const participants = new Set();
    eventData.events.forEach(event => {
        Object.values(event.predictions).forEach(names => {
            names.forEach(name => participants.add(name));
        });
    });
    
    participants.forEach(name => {
        scores[name] = 0;
    });
}

// Update scores based on event results
function updateScores() {
    // Reset scores
    initializeScores();
    
    // Calculate new scores
    eventData.events.forEach(event => {
        if (event.result) {
            event.predictions[event.result].forEach(name => {
                scores[name]++;
            });
        }
    });
    
    updateLeaderboard();
}

// Update the leaderboard display
function updateLeaderboard() {
    const tbody = document.getElementById('standings-body');
    tbody.innerHTML = '';
    
    // Sort participants by score
    const sortedScores = Object.entries(scores)
        .sort(([,a], [,b]) => b - a);
    
    sortedScores.forEach(([name, score], index) => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${name}</td>
            <td>${score}</td>
            <td>${getCorrectPredictions(name)}</td>
        `;
    });
}

// Create event toggle controls
function createEventControls() {
    const container = document.getElementById('events-container');
    
    eventData.events.forEach(event => {
        const eventDiv = document.createElement('div');
        eventDiv.className = 'event-control';
        
        const label = document.createElement('label');
        label.textContent = event.name + ': ';
        
        const select = document.createElement('select');
        select.innerHTML = `
            <option value="">-- Select Result --</option>
            ${event.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
        `;
        
        select.value = event.result || '';
        select.addEventListener('change', (e) => {
            event.result = e.target.value || null;
            updateScores();
            updateEventHistory();
        });
        
        eventDiv.appendChild(label);
        eventDiv.appendChild(select);
        container.appendChild(eventDiv);
    });
}

// Update event history display
function updateEventHistory() {
    const container = document.getElementById('event-history-container');
    container.innerHTML = '';
    
    eventData.events.forEach(event => {
        if (event.result) {
            const div = document.createElement('div');
            div.className = 'event-result';
            div.innerHTML = `
                <h3>${event.name}</h3>
                <p>Result: ${event.result}</p>
                <p>Correct predictions: ${event.predictions[event.result].join(', ')}</p>
            `;
            container.appendChild(div);
        }
    });
}

// Get number of correct predictions for a participant
function getCorrectPredictions(name) {
    return eventData.events.filter(event => 
        event.result && event.predictions[event.result].includes(name)
    ).length;
}

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    initializeScores();
    createEventControls();
    updateLeaderboard();
    updateEventHistory();
}); 