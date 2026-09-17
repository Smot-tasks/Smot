import { db, auth } from "./firebase-config.js";
import {
  collection, addDoc, getDocs, onSnapshot, query, orderBy,
  updateDoc, deleteDoc, doc, where, arrayUnion, arrayRemove,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let allMembers = [];
let allTeams = [];
let memberTeamByName = {};

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

function init() { setupListeners(); loadMembers(); loadTeams(); loadEvents(); loadReports(); }

function loadTeams() {
  const list = document.getElementById("teamsList");
  if (!list) return;
  const q = query(collection(db, "attendance_teams"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snap) => {
    allTeams = [];
    const nameMap = {};
    snap.forEach((d) => {
      const t = d.data();
      allTeams.push({ id: d.id, name: t.name, memberIds: t.memberIds || [], memberNames: t.memberNames || [] });
      (t.memberNames || []).forEach((n) => { nameMap[n] = t.name; });
    });
    memberTeamByName = nameMap;
    renderTeams();
  }, (err) => { console.error(err); list.innerHTML = '<p style="color:#c0392b;">Could not load teams: ' + (err.code || err.message) + '</p>'; });
}

function renderTeams() {
  const list = document.getElementById("teamsList");
  if (!list) return;
  list.innerHTML = "";
  if (allTeams.length === 0) { list.innerHTML = '<p style="opacity:0.7;">No teams created yet.</p>'; return; }
  allTeams.forEach((t) => {
    const addGrid = allMembers.map((m) => {
      const isIn = t.memberIds.includes(m.id);
      return `<button type="button" class="member-badge team-add-member-badge${isIn ? " in-team" : ""}" data-team="${t.id}" data-id="${m.id}" data-name="${m.name}"${isIn ? " disabled" : ""}><span>${m.name}</span><span class="add-plus">${isIn ? "&#10003;" : "+"}</span></button>`;
    }).join("") || '<p style="opacity:0.7;margin:0;">No members added yet.</p>';
    const membersHtml = (t.memberNames || []).map((n, i) =>
      `<span class="member-badge team-member-badge"><span>${n}</span><button class="btn btn-danger btn-small remove-team-member-btn" data-team="${t.id}" data-mid="${t.memberIds[i] || ""}" data-mname="${n}" style="padding:2px 8px;font-size:0.75rem;">&times;</button></span>`
    ).join("") || '<p style="opacity:0.7;margin:0;">No members in this team yet.</p>';
    const div = document.createElement("div");
    div.className = "team-card";
    div.innerHTML = `<div class="team-card-header"><h3>${t.name}</h3><span style="opacity:0.7;font-size:0.9rem;">${(t.memberNames || []).length} member(s)</span><button class="btn btn-danger btn-small delete-team-btn" data-id="${t.id}">Delete</button></div><div class="team-members">${membersHtml}</div><p class="team-add-label">Tap a member to add to this team:</p><div class="team-add-grid">${addGrid}</div>`;
    list.appendChild(div);
  });
  anime({ targets: "#teamsList .team-card", translateY: [30, 0], opacity: [0, 1], delay: anime.stagger(80) });
}

async function createTeam(name) {
  try { await addDoc(collection(db, "attendance_teams"), { name: name.trim(), memberIds: [], memberNames: [], createdAt: new Date() }); return true; }
  catch (e) { console.error(e); return "Error creating team" + (e && e.code ? ` (${e.code})` : "") + ". Try a hard refresh (Ctrl+F5)."; }
}

async function exportReportPDF(eid) {
  try {
    const eq = query(collection(db, "attendance_events"), where("__name__", "==", eid));
    const es = await getDocs(eq);
    if (es.empty) return;
    let ev = null; es.forEach((e) => { ev = e.data(); });
    const aq = query(collection(db, "attendance_records"), where("eventId", "==", eid));
    const rs = await getDocs(aq);
    const recs = []; rs.forEach((r) => recs.push(r.data()));
    recs.sort((a, b) => (a.memberName || "").localeCompare(b.memberName || ""));
    const rows = recs.map((r, i) => `<tr><td>${i + 1}</td><td>${r.memberName}</td><td>${memberTeamByName[r.memberName] || '-'}</td><td>${r.attended ? "Present" : "Absent"}</td><td>${r.arrivalTime || '-'}</td><td>${r.leaveTime || '-'}</td></tr>`).join("");
    const now = new Date().toLocaleString();
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) { alert("Please allow pop-ups to export the PDF."); return; }
    w.document.write(`<!doctype html><html><head><title>Report - ${ev.name}</title><style>body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#111;}h1{margin:0 0 4px;}h2{margin:0 0 12px;font-weight:500;}table{width:100%;border-collapse:collapse;margin-top:16px;}th,td{border:1px solid #999;padding:8px 10px;text-align:left;font-size:14px;}th{background:#f0f0f0;}.meta{color:#555;font-size:13px;}</style></head><body><h1>Smot - Attendance Report</h1><h2>${ev.name} (${ev.date})</h2><p class="meta">Leader: ${ev.leaderName} &nbsp;|&nbsp; Generated: ${now} &nbsp;|&nbsp; Present: ${recs.filter((r) => r.attended).length}/${recs.length}</p><table><thead><tr><th>#</th><th>Member</th><th>Team</th><th>Status</th><th>Arrival</th><th>Leave</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No attendance records.</td></tr>'}</tbody></table><p class="meta" style="margin-top:24px;">Choose "Print &gt; Save as PDF" in the print dialog to save this report as a PDF file.</p></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  } catch (e) { console.error(e); alert("Error exporting PDF."); }
}

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
    if (document.getElementById("teamsList")) renderTeams();
    anime({ targets: ".member-badge", scale: [0.8, 1], opacity: [0, 1], delay: anime.stagger(50) });
  }, (err) => { console.error(err); list.innerHTML = '<p style="color:#c0392b;">Could not load members: ' + (err.code || err.message) + '</p>'; });
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
  }, (err) => { console.error(err); list.innerHTML = '<p style="color:#c0392b;">Could not load events: ' + (err.code || err.message) + '</p>'; });
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
      card.innerHTML = `<div class="report-event-header" data-id="${eid}" style="cursor:pointer;"><h3>${ev.name} <span class="event-date">(${ev.date})</span></h3><span class="present-count" style="color:var(--success-color);font-weight:600;">Loading...</span><button class="btn btn-secondary btn-small pdf-report-btn" data-id="${eid}" style="margin-left:10px;">⬇ PDF</button></div><div class="reports-placeholder hidden" id="reports-${eid}"><div class="report-card"><div class="report-card-body"><p><strong>Leader:</strong> ${ev.leaderName}</p><p style="margin-top:4px;"><strong>Date:</strong> ${ev.date}</p><p style="margin-top:8px;"><strong>Attendance Details:</strong></p><div id="details-${eid}" style="margin-top:10px;overflow-x:auto;"><p style="opacity:0.7;">Loading...</p></div></div></div></div>`;
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
        let h = '<table class="attendance-table"><thead><tr><th>Member</th><th>Team</th><th>Status</th><th>Arrival</th><th>Leave</th></tr></thead><tbody>';
        recs.forEach((r) => { h += `<tr><td>${r.memberName}</td><td>${memberTeamByName[r.memberName] || '-'}</td><td class="${r.attended ? 'status-present' : 'status-absent'}">${r.attended ? 'Present' : 'Absent'}</td><td>${r.arrivalTime || '-'}</td><td>${r.leaveTime || '-'}</td></tr>`; });
        h += '</tbody></table>';
        dd.innerHTML = h;
      }, (err) => { console.error(err); if (dd) dd.innerHTML = '<p style="color:#c0392b;">Could not load records: ' + (err.code || err.message) + '</p>'; });
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

  const tf = document.getElementById("teamForm");
  if (tf) tf.addEventListener("submit", async (e) => {
    e.preventDefault();
    const inp = document.getElementById("teamName"), st = document.getElementById("teamFormStatus");
    const n = inp.value.trim(); if (!n) return;
    const res = await createTeam(n);
    if (res === true) { inp.value = ""; st.textContent = "Team created!"; st.className = "form-status success"; setTimeout(() => { st.textContent = ""; }, 3000); }
    else { st.textContent = res; st.className = "form-status error"; setTimeout(() => { st.textContent = ""; }, 6000); }
  });

  const tl = document.getElementById("teamsList");
  if (tl) tl.addEventListener("click", async (e) => {
    const card = e.target.closest(".team-card");
    if (!card) return;
    const addBadge = e.target.closest(".team-add-member-badge");
    if (addBadge && !addBadge.disabled) {
      try { await updateDoc(doc(db, "attendance_teams", addBadge.dataset.team), { memberIds: arrayUnion(addBadge.dataset.id), memberNames: arrayUnion(addBadge.dataset.name) }); }
      catch (err) { console.error(err); }
    } else if (e.target.classList.contains("remove-team-member-btn")) {
      try { await updateDoc(doc(db, "attendance_teams", e.target.dataset.team), { memberIds: arrayRemove(e.target.dataset.mid), memberNames: arrayRemove(e.target.dataset.mname) }); }
      catch (err) { console.error(err); }
    } else if (e.target.classList.contains("delete-team-btn")) {
      if (confirm("Delete this team?")) { try { await deleteDoc(doc(db, "attendance_teams", e.target.dataset.id)); } catch (err) { console.error(err); } }
    }
  });

  const rl = document.getElementById("reportsList");
  if (rl) rl.addEventListener("click", (e) => {
    if (e.target.classList.contains("pdf-report-btn")) { exportReportPDF(e.target.dataset.id); return; }
    const h = e.target.closest(".report-event-header");
    if (h) { const p = document.getElementById(`reports-${h.dataset.id}`); if (p) { const hid = p.classList.toggle("hidden"); if (!hid) anime({ targets: p.children, translateY: [-20, 0], opacity: [0, 1], delay: anime.stagger(80), easing: "easeOutExpo" }); } }
  });

  const lo = document.getElementById("logoutBtn");
  if (lo) lo.addEventListener("click", async () => { try { await signOut(auth); } catch (err) { console.error(err); } window.location.href = "task2.html"; });
}

