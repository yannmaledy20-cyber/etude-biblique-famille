// ================================
// Étude biblique — Admin (local only)
// Saves to localStorage; export to plan.json for GitHub update.
// ================================

const STORAGE_KEY = "eb_plan_local_v1";
const PLAN_URL = "./plan.json";
const THEME_KEY = "eb_theme_v1";

function $(id){ return document.getElementById(id); }

function setTheme(theme){
  const root = document.documentElement;
  if(theme === "light") root.setAttribute("data-theme", "light");
  else if(theme === "dark") root.setAttribute("data-theme", "dark");
  else root.removeAttribute("data-theme");
  localStorage.setItem(THEME_KEY, theme);
}
function initTheme(){
  const saved = localStorage.getItem(THEME_KEY);
  if(saved) setTheme(saved);
}
function toggleTheme(){
  const root = document.documentElement;
  const current = root.getAttribute("data-theme") || "dark";
  setTheme(current === "dark" ? "light" : "dark");
}

function pad(n){ return String(n).padStart(2, "0"); }
function toISODateLocal(d = new Date()){
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function uid(prefix="id"){
  return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

async function loadDefaultPlan(){
  const res = await fetch(PLAN_URL, { cache: "no-store" });
  if(!res.ok) throw new Error("Impossible de charger plan.json");
  return res.json();
}

function loadLocalPlan(){
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

function saveLocalPlan(plan){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plan, null, 2));
}

function ensureDay(plan, dateISO){
  let day = plan.assignments.find(a => a.date === dateISO);
  if(!day){
    day = {
      date: dateISO,
      title: "",
      study: { workTitle: "", chapterOrTheme: "" },
      sections: { paragraphs: [], verses: [], review: [] },
      notes: ""
    };
    plan.assignments.push(day);
    plan.assignments.sort((a,b) => a.date.localeCompare(b.date));
  }
  day.sections ||= { paragraphs: [], verses: [], review: [] };
  day.sections.paragraphs ||= [];
  day.sections.verses ||= [];
  day.sections.review ||= [];
  day.study ||= { workTitle:"", chapterOrTheme:"" };
  return day;
}

function renderMembers(plan){
  const root = $("membersList");
  root.innerHTML = "";

  if(plan.members.length === 0){
    root.innerHTML = `<div class="muted">Aucun membre.</div>`;
    return;
  }

  for(const m of plan.members){
    const row = document.createElement("div");
    row.className = "listRow";
    row.innerHTML = `
      <div>
        <div style="font-weight:800">${escapeHtml(m.name)}</div>
        <div class="muted" style="font-family:var(--mono);font-size:12px">${escapeHtml(m.id)}</div>
      </div>
      <div class="row">
        <button class="btn ghost" data-action="rename" data-id="${escapeHtml(m.id)}">Renommer</button>
        <button class="btn danger" data-action="delete" data-id="${escapeHtml(m.id)}">Supprimer</button>
      </div>
    `;
    root.appendChild(row);
  }

  root.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const action = btn.getAttribute("data-action");

      if(action === "rename"){
        const current = plan.members.find(x => x.id === id)?.name || "";
        const next = prompt("Nouveau nom :", current);
        if(!next) return;
        plan.members = plan.members.map(x => x.id === id ? ({...x, name: next.trim()}) : x);
        // Also refresh selects
        saveLocalPlan(plan);
        refreshAll(plan);
      }

      if(action === "delete"){
        if(!confirm("Supprimer ce membre ? Les attributions associées seront retirées.")) return;
        plan.members = plan.members.filter(x => x.id !== id);
        for(const day of plan.assignments){
          day.sections.paragraphs = (day.sections.paragraphs || []).filter(e => e.memberId !== id);
          day.sections.verses = (day.sections.verses || []).filter(e => e.memberId !== id);
          day.sections.review = (day.sections.review || []).filter(e => e.memberId !== id);
        }
        saveLocalPlan(plan);
        refreshAll(plan);
      }
    });
  });
}

function fillMemberSelects(plan){
  const sel = $("memberPick");
  sel.innerHTML = "";
  for(const m of plan.members){
    const o = document.createElement("option");
    o.value = m.id;
    o.textContent = m.name;
    sel.appendChild(o);
  }
}

function renderDayEditor(plan){
  const dateISO = $("datePick").value;
  const day = ensureDay(plan, dateISO);

  $("dayTitle").value = day.title || "";
  $("workTitle").value = day.study?.workTitle || "";
  $("theme").value = day.study?.chapterOrTheme || "";

  const root = $("dayItems");
  root.innerHTML = "";

  const sections = [
    { key:"paragraphs", label:"Paragraphes", badge:"" },
    { key:"verses", label:"Versets bibliques", badge:"blue" },
    { key:"review", label:"Révision", badge:"pink" }
  ];

  for(const s of sections){
    const entries = day.sections[s.key] || [];
    const wrapper = document.createElement("div");
    wrapper.className = "section";
    wrapper.innerHTML = `
      <div class="section__title">
        <div class="badge ${s.badge}"><span class="dot"></span>${escapeHtml(s.label)}</div>
        <div class="muted">${entries.length}</div>
      </div>
      <div class="list" id="list_${s.key}"></div>
    `;
    root.appendChild(wrapper);

    const list = wrapper.querySelector(`#list_${s.key}`);
    if(entries.length === 0){
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "Aucune entrée";
      list.appendChild(empty);
    } else {
      entries.forEach((e, idx) => {
        const row = document.createElement("div");
        row.className = "listRow";
        row.innerHTML = `
          <div>
            <div style="font-weight:800">${escapeHtml(memberName(plan, e.memberId))}</div>
            <div class="muted" style="font-family:var(--mono);font-size:12px">${escapeHtml(e.text)}</div>
          </div>
          <div class="row">
            <button class="btn ghost" data-action="edit" data-s="${s.key}" data-i="${idx}">Modifier</button>
            <button class="btn danger" data-action="del" data-s="${s.key}" data-i="${idx}">Supprimer</button>
          </div>
        `;
        list.appendChild(row);
      });
    }
  }

  root.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      const action = btn.getAttribute("data-action");
      const sKey = btn.getAttribute("data-s");
      const idx = Number(btn.getAttribute("data-i"));
      const entries = day.sections[sKey] || [];

      if(action === "del"){
        if(!confirm("Supprimer cette entrée ?")) return;
        entries.splice(idx, 1);
        day.sections[sKey] = entries;
        saveLocalPlan(plan);
        renderDayEditor(plan);
      }

      if(action === "edit"){
        const e = entries[idx];
        const newText = prompt("Nouveau contenu :", e.text || "");
        if(!newText) return;
        e.text = newText.trim();
        saveLocalPlan(plan);
        renderDayEditor(plan);
      }
    });
  });
}

function memberName(plan, id){
  return plan.members.find(m => m.id === id)?.name ?? "—";
}

function escapeHtml(s){
  return (s ?? "").toString()
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function bindEvents(plan){
  $("themeBtn").addEventListener("click", toggleTheme);

  $("addMemberBtn").addEventListener("click", () => {
    const name = $("newMemberName").value.trim();
    if(!name) return alert("Entrez un nom.");
    const id = uid("m");
    plan.members.push({ id, name });
    $("newMemberName").value = "";
    saveLocalPlan(plan);
    refreshAll(plan);
  });

  $("saveMetaBtn").addEventListener("click", () => {
    plan.familyName = $("familyName").value.trim() || plan.familyName;
    plan.timezone = $("timezone").value.trim() || plan.timezone;
    saveLocalPlan(plan);
    alert("Enregistré localement.");
  });

  ["datePick"].forEach(id => {
    $(id).addEventListener("change", () => {
      ensureDay(plan, $("datePick").value);
      saveLocalPlan(plan);
      renderDayEditor(plan);
    });
  });

  ["dayTitle","workTitle","theme"].forEach(id => {
    $(id).addEventListener("input", () => {
      const day = ensureDay(plan, $("datePick").value);
      day.title = $("dayTitle").value;
      day.study = day.study || {};
      day.study.workTitle = $("workTitle").value;
      day.study.chapterOrTheme = $("theme").value;
      saveLocalPlan(plan);
    });
  });

  $("addItemBtn").addEventListener("click", () => {
    if(plan.members.length === 0) return alert("Ajoutez d’abord des membres.");
    const day = ensureDay(plan, $("datePick").value);
    const sKey = $("sectionPick").value;
    const memberId = $("memberPick").value;
    const text = $("textPick").value.trim();
    if(!text) return alert("Entrez le contenu (paragraphes/versets/révision).");

    day.sections[sKey].push({ memberId, text });
    $("textPick").value = "";
    saveLocalPlan(plan);
    renderDayEditor(plan);
  });

  $("downloadBtn").addEventListener("click", () => downloadJSON(plan, "plan.json"));

  $("uploadInput").addEventListener("change", async (ev) => {
    const file = ev.target.files?.[0];
    if(!file) return;
    try{
      const txt = await file.text();
      const obj = JSON.parse(txt);
      validatePlan(obj);
      plan = obj; // replace local reference
      saveLocalPlan(plan);
      refreshAll(plan);
      alert("Import réussi.");
    } catch(e){
      alert("Import échoué: " + e.message);
    } finally {
      ev.target.value = "";
    }
  });

  $("resetBtn").addEventListener("click", async () => {
    if(!confirm("Réinitialiser les données locales ?")) return;
    localStorage.removeItem(STORAGE_KEY);
    const fresh = await loadDefaultPlan();
    saveLocalPlan(fresh);
    refreshAll(fresh);
  });
}

function validatePlan(p){
  if(!p || typeof p !== "object") throw new Error("JSON invalide");
  if(!Array.isArray(p.members)) throw new Error("members manquant");
  if(!Array.isArray(p.assignments)) throw new Error("assignments manquant");
}

function downloadJSON(obj, filename){
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function refreshAll(plan){
  $("familyName").value = plan.familyName || "";
  $("timezone").value = plan.timezone || "";
  renderMembers(plan);
  fillMemberSelects(plan);
  $("datePick").value = $("datePick").value || toISODateLocal(new Date());
  ensureDay(plan, $("datePick").value);
  renderDayEditor(plan);
}

(async function main(){
  initTheme();

  let plan = loadLocalPlan();
  if(!plan){
    plan = await loadDefaultPlan();
    saveLocalPlan(plan);
  }

  $("datePick").value = toISODateLocal(new Date());
  refreshAll(plan);
  bindEvents(plan);
})().catch(err => {
  document.body.innerHTML = `
    <div style="padding:24px;font-family:system-ui;">
      <h1>Erreur</h1>
      <p>${escapeHtml(err.message)}</p>
    </div>
  `;
});
