// ================================
// Étude biblique — Frontend
// Data source: plan.json (GitHub Pages friendly)
// ================================

const PLAN_URL = "./plan.json";
const THEME_KEY = "eb_theme_v1";

function countParagraphsText(text){
  let t = (text ?? "").toString();
  t = t.replace(/[§]/g, "");      // enlève §
  t = t.replace(/[–—]/g, "-");    // remplace tirets longs par "-"
  t = t.replace(/\s+/g, " ").trim();

  let count = 0;

  // Compte les plages: 1-3 => 3 paragraphes
  const rangeRe = /(\d+)\s*-\s*(\d+)/g;
  t = t.replace(rangeRe, (_, a, b) => {
    const A = Number(a), B = Number(b);
    count += Math.abs(B - A) + 1;
    return " "; // retire la plage du texte pour éviter double comptage
  });

  // Compte les nombres restants: "6, 15" => 2
  const nums = t.match(/\d+/g);
  if (nums) count += nums.length;

  return count;
}




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

function parseISO(iso){
  return new Date(iso + "T00:00:00");
}

function formatLong(iso, tz){
  // prefer user's browser locale FR; tz optional for future extension
  const d = parseISO(iso);
  return new Intl.DateTimeFormat("fr-FR", { weekday:"long", year:"numeric", month:"long", day:"numeric" }).format(d);
}

function startOfWeekISO(dateISO){
  const d = parseISO(dateISO);
  const day = (d.getDay() + 6) % 7; // monday=0
  d.setDate(d.getDate() - day);
  return toISODateLocal(d);
}

function addDaysISO(dateISO, n){
  const d = parseISO(dateISO);
  d.setDate(d.getDate() + n);
  return toISODateLocal(d);
}

async function loadPlan(){
  const res = await fetch(PLAN_URL, { cache: "no-store" });
  if(!res.ok) throw new Error("Impossible de charger plan.json");
  return res.json();
}

function memberName(plan, id){
  return plan.members.find(m => m.id === id)?.name ?? "—";
}

function normalize(s){
  return (s ?? "").toString().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"");
}

function filterEntries(entries, plan, memberId, q){
  let out = entries || [];
  if(memberId && memberId !== "all"){
    out = out.filter(e => e.memberId === memberId);
  }
  const query = normalize(q);
  if(query){
    out = out.filter(e => {
      const name = normalize(memberName(plan, e.memberId));
      const text = normalize(e.text);
      return name.includes(query) || text.includes(query);
    });
  }
  return out;
}

function computeCounts(day, plan, memberId, q){
  const s = day?.sections || {};
  const pEntries = filterEntries(s.paragraphs, plan, memberId, q);
  const vEntries = filterEntries(s.verses, plan, memberId, q);
  const rEntries = filterEntries(s.review, plan, memberId, q);

  const paragraphs = pEntries.reduce((sum, e) => sum + countParagraphsText(e.text), 0);

  // Pour versets/révision, on garde le nombre d’entrées (souvent du texte, pas des numéros)
  const verses = vEntries.length;
  const review = rEntries.length;

  return { paragraphs, verses, review };
}


function renderChips(day){
  const root = $("chips");
  root.innerHTML = "";
  if(!day) return;
  const parts = [];
  if(day.study?.workTitle) parts.push({ k:"Étude", v: day.study.workTitle });
  if(day.study?.chapterOrTheme) parts.push({ k:"Thème", v: day.study.chapterOrTheme });
  if(day.notes) parts.push({ k:"Note", v: day.notes });

  for(const p of parts){
    const div = document.createElement("div");
    div.className = "chip";
    div.innerHTML = `<span class="muted">${p.k}:</span> <strong>${escapeHtml(p.v)}</strong>`;
    root.appendChild(div);
  }
}

function escapeHtml(s){
  return (s ?? "").toString()
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function sectionBlock({ title, badgeClass, itemClass, entries, plan }){
  if(!entries || entries.length === 0){
    return `
      <div class="section">
        <div class="section__title">
          <div class="badge ${badgeClass}"><span class="dot"></span>${escapeHtml(title)}</div>
          <div class="muted">0</div>
        </div>
        <div class="muted">Aucune attribution.</div>
      </div>
    `;
  }

  const cards = entries.map(e => `
    <div class="item ${itemClass}">
      <div class="itemTop">
        <div class="who">${escapeHtml(memberName(plan, e.memberId))}</div>
        <div class="small muted">—</div>
      </div>
      <div class="contentText">${escapeHtml(e.text)}</div>
    </div>
  `).join("");

  return `
    <div class="section">
      <div class="section__title">
        <div class="badge ${badgeClass}"><span class="dot"></span>${escapeHtml(title)}</div>
        <div class="muted">${entries.length}</div>
      </div>
      <div class="cardgrid">${cards}</div>
    </div>
  `;
}

function renderDay(plan, dateISO){
  const day = plan.assignments.find(a => a.date === dateISO) || null;
  const memberId = $("memberSelect").value;
  const q = $("searchInput").value;

  $("viewTitle").textContent = day ? (day.title || formatLong(dateISO, plan.timezone)) : formatLong(dateISO, plan.timezone);
  $("subtitle").textContent = day ? "Lecture du jour" : "Aucune donnée pour cette date (ajoutez dans Admin)";

  const counts = computeCounts(day, plan, memberId, q);
  $("countParagraphs").textContent = counts.paragraphs;
  $("countVerses").textContent = counts.verses;
  $("countReview").textContent = counts.review;

  renderChips(day);

  const s = day?.sections || {};
  const paragraphs = filterEntries(s.paragraphs, plan, memberId, q);
  const verses = filterEntries(s.verses, plan, memberId, q);
  const review = filterEntries(s.review, plan, memberId, q);

  const html = [
    sectionBlock({ title:"Paragraphes à lire", badgeClass:"", itemClass:"", entries: paragraphs, plan }),
    sectionBlock({ title:"Versets bibliques", badgeClass:"blue", itemClass:"blue", entries: verses, plan }),
    sectionBlock({ title:"Réponses aux questions de révision", badgeClass:"pink", itemClass:"pink", entries: review, plan })
  ].join("");

  $("content").innerHTML = html;
}

function renderWeek(plan, dateISO){
  const w0 = startOfWeekISO(dateISO);
  const memberId = $("memberSelect").value;
  const q = $("searchInput").value;

  $("viewTitle").textContent = `Semaine du ${formatLong(w0, plan.timezone)}`;
  $("subtitle").textContent = "Vue compacte par jour (défilement horizontal si nécessaire)";

  // counts over the week
  let totalP=0, totalV=0, totalR=0;
  for(let i=0;i<7;i++){
    const d = addDaysISO(w0, i);
    const day = plan.assignments.find(a => a.date === d) || null;
    const c = computeCounts(day, plan, memberId, q);
    totalP += c.paragraphs; totalV += c.verses; totalR += c.review;
  }
  $("countParagraphs").textContent = totalP;
  $("countVerses").textContent = totalV;
  $("countReview").textContent = totalR;
  renderChips(null);

  const blocks = [];
  for(let i=0;i<7;i++){
    const dISO = addDaysISO(w0, i);
    const day = plan.assignments.find(a => a.date === dISO) || null;

    const title = day?.title || new Intl.DateTimeFormat("fr-FR",{weekday:"long"}).format(parseISO(dISO));
    const s = day?.sections || {};
    const paragraphs = filterEntries(s.paragraphs, plan, memberId, q);
    const verses = filterEntries(s.verses, plan, memberId, q);
    const review = filterEntries(s.review, plan, memberId, q);

    const minis = [];
    const pushMini = (label, cls, arr) => {
      if(arr.length === 0) return;
      // show up to 3, then +N
      const shown = arr.slice(0,3);
      const more = arr.length - shown.length;
      const content = shown.map(e => `
        <div class="weekMini">
          <div class="row" style="justify-content:space-between;">
            <div class="who">${escapeHtml(memberName(plan, e.memberId))}</div>
            <div class="badge ${cls}" style="padding:4px 8px;"><span class="dot"></span>${escapeHtml(label)}</div>
          </div>
          <div class="contentText">${escapeHtml(e.text)}</div>
        </div>
      `).join("") + (more>0 ? `<div class="small muted" style="margin-top:8px;">+ ${more} autre(s)</div>` : "");
      minis.push(content);
    };

    pushMini("Paragraphes", "", paragraphs);
    pushMini("Versets", "blue", verses);
    pushMini("Révision", "pink", review);

    blocks.push(`
      <div class="weekDay">
        <div class="weekDayHeader">
          <strong>${escapeHtml(dISO)}</strong>
          <span class="muted">${escapeHtml(title)}</span>
        </div>
        ${minis.length ? minis.join("") : `<div class="muted">Aucune attribution</div>`}
      </div>
    `);
  }

  $("content").innerHTML = `<div class="weekGrid">${blocks.join("")}</div>`;
}

function populateMembers(plan){
  const sel = $("memberSelect");
  sel.innerHTML = "";
  const all = document.createElement("option");
  all.value = "all";
  all.textContent = "Tout le monde";
  sel.appendChild(all);

  for(const m of plan.members){
    const o = document.createElement("option");
    o.value = m.id;
    o.textContent = m.name;
    sel.appendChild(o);
  }
}

function refresh(plan){
  const mode = $("viewMode").value;
  const dateISO = $("dateInput").value;
  if(mode === "week") renderWeek(plan, dateISO);
  else renderDay(plan, dateISO);
}

function initEvents(plan){
  $("printBtn").addEventListener("click", () => window.print());
  $("themeBtn").addEventListener("click", toggleTheme);
  $("todayBtn").addEventListener("click", () => {
    $("dateInput").value = toISODateLocal(new Date());
    refresh(plan);
  });

  ["dateInput","viewMode","memberSelect","searchInput"].forEach(id => {
    $(id).addEventListener("input", () => refresh(plan));
    $(id).addEventListener("change", () => refresh(plan));
  });
}

(async function main(){
  initTheme();

  const plan = await loadPlan();
  $("appTitle").textContent = plan.familyName || "Étude biblique";
  $("todayLine").textContent = `Aujourd’hui: ${formatLong(toISODateLocal(new Date()), plan.timezone)}`;

  populateMembers(plan);

  const today = toISODateLocal(new Date());
  $("dateInput").value = today;

  initEvents(plan);
  refresh(plan);
})().catch(err => {
  document.body.innerHTML = `
    <div style="padding:24px;font-family:system-ui;">
      <h1>Erreur</h1>
      <p>${escapeHtml(err.message)}</p>
      <p style="opacity:.7">Vérifiez que <code>plan.json</code> est bien à la racine du site.</p>
    </div>
  `;
});
