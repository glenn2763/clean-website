/* Toggle between adding and removing the "responsive" class to topnav when the user clicks on the icon */
function topNavResponsive() {
    var topnav = document.getElementById("myTopnav");
    if (topnav.className === "topnav") {
        topnav.classList.add("responsive");
    } else {
        topnav.classList.remove("responsive");
    }
}

// Smooth scrolling for anchor links
document.querySelectorAll('header nav a[href^="#"]').forEach(anchor => {
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

// Function to apply the theme based on stored preference or system setting
function applyTheme(theme) {
    if (theme === 'dark') {
        body.classList.add('dark-mode');
        if(themeToggleFooter) themeToggleFooter.checked = true;
    } else {
        body.classList.remove('dark-mode');
        if(themeToggleFooter) themeToggleFooter.checked = false;
    }
}

// Load saved theme from localStorage or use system preference
let currentTheme = localStorage.getItem('theme');
if (currentTheme) {
    applyTheme(currentTheme);
} else if (prefersDarkScheme.matches) {
    applyTheme('dark');
    localStorage.setItem('theme', 'dark'); // Save system preference if no user preference yet
}

// Listener for the toggle switch
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

// Listener for changes in system color scheme preference (optional but good UX)
prefersDarkScheme.addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) { // Only if user hasn't set a preference
        if (e.matches) {
            applyTheme('dark');
        } else {
            applyTheme('light');
        }
    }
});

// var slideIndex = 0; // Keep for potential future use if carousel is desired
// function carousel() { // Keep for potential future use
//   var i;
//   var x = document.getElementsByClassName("mySlides");
//   for (i = 0; i < x.length; i++) {
//     x[i].style.display = "none";
//   }
//   slideIndex++;
//   if (slideIndex > x.length) {slideIndex = 1}
//   x[slideIndex-1].style.display = "block";
//   setTimeout(carousel, 2000); // Change image every 2 seconds
// }

