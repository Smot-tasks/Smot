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
  arrayUnion,
  arrayRemove,
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
    loadTeams();
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

  // Load teams (real-time)
  function loadTeams() {
    const teamsList = document.getElementById("teamsList");
    if (!teamsList) return;

    const q = query(collection(db, "teams"), orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
      teamsList.innerHTML = "";
      if (snapshot.empty) {
        teamsList.innerHTML =
          '<p style="opacity:0.7;font-size:0.9rem;">No teams created yet.</p>';
        return;
      }
      snapshot.forEach((doc) => {
        const team = doc.data();
        const div = document.createElement("div");
        div.className = "team-card";
        div.innerHTML = buildTeamCardHTML(doc.id, team);
        teamsList.appendChild(div);
      });

      // Animate the team cards
      anime({
        targets: ".teams-container .team-card",
        translateY: [50, 0],
        opacity: [0, 1],
        delay: anime.stagger(100), // 100ms delay between each card
      });
    });
  }

  // Build the HTML for a team card (also used to restore after Cancel)
  function buildTeamCardHTML(teamId, team) {
    const members = team.members || [];
    const memberCount = members.length;

    let membersHTML = "";
    if (memberCount === 0) {
      membersHTML =
        '<p style="opacity:0.5;font-size:0.85rem;">No members in this team yet.</p>';
    } else {
      membersHTML = members
        .map(
          (member) => `
            <div class="team-member-badge">
              ${member}
              <button class="remove-member-btn" data-team="${teamId}" data-member="${member}">×</button>
            </div>
          `,
        )
        .join("");

    // Build printable HTML for a single report
    function buildReportPrintHTML(event, report) {
      const typeLabel =
        report.reportType === "before"
          ? "Before the Event"
          : report.reportType === "after"
          ? "After the Event"
          : "Report";
      const submittedAt = report.createdAt?.toDate
        ? new Date(report.createdAt.toDate()).toLocaleString()
        : report.createdAt || "N/A";

      const lines = [];
      lines.push(
        `<div style="font-family:'Segoe UI',Tahoma,sans-serif;color:#222;max-width:800px;margin:0 auto;padding:24px;">`
      );
      lines.push(`  <h1 style="margin:0 0 4px;font-size:22px;">Smot Event Report</h1>`);
      lines.push(`  <div style="color:#666;font-size:13px;margin-bottom:18px;">`);
      lines.push(`    <strong>Event:</strong> ${event?.name || report.eventName || "—"} &nbsp;|&nbsp; `);
      lines.push(`    <strong>Date:</strong> ${event?.date || "—"}`);
      lines.push(`  </div>`);
      lines.push(`  <hr style="border:none;border-top:2px solid #667eea;margin:18px 0;" />`);
      lines.push(`  <div style="margin-bottom:14px;">`);
      lines.push(`    <strong>Report Type:</strong> ${typeLabel}`);
      lines.push(`    &nbsp;&nbsp; <strong>Submitted:</strong> ${submittedAt}`);
      lines.push(`  </div>`);
      lines.push(`  <div style="margin-bottom:14px;">`);
      lines.push(`    <strong>Leader:</strong> ${report.leaderName || "—"}`);
      lines.push(`    &nbsp;&nbsp; <strong>Support:</strong> ${report.supportName || "—"}`);
      lines.push(`  </div>`);
      lines.push(`  <table style="width:100%;border-collapse:collapse;margin-top:10px;">`);
      lines.push(`    <thead><tr style="background:#f3f4f6;">`);
      lines.push(`      <th style="border:1px solid #ddd;padding:8px 10px;text-align:left;">Item</th>`);
      lines.push(`      <th style="border:1px solid #ddd;padding:8px 10px;text-align:center;">Expected</th>`);
      lines.push(`      <th style="border:1px solid #ddd;padding:8px 10px;text-align:center;">Actual</th>`);
      lines.push(`      <th style="border:1px solid #ddd;padding:8px 10px;text-align:center;">Status</th>`);
      lines.push(`      <th style="border:1px solid #ddd;padding:8px 10px;">Reason (if any)</th>`);
      lines.push(`    </tr></thead><tbody>`);

      const items = [
        ...(report.matches || []).map((m) => ({ ...m, match: true })),
        ...(report.discrepancies || []).map((d) => ({ ...d, match: false })),
      ];
      if (items.length === 0) {
        lines.push(
          `      <tr><td colspan="5" style="padding:12px;border:1px solid #ddd;">No items reported yet.</td></tr>`
        );
      } else {
        items.forEach((it) => {
          const status = it.match ? "✓ Matched" : "✗ Discrepancy";
          lines.push(`    <tr style="background:${it.match ? "#f9fbee" : "#fdf2f2"};">`);
          lines.push(
            `      <td style="border:1px solid #ddd;padding:8px 10px;">${it.name}</td>`
          );
          lines.push(
            `      <td style="border:1px solid #ddd;padding:8px 10px;text-align:center;">${it.expected}</td>`
          );
          lines.push(
            `      <td style="border:1px solid #ddd;padding:8px 10px;text-align:center;">${it.actual}</td>`
          );
          lines.push(
            `      <td style="border:1px solid #ddd;padding:8px 10px;text-align:center;color:${
              it.match ? "#16a34a" : "#dc2626"
            };font-weight:600;">${status}</td>`
          );
          lines.push(
            `      <td style="border:1px solid #ddd;padding:8px 10px;">${it.reason ? it.reason : "—"}</td>`
          );
          lines.push(`    </tr>`);
        });
      }

      lines.push(`    </tbody></table>`);
      lines.push(`  <div style="height:24px;"></div>`);
      lines.push(
        `  <div style="text-align:center;color:#888;font-size:11px;">Generated by Smot • ${new Date().toLocaleString()}</div>`
      );
      lines.push(`</div>`);
      return lines.join("\n");
    }

    // Open a printable PDF preview in a new tab and trigger browser print
    function openReportPDF(eventId, reportId) {
      const report = reportsData.get(reportId);
      if (!report) return;

      let event = null;
      try {
        const evSnap = await getDoc(doc(db, "events", eventId));
        if (evSnap.exists()) event = evSnap.data();
      } catch (e) {
        console.warn("Could not load event for PDF:", e);
      }

      const html = buildReportPrintHTML(event, report);
      const win = window.open("", "_blank");
      if (!win) {
        alert("Please allow popups for this site to export the report PDF.");
        return;
      }
      win.document.write(`<!doctype html><html><head><title>Smot Report - PDF</title>`);
      win.document.write(
        `<style>@media print { body { margin:0; } .no-print { display:none; } }</style>`
      );
      win.document.write(`</head><body>`);
      win.document.write(html);
      // Print button + close button (no-print)
      win.document.write(
        `<div class="no-print" style="text-align:center;margin-top:16px;">`
      );
      win.document.write(
        `  <button onclick="window.print()" class="btn">🖨 Print / Save as PDF</button>`
      );
      win.document.write(
        `  <button onclick="window.close()" class="btn btn-secondary">Close</button>`
      );
      win.document.write(`</div>`);
      win.document.write(`</body></html>`);
      win.document.close();

      // Auto-open print dialog after the page renders
      setTimeout(() => {
        try { win.print(); } catch (e) { /* ignore */ }
      }, 350);
    }

    return `

    return `
      <div class="team-card-header">
        <h3>${team.name}</h3>
        <span class="team-member-count">${memberCount} member(s)</span>
      </div>
      <div class="team-members-list">
        ${membersHTML}
      </div>
      <div class="team-add-member">
        <input type="text" class="team-member-input" placeholder="Add member name" />
        <button class="btn btn-small add-member-btn" data-id="${teamId}">Add</button>
      </div>
      <button class="btn btn-danger btn-small delete-team-btn" data-id="${teamId}">Delete Team</button>
    `;
  }

  // Create a new team
  async function createTeam(name) {
    try {
      await addDoc(collection(db, "teams"), {
        name: name.trim(),
        members: [],
        createdAt: new Date(),
      });
      return true;
    } catch (error) {
      console.error("Error creating team:", error);
      return false;
    }
  }

  // Add a member to a team
  async function addMemberToTeam(teamId, memberName) {
    try {
      const teamRef = doc(db, "teams", teamId);
      await updateDoc(teamRef, {
        members: arrayUnion(memberName),
      });
      return true;
    } catch (error) {
      console.error("Error adding member to team:", error);
      return false;
    }
  }

  // Remove a member from a team
  async function removeMemberFromTeam(teamId, memberName) {
    try {
      const teamRef = doc(db, "teams", teamId);
      await updateDoc(teamRef, {
        members: arrayRemove(memberName),
      });
    } catch (error) {
      console.error("Error removing member from team:", error);
    }
  }

  // Delete a team
  async function deleteTeam(teamId) {
    try {
      await deleteDoc(doc(db, "teams", teamId));
    } catch (error) {
      console.error("Error deleting team:", error);
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

    // --- Teams section event listeners ---

    // Create team form
    const teamForm = document.getElementById("teamForm");
    if (teamForm) {
      teamForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const teamName = document.getElementById("teamName");
        const teamFormStatus = document.getElementById("teamFormStatus");
        const name = teamName ? teamName.value.trim() : "";

        if (!name) {
          if (teamFormStatus) {
            teamFormStatus.textContent = "⚠ Please enter a team name.";
            teamFormStatus.className = "form-status error";
          }
          return;
        }

        const submitBtn = teamForm.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Creating...";
        }

        try {
          if (await createTeam(name)) {
            if (teamFormStatus) {
              teamFormStatus.textContent = "✓ Team created successfully!";
              teamFormStatus.className = "form-status success";
            }
            if (teamName) teamName.value = "";
          } else {
            if (teamFormStatus) {
              teamFormStatus.textContent =
                "✗ Could not create team. Please try again.";
              teamFormStatus.className = "form-status error";
            }
          }
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Create Team";
          }
        }
      });
    }

    // Event delegation for teams list (add member, remove member, delete team)
    const teamsList = document.getElementById("teamsList");
    if (teamsList) {
      teamsList.addEventListener("click", async (e) => {
        // Handle Add Member
        const addBtn = e.target.closest(".add-member-btn");
        if (addBtn) {
          const teamId = addBtn.dataset.id;
          const input = addBtn
            .closest(".team-add-member")
            .querySelector(".team-member-input");
          const memberName = input ? input.value.trim() : "";

          if (!memberName) {
            return;
          }

          addBtn.disabled = true;
          addBtn.textContent = "Adding...";

          try {
            const success = await addMemberToTeam(teamId, memberName);
            if (success) {
              if (input) input.value = "";
            } else {
              alert("Could not add member. Please try again.");
            }
          } catch (error) {
            console.error("Error adding member:", error);
            alert(
              `Could not add member${error && error.code ? ` (${error.code})` : ""}.`,
            );
          } finally {
            addBtn.disabled = false;
            addBtn.textContent = "Add";
          }
          return;
        }

        // Handle Remove Member
        const removeBtn = e.target.closest(".remove-member-btn");
        if (removeBtn) {
          const teamId = removeBtn.dataset.team;
          const memberName = removeBtn.dataset.member;
          if (confirm(`Remove "${memberName}" from this team?`)) {
            await removeMemberFromTeam(teamId, memberName);
          }
          return;
        }

        // Handle Delete Team
        if (e.target.classList.contains("delete-team-btn")) {
          const teamId = e.target.dataset.id;
          if (confirm("Are you sure you want to delete this team?")) {
            await deleteTeam(teamId);
          }
          return;
        }
      });
    }
  }
});


