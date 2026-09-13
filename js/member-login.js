document.addEventListener("DOMContentLoaded", () => {
  const memberLoginForm = document.getElementById("memberLoginForm");

  // Animate the login box on page load
  const loginBox = document.querySelector(".login-box");
  if (loginBox) {
    anime({
      targets: loginBox,
      translateY: [-50, 0],
      opacity: [0, 1],
      duration: 800,
      easing: "easeOutExpo",
    });
  }

  if (memberLoginForm) {
    memberLoginForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const leaderName = document.getElementById("leaderName").value;
      const supportName = document.getElementById("supportName").value;

      sessionStorage.setItem("smot_leaderName", leaderName);
      sessionStorage.setItem("smot_supportName", supportName);

      window.location.href = "member.html";
    });
  }
});
