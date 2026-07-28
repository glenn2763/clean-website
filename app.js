// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        let targetId = this.getAttribute('href');
        if (targetId.length > 1 && document.querySelector(targetId)) {
            document.querySelector(targetId).scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});

// Dark Mode Toggle Functionality
const themeToggleFooter = document.getElementById('theme-toggle-footer');
const body = document.body;
const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme(theme) {
    if (theme === 'dark') {
        body.classList.add('dark-mode');
        if (themeToggleFooter) themeToggleFooter.checked = true;
    } else {
        body.classList.remove('dark-mode');
        if (themeToggleFooter) themeToggleFooter.checked = false;
    }
}

let currentTheme = localStorage.getItem('theme');
if (currentTheme) {
    applyTheme(currentTheme);
} else if (prefersDarkScheme.matches) {
    applyTheme('dark');
    localStorage.setItem('theme', 'dark');
}

if (themeToggleFooter) {
    themeToggleFooter.addEventListener('change', function() {
        if (this.checked) {
            body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark');
        } else {
            body.classList.remove('dark-mode');
            localStorage.setItem('theme', 'light');
        }
    });
}

prefersDarkScheme.addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
        if (e.matches) {
            applyTheme('dark');
        } else {
            applyTheme('light');
        }
    }
});
