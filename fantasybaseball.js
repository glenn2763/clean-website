// Data structure to hold the events and predictions
const eventData = {
    events: [
        {
            name: "Anthem",
            options: ["Under", "Over"],
            result: "Under",
            predictions: {
                "Under": ["Nick", "Kent", "Ryan", "Jeff", "Paavo", "Connor", "Jshu", "Emmett", "Jake"],
                "Over": ["Glenn", "Isaac", "Cormac"]
            }
        },
        {
            name: "First Penalty",
            options: ["PHI", "KC"],
            result: "PHI",
            predictions: {
                "PHI": ["Kent", "Nick", "Ryan", "Paavo", "Jake", "Glenn", "Isaac", "Cormac"],
                "KC": ["Jeff", "Connor", "Jshu", "Emmett"]
            }
        },
        {
            name: "Score < 7",
            options: ["Yes", "No"],
            result: "No",
            predictions: {
                "Yes": ["Jeff", "Jshu", "Ryan", "Nick", "Paavo", "Jake", "Glenn", "Cormac"],
                "No": ["Connor", "Emmett", "Kent", "Isaac"]
            }
        },
        {
            name: "First Score",
            options: ["PHI", "KC"],
            result: "PHI",
            predictions: {
                "PHI": ["Jeff", "Jshu", "Emmett", "Ryan", "Nick", "Jake", "Cormac"],
                "KC": ["Connor", "Paavo", "Glenn"]
            }
        },
        {
            name: "Saquon TD",
            options: ["Yes", "No"],
            result: "No",
            predictions: {
                "Yes": ["Jshu", "Jeff", "Nick", "Ryan", "Jake"],
                "No": []
            }
        },
        {
            name: "Hurts TD",
            options: ["Yes", "No"],
            result: "Yes",
            predictions: {
                "Yes": ["Jshu", "Jeff", "Nick", "Ryan"],
                "No": ["Jake"]
            }
        },
        {
            name: "Kelce TD",
            options: ["Yes", "No"],
            result: "No",
            predictions: {
                "Yes": ["Jshu", "Nick"],
                "No": ["Jeff", "Ryan"]
            }
        }
    ]
};

// Keep track of scores
let scores = {};
let anthemCorrect = new Set();

// Keep track of results for hierarchical sorting
let eventOrder = ["Anthem", "First Penalty", "Score < 7", "First Score", "Saquon TD", "Hurts TD", "Kelce TD"];

// Initialize scores for all participants
function initializeScores() {
    const participants = new Set();
    eventData.events.forEach(event => {
        Object.values(event.predictions).forEach(names => {
            names.forEach(name => participants.add(name));
        });
    });
    
    // Convert to array, sort alphabetically, and initialize scores
    Array.from(participants)
        .sort()
        .forEach(name => {
            scores[name] = 0;
        });
}

// Update scores based on event results
function updateScores() {
    // Reset scores and anthem tracking
    initializeScores();
    anthemCorrect.clear();
    
    // Calculate new scores
    eventData.events.forEach(event => {
        if (event.result) {
            if (event.name === "Anthem") {
                // Track who got anthem correct
                event.predictions[event.result].forEach(name => {
                    anthemCorrect.add(name);
                });
            }
            
            event.predictions[event.result].forEach(name => {
                scores[name] += 1;
            });
        }
    });
    
    updateLeaderboard();
}

// Update the leaderboard display with hierarchical sorting
function updateLeaderboard() {
    const tbody = document.getElementById('standings-body');
    const oldPositions = new Map();
    
    // Store old positions
    tbody.querySelectorAll('tr').forEach((row, index) => {
        const name = row.querySelector('[data-label="Name"]').textContent;
        oldPositions.set(name, index);
    });
    
    tbody.innerHTML = '';
    
    const participants = Object.keys(scores);
    const sortedParticipants = participants.sort((a, b) => {
        for (const eventName of eventOrder) {
            const event = eventData.events.find(e => e.name === eventName);
            if (!event.result) continue;

            const aCorrect = event.predictions[event.result].includes(a);
            const bCorrect = event.predictions[event.result].includes(b);
            
            if (aCorrect !== bCorrect) {
                return bCorrect ? 1 : -1;
            }
        }
        return a.localeCompare(b);
    });
    
    sortedParticipants.forEach((name, index) => {
        const row = tbody.insertRow();
        const oldPos = oldPositions.get(name);
        
        if (oldPos !== undefined && oldPos !== index) {
            row.classList.add('position-change');
            row.classList.add(oldPos > index ? 'moved-up' : 'moved-down');
        }
        
        row.innerHTML = `
            <td data-label="Rank">${index + 1}</td>
            <td data-label="Name">${name}</td>
            <td data-label="Predictions">${getParticipantResults(name)}</td>
        `;
    });
}

// Update getParticipantResults to remove tooltip
function getParticipantResults(name) {
    return eventData.events
        .filter(event => event.result)
        .map(event => {
            const correct = event.predictions[event.result].includes(name);
            return `<span class="prediction-icon ${correct ? 'correct' : 'incorrect'}" 
                         onclick="if(this.classList.contains('correct')) createConfetti(event.clientX, event.clientY)">
                ${correct ? '✓' : '✗'}
            </span>`;
        })
        .join('');
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

function createConfetti(x, y) {
    const colors = ['#E31837', '#FFB81C', '#004C54', '#A5ACAF', '#FFFFFF'];
    const shapes = ['circle', 'square', 'triangle'];
    
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = `confetti ${shapes[Math.floor(Math.random() * shapes.length)]}`;
        
        // Random size between 5px and 10px
        const size = Math.random() * 5 + 5;
        confetti.style.width = `${size}px`;
        confetti.style.height = `${size}px`;
        
        // Set initial position to click point
        confetti.style.left = `${x}px`;
        confetti.style.top = `${y}px`;
        
        // Random color
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        
        // Random initial rotation
        const rotation = Math.random() * 360;
        
        // Random angle for explosion direction
        const angle = (Math.random() * 360) * (Math.PI / 180);
        const velocity = 15 + Math.random() * 15; // Random velocity between 15-30
        const velocityX = Math.cos(angle) * velocity;
        const velocityY = Math.sin(angle) * velocity;

        confetti.style.transform = `rotate(${rotation}deg)`;
        
        // Add custom properties for animation
        confetti.style.setProperty('--x-velocity', velocityX);
        confetti.style.setProperty('--y-velocity', velocityY);
        confetti.style.setProperty('--rotation-speed', (Math.random() * 720 - 360) + 'deg');
        
        document.body.appendChild(confetti);
        setTimeout(() => confetti.remove(), 2000);
    }
}

// Add theme toggle functionality
function initializeTheme() {
    const themeToggle = document.querySelector('.theme-toggle');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme');
    
    // Set initial theme
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    } else if (prefersDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });
}

// Add mobile-specific features
function initializeMobileFeatures() {
    if (window.innerWidth <= 768) {
        // Add pull-to-refresh functionality
        let touchStart = 0;
        let pulling = false;

        document.body.insertAdjacentHTML('afterbegin', 
            '<div class="pull-indicator">Pull down to refresh</div>'
        );

        document.addEventListener('touchstart', e => {
            touchStart = e.touches[0].clientY;
        });

        document.addEventListener('touchmove', e => {
            const touchY = e.touches[0].clientY;
            const pull = touchY - touchStart;
            
            if (pull > 50 && !pulling && window.scrollY === 0) {
                pulling = true;
                document.body.classList.add('pulling');
            }
        });

        document.addEventListener('touchend', e => {
            if (pulling) {
                pulling = false;
                document.body.classList.remove('pulling');
                location.reload();
            }
        });

        // Add swipe between sections
        let startX = 0;
        document.addEventListener('touchstart', e => {
            startX = e.touches[0].clientX;
        });

        document.addEventListener('touchend', e => {
            const endX = e.changedTouches[0].clientX;
            const diff = startX - endX;

            if (Math.abs(diff) > 100) { // Minimum swipe distance
                const sections = ['leaderboard', 'event-history'];
                const currentSection = sections.find(s => 
                    isElementInViewport(document.querySelector(`.${s}`))
                );
                const currentIndex = sections.indexOf(currentSection);

                if (diff > 0 && currentIndex < sections.length - 1) {
                    // Swipe left - next section
                    document.querySelector(`.${sections[currentIndex + 1]}`).scrollIntoView({ 
                        behavior: 'smooth' 
                    });
                } else if (diff < 0 && currentIndex > 0) {
                    // Swipe right - previous section
                    document.querySelector(`.${sections[currentIndex - 1]}`).scrollIntoView({ 
                        behavior: 'smooth' 
                    });
                }
            }
        });
    }
}

// Helper function for swipe detection
function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.right <= window.innerWidth
    );
}

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    initializeScores();
    updateLeaderboard();
    updateEventHistory();
    initializeTheme();
    initializeMobileFeatures();
});

// Keep this function for potential future use
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 3000);
} 