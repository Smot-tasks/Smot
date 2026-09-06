import { db, auth } from "./firebase-config.js";
import {
  collection, addDoc, getDocs, onSnapshot, query, orderBy,
  updateDoc, deleteDoc, doc, where,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let allMembers = [];

document.addEventListener("DOMContentLoaded", () => {
  auth.onAuthStateChanged((user) => {
    if (user) {
      const el = document.getElementById("adminGreeting");
      if (el) {
        const names = { "meriettehani2@gmail.com": "meriett", "georgeeskander2025eng@gmail.com": "george", "mina.sameh1904@gmail.com": "mina" };
        el.textContent = names[user.email] ? `Hi, ${names[user.email]}` : "Hi, Admin";
      }
    }
    init();
  });
});

function init() { setupListeners(); loadMembers(); loadEvents(); loadReports(); }

function loadMembers() {
  const list = document.getElementById("membersList");
  if (!list) return;
  const q = query(collection(db, "attendance_members"), orderBy("name", "asc"));
  onSnapshot(q, (snap) => {
    allMembers = [];
    list.innerHTML = "";
    if (snap.empty) { list.innerHTML = '<p style="opacity:0.7;">No members added yet.</p>'; return; }
    const grid = document.createElement("div");
    grid.style.cssText = "display:flex;flex-wrap:wrap;gap:10px;";
    snap.forEach((d) => {
      const m = d.data();
      allMembers.push({ id: d.id, name: m.name });
      const b = document.createElement("div");
      b.className = "member-badge";
      b.innerHTML = `<span>${m.name}</span><button class="btn btn-danger btn-small delete-member-btn" data-id="${d.id}" style="padding:2px 8px;font-size:0.75rem;">&times;</button>`;
      grid.appendChild(b);
    });
    list.appendChild(grid);
    anime({ targets: ".member-badge", scale: [0.8, 1], opacity: [0, 1], delay: anime.stagger(50) });
  });
}

async function addMember(name) {
  try { await addDoc(collection(db, "attendance_members"), { name: name.trim(), createdAt: new Date() }); return true; }
  catch (e) { console.error(e); return false; }
}

async function deleteMember(id) {
  try { await deleteDoc(doc(db, "attendance_members", id)); } catch (e) { console.error(e); }
}

function loadEvents() {
  const list = document.getElementById("eventsList");
  if (!list) return;
  const q = query(collection(db, "attendance_events"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snap) => {
    list.innerHTML = "";
    if (snap.empty) { list.innerHTML = '<p style="opacity:0.7;">No events created yet.</p>'; return; }
    snap.forEach((d) => {
      const ev = d.data();
      const div = document.createElement("div");
      div.className = "event-card";
      div.innerHTML = `<h3>${ev.name} <span class="event-date">(${ev.date})</span></h3><p style="margin-bottom:8px;opacity:0.8;">Leader: ${ev.leaderName}</p><button class="btn btn-secondary btn-small edit-event-btn" data-id="${d.id}" data-name="${ev.name}" data-leader="${ev.leaderName}" data-date="${ev.date}">Edit</button><button class="btn btn-danger btn-small delete-event-btn" data-id="${d.id}">Delete</button>`;
      list.appendChild(div);
    });
    anime({ targets: ".events-container .event-card", translateY: [50, 0], opacity: [0, 1], delay: anime.stagger(100) });
  });
}

async function deleteEvent(eid) {
  try {
    const q = query(collection(db, "attendance_records"), where("eventId", "==", eid));
    const snap = await getDocs(q);
    const proms = []; snap.forEach((r) => proms.push(deleteDoc(doc(db, "attendance_records", r.id))));
    await Promise.all(proms);
    await deleteDoc(doc(db, "attendance_events", eid));
  } catch (e) { console.error(e); }
}

async function updateEvent(eid, name, leader, date) {
  try { await updateDoc(doc(db, "attendance_events", eid), { name: name.trim(), leaderName: leader.trim(), date: date }); return true; }
  catch (e) { console.error(e); return false; }
}
function loadReports() {
  const list = document.getElementById("reportsList");
  if (!list) return;
  const q = query(collection(db, "attendance_events"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snap) => {
    list.innerHTML = "";
    if (snap.empty) { list.innerHTML = '<p style="opacity:0.7;">No events to report on.</p>'; return; }
    snap.forEach((ed) => {
      const ev = ed.data(), eid = ed.id;
      const card = document.createElement("div");
      card.className = "report-event-card";
      card.setAttribute("data-event-id", eid);
      card.innerHTML = `<div class="report-event-header" data-id="${eid}" style="cursor:pointer;"><h3>${ev.name} <span class="event-date">(${ev.date})</span></h3><span class="present-count" style="color:var(--success-color);font-weight:600;">Loading...</span></div><div class="reports-placeholder hidden" id="reports-${eid}"><div class="report-card"><div class="report-card-body"><p><strong>Leader:</strong> ${ev.leaderName}</p><p style="margin-top:4px;"><strong>Date:</strong> ${ev.date}</p><p style="margin-top:8px;"><strong>Attendance Details:</strong></p><div id="details-${eid}" style="margin-top:10px;overflow-x:auto;"><p style="opacity:0.7;">Loading...</p></div></div></div></div>`;
      list.appendChild(card);
      const aq = query(collection(db, "attendance_records"), where("eventId", "==", eid));
      onSnapshot(aq, (rs) => {
        const recs = []; rs.forEach((r) => recs.push({ id: r.id, ...r.data() }));
        const pc = recs.filter((r) => r.attended).length;
        const rc = document.querySelector(`[data-event-id="${eid}"]`);
        if (rc) { const ce = rc.querySelector(".present-count"); if (ce) ce.textContent = `${pc} present`; }
        const dd = document.getElementById(`details-${eid}`);
        if (!dd) return;
        if (recs.length === 0) { dd.innerHTML = '<p style="opacity:0.7;">No attendance records yet.</p>'; return; }
        let h = '<table class="attendance-table"><thead><tr><th>Member</th><th>Status</th><th>Arrival</th><th>Leave</th></tr></thead><tbody>';
        recs.forEach((r) => { h += `<tr><td>${r.memberName}</td><td class="${r.attended ? 'status-present' : 'status-absent'}">${r.attended ? 'Present' : 'Absent'}</td><td>${r.arrivalTime || '-'}</td><td>${r.leaveTime || '-'}</td></tr>`; });
        h += '</tbody></table>';
        dd.innerHTML = h;
      });
    });
  });
}

function setupListeners() {
  const mf = document.getElementById("memberForm");
  if (mf) mf.addEventListener("submit", async (e) => {
    e.preventDefault();
    const inp = document.getElementById("memberName"), st = document.getElementById("memberFormStatus");
    const n = inp.value.trim(); if (!n) return;
    if (await addMember(n)) { inp.value = ""; st.textContent = "Member added!"; st.className = "form-status success"; setTimeout(() => { st.textContent = ""; }, 3000); }
    else { st.textContent = "Error adding member."; st.className = "form-status error"; }
  });

  const ml = document.getElementById("membersList");
  if (ml) ml.addEventListener("click", async (e) => {
    if (e.target.classList.contains("delete-member-btn")) { if (confirm("Delete this member?")) await deleteMember(e.target.dataset.id); }
  });

  const el = document.getElementById("eventsList");
  if (el) el.addEventListener("click", async (e) => {
    if (e.target.classList.contains("delete-event-btn")) { if (confirm("Delete event and all records?")) await deleteEvent(e.target.dataset.id); }
    else if (e.target.classList.contains("edit-event-btn")) {
      const b = e.target;
      const nn = prompt("Event name:", b.dataset.name); if (nn === null) return;
      const nl = prompt("Leader name:", b.dataset.leader); if (nl === null) return;
      const nd = prompt("Event date (YYYY-MM-DD):", b.dataset.date); if (nd === null) return;
      alert((await updateEvent(b.dataset.id, nn, nl, nd)) ? "Event updated!" : "Error updating event.");
    }
  });

  const rl = document.getElementById("reportsList");
  if (rl) rl.addEventListener("click", (e) => {
    const h = e.target.closest(".report-event-header");
    if (h) { const p = document.getElementById(`reports-${h.dataset.id}`); if (p) { const hid = p.classList.toggle("hidden"); if (!hid) anime({ targets: p.children, translateY: [-20, 0], opacity: [0, 1], delay: anime.stagger(80), easing: "easeOutExpo" }); } }
  });

  const lo = document.getElementById("logoutBtn");
  if (lo) lo.addEventListener("click", async () => { try { await signOut(auth); } catch (err) { console.error(err); } window.location.href = "task2.html"; });
}

