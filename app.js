/* Toggle between adding and removing the "responsive" class to topnav when the user clicks on the icon */
function topNavResponsive() {
    var topnav = document.getElementById("myTopnav");
    if (topnav.className === "topnav") {
        topnav.classList.add("responsive");
    } else {
        topnav.classList.remove("responsive");
    }
}

var slideIndex = 0;

function carousel() {
  var i;
  var x = document.getElementsByClassName("mySlides");
  for (i = 0; i < x.length; i++) {
    x[i].style.display = "none";
  }
  slideIndex++;
  if (slideIndex > x.length) {slideIndex = 1}
  x[slideIndex-1].style.display = "block";
  setTimeout(carousel, 2000); // Change image every 2 seconds
}


