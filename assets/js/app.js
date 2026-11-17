/* HerbHub UI controller */
(function () {
  "use strict";

  var S = window.Store;
  var C = S.Calc;

  // ---------- helpers ----------
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var el = function (id) { return document.getElementById(id); };

  function cur() { return S.settings().currency || "$"; }
  function money(n) {
    n = Number(n) || 0;
    var neg = n < 0;
    var s = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (neg ? "-" : "") + cur() + s;
  }
  function esc(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }
  function fmtDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d)) return esc(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }
  function todayInput() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function todayStr() { return todayInput(); }
  function dayDiff(dateStr) {
    // whole-day difference from today (negative = past)
    var d = new Date(dateStr + "T00:00:00");
    var t = new Date(); t.setHours(0, 0, 0, 0);
    return Math.round((d - t) / 86400000);
  }
  function relDay(dateStr) {
    var diff = dayDiff(dateStr);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff === -1) return "Yesterday";
    if (diff > 1 && diff <= 7) return "In " + diff + " days";
    if (diff < -1) return Math.abs(diff) + " days ago";
    return fmtDate(dateStr);
  }
  function fmtTime(t) {
    if (!t) return "";
    var parts = String(t).split(":");
    var h = parseInt(parts[0], 10); if (isNaN(h)) return esc(t);
    var m = parts[1] || "00";
    var ap = h >= 12 ? "PM" : "AM";
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    return h12 + ":" + m + " " + ap;
  }
  function apptStatusBadge(a) {
    if (a.status === "completed") return '<span class="badge badge-paid">Completed</span>';
    if (a.status === "cancelled") return '<span class="badge badge-unpaid">Cancelled</span>';
    // scheduled
    var diff = dayDiff(a.date);
    if (diff < 0) return '<span class="badge badge-partial">Overdue</span>';
    if (diff === 0) return '<span class="badge badge-partial">Today</span>';
    return '<span class="badge badge-paid" style="background:var(--green-100);color:var(--green-700)">Scheduled</span>';
  }
  function apptSortKey(a) { return (a.date || "") + "T" + (a.time || "99:99"); }

  function initials(name) {
    var parts = String(name || "?").trim().split(/\s+/);
    return ((parts[0] || "")[0] || "") + ((parts[1] || "")[0] || "");
  }
  function statusBadge(status) {
    var map = { paid: ["badge-paid", "Paid"], partial: ["badge-partial", "Partial"], unpaid: ["badge-unpaid", "Unpaid"] };
    var m = map[status] || map.unpaid;
    return '<span class="badge ' + m[0] + '">' + m[1] + "</span>";
  }

  function toast(msg, isError) {
    var host = el("toastHost");
    var t = document.createElement("div");
    t.className = "toast" + (isError ? " error" : "");
    t.textContent = msg;
    host.appendChild(t);
    setTimeout(function () { t.style.opacity = "0"; t.style.transform = "translateX(20px)"; }, 2600);
    setTimeout(function () { t.remove(); }, 3000);
  }

  // ---------- modal ----------
  function openModal(html, wide) {
    var m = el("modal");
    m.className = "modal" + (wide ? " wide" : "");
    m.innerHTML = html;
    el("modalBackdrop").hidden = false;
    document.body.style.overflow = "hidden";
    var first = m.querySelector("input, select, textarea");
    if (first) setTimeout(function () { first.focus(); }, 50);
  }
  function closeModal() {
    el("modalBackdrop").hidden = true;
    el("modal").innerHTML = "";
    document.body.style.overflow = "";
  }
  el("modalBackdrop").addEventListener("click", function (e) {
    if (e.target === el("modalBackdrop")) closeModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !el("modalBackdrop").hidden) closeModal();
  });

  function confirmDialog(opts, onYes) {
    openModal(
      '<div class="modal-head"><h2>' + esc(opts.title) + '</h2><button class="close-x" data-close>&times;</button></div>' +
      '<div class="modal-body"><p style="margin:0;color:var(--text-soft);line-height:1.5">' + esc(opts.message) + "</p></div>" +
      '<div class="modal-foot"><button class="btn btn-outline" data-close>Cancel</button>' +
      '<button class="btn ' + (opts.danger ? "btn-danger" : "btn-primary") + '" id="confirmYes">' + esc(opts.confirm || "Confirm") + "</button></div>"
    );
    el("confirmYes").onclick = function () { closeModal(); onYes(); };
  }

  // delegate [data-close]
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-close]")) closeModal();
  });

  // ---------- routing ----------
  var views = {};
  var currentView = "dashboard";
  var viewState = {}; // transient per-view state (e.g. selected patient)

  function setView(name, state) {
    currentView = name;
    viewState = state || {};
    document.querySelectorAll(".nav-item").forEach(function (b) {
      b.classList.toggle("active", b.dataset.view === name);
    });
    closeSidebar();
    render();
  }

  function render() {
    var v = views[currentView] || views.dashboard;
    el("pageTitle").textContent = v.title(viewState);
    el("topbarActions").innerHTML = "";
    el("content").innerHTML = v.render(viewState);
    if (v.mount) v.mount(viewState);
  }

  // ---------- Dashboard ----------
  views.dashboard = {
    title: function () { return "Dashboard"; },
    render: function () {
      var visits = S.visits();
      var t = C.totals(visits);
      var patients = S.patients();

      // recent visits (last 6)
      var recent = visits.slice().sort(function (a, b) {
        return (b.date || b.createdAt || "").localeCompare(a.date || a.createdAt || "");
      }).slice(0, 6);

      // top debtors
      var debtors = patients.map(function (p) {
        var bal = C.totals(S.visitsForPatient(p.id)).balance;
        return { p: p, bal: bal };
      }).filter(function (x) { return x.bal > 0.001; }).sort(function (a, b) { return b.bal - a.bal; }).slice(0, 5);

      var html = '<div class="grid stats">' +
        statCard("Total Income", money(t.paid), "pos", t.count + " visit" + (t.count === 1 ? "" : "s") + " recorded", true) +
        statCard("Remedy Costs", money(t.cost), "", "What your remedies cost you") +
        statCard("Profit", money(t.profit), t.profit >= 0 ? "pos" : "neg", "Charges minus costs") +
        statCard("Outstanding", money(t.balance), t.balance > 0 ? "warn" : "", "Unpaid balances owed to you") +
        "</div>";

      html += '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-bottom:22px">' +
        statCard("Patients", String(patients.length), "", "") +
        statCard("Remedies", String(S.remedies().length), "", "") +
        statCard("Total Charged", money(t.charge), "", "Billed across all visits") +
        "</div>";

      // upcoming appointments / reminders
      var appts = S.appointments();
      var reminders = appts.filter(function (a) { return a.status === "scheduled" && dayDiff(a.date) <= 14; })
        .sort(function (a, b) { return apptSortKey(a).localeCompare(apptSortKey(b)); });
      if (reminders.length) {
        var overdueCount = reminders.filter(function (a) { return dayDiff(a.date) < 0; }).length;
        var todayCount = reminders.filter(function (a) { return dayDiff(a.date) === 0; }).length;
        html += '<div class="card"><div class="card-head"><h2>📅 Appointments & Reminders</h2>' +
          '<button class="btn btn-primary btn-sm" id="dashNewAppt">+ Book</button></div>';
        if (overdueCount || todayCount) {
          html += '<div class="card-body" style="padding-bottom:0"><div class="pill-row">' +
            (todayCount ? '<span class="badge badge-partial">' + todayCount + " today</span>" : "") +
            (overdueCount ? '<span class="badge badge-unpaid">' + overdueCount + " overdue</span>" : "") +
            "</div></div>";
        }
        html += '<div class="table-wrap"><table class="data"><thead><tr><th>When</th><th>Patient</th><th>Reason</th><th>Status</th></tr></thead><tbody>';
        reminders.slice(0, 6).forEach(function (a) {
          var p = S.getPatient(a.patientId);
          html += '<tr class="row-click" data-appt="' + a.id + '">' +
            "<td><strong>" + esc(relDay(a.date)) + "</strong>" + (a.time ? " · " + esc(fmtTime(a.time)) : "") + "</td>" +
            "<td>" + esc(p ? p.name : "—") + "</td>" +
            '<td class="mini">' + (a.reason ? esc(a.reason) : '<span class="muted">—</span>') + "</td>" +
            "<td>" + apptStatusBadge(a) + "</td></tr>";
        });
        html += "</tbody></table></div></div>";
      }

      // recent visits card
      html += '<div class="card"><div class="card-head"><h2>Recent Visits</h2>' +
        '<button class="btn btn-primary btn-sm" id="dashNewVisit">+ New Visit</button></div>';
      if (recent.length === 0) {
        html += '<div class="card-body"><p class="muted" style="margin:0">No visits yet. Add a patient, then record their first visit.</p></div>';
      } else {
        html += '<div class="table-wrap"><table class="data"><thead><tr><th>Date</th><th>Patient</th><th class="num">Charge</th><th class="num">Paid</th><th>Status</th></tr></thead><tbody>';
        recent.forEach(function (v) {
          var p = S.getPatient(v.patientId);
          html += '<tr class="row-click" data-visit="' + v.id + '">' +
            "<td>" + fmtDate(v.date || v.createdAt) + "</td>" +
            "<td>" + esc(p ? p.name : "—") + "</td>" +
            '<td class="num">' + money(C.visitCharge(v)) + "</td>" +
            '<td class="num">' + money(C.visitPaid(v)) + "</td>" +
            "<td>" + statusBadge(C.visitStatus(v)) + "</td></tr>";
        });
        html += "</tbody></table></div>";
      }
      html += "</div>";

      // debtors
      if (debtors.length) {
        html += '<div class="card"><div class="card-head"><h2>Outstanding Balances</h2></div><div class="table-wrap"><table class="data"><thead><tr><th>Patient</th><th class="num">Owes</th></tr></thead><tbody>';
        debtors.forEach(function (d) {
          html += '<tr class="row-click" data-patient="' + d.p.id + '"><td>' + esc(d.p.name) + '</td><td class="num" style="color:var(--amber);font-weight:600">' + money(d.bal) + "</td></tr>";
        });
        html += "</tbody></table></div></div>";
      }

      return html;
    },
    mount: function () {
      var nv = el("dashNewVisit");
      if (nv) nv.onclick = function () { openVisitForm(null, null); };
      var na = el("dashNewAppt");
      if (na) na.onclick = function () { openApptForm(null, null); };
      document.querySelectorAll("[data-visit]").forEach(function (row) {
        row.onclick = function () { openVisitForm(row.dataset.visit, null); };
      });
      document.querySelectorAll("[data-appt]").forEach(function (row) {
        row.onclick = function () { openApptForm(row.dataset.appt, null); };
      });
      document.querySelectorAll("[data-patient]").forEach(function (row) {
        row.onclick = function () { setView("patients", { selected: row.dataset.patient }); };
      });
    }
  };

  function statCard(label, value, cls, foot, accent) {
    return '<div class="stat-card' + (accent ? " stat-accent" : "") + '">' +
      '<span class="stat-label">' + esc(label) + "</span>" +
      '<span class="stat-value ' + (cls || "") + '">' + value + "</span>" +
      (foot ? '<span class="stat-foot">' + esc(foot) + "</span>" : "") +
      "</div>";
  }

  // ---------- Patients ----------
  views.patients = {
    title: function (st) { return st && st.selected ? "Patient" : "Patients"; },
    render: function (st) {
      if (st && st.selected) return renderPatientDetail(st.selected);
      return renderPatientList(st);
    },
    mount: function (st) {
      if (st && st.selected) { mountPatientDetail(st.selected); return; }
      mountPatientList();
    }
  };

  function renderPatientList(st) {
    var q = (st && st.q) || "";
    el("topbarActions").innerHTML = '<div class="search">🔍<input id="patientSearch" placeholder="Search patients…" value="' + esc(q) + '"></div>' +
      '<button class="btn btn-primary" id="addPatientBtn">+ Add Patient</button>';

    var list = S.patients();
    if (q) {
      var lq = q.toLowerCase();
      list = list.filter(function (p) {
        return (p.name || "").toLowerCase().indexOf(lq) >= 0 ||
          (p.phone || "").toLowerCase().indexOf(lq) >= 0 ||
          (p.email || "").toLowerCase().indexOf(lq) >= 0;
      });
    }
    list.sort(function (a, b) { return (a.name || "").localeCompare(b.name || ""); });

    if (list.length === 0) {
      return emptyState("👤", q ? "No matching patients" : "No patients yet",
        q ? "Try a different search." : "Add your first patient to start keeping records.",
        q ? "" : "Add Patient", "addPatientEmpty");
    }

    var html = '<div class="card"><div class="table-wrap"><table class="data"><thead><tr>' +
      "<th>Patient</th><th>Contact</th><th class=\"num\">Visits</th><th class=\"num\">Owes</th><th></th></tr></thead><tbody>";
    list.forEach(function (p) {
      var pv = S.visitsForPatient(p.id);
      var bal = C.totals(pv).balance;
      html += '<tr class="row-click" data-open="' + p.id + '">' +
        '<td><div class="patient-cell"><span class="avatar">' + esc(initials(p.name).toUpperCase()) + "</span><div><div style=\"font-weight:600\">" + esc(p.name) + "</div>" +
        (p.age || p.gender ? '<div class="mini muted">' + [p.gender, p.age ? p.age + " yrs" : ""].filter(Boolean).map(esc).join(" · ") + "</div>" : "") +
        "</div></div></td>" +
        "<td>" + (p.phone ? esc(p.phone) : '<span class="muted">—</span>') + "</td>" +
        '<td class="num">' + pv.length + "</td>" +
        '<td class="num">' + (bal > 0.001 ? '<span style="color:var(--amber);font-weight:600">' + money(bal) + "</span>" : '<span class="muted">—</span>') + "</td>" +
        '<td class="num"><button class="btn btn-outline btn-sm" data-edit="' + p.id + '">Edit</button></td>' +
        "</tr>";
    });
    html += "</tbody></table></div></div>";
    return html;
  }

  function mountPatientList() {
    var add = el("addPatientBtn"); if (add) add.onclick = function () { openPatientForm(null); };
    var addE = el("addPatientEmpty"); if (addE) addE.onclick = function () { openPatientForm(null); };
    var search = el("patientSearch");
    if (search) {
      search.oninput = function () {
        viewState.q = search.value;
        var content = el("content");
        content.innerHTML = renderPatientList(viewState);
        mountPatientList();
        var s2 = el("patientSearch"); if (s2) { s2.focus(); s2.setSelectionRange(s2.value.length, s2.value.length); }
      };
    }
    document.querySelectorAll("[data-open]").forEach(function (row) {
      row.onclick = function (e) {
        if (e.target.closest("[data-edit]")) return;
        setView("patients", { selected: row.dataset.open });
      };
    });
    document.querySelectorAll("[data-edit]").forEach(function (b) {
      b.onclick = function (e) { e.stopPropagation(); openPatientForm(b.dataset.edit); };
    });
  }

  function renderPatientDetail(id) {
    var p = S.getPatient(id);
    if (!p) return emptyState("❓", "Patient not found", "They may have been deleted.", "Back to Patients", "backPatients");

    el("topbarActions").innerHTML =
      '<button class="btn btn-outline" id="editPatientBtn">Edit</button>' +
      '<button class="btn btn-outline" id="bookApptBtn">+ Appointment</button>' +
      '<button class="btn btn-primary" id="newVisitBtn">+ New Visit</button>';

    var visits = S.visitsForPatient(p.id).sort(function (a, b) {
      return (b.date || b.createdAt || "").localeCompare(a.date || a.createdAt || "");
    });
    var t = C.totals(visits);

    var html = '<button class="back-link" id="backPatients">← All patients</button>';

    html += '<div class="card"><div class="card-body flex gap between wrap">' +
      '<div class="patient-cell"><span class="avatar" style="width:52px;height:52px;font-size:20px">' + esc(initials(p.name).toUpperCase()) + "</span>" +
      '<div><div style="font-size:20px;font-weight:700">' + esc(p.name) + "</div>" +
      '<div class="mini muted">' + [p.gender, p.age ? p.age + " yrs" : "", p.phone, p.email].filter(Boolean).map(esc).join(" · ") + "</div></div></div>" +
      "</div>";
    if (p.address || p.notes) {
      html += '<div class="card-body" style="border-top:1px solid var(--border)">';
      if (p.address) html += '<div class="mini"><strong>Address:</strong> ' + esc(p.address) + "</div>";
      if (p.notes) html += '<div class="mini mt" style="margin-top:8px"><strong>Notes / history:</strong><br>' + esc(p.notes).replace(/\n/g, "<br>") + "</div>";
      html += "</div>";
    }
    html += "</div>";

    html += '<div class="grid stats mt">' +
      statCard("Total Charged", money(t.charge), "", "") +
      statCard("Total Paid", money(t.paid), "pos", "") +
      statCard("Balance Owed", money(t.balance), t.balance > 0 ? "warn" : "", "") +
      "</div>";

    // patient appointments
    var pAppts = S.appointmentsForPatient(p.id);
    var upc = pAppts.filter(function (a) { return a.status === "scheduled"; })
      .sort(function (a, b) { return apptSortKey(a).localeCompare(apptSortKey(b)); });
    if (upc.length) {
      html += '<div class="card"><div class="card-head"><h2>Upcoming Appointments (' + upc.length + ')</h2></div><div class="table-wrap"><table class="data"><thead><tr><th>When</th><th>Reason</th><th>Status</th><th></th></tr></thead><tbody>';
      upc.forEach(function (a) {
        html += '<tr class="row-click" data-appt="' + a.id + '">' +
          "<td><strong>" + esc(relDay(a.date)) + "</strong>" + (a.time ? " · " + esc(fmtTime(a.time)) : "") + '<div class="mini muted">' + fmtDate(a.date) + "</div></td>" +
          '<td class="mini">' + (a.reason ? esc(a.reason) : '<span class="muted">—</span>') + "</td>" +
          "<td>" + apptStatusBadge(a) + "</td>" +
          '<td class="num"><button class="btn btn-outline btn-sm" data-done="' + a.id + '">✓ Done</button></td></tr>';
      });
      html += "</tbody></table></div></div>";
    }

    html += '<div class="card"><div class="card-head"><h2>Visit History (' + visits.length + ')</h2></div>';
    if (visits.length === 0) {
      html += '<div class="card-body"><p class="muted" style="margin:0">No visits recorded yet. Click “New Visit” to add one.</p></div>';
    } else {
      html += '<div class="table-wrap"><table class="data"><thead><tr><th>Date</th><th>Remedies</th><th class="num">Charge</th><th class="num">Paid</th><th class="num">Balance</th><th>Status</th><th></th></tr></thead><tbody>';
      visits.forEach(function (v) {
        var names = (v.items || []).map(function (it) { return it.name; }).join(", ");
        html += '<tr class="row-click" data-visit="' + v.id + '">' +
          "<td>" + fmtDate(v.date || v.createdAt) + "</td>" +
          '<td style="max-width:260px">' + (names ? esc(names) : '<span class="muted">—</span>') + "</td>" +
          '<td class="num">' + money(C.visitCharge(v)) + "</td>" +
          '<td class="num">' + money(C.visitPaid(v)) + "</td>" +
          '<td class="num">' + (C.visitBalance(v) > 0.001 ? money(C.visitBalance(v)) : '<span class="muted">—</span>') + "</td>" +
          "<td>" + statusBadge(C.visitStatus(v)) + "</td>" +
          '<td class="num"><button class="btn btn-outline btn-sm" data-delv="' + v.id + '">✕</button></td>' +
          "</tr>";
      });
      html += "</tbody></table></div>";
    }
    html += "</div>";
    return html;
  }

  function mountPatientDetail(id) {
    var back = el("backPatients"); if (back) back.onclick = function () { setView("patients", {}); };
    var edit = el("editPatientBtn"); if (edit) edit.onclick = function () { openPatientForm(id); };
    var nv = el("newVisitBtn"); if (nv) nv.onclick = function () { openVisitForm(null, id); };
    var ba = el("bookApptBtn"); if (ba) ba.onclick = function () { openApptForm(null, id); };
    bindApptRows();
    document.querySelectorAll("[data-visit]").forEach(function (row) {
      row.onclick = function (e) {
        if (e.target.closest("[data-delv]")) return;
        openVisitForm(row.dataset.visit, id);
      };
    });
    document.querySelectorAll("[data-delv]").forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        confirmDialog({ title: "Delete visit?", message: "This visit record will be permanently removed.", confirm: "Delete", danger: true }, function () {
          S.deleteVisit(b.dataset.delv);
          toast("Visit deleted");
          render();
        });
      };
    });
  }

  function openPatientForm(id) {
    var p = id ? S.getPatient(id) : null;
    var isEdit = !!p;
    var f = p || {};
    openModal(
      '<div class="modal-head"><h2>' + (isEdit ? "Edit Patient" : "Add Patient") + '</h2><button class="close-x" data-close>&times;</button></div>' +
      '<div class="modal-body"><form id="patientForm"><div class="form-grid">' +
      field("Full name *", '<input name="name" required value="' + esc(f.name || "") + '">', true) +
      field("Phone", '<input name="phone" value="' + esc(f.phone || "") + '">') +
      field("Email", '<input name="email" type="email" value="' + esc(f.email || "") + '">') +
      field("Age", '<input name="age" type="number" min="0" value="' + esc(f.age || "") + '">') +
      field("Gender", '<select name="gender"><option value="">—</option>' +
        ["Male", "Female", "Other"].map(function (g) { return '<option' + (f.gender === g ? " selected" : "") + ">" + g + "</option>"; }).join("") + "</select>") +
      field("Address", '<input name="address" value="' + esc(f.address || "") + '">', true) +
      field("Notes / medical history", '<textarea name="notes" placeholder="Conditions, allergies, observations…">' + esc(f.notes || "") + "</textarea>", true) +
      "</div></form></div>" +
      '<div class="modal-foot">' +
      (isEdit ? '<button class="btn btn-danger" id="delPatient" style="margin-right:auto">Delete</button>' : "") +
      '<button class="btn btn-outline" data-close>Cancel</button>' +
      '<button class="btn btn-primary" id="savePatient">' + (isEdit ? "Save Changes" : "Add Patient") + "</button></div>"
    );

    el("savePatient").onclick = function () {
      var form = el("patientForm");
      if (!form.name.value.trim()) { toast("Name is required", true); form.name.focus(); return; }
      var data = {
        name: form.name.value.trim(),
        phone: form.phone.value.trim(),
        email: form.email.value.trim(),
        age: form.age.value.trim(),
        gender: form.gender.value,
        address: form.address.value.trim(),
        notes: form.notes.value.trim()
      };
      if (isEdit) { S.updatePatient(id, data); toast("Patient updated"); }
      else { var rec = S.addPatient(data); toast("Patient added"); id = rec.id; }
      closeModal();
      if (viewState.selected) render(); else setView("patients", { selected: id });
    };
    var del = el("delPatient");
    if (del) del.onclick = function () {
      confirmDialog({ title: "Delete patient?", message: "This will permanently remove " + (f.name || "this patient") + " and all their visit records.", confirm: "Delete", danger: true }, function () {
        S.deletePatient(id);
        closeModal();
        toast("Patient deleted");
        setView("patients", {});
      });
    };
  }

  // ---------- Remedies ----------
  views.remedies = {
    title: function () { return "Remedies"; },
    render: function (st) {
      var q = (st && st.q) || "";
      el("topbarActions").innerHTML = '<div class="search">🔍<input id="remedySearch" placeholder="Search remedies…" value="' + esc(q) + '"></div>' +
        '<button class="btn btn-primary" id="addRemedyBtn">+ Add Remedy</button>';

      var list = S.remedies();
      if (q) {
        var lq = q.toLowerCase();
        list = list.filter(function (r) { return (r.name || "").toLowerCase().indexOf(lq) >= 0; });
      }
      list.sort(function (a, b) { return (a.name || "").localeCompare(b.name || ""); });

      if (list.length === 0) {
        return emptyState("🧪", q ? "No matching remedies" : "No remedies yet",
          q ? "Try a different search." : "Build your catalog of remedies with their cost and price.",
          q ? "" : "Add Remedy", "addRemedyEmpty");
      }

      var html = '<p class="section-sub">Your catalog. <strong>Cost</strong> is what a remedy costs you; <strong>price</strong> is what you charge. Add them to a patient visit.</p>';
      html += '<div class="card"><div class="table-wrap"><table class="data"><thead><tr><th>Remedy</th><th class="num">Cost</th><th class="num">Price</th><th class="num">Margin</th><th></th></tr></thead><tbody>';
      list.forEach(function (r) {
        var margin = (Number(r.price) || 0) - (Number(r.cost) || 0);
        html += '<tr class="row-click" data-edit="' + r.id + '">' +
          "<td><div style=\"font-weight:600\">" + esc(r.name) + "</div>" + (r.description ? '<div class="mini muted">' + esc(r.description) + "</div>" : "") + "</td>" +
          '<td class="num">' + money(r.cost) + "</td>" +
          '<td class="num">' + money(r.price) + "</td>" +
          '<td class="num" style="color:' + (margin >= 0 ? "var(--green-700)" : "var(--red)") + ';font-weight:600">' + money(margin) + "</td>" +
          '<td class="num"><button class="btn btn-outline btn-sm" data-e2="' + r.id + '">Edit</button></td>' +
          "</tr>";
      });
      html += "</tbody></table></div></div>";
      return html;
    },
    mount: function () {
      var add = el("addRemedyBtn"); if (add) add.onclick = function () { openRemedyForm(null); };
      var addE = el("addRemedyEmpty"); if (addE) addE.onclick = function () { openRemedyForm(null); };
      var search = el("remedySearch");
      if (search) {
        search.oninput = function () {
          viewState.q = search.value;
          el("content").innerHTML = views.remedies.render(viewState);
          views.remedies.mount(viewState);
          var s2 = el("remedySearch"); if (s2) { s2.focus(); s2.setSelectionRange(s2.value.length, s2.value.length); }
        };
      }
      document.querySelectorAll("[data-edit],[data-e2]").forEach(function (row) {
        row.onclick = function (e) {
          e.stopPropagation();
          openRemedyForm(row.dataset.edit || row.dataset.e2);
        };
      });
    }
  };

  function openRemedyForm(id) {
    var r = id ? S.getRemedy(id) : null;
    var isEdit = !!r;
    var f = r || {};
    openModal(
      '<div class="modal-head"><h2>' + (isEdit ? "Edit Remedy" : "Add Remedy") + '</h2><button class="close-x" data-close>&times;</button></div>' +
      '<div class="modal-body"><form id="remedyForm"><div class="form-grid">' +
      field("Remedy name *", '<input name="name" required value="' + esc(f.name || "") + '">', true) +
      field("Your cost", moneyInput("cost", f.cost)) +
      field("Price (what you charge)", moneyInput("price", f.price)) +
      field("Description", '<textarea name="description" placeholder="Ingredients, dosage, preparation…">' + esc(f.description || "") + "</textarea>", true) +
      "</div></form></div>" +
      '<div class="modal-foot">' +
      (isEdit ? '<button class="btn btn-danger" id="delRemedy" style="margin-right:auto">Delete</button>' : "") +
      '<button class="btn btn-outline" data-close>Cancel</button>' +
      '<button class="btn btn-primary" id="saveRemedy">' + (isEdit ? "Save Changes" : "Add Remedy") + "</button></div>"
    );
    el("saveRemedy").onclick = function () {
      var form = el("remedyForm");
      if (!form.name.value.trim()) { toast("Name is required", true); form.name.focus(); return; }
      var data = {
        name: form.name.value.trim(),
        cost: parseFloat(form.cost.value) || 0,
        price: parseFloat(form.price.value) || 0,
        description: form.description.value.trim()
      };
      if (isEdit) { S.updateRemedy(id, data); toast("Remedy updated"); }
      else { S.addRemedy(data); toast("Remedy added"); }
      closeModal();
      render();
    };
    var del = el("delRemedy");
    if (del) del.onclick = function () {
      confirmDialog({ title: "Delete remedy?", message: "This removes it from your catalog. Past visits that used it keep their recorded values.", confirm: "Delete", danger: true }, function () {
        S.deleteRemedy(id);
        closeModal();
        toast("Remedy deleted");
        render();
      });
    };
  }

  // ---------- Visits list ----------
  views.visits = {
    title: function () { return "Visits"; },
    render: function () {
      el("topbarActions").innerHTML = '<button class="btn btn-primary" id="addVisitBtn">+ New Visit</button>';
      var visits = S.visits().sort(function (a, b) {
        return (b.date || b.createdAt || "").localeCompare(a.date || a.createdAt || "");
      });
      if (visits.length === 0) {
        return emptyState("📋", "No visits yet", "Record a visit to add remedies and track payment.", "New Visit", "addVisitEmpty");
      }
      var html = '<div class="card"><div class="table-wrap"><table class="data"><thead><tr><th>Date</th><th>Patient</th><th>Remedies</th><th class="num">Charge</th><th class="num">Paid</th><th class="num">Balance</th><th>Status</th></tr></thead><tbody>';
      visits.forEach(function (v) {
        var p = S.getPatient(v.patientId);
        var names = (v.items || []).map(function (it) { return it.name; }).join(", ");
        html += '<tr class="row-click" data-visit="' + v.id + '">' +
          "<td>" + fmtDate(v.date || v.createdAt) + "</td>" +
          "<td>" + esc(p ? p.name : "—") + "</td>" +
          '<td style="max-width:240px" class="mini">' + (names ? esc(names) : '<span class="muted">—</span>') + "</td>" +
          '<td class="num">' + money(C.visitCharge(v)) + "</td>" +
          '<td class="num">' + money(C.visitPaid(v)) + "</td>" +
          '<td class="num">' + (C.visitBalance(v) > 0.001 ? money(C.visitBalance(v)) : '<span class="muted">—</span>') + "</td>" +
          "<td>" + statusBadge(C.visitStatus(v)) + "</td></tr>";
      });
      html += "</tbody></table></div></div>";
      return html;
    },
    mount: function () {
      var add = el("addVisitBtn"); if (add) add.onclick = function () { openVisitForm(null, null); };
      var addE = el("addVisitEmpty"); if (addE) addE.onclick = function () { openVisitForm(null, null); };
      document.querySelectorAll("[data-visit]").forEach(function (row) {
        row.onclick = function () { openVisitForm(row.dataset.visit, null); };
      });
    }
  };

  // ---------- Visit builder (the core workflow) ----------
  function openVisitForm(visitId, lockPatientId) {
    var patients = S.patients();
    if (patients.length === 0) {
      confirmDialog({ title: "Add a patient first", message: "You need at least one patient before recording a visit. Add one now?", confirm: "Add Patient" }, function () {
        openPatientForm(null);
      });
      return;
    }
    var remedies = S.remedies();
    var existing = visitId ? S.getVisit(visitId) : null;
    var isEdit = !!existing;

    // working copy of line items
    var items = existing ? JSON.parse(JSON.stringify(existing.items || [])) : [];
    var patientId = existing ? existing.patientId : (lockPatientId || patients[0].id);
    var visitDate = existing ? (existing.date || todayInput()) : todayInput();
    var amountPaid = existing ? (existing.amountPaid || 0) : 0;
    var visitNotes = existing ? (existing.notes || "") : "";
    var followUpDate = existing ? (existing.followUpDate || "") : "";

    var patientOptions = patients.map(function (p) {
      return '<option value="' + p.id + '"' + (p.id === patientId ? " selected" : "") + ">" + esc(p.name) + "</option>";
    }).join("");

    var remedyOptions = '<option value="">+ Add remedy…</option>' + remedies.map(function (r) {
      return '<option value="' + r.id + '">' + esc(r.name) + " (" + money(r.price) + ")</option>";
    }).join("");

    openModal(
      '<div class="modal-head"><h2>' + (isEdit ? "Edit Visit" : "New Visit") + '</h2><button class="close-x" data-close>&times;</button></div>' +
      '<div class="modal-body">' +
      '<div class="form-grid">' +
      field("Patient *", '<select id="vPatient"' + (lockPatientId ? " disabled" : "") + ">" + patientOptions + "</select>") +
      field("Date", '<input id="vDate" type="date" value="' + esc(visitDate) + '">') +
      "</div>" +
      '<div class="field full mt" style="margin-top:16px"><label>Remedies given</label>' +
      '<div class="field"><select id="vRemedyPick">' + remedyOptions + "</select>" +
      (remedies.length === 0 ? '<span class="hint">No remedies in your catalog yet — add some in the Remedies tab, or type a custom one below.</span>' : "") +
      '<div style="margin-top:6px"><button class="btn btn-outline btn-sm" id="vCustom">+ Custom item</button></div></div>' +
      '<div class="line-head" id="vLineHead" style="margin-top:10px"><span>Item</span><span>Qty</span><span>Price</span><span class="h-cost">Cost</span><span></span></div>' +
      '<div class="line-items" id="vItems"></div>' +
      '<div class="li-total-row"><span class="muted">Visit total (charge)</span><strong id="vCharge">' + money(0) + "</strong></div>" +
      "</div>" +
      '<div class="form-grid mt" style="margin-top:16px">' +
      field("Amount paid", moneyInput("vPaid", amountPaid)) +
      field("Balance", '<input id="vBalance" readonly style="font-weight:700" value="">') +
      "</div>" +
      '<div class="pill-row" style="margin-top:8px"><button class="btn btn-sm btn-outline" id="vPayFull">Mark fully paid</button><button class="btn btn-sm btn-outline" id="vPayNone">Clear</button></div>' +
      field("Visit notes", '<textarea id="vNotes" placeholder="Diagnosis, advice…">' + esc(visitNotes) + "</textarea>", true) +
      field("📅 Schedule a follow-up (optional)", '<input id="vFollowUp" type="date" value="' + esc(followUpDate) + '"><span class="hint">Creates a scheduled appointment for this patient.</span>', true) +
      "</div>" +
      '<div class="modal-foot">' +
      (isEdit ? '<button class="btn btn-danger" id="vDelete" style="margin-right:auto">Delete</button>' : "") +
      '<button class="btn btn-outline" data-close>Cancel</button>' +
      '<button class="btn btn-primary" id="vSave">' + (isEdit ? "Save Changes" : "Save Visit") + "</button></div>",
      true
    );

    if (lockPatientId) {
      // keep hidden actual value since disabled selects submit nothing; we track via patientId var
      el("vPatient").value = lockPatientId;
    }

    function renderItems() {
      var host = el("vItems");
      if (items.length === 0) {
        host.innerHTML = '<p class="muted mini" style="margin:4px 0">No remedies added yet. Pick from the list above.</p>';
      } else {
        host.innerHTML = items.map(function (it, i) {
          return '<div class="line-item">' +
            '<span class="li-name">' + esc(it.name) + "</span>" +
            '<input class="li-qty" data-i="' + i + '" type="number" min="1" step="1" value="' + (it.qty || 1) + '">' +
            '<div class="input-prefix"><span>' + esc(cur()) + '</span><input class="li-price" data-i="' + i + '" type="number" min="0" step="0.01" value="' + (it.unitPrice || 0) + '"></div>' +
            '<div class="input-prefix li-cost"><span>' + esc(cur()) + '</span><input class="li-cost-in" data-i="' + i + '" type="number" min="0" step="0.01" value="' + (it.unitCost || 0) + '"></div>' +
            '<button class="li-remove" data-rm="' + i + '">✕</button>' +
            "</div>";
        }).join("");
      }
      bindItemInputs();
      recalc();
    }

    function bindItemInputs() {
      document.querySelectorAll(".li-qty").forEach(function (inp) {
        inp.oninput = function () { items[+inp.dataset.i].qty = Math.max(1, parseInt(inp.value) || 1); recalc(); };
      });
      document.querySelectorAll(".li-price").forEach(function (inp) {
        inp.oninput = function () { items[+inp.dataset.i].unitPrice = parseFloat(inp.value) || 0; recalc(); };
      });
      document.querySelectorAll(".li-cost-in").forEach(function (inp) {
        inp.oninput = function () { items[+inp.dataset.i].unitCost = parseFloat(inp.value) || 0; recalc(); };
      });
      document.querySelectorAll("[data-rm]").forEach(function (b) {
        b.onclick = function () { items.splice(+b.dataset.rm, 1); renderItems(); };
      });
    }

    function recalc() {
      var charge = items.reduce(function (s, it) { return s + (Number(it.unitPrice) || 0) * (Number(it.qty) || 0); }, 0);
      el("vCharge").textContent = money(charge);
      var paid = parseFloat(el("vPaid").value) || 0;
      el("vBalance").value = money(Math.max(0, charge - paid));
    }

    el("vRemedyPick").onchange = function () {
      var rid = this.value;
      if (!rid) return;
      var r = S.getRemedy(rid);
      if (r) {
        items.push({ remedyId: r.id, name: r.name, qty: 1, unitPrice: Number(r.price) || 0, unitCost: Number(r.cost) || 0 });
        renderItems();
      }
      this.value = "";
    };

    el("vCustom").onclick = function () {
      openModal(
        '<div class="modal-head"><h2>Custom item</h2><button class="close-x" id="customCancel">&times;</button></div>' +
        '<div class="modal-body"><div class="form-grid">' +
        field("Name *", '<input id="cName" placeholder="e.g. Consultation">', true) +
        field("Price", moneyInput("cPrice", 0)) +
        field("Cost", moneyInput("cCost", 0)) +
        "</div></div>" +
        '<div class="modal-foot"><button class="btn btn-outline" id="customCancel2">Cancel</button><button class="btn btn-primary" id="customAdd">Add</button></div>'
      );
      function reopen() { closeModal(); openVisitFormRestore(); }
      // Simpler: since re-opening the big modal loses state, add directly then re-render inside.
      el("customAdd").onclick = function () {
        var name = el("cName").value.trim();
        if (!name) { toast("Name required", true); return; }
        items.push({ remedyId: null, name: name, qty: 1, unitPrice: parseFloat(el("cPrice").value) || 0, unitCost: parseFloat(el("cCost").value) || 0 });
        rebuildBig();
      };
      el("customCancel").onclick = rebuildBig;
      el("customCancel2").onclick = rebuildBig;
    };

    // Because the custom-item sub-modal replaces the main modal, rebuild the main modal preserving state.
    function rebuildBig() {
      var snapshot = {
        items: items,
        patientId: el0("vPatient", patientId),
        date: el0("vDate", visitDate),
        paid: el0("vPaid", amountPaid),
        notes: el0("vNotes", visitNotes),
        followUp: el0("vFollowUp", followUpDate)
      };
      closeModal();
      reopenVisit(visitId, lockPatientId, snapshot);
    }
    function el0(id, fallback) { var e = el(id); return e ? e.value : fallback; }

    el("vPaid").oninput = recalc;
    el("vPayFull").onclick = function () {
      var charge = items.reduce(function (s, it) { return s + (Number(it.unitPrice) || 0) * (Number(it.qty) || 0); }, 0);
      el("vPaid").value = charge.toFixed(2);
      recalc();
    };
    el("vPayNone").onclick = function () { el("vPaid").value = "0"; recalc(); };

    el("vSave").onclick = function () {
      var pid = lockPatientId || el("vPatient").value;
      if (!pid) { toast("Select a patient", true); return; }
      if (items.length === 0) {
        confirmDialog({ title: "Save empty visit?", message: "This visit has no remedies. Save it anyway?", confirm: "Save" }, doSave);
      } else { doSave(); }
      function doSave() {
        var fuDate = el("vFollowUp").value || "";
        var prevApptId = existing ? existing.followUpApptId : null;
        var followUpApptId = prevApptId || null;

        var data = {
          patientId: pid,
          date: el("vDate").value || todayInput(),
          items: items,
          amountPaid: parseFloat(el("vPaid").value) || 0,
          notes: el("vNotes").value.trim(),
          followUpDate: fuDate
        };

        // reconcile the linked follow-up appointment
        if (fuDate) {
          if (prevApptId && S.getAppointment(prevApptId)) {
            S.updateAppointment(prevApptId, { patientId: pid, date: fuDate });
          } else {
            var appt = S.addAppointment({ patientId: pid, date: fuDate, reason: "Follow-up visit", status: "scheduled" });
            followUpApptId = appt.id;
          }
        } else if (prevApptId && S.getAppointment(prevApptId)) {
          // follow-up cleared -> remove the appointment we created
          S.deleteAppointment(prevApptId);
          followUpApptId = null;
        }
        data.followUpApptId = followUpApptId;

        if (isEdit) { S.updateVisit(visitId, data); toast(fuDate ? "Visit saved · follow-up booked" : "Visit updated"); }
        else { S.addVisit(data); toast(fuDate ? "Visit saved · follow-up booked" : "Visit saved"); }
        closeModal();
        render();
      }
    };

    var del = el("vDelete");
    if (del) del.onclick = function () {
      confirmDialog({ title: "Delete visit?", message: "This visit record will be permanently removed.", confirm: "Delete", danger: true }, function () {
        S.deleteVisit(visitId);
        closeModal();
        toast("Visit deleted");
        render();
      });
    };

    // initial paint + restore snapshot if provided
    if (openVisitForm._restore) {
      var snap = openVisitForm._restore;
      openVisitForm._restore = null;
      items = snap.items;
      renderItems();
      if (el("vPatient") && !lockPatientId) el("vPatient").value = snap.patientId;
      if (el("vDate")) el("vDate").value = snap.date;
      if (el("vPaid")) el("vPaid").value = snap.paid;
      if (el("vNotes")) el("vNotes").value = snap.notes;
      if (el("vFollowUp")) el("vFollowUp").value = snap.followUp || "";
      recalc();
    } else {
      renderItems();
    }
  }

  function reopenVisit(visitId, lockPatientId, snapshot) {
    openVisitForm._restore = snapshot;
    openVisitForm(visitId, lockPatientId);
  }

  // ---------- Appointments ----------
  views.appointments = {
    title: function () { return "Appointments"; },
    render: function () {
      el("topbarActions").innerHTML = '<button class="btn btn-primary" id="addApptBtn">+ New Appointment</button>';
      var appts = S.appointments();
      if (appts.length === 0) {
        return emptyState("📅", "No appointments yet", "Schedule a patient appointment or follow-up to keep track of who's coming in.", "New Appointment", "addApptEmpty");
      }
      var upcoming = appts.filter(function (a) { return a.status === "scheduled" && dayDiff(a.date) >= 0; })
        .sort(function (a, b) { return apptSortKey(a).localeCompare(apptSortKey(b)); });
      var overdue = appts.filter(function (a) { return a.status === "scheduled" && dayDiff(a.date) < 0; })
        .sort(function (a, b) { return apptSortKey(b).localeCompare(apptSortKey(a)); });
      var past = appts.filter(function (a) { return a.status !== "scheduled"; })
        .sort(function (a, b) { return apptSortKey(b).localeCompare(apptSortKey(a)); });

      var html = "";
      if (overdue.length) html += apptCard("⚠️ Overdue / Missed", overdue, true);
      html += apptCard("Upcoming", upcoming, false, "No upcoming appointments.");
      if (past.length) html += apptCard("Past & Cancelled", past.slice(0, 30), false);
      return html;
    },
    mount: function () {
      var add = el("addApptBtn"); if (add) add.onclick = function () { openApptForm(null, null); };
      var addE = el("addApptEmpty"); if (addE) addE.onclick = function () { openApptForm(null, null); };
      bindApptRows();
    }
  };

  function apptCard(title, list, warn, emptyMsg) {
    var html = '<div class="card"><div class="card-head"><h2>' + esc(title) + " (" + list.length + ')</h2></div>';
    if (list.length === 0) {
      html += '<div class="card-body"><p class="muted" style="margin:0">' + esc(emptyMsg || "Nothing here.") + "</p></div></div>";
      return html;
    }
    html += '<div class="table-wrap"><table class="data"><thead><tr><th>When</th><th>Patient</th><th>Reason</th><th>Status</th><th></th></tr></thead><tbody>';
    list.forEach(function (a) {
      var p = S.getPatient(a.patientId);
      html += '<tr class="row-click" data-appt="' + a.id + '">' +
        "<td><div style=\"font-weight:600\">" + esc(relDay(a.date)) + (a.time ? " · " + esc(fmtTime(a.time)) : "") + "</div>" +
        '<div class="mini muted">' + fmtDate(a.date) + "</div></td>" +
        "<td>" + esc(p ? p.name : "—") + "</td>" +
        '<td class="mini">' + (a.reason ? esc(a.reason) : '<span class="muted">—</span>') + "</td>" +
        "<td>" + apptStatusBadge(a) + "</td>" +
        '<td class="num" style="white-space:nowrap">' +
        (a.status === "scheduled" ? '<button class="btn btn-outline btn-sm" data-done="' + a.id + '">✓ Done</button> ' : "") +
        '<button class="btn btn-outline btn-sm" data-delappt="' + a.id + '">✕</button></td>' +
        "</tr>";
    });
    html += "</tbody></table></div></div>";
    return html;
  }

  function bindApptRows() {
    document.querySelectorAll("[data-appt]").forEach(function (row) {
      row.onclick = function (e) {
        if (e.target.closest("[data-done]") || e.target.closest("[data-delappt]")) return;
        openApptForm(row.dataset.appt, null);
      };
    });
    document.querySelectorAll("[data-done]").forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        S.updateAppointment(b.dataset.done, { status: "completed" });
        toast("Marked completed");
        render();
      };
    });
    document.querySelectorAll("[data-delappt]").forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        confirmDialog({ title: "Delete appointment?", message: "This appointment will be removed.", confirm: "Delete", danger: true }, function () {
          S.deleteAppointment(b.dataset.delappt);
          toast("Appointment deleted");
          render();
        });
      };
    });
  }

  function openApptForm(id, lockPatientId) {
    var patients = S.patients();
    if (patients.length === 0) {
      confirmDialog({ title: "Add a patient first", message: "You need at least one patient before booking an appointment. Add one now?", confirm: "Add Patient" }, function () {
        openPatientForm(null);
      });
      return;
    }
    var a = id ? S.getAppointment(id) : null;
    var isEdit = !!a;
    var f = a || {};
    var pid = f.patientId || lockPatientId || patients[0].id;
    var patientOptions = patients.map(function (p) {
      return '<option value="' + p.id + '"' + (p.id === pid ? " selected" : "") + ">" + esc(p.name) + "</option>";
    }).join("");
    var statuses = [["scheduled", "Scheduled"], ["completed", "Completed"], ["cancelled", "Cancelled"]];

    openModal(
      '<div class="modal-head"><h2>' + (isEdit ? "Edit Appointment" : "New Appointment") + '</h2><button class="close-x" data-close>&times;</button></div>' +
      '<div class="modal-body"><div class="form-grid">' +
      field("Patient *", '<select id="aPatient">' + patientOptions + "</select>") +
      field("Status", '<select id="aStatus">' + statuses.map(function (s) { return '<option value="' + s[0] + '"' + (f.status === s[0] ? " selected" : "") + ">" + s[1] + "</option>"; }).join("") + "</select>") +
      field("Date *", '<input id="aDate" type="date" value="' + esc(f.date || todayStr()) + '">') +
      field("Time", '<input id="aTime" type="time" value="' + esc(f.time || "") + '">') +
      field("Reason", '<input id="aReason" placeholder="e.g. Follow-up, new consultation" value="' + esc(f.reason || "") + '">', true) +
      field("Notes", '<textarea id="aNotes" placeholder="Anything to remember for this appointment…">' + esc(f.notes || "") + "</textarea>", true) +
      "</div></div>" +
      '<div class="modal-foot">' +
      (isEdit ? '<button class="btn btn-danger" id="aDelete" style="margin-right:auto">Delete</button>' : "") +
      '<button class="btn btn-outline" data-close>Cancel</button>' +
      '<button class="btn btn-primary" id="aSave">' + (isEdit ? "Save Changes" : "Book Appointment") + "</button></div>"
    );

    el("aSave").onclick = function () {
      var date = el("aDate").value;
      if (!date) { toast("Date is required", true); return; }
      var data = {
        patientId: el("aPatient").value,
        status: el("aStatus").value,
        date: date,
        time: el("aTime").value,
        reason: el("aReason").value.trim(),
        notes: el("aNotes").value.trim()
      };
      if (isEdit) { S.updateAppointment(id, data); toast("Appointment updated"); }
      else { S.addAppointment(data); toast("Appointment booked"); }
      closeModal();
      render();
    };
    var del = el("aDelete");
    if (del) del.onclick = function () {
      confirmDialog({ title: "Delete appointment?", message: "This appointment will be removed.", confirm: "Delete", danger: true }, function () {
        S.deleteAppointment(id);
        closeModal();
        toast("Appointment deleted");
        render();
      });
    };
  }

  // ---------- Settings ----------
  views.settings = {
    title: function () { return "Settings"; },
    render: function () {
      var s = S.settings();
      var currencies = ["$", "€", "£", "₦", "₹", "R", "KSh", "GH₵", "CFA", "¥", "﷼"];
      var html = '<div class="card" style="max-width:560px"><div class="card-head"><h2>Practice Settings</h2></div><div class="card-body">' +
        '<form id="settingsForm"><div class="form-grid">' +
        field("Practice / clinic name", '<input name="clinicName" value="' + esc(s.clinicName || "") + '">', true) +
        field("Currency symbol",
          '<select name="currency">' + currencies.map(function (c) { return '<option' + (s.currency === c ? " selected" : "") + ">" + c + "</option>"; }).join("") +
          '<option value="__custom">Custom…</option></select>') +
        field("Custom symbol", '<input name="currencyCustom" placeholder="Type a symbol" value="">') +
        "</div></form>" +
        '<div style="margin-top:16px"><button class="btn btn-primary" id="saveSettings">Save Settings</button></div>' +
        "</div></div>";

      html += '<div class="card" style="max-width:560px"><div class="card-head"><h2>Data & Backup</h2></div><div class="card-body">' +
        '<p class="mini muted" style="margin:0 0 14px;line-height:1.5">Your data is stored in this browser on this device. <strong>Back up regularly</strong> and keep the file safe — clearing browser data or switching devices will otherwise lose your records.</p>' +
        '<div class="pill-row"><button class="btn btn-primary" id="setBackup">⬇ Download Backup</button>' +
        '<button class="btn btn-outline" id="setRestore">⬆ Restore from File</button>' +
        '<button class="btn btn-danger" id="setReset">Reset All Data</button></div>' +
        '<input type="file" id="setRestoreFile" accept="application/json" hidden>' +
        "</div></div>";
      return html;
    },
    mount: function () {
      var form = el("settingsForm");
      var sel = form.currency, custom = form.currencyCustom;
      function syncCustom() { custom.closest(".field").style.display = sel.value === "__custom" ? "" : "none"; }
      sel.onchange = syncCustom; syncCustom();

      el("saveSettings").onclick = function () {
        var currency = sel.value === "__custom" ? (custom.value.trim() || "$") : sel.value;
        S.saveSettings({ clinicName: form.clinicName.value.trim() || "HerbHub", currency: currency });
        el("clinicName").textContent = S.settings().clinicName;
        toast("Settings saved");
        render();
      };
      el("setBackup").onclick = doBackup;
      el("setRestore").onclick = function () { el("setRestoreFile").click(); };
      el("setRestoreFile").onchange = function (e) { handleRestore(e.target.files[0]); };
      el("setReset").onclick = function () {
        confirmDialog({ title: "Reset everything?", message: "This permanently deletes ALL patients, remedies and visits. Download a backup first if unsure.", confirm: "Delete Everything", danger: true }, function () {
          S.reset();
          el("clinicName").textContent = S.settings().clinicName;
          toast("All data reset");
          setView("dashboard");
        });
      };
    }
  };

  // ---------- shared UI builders ----------
  function field(label, inner, full) {
    return '<div class="field' + (full ? " full" : "") + '"><label>' + esc(label) + "</label>" + inner + "</div>";
  }
  function moneyInput(name, val) {
    return '<div class="input-prefix"><span>' + esc(cur()) + '</span><input name="' + name + '" id="' + name + '" type="number" min="0" step="0.01" value="' + (val != null && val !== "" ? val : "") + '" placeholder="0.00"></div>';
  }
  function emptyState(emoji, title, msg, btnLabel, btnId) {
    return '<div class="card"><div class="empty"><span class="emoji">' + emoji + "</span><h3>" + esc(title) + "</h3><p>" + esc(msg) + "</p>" +
      (btnLabel ? '<button class="btn btn-primary" id="' + btnId + '">+ ' + esc(btnLabel) + "</button>" : "") + "</div></div>";
  }

  // ---------- backup / restore ----------
  function doBackup() {
    var json = S.exportJSON();
    var blob = new Blob([json], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    var d = new Date();
    a.href = url;
    a.download = "herbhub-backup-" + d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0") + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast("Backup downloaded");
  }
  function handleRestore(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var json = reader.result;
        confirmDialog({ title: "Restore backup?", message: "This replaces all current data with the contents of the file. This cannot be undone.", confirm: "Restore", danger: true }, function () {
          try {
            S.importJSON(json);
            el("clinicName").textContent = S.settings().clinicName;
            toast("Data restored");
            setView("dashboard");
          } catch (err) { toast(err.message || "Restore failed", true); }
        });
      } catch (err) { toast("Could not read file", true); }
    };
    reader.readAsText(file);
  }

  // ---------- sidebar (mobile) ----------
  function closeSidebar() { el("sidebar").classList.remove("open"); var s = $(".scrim"); if (s) s.classList.remove("show"); }
  el("menuToggle").onclick = function () {
    var sb = el("sidebar");
    sb.classList.toggle("open");
    var scrim = $(".scrim");
    if (!scrim) { scrim = document.createElement("div"); scrim.className = "scrim"; document.body.appendChild(scrim); scrim.onclick = closeSidebar; }
    scrim.classList.toggle("show", sb.classList.contains("open"));
  };

  // ---------- wire nav + global buttons ----------
  document.querySelectorAll(".nav-item").forEach(function (b) {
    b.onclick = function () { setView(b.dataset.view); };
  });
  el("backupBtn").onclick = doBackup;
  el("restoreBtn").onclick = function () { el("restoreFile").click(); };
  el("restoreFile").onchange = function (e) { handleRestore(e.target.files[0]); };

  // ---------- init ----------
  el("clinicName").textContent = S.settings().clinicName || "HerbHub";
  setView("dashboard");
})();
