import { db } from "./firebase-config.js";
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  query,
  orderBy,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentEventId = null;
let currentEvent = null;
let currentReportType = null;

document.addEventListener("DOMContentLoaded", () => {
  // Redirect if leader/support names are not set
  const leaderName = sessionStorage.getItem("smot_leaderName");
  const supportName = sessionStorage.getItem("smot_supportName");
  if (!leaderName || !supportName) {
    window.location.href = "member-login.html";
    return;
  }
  // Load events
  function loadEvents() {
    const eventsList = document.getElementById("eventsList");
    if (!eventsList) return;

    const q = query(collection(db, "events"), orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
      eventsList.innerHTML = "";
      snapshot.forEach((doc) => {
        const event = doc.data();
        const div = document.createElement("div");
        div.className = "event-card";
        div.innerHTML = `
                    <h3>${event.name}</h3>
                    <p>Date: ${event.date}</p>
                    <button class="btn submit-report-btn" data-id="${doc.id}">Submit Report</button>
                `;
        eventsList.appendChild(div);
      });

      // Animate event cards
      anime({
        targets: "#eventsList .event-card",
        translateY: [50, 0],
        opacity: [0, 1],
        delay: anime.stagger(100),
      });
    });
  }

  // Show report type selection (before / after the event) for a selected event
  async function showReportForm(eventId) {
    currentEventId = eventId;

    // Get event details
    const eventRef = doc(db, "events", eventId);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) return;
    currentEvent = eventSnap.data();
    const reportTypeSection = document.getElementById("reportTypeSection");
    const eventsSection = document.getElementById("eventsList").parentElement;

    document.getElementById("typeEventName").textContent = currentEvent.name;
    reportTypeSection.classList.remove("hidden");

    // Animate section transition
    anime({
      targets: eventsSection,
      opacity: 0,
      duration: 400,
      complete: () => eventsSection.classList.add("hidden"),
    });
    anime({
      targets: reportTypeSection,
      translateY: [50, 0],
      opacity: [0, 1],
      duration: 600,
      delay: 200,
    });
  }

  // Build and show the report form once the member picks the report type
  function selectReportType(type) {
    currentReportType = type;

    const reportTypeSection = document.getElementById("reportTypeSection");
    const reportSection = document.getElementById("reportSection");

    document.getElementById("reportTypeLabel").textContent =
      type === "before" ? "Before the Event" : "After the Event";

    reportTypeSection.classList.add("hidden");
    reportSection.classList.remove("hidden");

    anime({
      targets: reportSection,
      translateY: [50, 0],
      opacity: [0, 1],
      duration: 600,
    });

    // Create input fields for each item
    const reportItems = document.getElementById("reportItems");
    reportItems.innerHTML = currentEvent.items
      .map(
        (item) => `
            <div class="report-item">
                <div class="report-item-input-group">
                    <label>${item.name}</label>
                    <div class="input-wrapper">
                        <input type="number" class="actual-qty" data-name="${item.name}" data-expected="${item.expected}" min="0" required>
                        <span class="validation-icon"></span>
                    </div>
                </div>
                <div class="reason-container hidden">
                    <textarea class="reason-input" placeholder="Reason for discrepancy (required)..." data-name="${item.name}"></textarea>
                </div>
            </div>
        `,
      )
      .join("");

    // Add live validation listeners
    document.querySelectorAll(".actual-qty").forEach((input) => {
      input.addEventListener("input", validateItem);
    });

    // Clear the missing-reason error as soon as the member types a reason
    document.querySelectorAll(".reason-input").forEach((textarea) => {
      textarea.addEventListener("input", () => {
        if (textarea.value.trim()) {
          textarea.closest(".report-item").classList.remove("reason-error");
        }
      });
    });
  }

  // Handle final report submission
  const reportForm = document.getElementById("reportForm");
  if (reportForm) {
    reportForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const leaderName = sessionStorage.getItem("smot_leaderName");
      const supportName = sessionStorage.getItem("smot_supportName");

      const discrepancies = [];
      const matches = [];
      let missingReasons = false;

      document.querySelectorAll(".report-item").forEach((itemRow) => {
        const input = itemRow.querySelector(".actual-qty");
        const name = input.dataset.name;
        const expected = parseInt(input.dataset.expected);
        const actual = parseInt(input.value) || 0;

        if (actual !== expected) {
          const reasonInput = itemRow.querySelector(".reason-input");
          const reason = reasonInput.value.trim();

          // A reason is REQUIRED whenever the quantity does not match
          if (!reason) {
            missingReasons = true;
            itemRow.classList.add("reason-error");
          }

          discrepancies.push({
            name,
            expected,
            actual,
            reason,
          });
        } else {
          itemRow.classList.remove("reason-error");
          matches.push({ name, expected, actual });
        }
      });

      // Block submission until every mismatch has a reason
      if (missingReasons) {
        alert(
          "Please add a reason for every item whose quantity does not match.",
        );
        const firstMissing = document.querySelector(
          ".report-item.reason-error .reason-input",
        );
        if (firstMissing) firstMissing.focus();
        return;
      }

      // Save to Firebase
      try {
        await addDoc(collection(db, "reports"), {
          eventId: currentEventId,
          eventName: currentEvent.name,
          reportType: currentReportType,
          leaderName,
          supportName,
          discrepancies,
          matches,
          createdAt: new Date(),
        });

        alert("Report submitted successfully!");
        // Reset view
        document.getElementById("reportSection").classList.add("hidden");
        const eventsSection =
          document.getElementById("eventsList").parentElement;
        eventsSection.classList.remove("hidden");
        anime({
          targets: eventsSection,
          opacity: [0, 1],
          duration: 400,
        });
      } catch (error) {
        console.error("Error saving report:", error);
        alert("There was an error submitting your report. Please try again.");
      }
    });
  }

  // Live validation for each item
  function validateItem(e) {
    const input = e.target;
    const expected = parseInt(input.dataset.expected);
    const actual = parseInt(input.value);
    const itemRow = input.closest(".report-item");
    const icon = itemRow.querySelector(".validation-icon");
    const reasonContainer = itemRow.querySelector(".reason-container");

    if (isNaN(actual)) {
      icon.textContent = "";
      reasonContainer.classList.add("hidden");
    } else if (actual === expected) {
      icon.textContent = "✓";
      icon.className = "validation-icon match";
      reasonContainer.classList.add("hidden");
    } else {
      icon.textContent = "✗";
      icon.className = "validation-icon mismatch";
      reasonContainer.classList.remove("hidden");
    }
  }

  // Return to the events list from the report type selection screen
  function backToEvents() {
    const reportTypeSection = document.getElementById("reportTypeSection");
    const eventsSection = document.getElementById("eventsList").parentElement;
    reportTypeSection.classList.add("hidden");
    eventsSection.classList.remove("hidden");
    anime({
      targets: eventsSection,
      opacity: [0, 1],
      duration: 400,
    });
  }

  // Initialize
  function initializeMemberPage() {
    loadEvents();

    // Use event delegation for "Submit Report" buttons
    const eventsList = document.getElementById("eventsList");
    if (eventsList) {
      eventsList.addEventListener("click", (e) => {
        if (e.target.classList.contains("submit-report-btn")) {
          showReportForm(e.target.dataset.id);
        }
      });
    }

    // Report type selection (before / after the event) and back button
    const reportTypeSection = document.getElementById("reportTypeSection");
    if (reportTypeSection) {
      reportTypeSection.addEventListener("click", (e) => {
        const typeBtn = e.target.closest(".report-type-btn");
        if (typeBtn) {
          selectReportType(typeBtn.dataset.type);
        } else if (e.target.id === "backToEventsBtn") {
          backToEvents();
        }
      });
    }
  }

  initializeMemberPage();
});
