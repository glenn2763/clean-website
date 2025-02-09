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
        {
            name: "Score Under 7",
            options: ["yes", "no"],
            predictions: {
                "yes": ["Jeff", "Jshu", "Ryan", "Nick", "Paavo", "Jake", "Glenn"],
                "no": ["Connor", "Emmett", "Kent", "Isaac", "Cormac"]
            },
            result: null
        },
        {
            name: "First Score",
            options: ["KC", "PHI"],
            predictions: {
                "KC": ["Jeff", "Jshu", "Emmett", "Ryan", "Nick", "Jake", "Glenn"],
                "PHI": ["Connor", "Paavo", "Cormac"]
            },
            result: null
        },
        {
            name: "Saquon TD",
            options: ["Y", "N"],
            predictions: {
                "Y": ["Jshu", "Jeff", "Nick", "Ryan"],
                "N": ["Jake"]
            },
            result: null
        },
        {
            name: "Hurts TD",
            options: ["Y", "N"],
            predictions: {
                "Y": ["Jshu", "Jeff", "Nick", "Ryan"],
                "N": ["Jake"]
            },
            result: null
        },
        {
            name: "Kelce TD",
            options: ["Y", "N"],
            predictions: {
                "Y": ["Jshu", "Nick"],
                "N": ["Jeff", "Ryan"]
            },
            result: null
        }
    ]
};

// Keep track of scores
let scores = {};
let anthemCorrect = new Set();

// Keep track of results for hierarchical sorting
let eventOrder = ["Anthem", "Penalty", "Score Under 7", "First Score", "Saquon TD", "Hurts TD", "Kelce TD"];

// Load saved results from localStorage
function loadSavedResults() {
    const savedResults = localStorage.getItem('eventResults');
    if (savedResults) {
        const results = JSON.parse(savedResults);
        eventData.events.forEach((event, index) => {
            event.result = results[index];
        });
    }
}

// Save results to localStorage
function saveResults() {
    const results = eventData.events.map(event => event.result);
    localStorage.setItem('eventResults', JSON.stringify(results));
}

// Check if we're on the admin page
const isAdminPage = window.location.pathname.includes('admin');

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

// Helper function to show which events a participant got correct
function getParticipantResults(name) {
    return eventData.events
        .filter(event => event.result)
        .map(event => {
            const correct = event.predictions[event.result].includes(name);
            return `<span class="prediction-icon ${correct ? 'correct' : 'incorrect'}" 
                         title="${event.name}: ${event.result}"
                         onclick="toggleTooltip(event)">
                ${correct ? '✓' : '✗'}
            </span>`;
        })
        .join('');
}

// Create event toggle controls
function createEventControls() {
    const container = document.getElementById('events-container');
    if (!container) return; // Exit if not on admin page
    
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
            saveResults(); // Save after each change
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
    loadSavedResults();
    if (isAdminPage) {
        createEventControls();
    }
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

// Add tooltip toggle function
function toggleTooltip(event) {
    // Remove active class from all other tooltips
    document.querySelectorAll('.prediction-icon.tooltip-active').forEach(icon => {
        if (icon !== event.target) {
            icon.classList.remove('tooltip-active');
        }
    });
    
    // Toggle the clicked tooltip
    event.target.classList.toggle('tooltip-active');
    
    // If it's a correct prediction, also show confetti
    if (event.target.classList.contains('correct')) {
        createConfetti(event.clientX, event.clientY);
    }
}

// Close tooltip when clicking outside
document.addEventListener('click', (event) => {
    if (!event.target.classList.contains('prediction-icon')) {
        document.querySelectorAll('.prediction-icon.tooltip-active').forEach(icon => {
            icon.classList.remove('tooltip-active');
        });
    }
}); 