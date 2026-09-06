import { db } from "./firebase-config.js";
import {
  collection, addDoc, getDocs, onSnapshot, query, orderBy,
  updateDoc, deleteDoc, doc, where,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentEventId = null;
let currentEvent = null;
let allMembers = [];

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
    const recs = []; snap.forEach((r) => recs.push({ id: r.id, ...r.data() }));
    renderTable(body, recs);
    updateSummary(recs);
  });
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
  div.innerHTML = `<div class="summary-card"><div class="number">${tm}</div><div class="label">Total Members</div></div><div class="summary-card"><div class="number" style="color:var(--success-color);">${pc}</div><div class="label">Present</div></div><div class="summary-card"><div class="number" style="color:var(--error-color);">${tm - pc}</div><div class="label">Absent</div></div>`;
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
}

