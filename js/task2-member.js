import { db } from "./firebase-config.js";
import {
  collection, addDoc, getDocs, onSnapshot, query, orderBy,
  updateDoc, deleteDoc, doc, where,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentEventId = null;
let currentEvent = null;
let allMembers = [];
let currentRecords = [];
let currentSearchTerm = "";

document.addEventListener("DOMContentLoaded", () => { init(); });

function init() { setupListeners(); loadEvents(); loadMembers(); }

function loadMembers() {
  const q = query(collection(db, "attendance_members"), orderBy("name", "asc"));
  onSnapshot(q, (snap) => {
    allMembers = [];
    snap.forEach((d) => allMembers.push({ id: d.id, name: d.data().name }));
    if (currentEventId) loadAttendance(currentEventId);
  });
}

function loadEvents() {
  const list = document.getElementById("eventsList");
  if (!list) return;
  const q = query(collection(db, "attendance_events"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snap) => {
    list.innerHTML = "";
    if (snap.empty) { list.innerHTML = '<p style="opacity:0.7;">No events created yet. Create one above!</p>'; return; }
    snap.forEach((d) => {
      const ev = d.data();
      const div = document.createElement("div");
      div.className = "event-card";
      div.innerHTML = `<h3>${ev.name} <span class="event-date">(${ev.date})</span></h3><p style="margin-bottom:8px;opacity:0.8;">Leader: ${ev.leaderName}</p><button class="btn mark-attendance-btn" data-id="${d.id}">Mark Attendance</button><button class="btn btn-danger btn-small delete-event-btn-member" data-id="${d.id}">Delete</button>`;
      list.appendChild(div);
    });
    anime({ targets: "#eventsList .event-card", translateY: [50, 0], opacity: [0, 1], delay: anime.stagger(100) });
  });
}

async function createEvent(name, leader, date) {
  try { const r = await addDoc(collection(db, "attendance_events"), { name: name.trim(), leaderName: leader.trim(), date: date, createdAt: new Date() }); return r.id; }
  catch (e) { console.error(e); return null; }
}

async function deleteEvent(eid) {
  try {
    const q = query(collection(db, "attendance_records"), where("eventId", "==", eid));
    const snap = await getDocs(q);
    const proms = []; snap.forEach((r) => proms.push(deleteDoc(doc(db, "attendance_records", r.id))));
    await Promise.all(proms);
    await deleteDoc(doc(db, "attendance_events", eid));
    if (currentEventId === eid) { document.getElementById("attendanceSection").classList.add("hidden"); currentEventId = null; currentEvent = null; }
  } catch (e) { console.error(e); }
}

async function showAttendance(eid) {
  currentEventId = eid;
  const eq = query(collection(db, "attendance_events"), where("__name__", "==", eid));
  const es = await getDocs(eq);
  if (es.empty) return;
  es.forEach((e) => { currentEvent = e.data(); });
  document.getElementById("selectedEventName").textContent = currentEvent.name;
  document.getElementById("attendanceSection").classList.remove("hidden");
  document.getElementById("attendanceSection").scrollIntoView({ behavior: "smooth" });
  loadAttendance(eid);
}

function loadAttendance(eid) {
  const body = document.getElementById("attendanceBody");
  if (!body) return;
  const q = query(collection(db, "attendance_records"), where("eventId", "==", eid));
  onSnapshot(q, (snap) => {
    currentRecords = []; snap.forEach((r) => currentRecords.push({ id: r.id, ...r.data() }));
    filterAndRender(body);
    updateSummary(currentRecords);
  });
}

function filterAndRender(body) {
  const term = currentSearchTerm.toLowerCase();
  const filtered = term
    ? currentRecords.filter(r => r.memberName.toLowerCase().includes(term))
    : currentRecords;
  renderTable(body, filtered);
}

function renderTable(tbody, recs) {
  tbody.innerHTML = "";
  if (allMembers.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;opacity:0.7;">No members in system.</td></tr>'; return; }
  allMembers.forEach((m, i) => {
    const ex = recs.find((r) => r.memberName === m.name);
    const att = ex ? ex.attended : false;
    const arr = ex ? (ex.arrivalTime || "") : "";
    const lv = ex ? (ex.leaveTime || "") : "";
    const tr = document.createElement("tr");
    tr.setAttribute("data-member", m.name);
    tr.innerHTML = `<td>${i + 1}</td><td>${m.name}</td><td><input type="checkbox" class="attendance-checkbox" data-member="${m.name}" ${att ? "checked" : ""} /></td><td><input type="time" class="time-input arrival-time" data-member="${m.name}" value="${arr}" /></td><td><input type="time" class="time-input leave-time" data-member="${m.name}" value="${lv}" /></td><td><button class="btn btn-small save-attendance-btn" data-member="${m.name}">Save</button></td>`;
    tbody.appendChild(tr);
  });
}

function updateSummary(recs) {
  const div = document.getElementById("attendanceSummary");
  if (!div) return;
  const pc = recs.filter((r) => r.attended).length;
  const tm = allMembers.length;
  const ac = tm - pc;
  div.innerHTML = `<div class="summary-card clickable" data-filter="total"><div class="number">${tm}</div><div class="label">Total Members</div><div class="hint">Click to view</div></div><div class="summary-card clickable present-card" data-filter="present"><div class="number" style="color:var(--success-color);">${pc}</div><div class="label">Present</div><div class="hint">Click to view & edit</div></div><div class="summary-card clickable absent-card" data-filter="absent"><div class="number" style="color:var(--error-color);">${ac}</div><div class="label">Absent</div><div class="hint">Click to view & edit</div></div>`;
}

function showDetailPanel(filter) {
  const panel = document.getElementById("memberDetailPanel");
  const title = document.getElementById("detailPanelTitle");
  const list = document.getElementById("memberDetailList");
  if (!panel || !title || !list) return;

  let filtered = [];
  let titleText = "";

  if (filter === "present") {
    filtered = currentRecords.filter(r => r.attended);
    titleText = `✅ Present Members (${filtered.length})`;
  } else if (filter === "absent") {
    filtered = currentRecords.filter(r => !r.attended);
    titleText = `❌ Absent Members (${filtered.length})`;
  } else {
    filtered = currentRecords;
    titleText = `👥 All Members (${filtered.length})`;
  }

  title.textContent = titleText;

  if (filtered.length === 0) {
    list.innerHTML = '<p style="opacity:0.7;padding:20px;text-align:center;">No members in this category.</p>';
  } else {
    let html = '';
    filtered.forEach((r, i) => {
      html += `<div class="detail-member-card" data-record-id="${r.id}" data-member="${r.memberName}">
        <div class="detail-member-info">
          <span class="detail-member-number">${i + 1}</span>
          <span class="detail-member-name">${r.memberName}</span>
          <span class="${r.attended ? 'status-present' : 'status-absent'} detail-status-badge">${r.attended ? 'Present' : 'Absent'}</span>
        </div>
        <div class="detail-member-actions">
          <label class="detail-toggle-label">
            <input type="checkbox" class="detail-attendance-toggle" data-member="${r.memberName}" ${r.attended ? 'checked' : ''} />
            <span>Present</span>
          </label>
          <input type="time" class="time-input detail-arrival-input" data-member="${r.memberName}" value="${r.arrivalTime || ''}" ${!r.attended ? 'disabled' : ''} />
          <input type="time" class="time-input detail-leave-input" data-member="${r.memberName}" value="${r.leaveTime || ''}" ${!r.attended ? 'disabled' : ''} />
          <button class="btn btn-small detail-save-btn" data-member="${r.memberName}">💾 Save</button>
        </div>
      </div>`;
    });
    list.innerHTML = html;
  }

  panel.classList.remove("hidden");
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  anime({ targets: ".detail-member-card", translateX: [30, 0], opacity: [0, 1], delay: anime.stagger(50), easing: "easeOutExpo" });
}

function closeDetailPanel() {
  const panel = document.getElementById("memberDetailPanel");
  if (panel) panel.classList.add("hidden");
}

async function saveAttendance(member, attended, arrival, leave) {
  try {
    const eq = query(collection(db, "attendance_records"), where("eventId", "==", currentEventId), where("memberName", "==", member));
    const es = await getDocs(eq);
    const now = new Date();
    const ct = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    const data = { eventId: currentEventId, eventName: currentEvent ? currentEvent.name : "", memberName: member, attended: attended, arrivalTime: attended ? arrival : "", leaveTime: attended ? leave : "", updatedAt: new Date() };
    if (es.empty) { data.createdAt = new Date(); data.autoArrivalTime = attended ? ct : ""; await addDoc(collection(db, "attendance_records"), data); }
    else { es.forEach(async (d) => { const ed = d.data(); data.autoArrivalTime = ed.autoArrivalTime || (attended ? ct : ""); data.createdAt = ed.createdAt || new Date(); await updateDoc(doc(db, "attendance_records", d.id), data); }); }
    return true;
  } catch (e) { console.error(e); return false; }
}

function setupListeners() {
  const ef = document.getElementById("eventForm");
  if (ef) ef.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ni = document.getElementById("eventName"), li = document.getElementById("leaderName"), di = document.getElementById("eventDate"), st = document.getElementById("formStatus");
    const n = ni.value.trim(), l = li.value.trim(), d = di.value;
    if (!n || !l || !d) return;
    const eid = await createEvent(n, l, d);
    if (eid) { ni.value = ""; li.value = ""; di.value = ""; st.textContent = "Event created!"; st.className = "form-status success"; setTimeout(() => { st.textContent = ""; }, 3000); }
    else { st.textContent = "Error creating event."; st.className = "form-status error"; }
  });

  const el = document.getElementById("eventsList");
  if (el) el.addEventListener("click", async (e) => {
    if (e.target.classList.contains("mark-attendance-btn")) await showAttendance(e.target.dataset.id);
    else if (e.target.classList.contains("delete-event-btn-member")) { if (confirm("Delete event and all records?")) await deleteEvent(e.target.dataset.id); }
  });

  const ab = document.getElementById("attendanceBody");
  if (ab) ab.addEventListener("click", async (e) => {
    if (e.target.classList.contains("save-attendance-btn")) {
      const mn = e.target.dataset.member;
      const row = e.target.closest("tr");
      const cb = row.querySelector(".attendance-checkbox");
      const ai = row.querySelector(".arrival-time");
      const li = row.querySelector(".leave-time");
      const att = cb.checked;
      let arr = ai.value;
      const lv = li.value;
      if (att && !arr) { const now = new Date(); arr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }); ai.value = arr; }
      const ok = await saveAttendance(mn, att, arr, lv);
      const st = document.getElementById("attendanceStatus");
      if (ok) { st.textContent = `Attendance saved for ${mn}!`; st.className = "form-status success"; setTimeout(() => { st.textContent = ""; }, 2000); }
      else { st.textContent = "Error saving attendance."; st.className = "form-status error"; }
    }
  });

  // Search input listener
  const si = document.getElementById("memberSearch");
  if (si) si.addEventListener("input", (e) => {
    currentSearchTerm = e.target.value;
    const body = document.getElementById("attendanceBody");
    if (body) filterAndRender(body);
  });

  // Summary card click listener
  const as = document.getElementById("attendanceSummary");
  if (as) as.addEventListener("click", (e) => {
    const card = e.target.closest(".clickable");
    if (card) showDetailPanel(card.dataset.filter);
  });

  // Close detail panel button
  const cdb = document.getElementById("closeDetailBtn");
  if (cdb) cdb.addEventListener("click", () => closeDetailPanel());

  // Detail panel: toggle attendance (enable/disable time inputs)
  const mdp = document.getElementById("memberDetailList");
  if (mdp) {
    mdp.addEventListener("change", (e) => {
      if (e.target.classList.contains("detail-attendance-toggle")) {
        const mn = e.target.dataset.member;
        const card = e.target.closest(".detail-member-card");
        const ai = card.querySelector(".detail-arrival-input");
        const li = card.querySelector(".detail-leave-input");
        const badge = card.querySelector(".detail-status-badge");
        if (e.target.checked) {
          ai.disabled = false;
          li.disabled = false;
          badge.className = "status-present detail-status-badge";
          badge.textContent = "Present";
        } else {
          ai.disabled = true;
          li.disabled = true;
          badge.className = "status-absent detail-status-badge";
          badge.textContent = "Absent";
        }
      }
    });

    // Detail panel: save button
    mdp.addEventListener("click", async (e) => {
      if (e.target.classList.contains("detail-save-btn")) {
        const mn = e.target.dataset.member;
        const card = e.target.closest(".detail-member-card");
        const cb = card.querySelector(".detail-attendance-toggle");
        const ai = card.querySelector(".detail-arrival-input");
        const li = card.querySelector(".detail-leave-input");
        const att = cb.checked;
        let arr = ai.value;
        const lv = li.value;
        if (att && !arr) { const now = new Date(); arr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }); ai.value = arr; }
        const ok = await saveAttendance(mn, att, arr, lv);
        const st = document.getElementById("attendanceStatus");
        if (ok) { st.textContent = `Attendance saved for ${mn}!`; st.className = "form-status success"; setTimeout(() => { st.textContent = ""; }, 2000); }
        else { st.textContent = "Error saving attendance."; st.className = "form-status error"; }
      }
    });
  }
}

