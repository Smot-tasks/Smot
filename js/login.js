import { auth } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const errorElement = document.getElementById("error");

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

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;

      try {
        await signInWithEmailAndPassword(auth, email, password);
        window.location.href = "admin.html";
      } catch (error) {
        console.error("Login error:", error);
        errorElement.textContent =
          "Invalid email or password: " + error.message;
      }
    });
  }
});
