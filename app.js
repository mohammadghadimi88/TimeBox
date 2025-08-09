/* app.js - TimeBox MVP
   - Local storage for guests
   - Firebase auth + Firestore optional (configure in index.html)
   - Google Calendar sync via gapi (client id needed)
*/
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/* ---------- config ---------- */
const FB_CONFIG = window.__FIREBASE_CONFIG__ || {};
const GOOGLE_CLIENT_ID = window.__GOOGLE_CLIENT_ID__ || '';

let firebaseApp = null, auth = null, db = null, user = null;

/* init firebase if configured */
if (FB_CONFIG && FB_CONFIG.apiKey){
  firebaseApp = initializeApp(FB_CONFIG);
  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);
}

/* ---------- DOM ---------- */
const userLabel = document.getElementById('userLabel');
const googleSignBtn = document.getElementById('googleSignBtn');
const logoutBtn = document.getElementById('logoutBtn');
const viewSelect = document.getElementById('viewSelect');
const todayBtn = document.getElementById('todayBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const rangeLabel = document.getElementById('rangeLabel');

const tasksListEl = document.getElementById('tasksList');
const newTaskInput = document.getElementById('newTaskInput');
const addTaskBtn = document.getElementById('addTaskBtn');
const clearDoneBtn = document.getElementById('clearDone');
const clearAllBtn = document.getElementById('clearAll');

const boxTitle = document.getElementById('boxTitle');
const boxDuration = document.getElementById('boxDuration');
const boxType = document.getElementById('boxType');
const createBoxBtn = document.getElementById('createBoxBtn');
const syncCalendarBtn = document.getElementById('syncCalendarBtn');

const calendarView = document.getElementById('calendarView');

const timerDisplay = document.getElementById('timerDisplay');
const timerStatus = document.getElementById('timerStatus');
const startTimerBtn = document.getElementById('startTimerBtn');
const stopTimerBtn = document.getElementById('stopTimerBtn');
const completeBoxBtn = document.getElementById('completeBoxBtn');
const selectedDetails = document.getElementById('selectedDetails');
const reportSummary = document.getElementById('reportSummary');
const exportBtn = document.getElementById('exportBtn');

const ding = document.getElementById('dingSound');

/* ---------- State & Storage ---------- */
const LS_KEYS = {
  timeboxes: 'tb_timeboxes_v1',
  tasks: 'tb_tasks_v1',
  settings: 'tb_settings_v1'
};

let currentDate = new Date(); // anchor date for views
let selectedBox = null;
let timerInterval = null;
let timerRemaining = 0;
let timerRunning = false;

/* default settings */
let settings = {
  defFocus: 25,
  defShort: 5,
  defLong: 15
};

/* ---------- Utilities ---------- */
function saveLS(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
function loadLS(key, fallback){ try{ return JSON.parse(localStorage.getItem(key)) || fallback; }catch(e){ return fallback; } }
function uid(){ return user? user.uid : 'guest'; }

function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function formatDate(d){ return startOfDay(new Date(d)).toISOString().slice(0,10); }
function addMinutes(d, m){ return new Date(d.getTime()+m*60000); }

/* ---------- Data models ---------- */
/* timebox = { id, date(YYYY-MM-DD), startISO (optional), durationMin, title, type, createdBy } */
function loadTimeboxes(){ return loadLS(LS_KEYS.timeboxes, []); }
function saveTimeboxes(arr){ saveLS(LS_KEYS.timeboxes, arr); if (user && db){ /* also push to firestore users/{uid}/timeboxes (optional) */ } }

/* tasks model */
function loadTasks(){ return loadLS(LS_KEYS.tasks, []); }
function saveTasks(arr){ saveLS(LS_KEYS.tasks, arr); }

/* settings */
function loadSettings(){ settings = Object.assign(settings, loadLS(LS_KEYS.settings, {})); document.getElementById('defFocus').value = settings.defFocus; document.getElementById('defShort').value = settings.defShort; document.getElementById('defLong').value = settings.defLong; }
function saveSettings(){ settings.defFocus = parseInt(document.getElementById('defFocus').value)||25; settings.defShort = parseInt(document.getElementById('defShort').value)||5; settings.defLong = parseInt(document.getElementById('defLong').value)||15; saveLS(LS_KEYS.settings, settings); }

/* ---------- Tasks UI ---------- */
function renderTasks(){
  const arr = loadTasks();
  tasksListEl.innerHTML = '';
  if (!arr.length){ tasksListEl.innerHTML = '<div class="help">هیچ تسکی وجود ندارد</div>'; return; }
  arr.forEach((t, idx)=>{
    const div = document.createElement('div'); div.className = 'task' + (t.done? ' done':'');
    div.innerHTML = `<div class="title">${escapeHtml(t.title)}</div>
      <div class="task-actions">
        <button class="btn small" data-idx="${idx}" data-act="link">وصل</button>
        <button class="btn outline small" data-idx="${idx}" data-act="del">حذف</button>
        <input type="checkbox" data-idx="${idx}" class="task-check" ${t.done? 'checked':''}>
      </div>`;
    tasksListEl.appendChild(div);
  });
}
function addTask(title){
  const arr = loadTasks(); arr.unshift({ title: title.trim(), done:false, created:Date.now(), id: 't'+Date.now() }); saveTasks(arr); renderTasks();
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; }); }

/* task events */
addTaskBtn.addEventListener('click', ()=>{ if (!newTaskInput.value.trim()) return; addTask(newTaskInput.value); newTaskInput.value=''; });
newTaskInput.addEventListener('keydown', (e)=>{ if (e.key==='Enter'){ addTask(newTaskInput.value); newTaskInput.value=''; }});
tasksListEl.addEventListener('click', (e)=>{
  const btn = e.target;
  if (btn.dataset && btn.dataset.act){
    const idx = Number(btn.dataset.idx);
    const arr = loadTasks();
    if (btn.dataset.act === 'del'){ arr.splice(idx,1); saveTasks(arr); renderTasks(); }
    if (btn.dataset.act === 'link'){ alert('برای لینک کردن، یک بلوک را انتخاب کن سپس دکمه وصل را بزن'); }
  }
});
tasksListEl.addEventListener('change', (e)=>{ if (e.target.classList.contains('task-check')){ const idx=Number(e.target.dataset.idx); const arr=loadTasks(); arr[idx].done = e.target.checked; saveTasks(arr); renderTasks(); }});
clearDoneBtn.addEventListener('click', ()=>{ let arr=loadTasks(); arr = arr.filter(x=>!x.done); saveTasks(arr); renderTasks(); });
clearAllBtn.addEventListener('click', ()=>{ if (!confirm('حذف همه تسک‌ها؟')) return; saveTasks([]); renderTasks(); });

/* ---------- Timebox CRUD + UI ---------- */
function createTimeboxOnDate(dateISO, title, duration, type){
  const arr = loadTimeboxes();
  const tb = { id:'tb'+Date.now(), date: dateISO, startISO: null, durationMin: parseInt(duration), title: title||'بدون عنوان', type:type||'focus', createdBy: uid() };
  arr.unshift(tb); saveTimeboxes(arr); renderCalendar();
  return tb;
}

createBoxBtn.addEventListener('click', ()=>{
  const dateISO = formatDate(currentDate);
  const tb = createTimeboxOnDate(dateISO, boxTitle.value || ('فوکوس '+boxDuration.value), boxDuration.value || settings.defFocus, boxType.value);
  boxTitle.value=''; boxDuration.value=settings.defFocus;
});

/* render calendar - for simplicity implement week view grid; day/month/year placeholders */
function renderCalendar(){
  const view = viewSelect.value;
  if (view === 'week') renderWeekView();
  else if (view === 'day') renderDayView();
  else if (view === 'month') renderMonthView();
  else renderYearView();
}

/* week view */
function startOfWeek(d){
  const dt = new Date(d); const day = dt.getDay(); // 0 sun .. 6 sat
  // In Persian context week may start Saturday; but we align to Sunday for simplicity
  const diff = dt.getDate() - day;
  const s = new Date(dt.setDate(diff)); s.setHours(0,0,0,0);
  return s;
}
function renderWeekView(){
  calendarView.innerHTML = '';
  const s = startOfWeek(currentDate);
  const days = [];
  for (let i=0;i<7;i++){
    const d = new Date(s); d.setDate(s.getDate()+i);
    days.push(d);
  }
  rangeLabel.textContent = `${formatDate(days[0])} — ${formatDate(days[6])}`;
  const grid = document.createElement('div'); grid.className='week-grid';
  const tbArr = loadTimeboxes();
  days.forEach(d=>{
    const col = document.createElement('div'); col.className='day-column';
    const dateISO = formatDate(d);
    col.innerHTML = `<div class="date">${dateISO}</div>`;
    const dayBoxes = tbArr.filter(x=> x.date === dateISO);
    dayBoxes.forEach(b=>{
      const el = document.createElement('div'); el.className='timebox '+(b.type||'other'); el.dataset.id = b.id;
      el.innerHTML = `<div class="tb-title">${escapeHtml(b.title)}</div><div class="tb-meta">${b.durationMin} دقیقه</div>`;
      el.addEventListener('click', ()=> selectBox(b.id));
      col.appendChild(el);
    });
    // allow drop
    col.addEventListener('dragover',(e)=>e.preventDefault());
    col.addEventListener('drop',(e)=>{ const id=e.dataTransfer.getData('text'); moveBoxToDate(id, dateISO); });
    grid.appendChild(col);
  });
  calendarView.appendChild(grid);
}

/* day view (list) */
function renderDayView(){
  calendarView.innerHTML = '';
  const dateISO = formatDate(currentDate);
  rangeLabel.textContent = dateISO;
  const col = document.createElement('div'); col.className='day-column';
  col.innerHTML = `<div class="date">${dateISO}</div>`;
  const tbArr = loadTimeboxes().filter(x=>x.date===dateISO);
  tbArr.forEach(b=>{
    const el = document.createElement('div'); el.className='timebox '+(b.type||'other'); el.dataset.id=b.id;
    el.innerHTML = `<div class="tb-title">${escapeHtml(b.title)}</div><div class="tb-meta">${b.durationMin} دقیقه</div>`;
    el.addEventListener('click', ()=> selectBox(b.id));
    col.appendChild(el);
  });
  calendarView.appendChild(col);
}

/* month view - simple cards */
function renderMonthView(){
  calendarView.innerHTML = '';
  const year = currentDate.getFullYear(), month = currentDate.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month+1, 0);
  rangeLabel.textContent = `${month+1}/${year}`;
  const grid = document.createElement('div'); grid.className='week-grid';
  for (let d=1; d<=last.getDate(); d++){
    const dt = new Date(year, month, d);
    const dateISO = formatDate(dt);
    const col = document.createElement('div'); col.className='day-column';
    col.innerHTML = `<div class="date">${dateISO}</div>`;
    const dayBoxes = loadTimeboxes().filter(x=> x.date===dateISO);
    dayBoxes.forEach(b=> {
      const el = document.createElement('div'); el.className='timebox '+(b.type||'other'); el.dataset.id=b.id;
      el.innerHTML = `<div class="tb-title">${escapeHtml(b.title)}</div><div class="tb-meta">${b.durationMin} دقیقه</div>`;
      el.addEventListener('click', ()=> selectBox(b.id));
      col.appendChild(el);
    });
    grid.appendChild(col);
  }
  calendarView.appendChild(grid);
}

/* year view - months list */
function renderYearView(){
  calendarView.innerHTML = '';
  const year = currentDate.getFullYear();
  rangeLabel.textContent = `${year}`;
  const grid = document.createElement('div'); grid.className='week-grid';
  for (let m=0;m<12;m++){
    const col = document.createElement('div'); col.className='day-column';
    col.innerHTML = `<div class="date">ماه ${m+1}</div>`;
    const monthBoxes = loadTimeboxes().filter(x=> x.date.startsWith(`${year}-${String(m+1).padStart(2,'0')}`));
    monthBoxes.slice(0,5).forEach(b=> { const el=document.createElement('div'); el.className='timebox'; el.innerHTML = `<div class="tb-title">${escapeHtml(b.title)}</div>`; col.appendChild(el); });
    grid.appendChild(col);
  }
  calendarView.appendChild(grid);
}

/* move box to another date */
function moveBoxToDate(id, newDateISO){
  const arr = loadTimeboxes();
  const idx = arr.findIndex(x=> x.id===id);
  if (idx>=0){ arr[idx].date = newDateISO; saveTimeboxes(arr); renderCalendar(); }
}

/* select */
function selectBox(id){
  const arr = loadTimeboxes(); const b = arr.find(x=> x.id===id);
  selectedBox = b;
  selectedDetails.textContent = `عنوان: ${b.title}\nمدت: ${b.durationMin} دقیقه\nنوع: ${b.type}`;
  timerRemaining = b.durationMin*60;
  updateTimerDisplay();
}

/* delete, complete */
completeBoxBtn.addEventListener('click', ()=> {
  if (!selectedBox) return alert('هیچ بلوکی انتخاب نشده');
  // mark as done - here we remove it and add session record
  const arr = loadTimeboxes(); const idx = arr.findIndex(x=> x.id===selectedBox.id); if (idx>=0) arr.splice(idx,1); saveTimeboxes(arr); selectedBox=null; selectedDetails.textContent='هیچ بلوکی انتخاب نشده'; renderCalendar();
});

/* timer controls */
function updateTimerDisplay(){ timerDisplay.textContent = formatTimer(timerRemaining); }
function formatTimer(sec){ const m=Math.floor(sec/60); const s=sec%60; return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }

startTimerBtn.addEventListener('click', ()=> {
  if (!selectedBox) return alert('یک بلوک را انتخاب کن');
  if (timerRunning) return;
  timerRunning = true;
  timerStatus.textContent = 'درحال اجرا';
  if (!sessionStorage.getItem('tb_session_start')) sessionStorage.setItem('tb_session_start', Date.now().toString());
  timerInterval = setInterval(()=> {
    timerRemaining--; updateTimerDisplay();
    if (timerRemaining<=0){ clearInterval(timerInterval); timerRunning=false; timerStatus.textContent='پایان'; ding.play(); // auto mark complete
      completeBoxBtn.click();
    }
  }, 1000);
});
stopTimerBtn.addEventListener('click', ()=> { if (timerInterval) clearInterval(timerInterval); timerRunning=false; timerStatus.textContent='متوقف'; });

/* export */
exportBtn.addEventListener('click', ()=> {
  const data = { timeboxes: loadTimeboxes(), tasks: loadTasks(), settings: settings };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='timebox-export.json'; a.click(); URL.revokeObjectURL(url);
});

/* prev/next/today */
prevBtn.addEventListener('click', ()=> { changeRange(-1); });
nextBtn.addEventListener('click', ()=> { changeRange(1); });
todayBtn.addEventListener('click', ()=> { currentDate = new Date(); renderCalendar(); });

function changeRange(dir){
  const view = viewSelect.value;
  if (view==='week') currentDate.setDate(currentDate.getDate() + dir*7);
  else if (view==='day') currentDate.setDate(currentDate.getDate() + dir);
  else if (view==='month') currentDate.setMonth(currentDate.getMonth() + dir);
  else currentDate.setFullYear(currentDate.getFullYear() + dir);
  renderCalendar();
}
viewSelect.addEventListener('change', ()=> renderCalendar());

/* ---------- Google Calendar sync (via gapi) ---------- */
let gapiInited = false;
function loadGapiClient(){
  if (!GOOGLE_CLIENT_ID) return;
  if (gapiInited) return;
  const script = document.createElement('script');
  script.src = "https://apis.google.com/js/api.js";
  script.onload = ()=> {
    window.gapi.load('client:auth2', async ()=> {
      await window.gapi.client.init({
        apiKey: '', // optional
        clientId: GOOGLE_CLIENT_ID,
        discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"],
        scope: "https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/calendar.events"
      });
      gapiInited = true;
    });
  };
  document.body.appendChild(script);
}
syncCalendarBtn.addEventListener('click', async ()=>{
  if (!gapiInited) return loadGapiClient();
  const GoogleAuth = window.gapi.auth2.getAuthInstance();
  const isSigned = GoogleAuth.isSignedIn.get();
  if (!isSigned){
    await GoogleAuth.signIn();
  }
  // now fetch primary calendar events for current week and import as timeboxes
  const start = new Date(startOfWeek(currentDate)); start.setHours(0,0,0,0);
  const end = new Date(start); end.setDate(start.getDate()+7); end.setHours(23,59,59,999);
  const resp = await window.gapi.client.calendar.events.list({
    'calendarId':'primary',
    'timeMin': start.toISOString(),
    'timeMax': end.toISOString(),
    'showDeleted': false,
    'singleEvents': true,
    'orderBy': 'startTime'
  });
  const events = resp.result.items || [];
  let imported = 0;
  for (const ev of events){
    const st = new Date(ev.start.dateTime || ev.start.date);
    const durationMin = ev.end ? Math.round((new Date(ev.end.dateTime || ev.end.date) - st)/60000) : settings.defFocus;
    const dateISO = formatDate(st);
    createTimeboxOnDate(dateISO, ev.summary || 'رویداد تقویم', durationMin, 'meeting');
    imported++;
  }
  alert('رویدادهای تقویم وارد شدند: ' + imported);
});

/* ---------- Firebase Auth (optional) ---------- */
if (auth){
  const provider = new GoogleAuthProvider();
  googleSignBtn.addEventListener('click', async ()=>{
    try{
      const res = await signInWithPopup(auth, provider);
      // onAuthStateChanged will handle
    }catch(e){ alert('ورود با گوگل انجام نشد: '+ (e.message||e)); }
  });
  logoutBtn.addEventListener('click', ()=> signOut(auth));
  onAuthStateChanged(auth, async (u)=>{
    if (u){
      user = u; userLabel.textContent = u.displayName || u.email;
      googleSignBtn.style.display = 'none'; logoutBtn.style.display='';
      // load user-specific data from Firestore if present
      try{
        const docRef = doc(db, 'users', user.uid);
        const snap = await getDoc(docRef);
        if (snap.exists() && snap.data().timeboxes){ saveTimeboxes(snap.data().timeboxes); }
        // save settings
        await setDoc(docRef, { settings: settings, timeboxes: loadTimeboxes() }, { merge:true });
      }catch(e){ console.warn(e); }
    } else {
      user = null; userLabel.textContent = 'حالت مهمان'; googleSignBtn.style.display=''; logoutBtn.style.display='none';
    }
  });
} else {
  // hide google sign if firebase not configured
  googleSignBtn.style.display = 'none';
  loadGapiClient(); // still load gapi for calendar-only if client id provided
}

/* ---------- init ---------- */
function init(){
  loadSettings();
  renderTasks();
  renderCalendar();
  updateTimerDisplay();
  setStatus('آماده');
}
function setStatus(s){ timerStatus.textContent = s; }
function updateTimerDisplay(){ timerDisplay.textContent = formatTimer(timerRemaining || 0); }
init();
