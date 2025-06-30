// Marathon Training Plan Data based on Boston Marathon Level Three Training Plan
const trainingPlan = {
    prep: [
        {
            week: 1,
            phase: "3-Week Prep Phase",
            days: [
                { day: "Monday", workout: "4-6 mile Easy Run", type: "easy" },
                { day: "Tuesday", workout: "Off Day or Cross Training or Strength Training", type: "rest" },
                { day: "Wednesday", workout: "7 mile Aerobic Run", type: "aerobic" },
                { day: "Thursday", workout: "Off Day", type: "rest" },
                { day: "Friday", workout: "4-6 mile Easy Run", type: "easy" },
                { day: "Saturday", workout: "5-6 mile Easy Run", type: "easy" },
                { day: "Sunday", workout: "11-13 mile Easy Run", type: "long" }
            ]
        },
        {
            week: 2,
            phase: "3-Week Prep Phase",
            days: [
                { day: "Monday", workout: "Off Day or Cross Training or Strength Training", type: "rest" },
                { day: "Tuesday", workout: "6-7 mile Aerobic Run", type: "aerobic" },
                { day: "Wednesday", workout: "4-6 mile Easy Run", type: "easy" },
                { day: "Thursday", workout: "7 mile Aerobic Run", type: "aerobic" },
                { day: "Friday", workout: "Off Day", type: "rest" },
                { day: "Saturday", workout: "5 mile Aerobic Run", type: "aerobic" },
                { day: "Sunday", workout: "12-13 mile Aerobic Run", type: "long" }
            ]
        },
        {
            week: 3,
            phase: "3-Week Prep Phase",
            days: [
                { day: "Monday", workout: "Off Day or Cross Training or Strength Training", type: "rest" },
                { day: "Tuesday", workout: "7 miles: 2 mile Warm Up, 6 x (300m uphill at 10k Pace, 30 seconds rest, 300m downhill at MP), 90 seconds rest between sets, 2-3 mile Warm Down", type: "interval" },
                { day: "Wednesday", workout: "4-6 mile Easy Run", type: "easy" },
                { day: "Thursday", workout: "Off Day", type: "rest" },
                { day: "Friday", workout: "8 miles: 2 mile Warm Up, 2 x 2 miles at HMP with 3 minutes easy jog in between, 2 mile Warm Down", type: "tempo" },
                { day: "Saturday", workout: "4-6 mile Easy Run", type: "easy" },
                { day: "Sunday", workout: "12-14 miles: 7-8 miles easy, 10 x (1 minute at 5k-10k Pace, then 1 minute at MP), 1-2 miles easy", type: "long" }
            ]
        }
    ],
    building: [
        {
            week: 4,
            phase: "6-Week Building Phase",
            days: [
                { day: "Monday", workout: "Off Day or Cross Training or Strength Training", type: "rest" },
                { day: "Tuesday", workout: "8-9 miles: 2 mile Warm Up, 5 x 1k at 10k pace with 2 minutes rest, 5 x 200 at 5k Pace with 30 seconds rest, 2 mile Warm Down", type: "interval" },
                { day: "Wednesday", workout: "4-6 mile Easy Run", type: "easy" },
                { day: "Thursday", workout: "6-7 mile Aerobic Run", type: "aerobic" },
                { day: "Friday", workout: "Off Day", type: "rest" },
                { day: "Saturday", workout: "13-15 miles: 4 mile Warm Up, 4 x 2 miles at MP with 2-3 minutes rest, 1-2 mile Warm Down", type: "long" },
                { day: "Sunday", workout: "7-10 mile Easy Run", type: "easy" }
            ]
        },
        {
            week: 5,
            phase: "6-Week Building Phase",
            days: [
                { day: "Monday", workout: "Off Day or Cross Training or Strength Training", type: "rest" },
                { day: "Tuesday", workout: "6-7 miles: 2 mile Warm Up, 8 x (300m uphill at 10k Pace, 30 seconds rest, 300m downhill at MP), 90 seconds rest between sets, 2 mile Warm Down", type: "interval" },
                { day: "Wednesday", workout: "4-6 mile Easy Run", type: "easy" },
                { day: "Thursday", workout: "Off Day", type: "rest" },
                { day: "Friday", workout: "9 miles: 2 mile Warm Up, 4-5 x 1 mile at HMP with 2 minutes rest between, 2 mile Warm Down", type: "tempo" },
                { day: "Saturday", workout: "4-6 mile Easy Run", type: "easy" },
                { day: "Sunday", workout: "13-15 mile Aerobic Run", type: "long" }
            ]
        },
        {
            week: 6,
            phase: "6-Week Building Phase",
            days: [
                { day: "Monday", workout: "Off Day or Cross Training or Strength Training", type: "rest" },
                { day: "Tuesday", workout: "8-9 miles: 2 mile Warm Up, 6 x 1k at 10k pace with 2 minutes rest, 2 mile Warm Down", type: "interval" },
                { day: "Wednesday", workout: "4-5 mile Easy Run", type: "easy" },
                { day: "Thursday", workout: "4-5 mile Easy Run", type: "easy" },
                { day: "Friday", workout: "9 miles: 2 mile Warm Up, 2 x 2 miles at HM with 3 minutes jog, 1 x mile at HM-10k Pace, 2 mile Warm Down", type: "tempo" },
                { day: "Saturday", workout: "4-5 mile Easy Run", type: "easy" },
                { day: "Sunday", workout: "13 mile Marathon Simulation (on rolling hill course): 5-6 miles easy, 6-7 miles at MP, 2 miles easy", type: "long" }
            ]
        },
        {
            week: 7,
            phase: "6-Week Building Phase",
            days: [
                { day: "Monday", workout: "Off Day or Cross Training or Strength Training", type: "rest" },
                { day: "Tuesday", workout: "7 miles: 2 mile Warm Up, 6 x (400m uphill at 10k Pace, 45 seconds rest, 400m downhill at MP), 90 seconds rest between sets, 2 mile Warm Down", type: "interval" },
                { day: "Wednesday", workout: "5-7 mile Easy Run", type: "easy" },
                { day: "Thursday", workout: "5-7 mile Aerobic Run", type: "aerobic" },
                { day: "Friday", workout: "Off Day", type: "rest" },
                { day: "Saturday", workout: "14-16 miles: 3-4 mile Warm Up, 3 x 3 miles at MP with 2-3 minutes rest, 2 mile Warm Down", type: "long" },
                { day: "Sunday", workout: "7-9 mile Easy Run", type: "easy" }
            ]
        },
        {
            week: 8,
            phase: "6-Week Building Phase",
            days: [
                { day: "Monday", workout: "Off Day or Cross Training or Strength Training", type: "rest" },
                { day: "Tuesday", workout: "8-9 miles: 2 mile Warm Up, 3 x (800m uphill at HMP, 60 seconds rest, 800m downhill at MP), 2 minutes rest between sets, 4 x (400m uphill at 10k Pace, 45 seconds rest, 400m downhill at MP), 90 seconds rest between sets, 2 mile Warm Down", type: "interval" },
                { day: "Wednesday", workout: "5-7 mile Easy Run", type: "easy" },
                { day: "Thursday", workout: "Off Day", type: "rest" },
                { day: "Friday", workout: "10 miles: 2 mile Warm Up, 5-6 mile tempo at HMP, 2 mile Warm Down", type: "tempo" },
                { day: "Saturday", workout: "4-6 mile Easy Run", type: "easy" },
                { day: "Sunday", workout: "15-17 mile Aerobic Run", type: "long" }
            ]
        },
        {
            week: 9,
            phase: "6-Week Building Phase",
            days: [
                { day: "Monday", workout: "Off Day or Cross Training or Strength Training", type: "rest" },
                { day: "Tuesday", workout: "8-9 miles: 2 mile Warm Up, 2 x (2k at HM, 1k at 10k) all with 2 minutes rest, 5 x 400 at 5k Pace with 1 minute rest, 2 mile Warm Down", type: "interval" },
                { day: "Wednesday", workout: "4-5 mile Easy Run", type: "easy" },
                { day: "Thursday", workout: "4-5 mile Easy Run", type: "easy" },
                { day: "Friday", workout: "12 miles: 2 mile Warm Up, 8 mile cutdown at MP (start a little slower & increase the pace every 2 miles), 2 mile Warm Down", type: "tempo" },
                { day: "Saturday", workout: "4-5 mile Easy Run", type: "easy" },
                { day: "Sunday", workout: "16-18 mile Marathon Simulation (on rolling hill course): 7-8 miles easy, 7-8 miles at MP, 2 miles easy", type: "long" }
            ]
        }
    ],
    specific: [
        {
            week: 10,
            phase: "9-Week Marathon Specific Phase",
            days: [
                { day: "Monday", workout: "Off Day or Cross Training or Strength Training", type: "rest" },
                { day: "Tuesday", workout: "9 miles: 2 mile Warm Up, 5 x (800m uphill at HMP, 60 seconds rest, 800m downhill at MP), 2 minutes rest between sets, 2 mile Warm Down", type: "interval" },
                { day: "Wednesday", workout: "5-7 mile Easy Run", type: "easy" },
                { day: "Thursday", workout: "Off Day", type: "rest" },
                { day: "Friday", workout: "10 miles: 2 mile Warm Up, 5-6 mile tempo at HMP, 2 mile Warm Down", type: "tempo" },
                { day: "Saturday", workout: "4-6 mile Easy Run", type: "easy" },
                { day: "Sunday", workout: "17-19 mile Marathon Simulation (on rolling hill course): 8-9 miles easy, 7-8 miles at MP, 2 miles easy", type: "long" }
            ]
        },
        {
            week: 11,
            phase: "9-Week Marathon Specific Phase",
            days: [
                { day: "Monday", workout: "Off Day or Cross Training or Strength Training", type: "rest" },
                { day: "Tuesday", workout: "9-10 miles: 2 mile Warm Up, 3 x (2k at HM, 1k at 10k) all with 2 minutes rest, 2 mile Warm Down", type: "interval" },
                { day: "Wednesday", workout: "4-5 mile Easy Run", type: "easy" },
                { day: "Thursday", workout: "5-6 mile Aerobic Run", type: "aerobic" },
                { day: "Friday", workout: "4-5 mile Easy Run", type: "easy" },
                { day: "Saturday", workout: "12-13 miles: 2 mile Warm Up, 9-10 miles MP Tempo, 1 mile Warm Down", type: "tempo" },
                { day: "Sunday", workout: "8-10 mile Easy Run", type: "easy" }
            ]
        },
        {
            week: 12,
            phase: "9-Week Marathon Specific Phase",
            days: [
                { day: "Monday", workout: "Off Day or Cross Training or Strength Training", type: "rest" },
                { day: "Tuesday", workout: "9 miles: 2 mile Warm Up, 5 x 1 mile at 10k pace with 3 minutes rest, 2 mile Warm Down", type: "interval" },
                { day: "Wednesday", workout: "4-5 mile Easy Run", type: "easy" },
                { day: "Thursday", workout: "4-5 mile Easy Run", type: "easy" },
                { day: "Friday", workout: "8-9 miles: 2 mile Warm Up, 4-5 mile tempo at HM, 2 mile Warm Down", type: "tempo" },
                { day: "Saturday", workout: "4-5 mile Easy Run", type: "easy" },
                { day: "Sunday", workout: "18-20 mile Marathon Simulation (on rolling hill course): 8-9 miles easy, 8-9 miles at MP, 2 miles easy", type: "long" }
            ]
        },
        {
            week: 13,
            phase: "9-Week Marathon Specific Phase",
            days: [
                { day: "Monday", workout: "Off Day or Cross Training or Strength Training", type: "rest" },
                { day: "Tuesday", workout: "9 miles: 2 mile Warm Up, 3 x (800m uphill at HMP, 60 seconds rest, 800m downhill at MP), 2 minutes rest between sets, 4 x (400m uphill at 10k Pace, 45 seconds rest, 400m downhill at MP), 90 seconds rest between sets, 2 mile Warm Down", type: "interval" },
                { day: "Wednesday", workout: "5-7 mile Easy Run", type: "easy" },
                { day: "Thursday", workout: "5-7 mile Aerobic Run", type: "aerobic" },
                { day: "Friday", workout: "Off Day", type: "rest" },
                { day: "Saturday", workout: "14 miles: 2 mile Warm Up, 2 x 5 miles at MP with 5 minutes jog between reps, 2 mile Warm Down", type: "tempo" },
                { day: "Sunday", workout: "8-10 mile Easy Run", type: "easy" }
            ]
        },
        {
            week: 14,
            phase: "9-Week Marathon Specific Phase",
            days: [
                { day: "Monday", workout: "Off Day or Cross Training or Strength Training", type: "rest" },
                { day: "Tuesday", workout: "9 miles: 2 mile Warm Up, 5 x 1 mile at 10k pace with 3 minutes rest, 2 mile Warm Down", type: "interval" },
                { day: "Wednesday", workout: "4-5 mile Easy Run", type: "easy" },
                { day: "Thursday", workout: "4-5 mile Easy Run", type: "easy" },
                { day: "Friday", workout: "8-9 miles: 2 mile Warm Up, 4-5 mile tempo at HM, 2 mile Warm Down", type: "tempo" },
                { day: "Saturday", workout: "4-5 mile Easy Run", type: "easy" },
                { day: "Sunday", workout: "16-19 mile Marathon Simulation (on rolling hill course): 8-9 miles easy, 6-8 miles at MP, 2 miles easy", type: "long" }
            ]
        },
        {
            week: 15,
            phase: "9-Week Marathon Specific Phase",
            days: [
                { day: "Monday", workout: "Off Day or Cross Training or Strength Training", type: "rest" },
                { day: "Tuesday", workout: "9 miles: 2 mile Warm Up, 3 x (800m uphill at HMP, 60 seconds rest, 800m downhill at MP), 2 minutes rest between sets, 4 x (400m uphill at 10k Pace, 45 seconds rest, 400m downhill at MP), 90 seconds rest between sets, 2 mile Warm Down", type: "interval" },
                { day: "Wednesday", workout: "5-7 mile Easy Run", type: "easy" },
                { day: "Thursday", workout: "5-7 mile Aerobic Run", type: "aerobic" },
                { day: "Friday", workout: "Off Day", type: "rest" },
                { day: "Saturday", workout: "14 miles: 2 mile Warm Up, 2 x 5 miles at MP with 5 minutes jog between reps, 2 mile Warm Down", type: "tempo" },
                { day: "Sunday", workout: "8-10 mile Easy Run", type: "easy" }
            ]
        },
        {
            week: 16,
            phase: "9-Week Marathon Specific Phase",
            days: [
                { day: "Monday", workout: "Off Day or Cross Training or Strength Training", type: "rest" },
                { day: "Tuesday", workout: "9 miles: 2 mile Warm Up, 2 x (2k at HM, 1k at 10k) all with 2 minutes rest, 5 x 400 at 5k Pace with 1 minute rest, 2 mile Warm Down", type: "interval" },
                { day: "Wednesday", workout: "4-5 mile Easy Run", type: "easy" },
                { day: "Thursday", workout: "4-5 mile Easy Run", type: "easy" },
                { day: "Friday", workout: "12 miles: 2 mile Warm Up, 8 mile cutdown at MP (start a little slower & increase the pace every 2 miles), 2 mile Warm Down", type: "tempo" },
                { day: "Saturday", workout: "4-5 mile Easy Run", type: "easy" },
                { day: "Sunday", workout: "17-20 mile Aerobic Run", type: "long" }
            ]
        },
        {
            week: 17,
            phase: "9-Week Marathon Specific Phase",
            days: [
                { day: "Monday", workout: "Off Day or Cross Training or Strength Training", type: "rest" },
                { day: "Tuesday", workout: "9 miles: 2 mile Warm Up, 5 x (800m uphill at HMP, 60 seconds rest, 800m downhill at MP), 2 minutes rest between sets, 2 mile Warm Down", type: "interval" },
                { day: "Wednesday", workout: "5-7 mile Easy Run", type: "easy" },
                { day: "Thursday", workout: "Off Day", type: "rest" },
                { day: "Friday", workout: "10 miles: 2 mile Warm Up, 5-6 mile tempo at HMP, 2 mile Warm Down", type: "tempo" },
                { day: "Saturday", workout: "4-6 mile Easy Run", type: "easy" },
                { day: "Sunday", workout: "18-20 Marathon Simulation (on rolling hill course): 8-9 miles easy, 8-9 miles at MP, 2 miles easy", type: "long" }
            ]
        },
        {
            week: 18,
            phase: "9-Week Marathon Specific Phase",
            days: [
                { day: "Monday", workout: "Off Day or Cross Training or Strength Training", type: "rest" },
                { day: "Tuesday", workout: "9-10 miles: 2 mile Warm Up, 3 x (2k at HM, 1k at 10k) all with 2 minutes rest, 2 mile Warm Down", type: "interval" },
                { day: "Wednesday", workout: "4-5 mile Easy Run", type: "easy" },
                { day: "Thursday", workout: "5-6 mile Aerobic Run", type: "aerobic" },
                { day: "Friday", workout: "4-5 mile Easy Run", type: "easy" },
                { day: "Saturday", workout: "13-14 miles: 2 mile Warm Up, 10-11 miles MP Tempo, 1 mile Warm Down", type: "tempo" },
                { day: "Sunday", workout: "Off Day", type: "rest" }
            ]
        }
    ],
    taper: [
        {
            week: 19,
            phase: "2-Week Taper Phase",
            days: [
                { day: "Monday", workout: "Off Day", type: "rest" },
                { day: "Tuesday", workout: "8 miles: 2 mile Warm Up, 5 x 1k at 10k pace with 2 minutes rest, 5 x 200 at 5k Pace with 30 seconds rest, 2 mile Warm Down", type: "interval" },
                { day: "Wednesday", workout: "3-5 mile Easy Run", type: "easy" },
                { day: "Thursday", workout: "Off Day", type: "rest" },
                { day: "Friday", workout: "10 miles: 2 mile Warm Up, 2 x (3 miles at HM on, then 1 mile easy), 2 mile Warm Down", type: "tempo" },
                { day: "Saturday", workout: "3-5 mile Easy Run", type: "easy" },
                { day: "Sunday", workout: "8-10 mile Easy Run", type: "easy" }
            ]
        },
        {
            week: 20,
            phase: "2-Week Taper Phase",
            days: [
                { day: "Monday", workout: "Off Day or Cross Training", type: "rest" },
                { day: "Tuesday", workout: "4 miles with 4-6 x 100m strides", type: "easy" },
                { day: "Wednesday", workout: "2-3 mile Easy Run", type: "easy" },
                { day: "Thursday", workout: "Off Day", type: "rest" },
                { day: "Friday", workout: "2 mile shakeout run with 2-3 strides", type: "easy" },
                { day: "Saturday", workout: "The Niagara Falls Marathon! Good luck!", type: "race" },
                { day: "Sunday", workout: "Rest & Celebrate!", type: "rest" }
            ]
        }
    ]
};

// --- CONFIGURATION ---
// Set your marathon race date here
const RACE_DATE = '2024-10-26'; // YYYY-MM-DD format

// --- Date Calculation ---
const allWeeksInPlan = Object.values(trainingPlan).flat();
const TOTAL_WEEKS_IN_PLAN = allWeeksInPlan.length;

function getPlanStartDate(raceDateStr) {
    const raceDate = new Date(`${raceDateStr}T12:00:00Z`); // Use noon to avoid timezone issues
    const dayOfWeek = raceDate.getUTCDay(); // Sun=0, Mon=1...
    
    // Get to the Monday of the race week
    const daysToSubtractForMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const mondayOfRaceWeek = new Date(raceDate);
    mondayOfRaceWeek.setUTCDate(mondayOfRaceWeek.getUTCDate() - daysToSubtractForMonday);
    
    // The plan starts (TOTAL_WEEKS_IN_PLAN - 1) weeks before the Monday of race week
    // so that Week 20 IS the race week.
    const planStartDate = new Date(mondayOfRaceWeek);
    planStartDate.setUTCDate(planStartDate.getUTCDate() - (TOTAL_WEEKS_IN_PLAN - 1) * 7);
    
    return planStartDate;
}

const planStartDate = getPlanStartDate(RACE_DATE);

function getWeekDates(weekNumber) {
    const weekStartDate = new Date(planStartDate);
    weekStartDate.setUTCDate(planStartDate.getUTCDate() + (weekNumber - 1) * 7);

    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6);

    const options = { month: 'short', day: 'numeric' };
    return `${weekStartDate.toLocaleDateString('en-US', options)} - ${weekEndDate.toLocaleDateString('en-US', options)}`;
}

// --- Firebase and Auth Setup ---
// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
let currentUser = null;

// Application state
let currentPhase = 'prep';
let completedRuns = {};
let runData = {};
let goalTime = '3:30:00'; // Default

// --- PACE CHART DATA ---
const paceChartData = {
    "2:45:00": {
        "5k": "5:20", "10k": "5:45", "Half": "6:00", "Marathon": "6:20", "Easy": "7:15", "Aerobic": "6:50"
    },
    "3:00:00": {
        "5k": "6:00", "10k": "6:18", "Half": "6:38", "Marathon": "6:55", "Easy": "7:53", "Aerobic": "7:25"
    },
    "3:15:00": {
        "5k": "6:25", "10k": "6:48", "Half": "7:08", "Marathon": "7:30", "Easy": "8:33", "Aerobic": "8:00"
    },
    "3:30:00": {
        "5k": "6:55", "10k": "7:20", "Half": "7:40", "Marathon": "8:03", "Easy": "9:10", "Aerobic": "8:40"
    },
    "3:45:00": {
        "5k": "7:25", "10k": "7:50", "Half": "8:15", "Marathon": "8:38", "Easy": "9:50", "Aerobic": "9:18"
    },
    "4:00:00": {
        "5k": "7:55", "10k": "8:20", "Half": "8:48", "Marathon": "9:13", "Easy": "10:30", "Aerobic": "9:55"
    },
    "4:15:00": {
        "5k": "8:25", "10k": "8:50", "Half": "9:18", "Marathon": "9:45", "Easy": "11:13", "Aerobic": "10:33"
    },
    "4:30:00": {
        "5k": "8:55", "10k": "9:25", "Half": "9:50", "Marathon": "10:20", "Easy": "11:40", "Aerobic": "11:08"
    },
    "4:45:00": {
        "5k": "9:25", "10k": "10:25", "Half": "10:25", "Marathon": "10:55", "Easy": "12:25", "Aerobic": "11:45"
    },
    "5:00:00": {
        "5k": "9:55", "10k": "10:25", "Half": "10:55", "Marathon": "11:30", "Easy": "13:10", "Aerobic": "12:25"
    }
};

function renderPaceChart(goalTime) {
    const paces = paceChartData[goalTime] || paceChartData['3:30:00'];
    const tbody = document.querySelector('#pace-chart tbody');
    tbody.innerHTML = '';
    Object.entries(paces).forEach(([type, pace]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${type}</td><td>${pace}</td>`;
        tbody.appendChild(tr);
    });
}

function setupPaceChartUI() {
    const select = document.getElementById('goal-time-select');
    const btn = document.getElementById('toggle-pace-chart');
    const modal = document.getElementById('pace-modal');
    const closeBtn = document.getElementById('close-pace-modal');
    // Set initial value
    if (currentUser && goalTime) {
        select.value = goalTime;
    } else {
        const stored = localStorage.getItem('goalTime');
        if (stored && select) select.value = stored;
        goalTime = select.value;
    }
    function updateChart(save = true) {
        let val = select.value;
        if (!paceChartData[val]) val = '3:30:00';
        renderPaceChart(val);
        goalTime = val;
        if (currentUser) {
            if (save) saveUserData();
        } else {
            if (save) localStorage.setItem('goalTime', val);
        }
    }
    btn.addEventListener('click', function() {
        modal.classList.add('active');
        renderPaceChart(select.value);
    });
    closeBtn.addEventListener('click', function() {
        modal.classList.remove('active');
    });
    select.addEventListener('change', updateChart);
    // Initialize
    updateChart(false);
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    auth.onAuthStateChanged(user => {
        if (user) {
            // User is signed in.
            currentUser = user;
            showUserInfo(user);
            loadUserData();
        } else {
            // User is signed out.
            currentUser = null;
            showLogin();
            resetAppData();
            initializeApp(); // Render the empty state
        }
    });
    setupPaceChartUI();
});

function showUserInfo(user) {
    document.getElementById('login-btn').classList.add('hidden');
    const userInfo = document.getElementById('user-info');
    userInfo.classList.remove('hidden');
    document.getElementById('user-email').textContent = user.email;
}

function showLogin() {
    document.getElementById('login-btn').classList.remove('hidden');
    document.getElementById('user-info').classList.add('hidden');
}

function resetAppData() {
    completedRuns = {};
    runData = {};
}

async function loadUserData() {
    if (!currentUser) return;
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    if (userDoc.exists) {
        const data = userDoc.data();
        completedRuns = data.completedRuns || {};
        runData = data.runData || {};
        goalTime = data.goalTime || '3:30:00';
    } else {
        goalTime = '3:30:00';
    }
    initializeApp();
    // Update pace chart UI to reflect loaded goalTime
    const select = document.getElementById('goal-time-select');
    if (select) select.value = goalTime;
    renderPaceChart(goalTime);
}

function initializeApp() {
    renderTrainingCalendar();
    updateStats();
    updateProgress();
}

function setupEventListeners() {
    // Auth buttons
    document.getElementById('login-btn').addEventListener('click', () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider);
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
        auth.signOut();
    });

    // Phase selector buttons
    document.querySelectorAll('.phase-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.phase-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentPhase = this.dataset.phase;
            renderTrainingCalendar();
        });
    });

    // Modal close button
    document.getElementById('close-modal').addEventListener('click', closeModal);

    // Modal background click
    document.getElementById('run-modal').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });

    // Run form submission
    document.getElementById('run-form').addEventListener('submit', handleRunSubmission);

    // Delete run button
    document.getElementById('delete-run-btn').addEventListener('click', handleRunDeletion);
}

function renderTrainingCalendar() {
    const calendar = document.getElementById('training-calendar');
    const phaseData = trainingPlan[currentPhase];
    
    calendar.innerHTML = '';
    
    phaseData.forEach(week => {
        const weekCard = createWeekCard(week);
        calendar.appendChild(weekCard);
    });
}

function createWeekCard(week) {
    const weekCard = document.createElement('div');
    weekCard.className = 'week-card';
    
    const completedDays = week.days.filter(day => 
        isRunCompleted(week.week, day.day)
    ).length;
    
    const dateRange = getWeekDates(week.week);

    weekCard.innerHTML = `
        <div class="week-header">
            <div class="week-title-container">
                <div class="week-title">Week ${week.week} - ${week.phase}</div>
                <div class="week-dates">${dateRange}</div>
            </div>
            <div class="week-progress">${completedDays}/${week.days.length} completed</div>
        </div>
        <div class="days-grid">
            ${week.days.map(day => createDayCard(week.week, day)).join('')}
        </div>
    `;
    
    return weekCard;
}

function createDayCard(weekNumber, day) {
    const runKey = `${weekNumber}-${day.day}`;
    const isCompleted = isRunCompleted(weekNumber, day.day);
    const isRest = day.type === 'rest';
    const isRace = day.type === 'race';
    
    return `
        <div class="day-card ${isCompleted ? 'completed' : ''} ${isRest ? 'rest' : ''} ${isRace ? 'race' : ''}" 
             onclick="openRunModal('${runKey}', '${day.day}', '${day.workout}')">
            <div class="day-header">
                <div class="day-name">${day.day}</div>
                <div class="completion-status ${isCompleted ? 'completed' : ''}">
                    ${isCompleted ? '✓' : ''}
                </div>
            </div>
            <div class="workout-description">${day.workout}</div>
        </div>
    `;
}

function isRunCompleted(week, day) {
    return completedRuns[`${week}-${day}`] === true;
}

function openRunModal(runKey, dayName, workout) {
    const modal = document.getElementById('run-modal');
    const title = document.getElementById('modal-title');
    const form = document.getElementById('run-form');
    // Find the day object to check its type
    const [weekNum, dayStr] = runKey.split('-');
    const weekData = Object.values(trainingPlan).flat().find(w => w.week == weekNum);
    const day = weekData.days.find(d => d.day === dayStr);
    const isRest = day.type === 'rest';
    title.textContent = isRest ? `Log Activity - ${dayName}` : `Log Run - ${dayName}`;
    form.dataset.runKey = runKey;
    form.dataset.isRest = isRest;
    // Toggle form fields for rest/cross/strength days
    document.getElementById('distance').parentElement.style.display = isRest ? 'none' : '';
    document.getElementById('pace').parentElement.style.display = isRest ? 'none' : '';
    document.getElementById('activity-type-group').style.display = isRest ? '' : 'none';
    // Pre-fill form if run data exists
    const existingData = runData[runKey];
    const deleteBtn = document.getElementById('delete-run-btn');
    if (existingData) {
        if (isRest) {
            document.getElementById('activity-type').value = existingData.activityType || 'off';
            document.getElementById('notes').value = existingData.notes || '';
        } else {
            document.getElementById('distance').value = existingData.distance || '';
            document.getElementById('pace').value = existingData.pace || '';
            document.getElementById('notes').value = existingData.notes || '';
        }
        deleteBtn.classList.remove('hidden');
    } else {
        form.reset();
        deleteBtn.classList.add('hidden');
        if (isRest) {
            document.getElementById('activity-type').value = 'off';
        }
    }
    modal.classList.add('active');
}

function closeModal() {
    const modal = document.getElementById('run-modal');
    modal.classList.remove('active');
}

function handleRunSubmission(e) {
    e.preventDefault();
    if (!currentUser) {
        alert("Please log in to save your run.");
        return;
    }
    const form = e.target;
    const runKey = form.dataset.runKey;
    const isRest = form.dataset.isRest === 'true' || form.dataset.isRest === true;
    let runInfo;
    if (isRest) {
        runInfo = {
            activityType: document.getElementById('activity-type').value,
            notes: document.getElementById('notes').value,
            date: new Date().toISOString()
        };
    } else {
        runInfo = {
            distance: parseFloat(document.getElementById('distance').value),
            pace: document.getElementById('pace').value,
            notes: document.getElementById('notes').value,
            date: new Date().toISOString()
        };
    }
    runData[runKey] = runInfo;
    completedRuns[runKey] = true;
    // Save to Firestore
    saveUserData();
    // Update UI
    renderTrainingCalendar();
    updateStats();
    updateProgress();
    closeModal();
}

function handleRunDeletion() {
    if (!currentUser) {
        alert("Please log in to delete your run.");
        return;
    }

    const form = document.getElementById('run-form');
    const runKey = form.dataset.runKey;

    if (confirm('Are you sure you want to delete this run? This action cannot be undone.')) {
        // Remove from local state
        delete completedRuns[runKey];
        delete runData[runKey];

        // Save updated data to Firestore
        saveUserData();

        // Update UI
        renderTrainingCalendar();
        updateStats();
        updateProgress();
        closeModal();
    }
}

async function saveUserData() {
    if (!currentUser) return;
    await db.collection('users').doc(currentUser.uid).set({
        completedRuns,
        runData,
        goalTime
    }, { merge: true });
}

function updateStats() {
    const totalRuns = Object.keys(completedRuns).length;
    const totalMiles = Object.values(runData).reduce((sum, run) => sum + (run.distance || 0), 0);
    const currentWeek = getCurrentWeek();
    
    document.getElementById('completed-runs').textContent = totalRuns;
    document.getElementById('total-miles').textContent = totalMiles.toFixed(1);
    document.getElementById('current-week').textContent = currentWeek;
}

function updateProgress() {
    const totalWorkouts = getTotalWorkouts();
    const completedWorkouts = Object.keys(completedRuns).length;
    const percentage = totalWorkouts > 0 ? (completedWorkouts / totalWorkouts) * 100 : 0;
    
    document.getElementById('overall-progress').style.width = `${percentage}%`;
    document.getElementById('progress-percentage').textContent = `${Math.round(percentage)}%`;
}

function getTotalWorkouts() {
    let total = 0;
    Object.values(trainingPlan).forEach(phase => {
        phase.forEach(week => {
            total += week.days.filter(day => day.type !== 'rest').length;
        });
    });
    return total;
}

function getCurrentWeek() {
    // Find the current week based on completed runs
    const allWeeks = [];
    Object.values(trainingPlan).forEach(phase => {
        phase.forEach(week => allWeeks.push(week.week));
    });
    
    // Find the first week with incomplete runs
    for (const week of allWeeks) {
        const weekRuns = Object.keys(completedRuns).filter(key => key.startsWith(`${week}-`));
        if (weekRuns.length < 7) { // Assuming 7 days per week
            return week;
        }
    }
    
    return allWeeks[allWeeks.length - 1]; // Return last week if all complete
} 