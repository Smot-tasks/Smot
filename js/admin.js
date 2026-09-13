import { db, auth } from "./firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  getDoc,
  deleteDoc,
  where,
  doc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
  // Shared reference to the flatpickr date picker instance (used by create/edit/reset)
  let eventDatePicker = null;

  // Cache of loaded reports (id -> data) so the Edit/Delete buttons can work
  const reportsData = new Map();

  // Check if user is logged in
  auth.onAuthStateChanged((user) => {
    if (!user) {
      // If no user, redirect to login page.
      window.location.href = "login.html";
    } else {
      // If user is logged in, initialize the admin page.
      const adminGreeting = document.getElementById("adminGreeting");
      if (adminGreeting) {
        const emailToName = {
          "meriettehani2@gmail.com": "meriett",
          "georgeeskander2025eng@gmail.com": "george",
          "mina.sameh1904@gmail.com": "mina",
        };
        const adminName = emailToName[user.email];
        if (adminName) {
          adminGreeting.textContent = `Hi, ${adminName}`;
        } else {
          adminGreeting.textContent = `Hi, Admin`;
        }
      }
      initializeAdminPage();
    }
  });

  function initializeAdminPage() {
    // Initialize event listeners and load data now that we know the user is authenticated.
    setupEventListeners();
    loadEvents();
    loadReports();
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
                    <h3>${event.name} <span class="event-date">(${event.date})</span></h3>
                    <div class="event-items">
                        ${event.items.map((item) => `<span>${item.name}: ${item.expected}</span>`).join("")}
                    </div>
                    <button class="btn btn-secondary edit-event-btn" data-id="${doc.id}">
                        Edit
                    </button>
                    <button class="btn btn-danger delete-event-btn" data-id="${doc.id}">
                        Delete
                    </button>
                `;
        eventsList.appendChild(div);
      });

      // Animate the event cards
      anime({
        targets: ".events-container .event-card",
        translateY: [50, 0],
        opacity: [0, 1],
        delay: anime.stagger(100), // 100ms delay between each card
      });
    });
  }

  // Populate form for editing an event
  async function startEditEvent(eventId) {
    try {
      const eventRef = doc(db, "events", eventId);
      const eventSnap = await getDoc(eventRef);

      if (eventSnap.exists()) {
        const event = eventSnap.data();
        const eventForm = document.getElementById("eventForm");

        document.getElementById("eventName").value = event.name;
        if (eventDatePicker) {
          eventDatePicker.setDate(event.date, false);
        } else {
          document.getElementById("eventDate").value = event.date;
        }

        const itemsList = document.getElementById("itemsList");
        itemsList.innerHTML = event.items
          .map(
            (item) => `
          <div class="item-row">
            <input type="text" class="item-name" placeholder="Item name" required value="${item.name}">
            <input type="number" class="item-qty" placeholder="Quantity" min="0" required value="${item.expected}">
          </div>
        `,
          )
          .join("");

        eventForm.dataset.editingId = eventId;
        eventForm.scrollIntoView({ behavior: "smooth" });
        eventForm.querySelector('button[type="submit"]').textContent =
          "Save Changes";

        // Animate the form to draw attention
        anime({
          targets: "#eventForm",
          scale: [0.98, 1],
          duration: 400,
        });
      }
    } catch (error) {
      console.error("Error preparing event for edit: ", error);
    }
  }

  // Load reports
  function loadReports() {
    const reportEventsList = document.getElementById("reportEventsList");
    if (!reportEventsList) return;

    const q = query(collection(db, "reports"), orderBy("createdAt", "asc"));

    onSnapshot(q, async (snapshot) => {
      // Optimization: Fetch all events once to avoid N+1 queries.
      const eventsSnapshot = await getDocs(collection(db, "events"));
      const eventMap = new Map();
      eventsSnapshot.forEach((doc) => eventMap.set(doc.id, doc.data()));

      // Group reports by eventId
      const reportsByEvent = {};

      for (const doc of snapshot.docs) {
        const report = doc.data();
        report.id = doc.id;
        reportsData.set(doc.id, report);

        const eventName =
          report.eventName ||
          eventMap.get(report.eventId)?.name ||
          "Unknown Event";
        if (eventName === "Unknown Event") continue;

        const div = document.createElement("div");
        div.className = "report-card";
        div.innerHTML = buildReportCardHTML(report);

        if (!reportsByEvent[report.eventId]) {
          reportsByEvent[report.eventId] = {
            name: eventName,
            date: eventMap.get(report.eventId)?.date || "",
            reports: [],
            beforeCount: 0,
            afterCount: 0,
          };
        }
        if (report.reportType === "before") {
          reportsByEvent[report.eventId].beforeCount++;
        } else if (report.reportType === "after") {
          reportsByEvent[report.eventId].afterCount++;
        }
        reportsByEvent[report.eventId].reports.push(div);
      }

      // Render the report event cards
      reportEventsList.innerHTML = "";
      for (const eventId in reportsByEvent) {
        const eventData = reportsByEvent[eventId];
        const typeBadges = [
          eventData.beforeCount > 0
            ? `<span class="report-count-badge before">${eventData.beforeCount} before-event</span>`
            : "",
          eventData.afterCount > 0
            ? `<span class="report-count-badge after">${eventData.afterCount} after-event</span>`
            : "",
        ]
          .filter(Boolean)
          .join("");

        const reportEventCard = document.createElement("div");
        reportEventCard.className = "report-event-card";
        reportEventCard.innerHTML = `
          <div class="report-event-header">
            <h3>${eventData.name} <span class="event-date">(${eventData.date})</span></h3>
            <div class="report-count-badges">
              <span class="report-count-badge">${eventData.reports.length} report(s)</span>
              ${typeBadges}
            </div>
          </div>
          <div class="reports-placeholder hidden"></div>
        `;

        const placeholder = reportEventCard.querySelector(
          ".reports-placeholder",
        );
        eventData.reports.forEach((reportDiv) =>
          placeholder.appendChild(reportDiv),
        );

        reportEventsList.appendChild(reportEventCard);
      }

      // Animate the report event cards
      anime({
        targets: ".report-event-card",
        translateY: [30, 0],
        opacity: [0, 1],
        delay: anime.stagger(100),
        easing: "easeOutExpo",
      });
    });
  }

  // Build the read-only HTML of a report card (also used to restore after Cancel)
  function buildReportCardHTML(report) {
    const reportTypeInfo =
      report.reportType === "before"
        ? { label: "Before Event", cssClass: "before" }
        : report.reportType === "after"
          ? { label: "After Event", cssClass: "after" }
          : { label: "Type Not Specified", cssClass: "unspecified" };

    return `
            <div class="report-card-header">
                <span class="report-type-badge ${reportTypeInfo.cssClass}">${reportTypeInfo.label}</span>
                <span class="report-date"><strong>Submitted:</strong> ${new Date(
                  report.createdAt.toDate(),
                ).toLocaleString()}</span>
            </div>
            <div class="report-managers">
                <span class="manager-badge leader"><span class="manager-role">Leader</span>${report.leaderName || "—"}</span>
                <span class="manager-badge support"><span class="manager-role">Support</span>${report.supportName || "—"}</span>
            </div>
            <div class="report-card-body">
            ${(report.discrepancies || [])
              .map(
                (d) => `
                <div class="discrepancy-item mismatch">
                    <span class="cross-icon">✗</span>
                    <span>${d.name}: Expected ${d.expected}, Got ${d.actual}</span>
                    <p>Reason: ${d.reason}</p>
                </div>
            `,
              )
              .join("")}
            ${(report.matches || [])
              .map(
                (m) => `
                <div class="discrepancy-item match">
                    <span class="check-icon">✓</span>
                    <span>${m.name}: ${m.expected} (matched)</span>
                </div>
            `,
              )
              .join("")}
            </div>
            <div class="report-actions">
                <button class="btn btn-small edit-report-btn" data-id="${report.id}">✏️ Edit</button>
                <button class="btn btn-danger btn-small delete-report-btn" data-id="${report.id}">🗑 Delete</button>
            </div>
        `;
  }

  // Turn a report card into an editable form
  function startEditReport(reportCard, report) {
    if (!report || !reportCard) return;
    const body = reportCard.querySelector(".report-card-body");
    const actions = reportCard.querySelector(".report-actions");

    const items = [
      ...(report.discrepancies || []).map((d) => ({ ...d })),
      ...(report.matches || []).map((m) => ({ ...m })),
    ];

    body.innerHTML = items
      .map(
        (item) => `
            <div class="report-item edit-item" data-name="${item.name}" data-expected="${item.expected}">
                <div class="report-item-input-group">
                    <label>${item.name} <span class="expected-hint">(expected: ${item.expected})</span></label>
                    <div class="input-wrapper">
                        <input type="number" min="0" class="edit-qty" value="${item.actual}">
                    </div>
                </div>
                <div class="reason-container ${item.actual === item.expected ? "hidden" : ""}">
                    <textarea class="reason-input edit-reason" placeholder="Reason for discrepancy (required)...">${item.reason || ""}</textarea>
                </div>
            </div>
        `,
      )
      .join("");

    actions.innerHTML = `
                <button class="btn btn-small save-report-btn" data-id="${report.id}">💾 Save Changes</button>
                <button class="btn btn-secondary btn-small cancel-edit-btn" data-id="${report.id}">Cancel</button>
            `;

    // Show/hide the reason box live while editing quantities
    reportCard.querySelectorAll(".edit-qty").forEach((input) => {
      input.addEventListener("input", () => {
        const row = input.closest(".edit-item");
        const expected = parseInt(row.dataset.expected);
        const actual = parseInt(input.value);
        const reasonContainer = row.querySelector(".reason-container");
        if (!isNaN(actual) && actual !== expected) {
          reasonContainer.classList.remove("hidden");
        } else {
          reasonContainer.classList.add("hidden");
        }
      });
    });
  }

  // Validate and persist the edited quantities/reasons
  async function saveReportEdits(reportCard, reportId) {
    const discrepancies = [];
    const matches = [];
    let missingReasons = false;

    reportCard.querySelectorAll(".edit-item").forEach((row) => {
      const name = row.dataset.name;
      const expected = parseInt(row.dataset.expected);
      const actual = parseInt(row.querySelector(".edit-qty").value) || 0;
      const reasonInput = row.querySelector(".edit-reason");
      const reason = reasonInput ? reasonInput.value.trim() : "";

      if (actual !== expected) {
        if (!reason) {
          missingReasons = true;
          row.classList.add("reason-error");
        }
        discrepancies.push({ name, expected, actual, reason });
      } else {
        row.classList.remove("reason-error");
        matches.push({ name, expected, actual });
      }
    });

    if (missingReasons) {
      alert(
        "Please add a reason for every item whose quantity does not match.",
      );
      return;
    }

    try {
      await updateDoc(doc(db, "reports", reportId), { discrepancies, matches });
    } catch (error) {
      console.error("Error updating report:", error);
      alert(
        `Could not update the report${error && error.code ? ` (${error.code})` : ""}.`,
      );
    }
  }

  // Delete event and associated reports
  async function deleteEvent(eventId) {
    try {
      // Delete the event document
      await deleteDoc(doc(db, "events", eventId));

      // Query and delete associated reports
      const reportsQuery = query(
        collection(db, "reports"),
        where("eventId", "==", eventId),
      );
      const reportSnapshots = await getDocs(reportsQuery);
      // Use Promise.all to delete associated reports in parallel for better performance.
      const deletePromises = reportSnapshots.docs.map((reportDoc) =>
        deleteDoc(reportDoc.ref),
      );
      await Promise.all(deletePromises);
    } catch (error) {
      console.error("Error deleting event and reports:", error);
    }
  }

  function setupEventListeners() {
    // Initialize modern date picker (store instance so we can clear/set it later)
    const eventDateInput = document.getElementById("eventDate");
    if (eventDateInput) {
      eventDatePicker = flatpickr(eventDateInput, {
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "F j, Y",
      });
    }
    // Add item row
    const addItemBtn = document.getElementById("addItemBtn");
    if (addItemBtn) {
      addItemBtn.addEventListener("click", () => {
        const itemsList = document.getElementById("itemsList");
        const div = document.createElement("div");
        div.className = "item-row";
        div.innerHTML = `
                  <input type="text" class="item-name" placeholder="Item name" required>
                  <input type="number" class="item-qty" placeholder="Quantity" min="0" required>
              `;
        itemsList.appendChild(div);
      });
    }

    // Create/Update event
    const eventForm = document.getElementById("eventForm");
    if (eventForm) {
      eventForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = document.getElementById("eventName").value.trim();
        const date = document.getElementById("eventDate").value;

        const itemRows = document.querySelectorAll("#itemsList .item-row");
        const items = [];

        itemRows.forEach((row) => {
          const itemName = row.querySelector(".item-name").value.trim();
          const itemQty = row.querySelector(".item-qty").value;
          if (itemName && itemQty !== "") {
            items.push({ name: itemName, expected: parseInt(itemQty) });
          }
        });

        const formStatus = document.getElementById("formStatus");
        const submitBtn = eventForm.querySelector('button[type="submit"]');

        const showStatus = (message, type) => {
          if (!formStatus) return;
          formStatus.textContent = message;
          formStatus.className = `form-status ${type}`;
        };

        // Validate before touching Firebase so nothing ever fails silently
        if (!name || !date || items.length === 0) {
          showStatus(
            "⚠ Please fill in the event name, pick a date, and add at least one item.",
            "error",
          );
          return;
        }

        try {
          submitBtn.disabled = true;
          submitBtn.textContent = "Saving...";

          const editingId = eventForm.dataset.editingId;
          if (editingId) {
            // Update existing event
            const eventRef = doc(db, "events", editingId);
            await updateDoc(eventRef, { name, date, items });
            delete eventForm.dataset.editingId; // Clear editing state
            document.querySelector("#eventForm h2").textContent =
              "Create New Event";
            submitBtn.textContent = "Create Event";
            showStatus("✓ Event updated successfully!", "success");
          } else {
            // Create new event
            await addDoc(collection(db, "events"), {
              name,
              date,
              items,
              createdAt: new Date(),
            });
            showStatus("✓ Event created successfully!", "success");
          }

          document.getElementById("eventForm").reset();
          if (eventDatePicker) eventDatePicker.clear();
          document.getElementById("itemsList").innerHTML = `
                      <div class="item-row">
                          <input type="text" class="item-name" placeholder="Item name" required>
                          <input type="number" class="item-qty" placeholder="Quantity" min="0" required>
                      </div>
                  `;
        } catch (error) {
          console.error("Error saving event:", error);
          showStatus(
            `✗ Could not save the event${error && error.code ? ` (${error.code})` : ""}. Please check your connection and try again.`,
            "error",
          );
        } finally {
          submitBtn.disabled = false;
          if (submitBtn.textContent === "Saving...") {
            submitBtn.textContent = "Create Event";
          }
        }
      });
    }

    // Logout
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        try {
          await signOut(auth);
          window.location.href = "login.html";
        } catch (error) {
          console.error("Logout Error:", error);
        }
      });
    }

    // Event delegation for delete buttons
    // Event delegation for the events list (Edit and Delete)
    const eventsList = document.getElementById("eventsList");
    if (eventsList) {
      eventsList.addEventListener("click", async (e) => {
        // Handle Delete
        if (e.target.classList.contains("delete-event-btn")) {
          const eventId = e.target.dataset.id;
          if (
            confirm(
              "Are you sure you want to delete this event? This will also delete all associated reports.",
            )
          ) {
            await deleteEvent(eventId);
          }
        }
      });

      // Event delegation for edit buttons
      eventsList.addEventListener("click", (e) => {
        if (e.target.classList.contains("edit-event-btn")) {
        } else if (e.target.classList.contains("edit-event-btn")) {
          // Handle Edit
          const eventId = e.target.dataset.id;
          startEditEvent(eventId);
        }
      });
    }

    // Event delegation for the reports section (expand/collapse, edit, delete)
    const reportEventsList = document.getElementById("reportEventsList");
    if (reportEventsList) {
      reportEventsList.addEventListener("click", async (e) => {
        const editBtn = e.target.closest(".edit-report-btn");
        const deleteBtn = e.target.closest(".delete-report-btn");
        const saveBtn = e.target.closest(".save-report-btn");
        const cancelBtn = e.target.closest(".cancel-edit-btn");

        if (deleteBtn) {
          const reportId = deleteBtn.dataset.id;
          if (confirm("Are you sure you want to delete this report?")) {
            try {
              await deleteDoc(doc(db, "reports", reportId));
            } catch (error) {
              console.error("Error deleting report:", error);
              alert(
                `Could not delete the report${error && error.code ? ` (${error.code})` : ""}.`,
              );
            }
          }
          return;
        }

        if (editBtn) {
          startEditReport(
            editBtn.closest(".report-card"),
            reportsData.get(editBtn.dataset.id),
          );
          return;
        }

        if (saveBtn) {
          saveBtn.disabled = true;
          try {
            await saveReportEdits(
              saveBtn.closest(".report-card"),
              saveBtn.dataset.id,
            );
          } finally {
            saveBtn.disabled = false;
          }
          return;
        }

        if (cancelBtn) {
          const reportCard = cancelBtn.closest(".report-card");
          const report = reportsData.get(cancelBtn.dataset.id);
          if (report) reportCard.innerHTML = buildReportCardHTML(report);
          return;
        }

        const header = e.target.closest(".report-event-header");
        if (header) {
          const card = header.closest(".report-event-card");
          const placeholder = card.querySelector(".reports-placeholder");
          const isExpanded = card.classList.toggle("expanded");

          // Stop any ongoing animation on the placeholder children
          anime.remove(placeholder.children);

          if (isExpanded) {
            placeholder.classList.remove("hidden");
            anime({
              targets: placeholder.children,
              translateY: [-20, 0],
              opacity: [0, 1],
              delay: anime.stagger(80),
              easing: "easeOutExpo",
            });
          } else {
            // Instantly hide on collapse
            placeholder.classList.add("hidden");
          }
        }
      });
    }
  }
});
