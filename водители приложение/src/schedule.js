import { auth, db } from './firebase.js';
import firebase from 'firebase/compat/app';

// ══════════════════════════════════════════════════════
// schedule.js — Availability Editor + Student Schedule + Booking Modal + School Lesson Modal
// All shared state accessed via window bridge set up in app.js
// ══════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════
// SCHEDULING — AVAILABILITY EDITOR (teacher side)
// ══════════════════════════════════════════════════════

// Temp state for availability editor
const _avail = {};  // { [instructorName]: { weeklySlots: {}, duration: 90 } }

const DAY_LABELS = {
  ru: ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'],
  he: ['א','ב','ג','ד','ה','ו','ש'],
  en: ['Su','Mo','Tu','We','Th','Fr','Sa'],
};
const HOURS = [8,9,10,11,12,13,14,15,16,17,18,19];

function renderAvailabilityEditor(instructors, schoolId) {
  const wrap = document.getElementById('avail-editor-body');
  if (!wrap) return;
  if (!instructors || instructors.length === 0) {
    wrap.innerHTML = '<div style="color:var(--muted);font-size:0.88rem;padding:8px 0">Добавьте инструкторов в профиле школы чтобы управлять расписанием.</div>';
    return;
  }
  wrap.innerHTML = '<div style="color:var(--muted);font-size:0.8rem;margin-bottom:12px">Загружаем расписание…</div>';

  db.collection('availability').doc(schoolId).get().then(function(doc) {
    const saved = doc.exists ? (doc.data().instructors || {}) : {};
    const days = DAY_LABELS[window.currentLang] || DAY_LABELS.ru;
    const fromLbl = window.currentLang==='ru'?'С':window.currentLang==='en'?'From':'מ-';
    const toLbl   = window.currentLang==='ru'?'До':window.currentLang==='en'?'To':'עד';
    const durLbl  = window.currentLang==='ru'?'Урок:':window.currentLang==='en'?'Lesson:':'שיעור:';
    const minLbl  = window.currentLang==='ru'?'мин':window.currentLang==='en'?'min':'דק';

    const hourOpts = function(sel) {
      return Array.from({length:14},(_,i)=>i+7).map(h=>`<option value="${h}" ${sel===h?'selected':''}>${h}:00</option>`).join('');
    };

    let html = '<div class="avail-editor">';
    instructors.forEach(function(iname) {
      const idata = saved[iname] || { weeklySlots: {}, duration: 90 };
      _avail[iname] = JSON.parse(JSON.stringify(idata));

      // Derive active days and working hours from saved weeklySlots
      const allSlots = Object.values(idata.weeklySlots||{}).flat();
      const savedFrom = allSlots.length ? Math.min(...allSlots) : 9;
      const dur = idata.duration || 90;
      const savedTo   = allSlots.length ? Math.max(...allSlots) + Math.ceil(dur/60) : 18;
      const activeDays = new Set(Object.keys(idata.weeklySlots||{}).filter(k=>(idata.weeklySlots[k]||[]).length>0).map(Number));

      const safe = iname.replace(/'/g,"\\'");
      html += `<div class="avail-instructor-block" id="avail-block-${CSS.escape(iname)}">
        <div class="avail-instructor-name">${window.escapeHtml(iname)}</div>
        <div class="avail-days-row">
          ${days.map((d,i)=>`<button class="avail-day-btn ${activeDays.has(i)?'active':''}" data-day="${i}" onclick="toggleAvailDay('${safe}',${i},this)">${d}</button>`).join('')}
        </div>
        <div class="avail-hours-row">
          <span class="avail-range-lbl">${fromLbl}</span>
          <select class="avail-hour-sel" id="avail-from-${CSS.escape(iname)}" onchange="updateAvailHours('${safe}')">${hourOpts(savedFrom)}</select>
          <span class="avail-range-lbl">${toLbl}</span>
          <select class="avail-hour-sel" id="avail-to-${CSS.escape(iname)}" onchange="updateAvailHours('${safe}')">${hourOpts(savedTo)}</select>
        </div>
        <div class="duration-picker">
          <span style="font-size:0.8rem;font-weight:700;color:var(--muted);align-self:center;margin-inline-end:4px">${durLbl}</span>
          ${[45,60,90].map(d=>`<button class="duration-btn ${dur===d?'active':''}" onclick="setDuration('${safe}',${d},this)">${d} ${minLbl}</button>`).join('')}
        </div>
      </div>`;
    });
    html += `<button class="avail-save-btn" onclick="saveAvailability('${schoolId}')">${window.currentLang==='ru'?'Сохранить расписание':window.currentLang==='en'?'Save schedule':'שמור לוח זמנים'}</button>`;
    html += '</div>';
    wrap.innerHTML = html;
  }).catch(function() {
    wrap.innerHTML = '<div style="color:#c0392b;font-size:0.85rem">Ошибка загрузки расписания</div>';
  });
}

function toggleAvailDay(iname, dayIdx, btn) {
  if (!_avail[iname]) return;
  btn.classList.toggle('active');
  _rebuildAvailSlots(iname);
}

function updateAvailHours(iname) {
  _rebuildAvailSlots(iname);
}

function _rebuildAvailSlots(iname) {
  if (!_avail[iname]) return;
  const block = document.getElementById('avail-block-' + CSS.escape(iname));
  if (!block) return;
  const fromH = parseInt(document.getElementById('avail-from-' + CSS.escape(iname)).value, 10);
  const toH   = parseInt(document.getElementById('avail-to-'   + CSS.escape(iname)).value, 10);
  const dur   = _avail[iname].duration || 90;
  const activeDayBtns = block.querySelectorAll('.avail-day-btn.active');
  const slots = {};
  const lastStart = toH - Math.ceil(dur / 60);
  activeDayBtns.forEach(function(btn) {
    const di = parseInt(btn.dataset.day, 10);
    slots[di] = [];
    for (let h = fromH; h <= lastStart; h++) slots[di].push(h);
  });
  _avail[iname].weeklySlots = slots;
}

function setDuration(iname, dur, btn) {
  if (!_avail[iname]) return;
  _avail[iname].duration = dur;
  const block = btn.closest('.avail-instructor-block');
  block.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _rebuildAvailSlots(iname);
}

function toggleAvailCell(iname, day, hour, el) {
  // Legacy — kept for backward compat, not used in new UI
  if (!_avail[iname]) return;
  if (!_avail[iname].weeklySlots) _avail[iname].weeklySlots = {};
  if (!_avail[iname].weeklySlots[day]) _avail[iname].weeklySlots[day] = [];
  const arr = _avail[iname].weeklySlots[day];
  const idx = arr.indexOf(hour);
  if (idx === -1) { arr.push(hour); el.classList.add('on'); }
  else            { arr.splice(idx,1); el.classList.remove('on'); }
}

function saveAvailability(schoolId) {
  const btn = document.querySelector('.avail-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  db.collection('availability').doc(schoolId).set({ instructors: _avail }, { merge: true })
    .then(function() {
      window.notify(window.currentLang === 'ru' ? 'Расписание сохранено ✓' : window.currentLang === 'en' ? 'Schedule saved ✓' : 'לוח זמנים נשמר ✓');
      if (btn) { btn.disabled = false; btn.textContent = 'Сохранить расписание'; }
    })
    .catch(function() {
      window.notify('Ошибка сохранения');
      if (btn) { btn.disabled = false; btn.textContent = 'Сохранить расписание'; }
    });
}

// ══════════════════════════════════════════════════════
// SCHEDULING — STUDENT SCHEDULE (load from Firestore)
// ══════════════════════════════════════════════════════

function loadScheduleData() {
  const user = auth.currentUser;
  const container = document.getElementById('schedule-body');
  if (!container) return;

  if (!user) {
    container.innerHTML = `<div class="schedule-empty">
      <div class="schedule-empty-icon">📅</div>
      <h3>${window.currentLang==='ru'?'Войдите чтобы видеть расписание':window.currentLang==='en'?'Sign in to see your schedule':'התחבר כדי לראות את לוח הזמנים'}</h3>
      <button class="schedule-add-btn" style="margin:0 auto;display:flex" onclick="window.openAuthModal()">
        ${window.currentLang==='ru'?'Войти':window.currentLang==='en'?'Sign in':'כניסה'}
      </button>
    </div>`;
    return;
  }

  // Apply cached role immediately — no spinner needed for repeat visits
  const cachedRole2 = localStorage.getItem('driveIL-role-' + user.uid);
  if (cachedRole2 === 'school' && !window._userIsSchool) { window._userIsSchool = true; window.updateSidebarForSchool(); }
  // Apply cached student state immediately
  if (window._studentState === null || window._studentState === undefined) {
    const cachedState = localStorage.getItem('driveIL-state-' + user.uid);
    if (cachedState) window._studentState = cachedState;
  }

  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Загружаем уроки…</div>';

  // Unsubscribe previous listener if any
  if (window._scheduleUnsub) { window._scheduleUnsub(); window._scheduleUnsub = null; }

  db.collection('schools').doc(user.uid).get().then(function(schoolDoc) {
    const isSchool = schoolDoc.exists;
    window._userIsSchool = isSchool;
    if (isSchool) { localStorage.setItem('driveIL-role-' + user.uid, 'school'); window.updateSidebarForSchool(); }

    if (isSchool) {
      // School: real-time own bookings
      const query = db.collection('bookings').where('schoolId', '==', user.uid);
      window._scheduleUnsub = query.onSnapshot(function(snap) {
        const bookings = [];
        snap.forEach(d => bookings.push({ id: d.id, ...d.data() }));
        bookings.sort((a,b) => a.date < b.date ? -1 : 1);
        renderCalendarView(bookings, true, schoolDoc.data());
      }, function() { renderCalendarView([], true, schoolDoc.data()); });
      return;
    }

    // Student: always verify state from Firestore (one read, avoids stale cache)
    db.collection('enrollments').where('userId', '==', user.uid).get().then(function(snap) {
      let state;
      if (snap.empty) {
        state = 'no_school';
      } else {
        const statuses = snap.docs.map(function(d) { return d.data().status; });
        if (statuses.includes('confirmed')) {
          state = 'active';
        } else if (statuses.every(function(s) { return s === 'cancelled'; })) {
          state = 'no_school'; // all rejected — back to state 1
        } else {
          state = 'pending';
        }
      }
      window._studentState = state;
      localStorage.setItem('driveIL-state-' + user.uid, state);
      if (state === 'no_school' || state === 'pending') {
        const pendingDoc = state === 'pending' ? snap.docs.find(function(d) { return d.data().status !== 'confirmed' && d.data().status !== 'cancelled'; }) : null;
        const pendingSchoolName = pendingDoc ? (pendingDoc.data().schoolName || '') : '';
        renderLockedCalendar(state, pendingSchoolName);
      } else {
        _loadStudentSchedule(user);
      }
    });
    return; // wait for the query above
  }).catch(function() { renderCalendarView([], false, null); });
}

function _loadStudentSchedule(user) {
  // Student: use _activeSchoolId if already known, otherwise load from enrollments
  if (_activeSchoolId) {
    // School known (set by joinSchool) — load directly, no enrollment query needed
    Promise.all([
      db.collection('bookings').where('studentId', '==', user.uid).get(),
      db.collection('availability').doc(_activeSchoolId).get(),
      db.collection('bookings').where('schoolId', '==', _activeSchoolId).where('status', '==', 'confirmed').get(),
      db.collection('bookings').where('schoolId', '==', _activeSchoolId).where('studentId', '==', 'open').get()
    ]).then(function([bookSnap, availDoc, takenSnap, openSnap]) {
      const myBookings = [];
      bookSnap.forEach(d => myBookings.push({ id: d.id, ...d.data() }));
      myBookings.sort((a,b) => a.date < b.date ? -1 : 1);
      const openSlots = {};
      openSnap.forEach(d => {
        const b = d.data();
        const hh = b.time ? parseInt(b.time.split(':')[0], 10) : null;
        if (hh !== null) {
          if (!openSlots[b.date]) openSlots[b.date] = [];
          openSlots[b.date].push({ hour: hh, instructor: b.instructorName || '', duration: b.duration || 60, bookingId: d.id });
        }
      });
      _schoolAvailData = {
        instructors: availDoc.exists ? (availDoc.data().instructors || {}) : {},
        openSlots,
        takenSlots: new Set(),
        schoolId: _activeSchoolId,
        schoolName: window._activeSchoolName
      };
      takenSnap.forEach(d => {
        const b = d.data();
        if (b.studentId === 'open') return;
        const hh = b.time ? parseInt(b.time.split(':')[0], 10) : null;
        if (hh !== null) _schoolAvailData.takenSlots.add(b.date + '_' + hh);
      });
      renderCalendarView(myBookings, false, null);
    }).catch(function(e) {
      console.error('loadScheduleData student direct error', e);
      renderCalendarView([], false, null);
    });
  } else {
    // School not known — load from confirmed enrollment
    Promise.all([
      db.collection('bookings').where('studentId', '==', user.uid).get(),
      db.collection('enrollments').where('userId', '==', user.uid).where('status', '==', 'confirmed').limit(1).get()
    ]).then(function([bookSnap, enrollSnap]) {
      const myBookings = [];
      bookSnap.forEach(d => myBookings.push({ id: d.id, ...d.data() }));
      myBookings.sort((a,b) => a.date < b.date ? -1 : 1);

      if (enrollSnap.empty) {
        _schoolAvailData = null;
        renderCalendarView(myBookings, false, null);
        return;
      }

      const enroll = enrollSnap.docs[0].data();
      _activeSchoolId = enroll.schoolId;
      window._activeSchoolName = enroll.schoolName || '';

      Promise.all([
        db.collection('availability').doc(_activeSchoolId).get(),
        db.collection('bookings').where('schoolId', '==', _activeSchoolId).where('status', '==', 'confirmed').get(),
        db.collection('bookings').where('schoolId', '==', _activeSchoolId).where('studentId', '==', 'open').get()
      ]).then(function([availDoc, takenSnap, openSnap]) {
        const openSlots = {};
        openSnap.forEach(d => {
          const b = d.data();
          const hh = b.time ? parseInt(b.time.split(':')[0], 10) : null;
          if (hh !== null) {
            if (!openSlots[b.date]) openSlots[b.date] = [];
            openSlots[b.date].push({ hour: hh, instructor: b.instructorName || '', duration: b.duration || 60, bookingId: d.id });
          }
        });
        _schoolAvailData = {
          instructors: availDoc.exists ? (availDoc.data().instructors || {}) : {},
          openSlots,
          takenSlots: new Set(),
          schoolId: _activeSchoolId,
          schoolName: window._activeSchoolName
        };
        takenSnap.forEach(d => {
          const b = d.data();
          if (b.studentId === 'open') return;
          const hh = b.time ? parseInt(b.time.split(':')[0], 10) : null;
          if (hh !== null) _schoolAvailData.takenSlots.add(b.date + '_' + hh);
        });
        renderCalendarView(myBookings, false, null);
      }).catch(function(e) {
        console.error('loadScheduleData avail error', e);
        _schoolAvailData = null;
        renderCalendarView(myBookings, false, null);
      });
    }).catch(function(e) {
      console.error('loadScheduleData enroll error', e);
      renderCalendarView([], false, null);
    });
  }
}

let _activeSchoolId = null;
let _schoolAvailData = null; // { instructors, takenSlots:Set, schoolId, schoolName }

function renderCalendarView(bookings, isSchool, schoolData) {
  window._cal.bookings = bookings;
  window._cal.isSchool = isSchool;
  window._cal.selectedDate = null;
  const container = document.getElementById('schedule-body');
  if (!container) return;

  const today = new Date();
  const withStatus = bookings.map(b => {
    if (b.status === 'cancelled') return null;
    const [d,m,y] = b.date.split('.');
    const bDate = new Date(+y, +m-1, +d);
    bDate.setHours(0,0,0,0);
    const st = bDate < new Date(today.getFullYear(), today.getMonth(), today.getDate()) ? 'done' : 'upcoming';
    return { ...b, _st: st, _dateObj: bDate };
  }).filter(Boolean);

  window._cal.withStatus = withStatus;

  const upcoming = withStatus.filter(b => b._st === 'upcoming').length;
  const done     = withStatus.filter(b => b._st === 'done').length;

  const clickDay = window.currentLang==='ru'?'Нажмите на дату чтобы увидеть уроки':window.currentLang==='en'?'Click a date to see lessons':'לחץ על תאריך לצפייה בשיעורים';
  const bookLbl  = window.currentLang==='ru'?'Записаться на урок':window.currentLang==='en'?'Book a lesson':'הזמן שיעור';
  const addLbl   = window.currentLang==='ru'?'Добавить урок':window.currentLang==='en'?'Add lesson':'הוסף שיעור';
  const plusSvg  = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

  // Update page title
  const titleEl = document.querySelector('#page-schedule h1');
  if (titleEl) titleEl.textContent = isSchool
    ? (window.currentLang==='ru'?'Мои уроки':window.currentLang==='en'?'My Lessons':'השיעורים שלי')
    : (window.t.schedule_title || 'לוח שיעורים');

  // School profile card (Facebook style)
  let profileHtml = '';
  if (isSchool && schoolData) {
    const sd = schoolData;
    const initial = (sd.name || '?').charAt(0).toUpperCase();
    const instrCount = (sd.instructors || []).length;
    const L2 = {
      lessons:  window.currentLang==='ru'?'Уроков':window.currentLang==='en'?'Lessons':'שיעורים',
      instrs:   window.currentLang==='ru'?'Инструкторов':window.currentLang==='en'?'Instructors':'מדריכים',
      students: window.currentLang==='ru'?'Учеников':window.currentLang==='en'?'Students':'תלמידים',
      edit:     window.currentLang==='ru'?'Редактировать профиль':window.currentLang==='en'?'Edit profile':'ערוך פרופיל',
      myless:   window.currentLang==='ru'?'Мои уроки':window.currentLang==='en'?'My lessons':'השיעורים שלי',
    };
    profileHtml = `
      <div class="sp-profile">
        <div class="sp-cover"></div>
        <div class="sp-avatar">${initial}</div>
        <div class="sp-body">
          <div class="sp-name">${window.escapeHtml(sd.name || '')}</div>
          <div class="sp-meta">
            ${sd.city ? `<span>${window.escapeHtml(sd.city)}</span>` : ''}
            ${sd.rating ? `<span>${sd.rating.toFixed(1)}</span>` : ''}
            ${sd.price ? `<span>₪${sd.price} / שיעור</span>` : ''}
          </div>
          ${sd.description ? `<div class="sp-desc">${window.escapeHtml(sd.description)}</div>` : ''}
        </div>
      </div>`;
  }

  // Show school info banner for students
  let schoolBannerHtml = '';
  if (!isSchool && _schoolAvailData) {
    const hasWeeklySlots = Object.values(_schoolAvailData.instructors || {}).some(
      idata => Object.values(idata.weeklySlots || {}).some(slots => slots.length > 0)
    );
    const hasOpenSlots = Object.keys(_schoolAvailData.openSlots || {}).length > 0;
    const hasAnySlots = hasWeeklySlots || hasOpenSlots;
    if (hasAnySlots) {
      schoolBannerHtml = `<div style="background:#e8f5e9;border-radius:12px;padding:10px 14px;margin-bottom:12px;font-size:0.85rem;color:#27ae60;font-weight:600">
        🟢 ${window.currentLang==='ru'?'Школа '+window.escapeHtml(_schoolAvailData.schoolName)+' — нажмите на зелёный день для записи':
           window.currentLang==='en'?'School '+window.escapeHtml(_schoolAvailData.schoolName)+' — tap a green day to book':
           'בית ספר '+window.escapeHtml(_schoolAvailData.schoolName)+' — לחץ על יום ירוק להזמנה'}
      </div>`;
    } else if (_schoolAvailData.schoolId) {
      schoolBannerHtml = `<div style="background:#fff8e1;border-radius:12px;padding:10px 14px;margin-bottom:12px;font-size:0.85rem;color:#e67e22;font-weight:600">
        ⏳ ${window.currentLang==='ru'?'Школа ещё не добавила расписание':window.currentLang==='en'?'School has not set up schedule yet':'בית הספר עוד לא הגדיר לוח זמנים'}
      </div>`;
    }
  } else if (!isSchool && !_schoolAvailData) {
    schoolBannerHtml = `<div style="background:#f0f4ff;border-radius:12px;padding:10px 14px;margin-bottom:12px;font-size:0.85rem;color:#1a73e8;font-weight:600;cursor:pointer" onclick="window.showPage('schools')">
      👆 ${window.currentLang==='ru'?'Нажмите «Присоединиться» на карточке школы чтобы видеть расписание':
         window.currentLang==='en'?'Click "Join" on a school card to see their schedule':
         'לחץ "הצטרף" על כרטיס בית ספר לראות את לוח הזמנים'}
    </div>`;
  }
  const bookBtn = schoolBannerHtml;

  container.innerHTML = profileHtml + bookBtn + `
    <div class="cal-wrap">
      <div class="cal-header">
        <button class="cal-nav-btn" onclick="schedCalNav(-1)">‹</button>
        <span class="cal-month-label" id="cal-month-label"></span>
        <button class="cal-nav-btn" onclick="schedCalNav(1)">›</button>
      </div>
      <div class="cal-grid" id="cal-grid"></div>
    </div>
    <div class="cal-day-lessons" id="cal-day-lessons"><p class="cal-hint">${clickDay}</p></div>`;

  const _pendingDate = window._cal.pendingSelect;
  window._cal.pendingSelect = null;
  renderCalendarGrid();
  if (_pendingDate) setTimeout(function() { schedCalSelect(_pendingDate); }, 50);
}

function renderCalendarGrid() {
  const grid = document.getElementById('cal-grid');
  const label = document.getElementById('cal-month-label');
  if (!grid) return;

  const { year, month, withStatus } = window._cal;
  const today = new Date();
  today.setHours(0,0,0,0);

  const monthNames = {
    ru: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
    he: ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'],
    en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  };
  const dayNames = {
    ru: ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'],
    he: ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'],
    en: ['Su','Mo','Tu','We','Th','Fr','Sa'],
  };

  label.textContent = (monthNames[window.currentLang] || monthNames.ru)[month] + ' ' + year;

  // Build a set of dates that have bookings this month
  const bookedDates = {};
  (withStatus || []).forEach(b => {
    const [d,m,y] = b.date.split('.');
    if (+y === year && +m - 1 === month) {
      const key = b.date;
      if (!bookedDates[key]) bookedDates[key] = [];
      bookedDates[key].push(b);
    }
  });

  // Compute available days from school availability (students only)
  const availDays = _computeAvailDays(year, month);

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days = dayNames[window.currentLang] || dayNames.ru;
  let html = days.map(d => `<div class="cal-day-name">${d}</div>`).join('');

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) html += '<div class="cal-cell empty"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${String(d).padStart(2,'0')}.${String(month+1).padStart(2,'0')}.${year}`;
    const cellDate = new Date(year, month, d);
    cellDate.setHours(0,0,0,0);
    const isToday = cellDate.getTime() === today.getTime();
    const isSelected = window._cal.selectedDate === dateStr;
    const lessons = bookedDates[dateStr] || [];
    const isPast = cellDate < today;
    const hasDot = lessons.length > 0 && !isPast;

    const typeColors = { lesson_practical:'#1a73e8', lesson_theory:'#8e44ad', lesson_highway:'#27ae60' };
    const dots = lessons.slice(0,3).map(b => `<span class="cal-dot" style="background:${typeColors[b.type]||'#1a73e8'}"></span>`).join('');
    const hasAvail = !isPast && availDays.has(dateStr);
    const availDot = hasAvail ? `<span class="cal-dot" style="background:#27ae60"></span>` : '';

    html += `<div class="cal-cell ${isToday?'today':''} ${isSelected?'selected':''} ${isPast?'past':''} ${hasDot?'has-lesson':''} ${hasAvail&&!hasDot?'has-avail':''}" onclick="schedCalSelect('${dateStr}')">
      <span class="cal-cell-num">${d}</span>
      ${(hasDot || hasAvail) ? `<div class="cal-dots">${dots}${availDot}</div>` : ''}
    </div>`;
  }

  grid.innerHTML = html;
}

function schedCalNav(dir) {
  window._cal.month += dir;
  if (window._cal.month > 11) { window._cal.month = 0; window._cal.year++; }
  if (window._cal.month < 0)  { window._cal.month = 11; window._cal.year--; }
  window._cal.selectedDate = null;
  renderCalendarGrid();
  const panel = document.getElementById('cal-day-lessons');
  if (panel) {
    const hint = window.currentLang==='ru'?'Нажмите на дату чтобы увидеть уроки':window.currentLang==='en'?'Click a date to see lessons':'לחץ על תאריך לצפייה בשיעורים';
    panel.innerHTML = `<p class="cal-hint">${hint}</p>`;
  }
}

function schedCalSelect(dateStr) {
  window._cal.selectedDate = dateStr;
  renderCalendarGrid();

  const lessons = (window._cal.withStatus || []).filter(b => b.date === dateStr);
  const panel = document.getElementById('cal-day-lessons');
  if (!panel) return;

  const typeColors = { lesson_practical:'#1a73e8', lesson_theory:'#8e44ad', lesson_highway:'#27ae60' };
  const statusCls  = { upcoming:'ls-confirmed', done:'ls-done' };
  const personSvg  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`;
  const cancelLbl  = window.currentLang==='ru'?'Отменить':window.currentLang==='en'?'Cancel':'בטל';

  const [dd,mm,yy] = dateStr.split('.');
  const cellDate = new Date(+yy, +mm-1, +dd);
  const today2 = new Date(); today2.setHours(0,0,0,0);
  const isFuture = cellDate >= today2;

  // Show available school slots for students on future dates
  const availSlots = (!window._cal.isSchool && isFuture && _schoolAvailData)
    ? _getAvailSlotsForDay(dateStr, cellDate.getDay()) : [];

  const addBtnHtml = window._userIsSchool && isFuture ? (function() {
    const [dd2,mm2,yy2] = dateStr.split('.');
    const iso = `${yy2}-${mm2}-${dd2}`;
    const lbl = window.currentLang==='ru'?'+ Добавить урок':window.currentLang==='en'?'+ Add lesson':'+ הוסף שיעור';
    return `<button onclick="openSchoolLessonModal('${iso}')" style="margin-top:10px;width:100%;padding:9px;background:var(--text);color:var(--bg);border:none;border-radius:10px;font-size:0.83rem;font-weight:700;cursor:pointer;font-family:inherit;">${lbl}</button>`;
  })() : '';

  if (lessons.length === 0 && availSlots.length === 0) {
    const empty = window.currentLang==='ru'?'Нет уроков в этот день':window.currentLang==='en'?'No lessons this day':'אין שיעורים ביום זה';
    panel.innerHTML = `<p class="cal-hint">${empty}</p>${addBtnHtml}`;
    return;
  }

  if (lessons.length === 0 && availSlots.length > 0) {
    const hdr = window.currentLang==='ru'?'Свободные слоты':window.currentLang==='en'?'Available slots':'שעות פנויות';
    const bookLbl = window.currentLang==='ru'?'Записаться':window.currentLang==='en'?'Book':'הזמן';
    panel.innerHTML = `<div class="avail-slots-hdr">${hdr} — ${_schoolAvailData.schoolName || ''}</div>` +
      availSlots.map(s => {
        const safe = s.instructor.replace(/'/g,"\\'");
        return `<div class="avail-slot-row">
          <span class="avail-slot-time">${String(s.hour).padStart(2,'0')}:00</span>
          <span class="avail-slot-instr">${window.escapeHtml(s.instructor)}</span>
          <button class="avail-slot-btn" onclick="quickBook('${dateStr}',${s.hour},'${safe}',${s.bookingId ? `'${s.bookingId}'` : 'null'})">${bookLbl}</button>
        </div>`;
      }).join('');
    return;
  }

  panel.innerHTML = lessons.map(b => {
    const color   = typeColors[b.type] || '#1a73e8';
    const stCls   = statusCls[b._st] || 'ls-pending';
    const stTxt   = window.t[b._st === 'upcoming' ? 'status_confirmed' : 'status_done'] || b._st;
    const typeTxt = window.t[b.type] || b.type;
    const canCancel = b._st === 'upcoming';
    const nameRow = window._cal.isSchool
      ? `<div class="lesson-instr-row">${personSvg}<span class="lesson-instr-name">${window.escapeHtml(b.studentName||'')}</span></div>`
      : `<div class="lesson-instr-row">${personSvg}<span class="lesson-instr-name">${window.escapeHtml(b.instructorName||'')}</span></div>`;
    return `<div class="lesson-card" style="margin-bottom:10px">
      <div class="lesson-accent" style="background:${color}"></div>
      <div class="lesson-body">
        <div class="lesson-top">
          <div><div class="lesson-time-val">${b.time}</div><div class="lesson-date-val">${b.date}</div></div>
          <span class="lesson-status ${stCls}">${stTxt}</span>
        </div>
        <div class="lesson-divider"></div>
        <div class="lesson-type-row"><div class="lesson-type-dot" style="background:${color}"></div><div class="lesson-type-name">${typeTxt}</div></div>
        ${nameRow}
        ${b.schoolName && !window._cal.isSchool ? `<div class="lesson-instr-row"><span class="lesson-instr-name" style="color:var(--muted)">${window.escapeHtml(b.schoolName)}</span></div>` : ''}
        ${canCancel && !window._cal.isSchool ? `<button class="lesson-cancel-btn" onclick="cancelBooking('${b.id}')">${cancelLbl}</button>` : ''}
      </div>
    </div>`;
  }).join('') + addBtnHtml;

  // For students with upcoming lessons — show the lesson's route (or all teacher routes as fallback)
  const upcomingLesson = !window._cal.isSchool && lessons.find(b => b._st === 'upcoming');
  if (upcomingLesson && _schoolAvailData && _schoolAvailData.schoolId) {
    const hasRoute = upcomingLesson.routeId;
    const routeHdr = hasRoute
      ? (window.currentLang==='ru'?'Маршрут урока':window.currentLang==='en'?'Lesson Route':'מסלול השיעור')
      : (window.currentLang==='ru'?'Маршруты учителя':window.currentLang==='en'?'Teacher Routes':'מסלולי המורה');
    const routeWrap = document.createElement('div');
    routeWrap.style.cssText = 'margin-top:16px;border-top:1px solid var(--border);padding-top:14px;';
    routeWrap.innerHTML = `
      <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;color:var(--muted);margin-bottom:10px;">${routeHdr}</div>
      <div id="lesson-routes-map" style="height:200px;border-radius:12px;overflow:hidden;background:var(--border);margin-bottom:8px;"></div>
      <div id="lesson-routes-list" style="font-size:0.82rem;color:var(--muted);"></div>`;
    panel.appendChild(routeWrap);
    if (hasRoute) {
      _loadSingleRoute(upcomingLesson.routeId, upcomingLesson.routeName);
    } else {
      _loadLessonRoutes(_schoolAvailData.schoolId);
    }
  }
}

function _loadSingleRoute(routeId, routeName) {
  const mapDiv = document.getElementById('lesson-routes-map');
  const listEl = document.getElementById('lesson-routes-list');
  if (!mapDiv) return;
  db.collection('routes').doc(routeId).get().then(function(doc) {
    if (!doc.exists) { if (listEl) listEl.textContent = window.currentLang==='ru'?'Маршрут не найден':'Route not found'; return; }
    const r = doc.data();
    const diffColor = { easy:'#34a853', medium:'#fbbc05', hard:'#ea4335' };
    const diffLabel = { easy: window.currentLang==='ru'?'Лёгкий':window.currentLang==='en'?'Easy':'קל', medium: window.currentLang==='ru'?'Средний':window.currentLang==='en'?'Medium':'בינוני', hard: window.currentLang==='ru'?'Сложный':window.currentLang==='en'?'Hard':'קשה' };
    const diff = r.difficulty || 'medium';
    if (listEl) {
      const dist = r.distance ? r.distance.toFixed(1) + ' км' : '';
      listEl.innerHTML = `<span style="color:${diffColor[diff]}">●</span> ${window.escapeHtml(r.name||routeName||'—')}${dist?' · '+dist:''} · <span style="color:${diffColor[diff]}">${diffLabel[diff]}</span>`;
    }
    if (!r.points || r.points.length < 2) return;
    setTimeout(function() {
      if (!document.getElementById('lesson-routes-map')) return;
      const lmap = L.map('lesson-routes-map', { zoomControl: false, dragging: true }).setView([31.5, 34.9], 9);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '© CartoDB', maxZoom: 19 }).addTo(lmap);
      const latlngs = r.points.map(function(p) { return [p.lat, p.lng]; });
      L.polyline(latlngs, { color: diffColor[diff], weight: 5, opacity: 0.95 }).addTo(lmap);
      L.circleMarker(latlngs[0], { radius: 7, color: diffColor[diff], fillColor: '#fff', fillOpacity: 1, weight: 2 }).addTo(lmap);
      L.circleMarker(latlngs[latlngs.length-1], { radius: 7, color: diffColor[diff], fillColor: diffColor[diff], fillOpacity: 1, weight: 2 }).addTo(lmap);
      lmap.fitBounds(latlngs, { padding: [20, 20] });
      lmap.invalidateSize();
    }, 100);
  });
}

function _loadLessonRoutes(schoolId) {
  const mapDiv = document.getElementById('lesson-routes-map');
  const listEl = document.getElementById('lesson-routes-list');
  if (!mapDiv) return;
  const noRoutes = window.currentLang==='ru'?'Маршрутов пока нет':window.currentLang==='en'?'No routes yet':'אין מסלולים עדיין';
  db.collection('routes').where('schoolId', '==', schoolId).get().then(function(snap) {
    if (snap.empty) {
      if (listEl) listEl.textContent = noRoutes;
      mapDiv.style.background = 'var(--border)';
      return;
    }
    const routes = [];
    snap.forEach(function(d) { routes.push({ id: d.id, ...d.data() }); });
    const diffColor = { easy:'#34a853', medium:'#fbbc05', hard:'#ea4335' };
    const diffLabel = {
      easy:   window.currentLang==='ru'?'Лёгкий':window.currentLang==='en'?'Easy':'קל',
      medium: window.currentLang==='ru'?'Средний':window.currentLang==='en'?'Medium':'בינוני',
      hard:   window.currentLang==='ru'?'Сложный':window.currentLang==='en'?'Hard':'קשה',
    };
    if (listEl) {
      listEl.innerHTML = routes.map(function(r) {
        const diff = r.difficulty || 'medium';
        const dist = r.distance ? r.distance.toFixed(1) + ' км' : '';
        return `<span style="display:inline-block;margin-right:10px;margin-bottom:4px;">
          <span style="color:${diffColor[diff]}">●</span> ${window.escapeHtml(r.name||'—')}${dist?' · '+dist:''}
        </span>`;
      }).join('');
    }
    setTimeout(function() {
      if (!document.getElementById('lesson-routes-map')) return;
      const lmap = L.map('lesson-routes-map', { zoomControl: false, dragging: true }).setView([31.5, 34.9], 9);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '© CartoDB', maxZoom: 19 }).addTo(lmap);
      const allBounds = [];
      routes.forEach(function(route) {
        if (!route.points || route.points.length < 2) return;
        const diff = route.difficulty || 'medium';
        const latlngs = route.points.map(function(p) { return [p.lat, p.lng]; });
        L.polyline(latlngs, { color: diffColor[diff], weight: 4, opacity: 0.9 }).addTo(lmap);
        L.circleMarker(latlngs[0], { radius: 5, color: diffColor[diff], fillColor: '#fff', fillOpacity: 1, weight: 2 }).addTo(lmap);
        allBounds.push(...latlngs);
      });
      if (allBounds.length > 0) lmap.fitBounds(allBounds, { padding: [16, 16] });
      lmap.invalidateSize();
    }, 100);
  }).catch(function() {
    if (listEl) listEl.textContent = noRoutes;
  });
}

function _computeAvailDays(year, month) {
  const result = new Set();
  if (!_schoolAvailData) return result;
  const pad = n => String(n).padStart(2,'0');
  const today = new Date(); today.setHours(0,0,0,0);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    dateObj.setHours(0,0,0,0);
    if (dateObj < today) continue;
    const dow = dateObj.getDay();
    const dateStr = `${pad(d)}.${pad(month+1)}.${year}`;
    // Weekly recurring slots
    for (const idata of Object.values(_schoolAvailData.instructors||{})) {
      const daySlots = (idata.weeklySlots || {})[dow] || [];
      if (daySlots.some(h => !_schoolAvailData.takenSlots.has(dateStr + '_' + h))) {
        result.add(dateStr); break;
      }
    }
    // Specific open slots created by school
    if ((_schoolAvailData.openSlots||{})[dateStr] && (_schoolAvailData.openSlots[dateStr]).length > 0) {
      result.add(dateStr);
    }
  }
  return result;
}

function _getAvailSlotsForDay(dateStr, dow) {
  const slots = [];
  if (!_schoolAvailData) return slots;

  // Time window filter — only for today
  const now = new Date();
  const [dd,mm,yy] = dateStr.split('.');
  const isToday = +yy === now.getFullYear() && +mm-1 === now.getMonth() && +dd === now.getDate();
  const minHour = isToday ? now.getHours() : 0;
  const maxHour = isToday ? now.getHours() + 10 : 24;

  // Weekly recurring slots
  for (const [iname, idata] of Object.entries(_schoolAvailData.instructors||{})) {
    const daySlots = (idata.weeklySlots || {})[dow] || [];
    daySlots.forEach(function(h) {
      if (isToday && (h < minHour || h > maxHour)) return;
      if (!_schoolAvailData.takenSlots.has(dateStr + '_' + h)) {
        slots.push({ hour: h, instructor: iname, duration: idata.duration || 60 });
      }
    });
  }
  // Specific open slots created by school
  const openForDay = (_schoolAvailData.openSlots||{})[dateStr] || [];
  openForDay.forEach(function(s) {
    if (isToday && (s.hour < minHour || s.hour > maxHour)) return;
    // Don't duplicate if already in weekly slots
    if (!slots.some(x => x.hour === s.hour && x.instructor === s.instructor)) {
      slots.push({ hour: s.hour, instructor: s.instructor, duration: s.duration, bookingId: s.bookingId });
    }
  });

  slots.sort((a,b) => a.hour - b.hour);
  return slots;
}

function quickBook(dateStr, hour, instructorName, bookingId) {
  const user = auth.currentUser;
  if (!user || !_schoolAvailData) return;
  const pad = n => String(n).padStart(2,'0');
  const time   = `${pad(hour)}:00`;
  const timeTo = `${pad(hour + 1)}:00`;
  const onSuccess = function() {
    _schoolAvailData.takenSlots.add(dateStr + '_' + hour);
    // Remove from openSlots
    if (_schoolAvailData.openSlots && _schoolAvailData.openSlots[dateStr]) {
      _schoolAvailData.openSlots[dateStr] = _schoolAvailData.openSlots[dateStr].filter(s => s.hour !== hour);
    }
    window._cal.pendingSelect = dateStr;
    loadScheduleData();
    window.notify(window.currentLang==='ru'?`Урок забронирован: ${dateStr} в ${time} ✓`:window.currentLang==='en'?`Lesson booked: ${dateStr} at ${time} ✓`:`שיעור הוזמן: ${dateStr} ב-${time} ✓`);
  };
  if (bookingId) {
    // School-created open slot — just assign student to it
    db.collection('bookings').doc(bookingId).update({
      studentId: user.uid,
      studentName: user.displayName || user.email || '—',
      bookedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(onSuccess).catch(function() { window.notify('Ошибка бронирования'); });
  } else {
    const booking = {
      schoolId:      _schoolAvailData.schoolId,
      schoolName:    _schoolAvailData.schoolName,
      instructorName: instructorName,
      studentId:     user.uid,
      studentName:   user.displayName || user.email || '—',
      date:          dateStr,
      time:          time,
      timeTo:        timeTo,
      duration:      60,
      type:          'lesson_practical',
      status:        'confirmed',
      createdBy:     'student',
      createdAt:     firebase.firestore.FieldValue.serverTimestamp(),
    };
    db.collection('bookings').add(booking).then(onSuccess).catch(function() { window.notify('Ошибка бронирования'); });
  }
}

function joinSchool(schoolId, schoolName) {
  try {
    const user = auth.currentUser;
    // Set active school and navigate immediately
    _activeSchoolId = schoolId;
    window._activeSchoolName = schoolName || '';
    window.showPage('schedule');

    if (!user) return; // not logged in — just show calendar

    // Save enrollment in background (don't block navigation)
    db.collection('enrollments').where('userId','==',user.uid).where('schoolId','==',schoolId).get()
      .then(function(snap) {
        if (snap.empty) {
          db.collection('enrollments').add({
            userId:      user.uid,
            schoolId:    schoolId,
            schoolName:  schoolName || '',
            studentName: user.displayName || user.email || '—',
            studentEmail:user.email || '',
            status:      'pending',
            createdAt:   firebase.firestore.FieldValue.serverTimestamp()
          }).then(function() {
            window.notify(window.currentLang==='ru'?'Заявка отправлена ✓':window.currentLang==='en'?'Request sent ✓':'הבקשה נשלחה ✓');
          });
        }
      }).catch(function(e) { console.warn('joinSchool enroll error', e); });
  } catch(e) {
    console.error('joinSchool error', e);
    window.showPage('schedule');
  }
}

function cancelBooking(bookingId) {
  if (!confirm(window.currentLang==='ru'?'Отменить этот урок?':window.currentLang==='en'?'Cancel this lesson?':'לבטל את השיעור?')) return;
  db.collection('bookings').doc(bookingId).update({ status: 'cancelled' })
    .then(loadScheduleData)
    .catch(function() { window.notify('Ошибка отмены'); });
}

// ══════════════════════════════════════════════════════
// SCHEDULING — BOOKING MODAL (student side)
// ══════════════════════════════════════════════════════

const _bk = {
  schoolId: null, schoolName: null,
  instructorName: null,
  weekOffset: 0,
  selectedDate: null, selectedTime: null,
  takenSlots: [],    // ["DD.MM.YYYY_HH"] strings
  availability: null,
  duration: 90,
  lessonType: 'lesson_practical',
};

function openBookingModal() {
  const user = auth.currentUser;
  if (!user) { window.openAuthModal(); return; }
  if (window._userIsSchool) {
    window.notify(window.currentLang==='ru'?'Школы не могут записываться на уроки':window.currentLang==='en'?'Schools cannot book lessons':'בתי ספר אינם יכולים להזמין שיעורים');
    return;
  }

  const overlay = document.getElementById('booking-overlay');
  overlay.style.display = 'flex';

  // Reset state
  Object.assign(_bk, { schoolId:null, schoolName:null, instructorName:null,
    weekOffset:0, selectedDate:null, selectedTime:null,
    takenSlots:[], availability:null, duration:90, lessonType:'lesson_practical' });

  // Reset UI
  document.getElementById('booking-step2').style.display = 'none';
  document.getElementById('booking-instructor-field').style.display = 'none';
  const sel = document.getElementById('booking-school-sel');
  const selPlaceholder = window.currentLang==='ru'?'— выбрать —':window.currentLang==='en'?'— select —':'— בחר —';
  sel.innerHTML = `<option value="">${selPlaceholder}</option>`;

  const titleMap = { ru:'Записаться на урок', he:'הזמן שיעור', en:'Book a lesson' };
  document.getElementById('booking-modal-title').textContent = titleMap[window.currentLang] || 'הזמן שיעור';

  // Translate type buttons
  const bkTypeLabels = window.currentLang==='ru'
    ? ['Практика','Теория','Шоссе']
    : window.currentLang==='en'
    ? ['Driving','Theory','Highway']
    : ['נהיגה','תיאוריה','כביש מהיר'];
  document.querySelectorAll('#booking-type-row .booking-type-btn').forEach(function(b, i) {
    b.classList.toggle('active', i===0);
    b.textContent = bkTypeLabels[i];
  });

  // Populate schools from confirmed enrollments
  db.collection('enrollments').where('userId', '==', user.uid).where('status', '==', 'confirmed').get()
    .then(function(snap) {
      const opts = [];
      snap.forEach(d => {
        const e = d.data();
        if (e.schoolId && e.schoolName) opts.push({ id: e.schoolId, name: e.schoolName });
      });
      if (opts.length === 0) {
        sel.innerHTML = `<option value="">${window.currentLang==='ru'?'Нет подтверждённых записей':window.currentLang==='en'?'No confirmed enrollments':'אין הרשמות מאושרות'}</option>`;
        return;
      }
      sel.innerHTML = `<option value="">${selPlaceholder}</option>` +
        opts.map(o => `<option value="${o.id}" data-name="${window.escapeHtml(o.name)}">${window.escapeHtml(o.name)}</option>`).join('');
    });
}

// Opens booking modal and pre-selects a specific date in the slot grid
function openBookingModalForDate(dateStr) {
  // Store desired date so renderBookingSlots can jump to correct week
  _bk._preselectedDate = dateStr;
  openBookingModal();
}

function closeBookingModal() {
  document.getElementById('booking-overlay').style.display = 'none';
}

function handleBookingOverlay(e) {
  if (e.target === document.getElementById('booking-overlay')) closeBookingModal();
}

function onBookingSchoolChange() {
  const sel = document.getElementById('booking-school-sel');
  const opt = sel.options[sel.selectedIndex];
  _bk.schoolId   = sel.value || null;
  _bk.schoolName = opt ? (opt.dataset.name || opt.textContent) : null;
  _bk.instructorName = null;
  document.getElementById('booking-step2').style.display = 'none';
  document.getElementById('booking-instructor-field').style.display = 'none';

  if (!_bk.schoolId) return;

  // Load instructors from school doc
  db.collection('schools').doc(_bk.schoolId).get().then(function(doc) {
    if (!doc.exists) return;
    const instructors = doc.data().instructors || [];
    const isel = document.getElementById('booking-instr-sel');
    isel.innerHTML = '<option value="">— выбрать —</option>' +
      instructors.map(n => { const name = typeof n === 'string' ? n : (n.name || ''); return `<option value="${window.escapeHtml(name)}">${window.escapeHtml(name)}</option>`; }).join('');
    document.getElementById('booking-instructor-field').style.display = 'block';
  });
}

function onBookingInstructorChange() {
  const isel = document.getElementById('booking-instr-sel');
  _bk.instructorName = isel.value || null;
  document.getElementById('booking-step2').style.display = 'none';
  if (!_bk.instructorName) return;
  _bk.selectedDate = null;
  _bk.selectedTime = null;

  // Jump to the week of the pre-selected date (from clicking a calendar day)
  if (_bk._preselectedDate) {
    const [dd,mm,yy] = _bk._preselectedDate.split('.');
    const targetDate = new Date(+yy, +mm-1, +dd);
    const today = new Date(); today.setHours(0,0,0,0);
    const startSun = new Date(today);
    startSun.setDate(today.getDate() - today.getDay());
    const diffMs = targetDate - startSun;
    _bk.weekOffset = Math.max(0, Math.floor(diffMs / (7*24*3600*1000)));
    _bk._preselectedDate = null;
  } else {
    _bk.weekOffset = 0;
  }

  // Load availability + taken slots in parallel
  Promise.all([
    db.collection('availability').doc(_bk.schoolId).get(),
    db.collection('bookings')
      .where('schoolId', '==', _bk.schoolId)
      .where('instructorName', '==', _bk.instructorName)
      .where('status', '==', 'confirmed')
      .get()
  ]).then(function([availDoc, bookSnap]) {
    const instrData = availDoc.exists
      ? ((availDoc.data().instructors || {})[_bk.instructorName] || {})
      : {};
    _bk.availability = instrData.weeklySlots || {};
    _bk.duration     = instrData.duration    || 90;

    _bk.takenSlots = [];
    bookSnap.forEach(d => {
      const b = d.data();
      _bk.takenSlots.push(b.date + '_' + b.time.split(':')[0]);
    });

    document.getElementById('booking-step2').style.display = 'block';
    renderBookingSlots();
  }).catch(function() {
    _bk.availability = {};
    document.getElementById('booking-step2').style.display = 'block';
    renderBookingSlots();
  });
}

function bookingWeekNav(dir) {
  _bk.weekOffset += dir;
  if (_bk.weekOffset < 0) _bk.weekOffset = 0;
  _bk.selectedDate = null;
  _bk.selectedTime = null;
  renderBookingSlots();
}

function renderBookingSlots() {
  if (!_bk.availability) return;

  const today = new Date();
  today.setHours(0,0,0,0);
  // Start of display week (offset from current week's Sunday)
  const startDay = new Date(today);
  const daySunOffset = today.getDay(); // 0=Sun
  startDay.setDate(today.getDate() - daySunOffset + _bk.weekOffset * 7);

  const endDay = new Date(startDay);
  endDay.setDate(startDay.getDate() + 6);

  // Week label
  const fmt = (d) => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;
  document.getElementById('booking-week-label').textContent = `${fmt(startDay)} – ${fmt(endDay)}`;

  const days = DAY_LABELS[window.currentLang] || DAY_LABELS.ru;

  // Build header row
  let gridHtml = '<div class="booking-hour-lbl"></div>';
  for (let di = 0; di < 7; di++) {
    const d = new Date(startDay); d.setDate(startDay.getDate() + di);
    const isToday = d.toDateString() === today.toDateString();
    const isPast  = d < today;
    gridHtml += `<div class="booking-col-header ${isToday?'today':''}" style="${isPast?'opacity:0.4':''}">
      ${days[di]}<span>${d.getDate()}</span>
    </div>`;
  }

  // Build slot rows
  for (const h of HOURS) {
    gridHtml += `<div class="booking-hour-lbl">${h}:00</div>`;
    for (let di = 0; di < 7; di++) {
      const d = new Date(startDay); d.setDate(startDay.getDate() + di);
      const isPast = d < today || (d.toDateString()===today.toDateString() && h <= new Date().getHours());
      const dateStr = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
      const key = dateStr + '_' + h;
      const dayOfWeek = d.getDay();
      const availHours = _bk.availability[dayOfWeek] || [];
      const isAvail = availHours.includes(h);
      const isTaken = _bk.takenSlots.includes(key);
      const isSelected = _bk.selectedDate === dateStr && _bk.selectedTime === h + ':00';

      let cls = '';
      if (isPast || !isAvail)  cls = '';
      else if (isTaken)        cls = 'taken';
      else if (isSelected)     cls = 'free selected';
      else                     cls = 'free';

      const onclick = (!isPast && isAvail && !isTaken)
        ? `onclick="selectBookingSlot('${dateStr}','${h}:00',this)"`
        : '';
      gridHtml += `<div class="booking-slot-cell ${cls}" ${onclick} title="${h}:00"></div>`;
    }
  }

  document.getElementById('booking-slots-grid').innerHTML = gridHtml;
  updateBookingConfirmBtn();
}

function selectBookingSlot(date, time, el) {
  _bk.selectedDate = date;
  _bk.selectedTime = time;
  // Deselect others
  document.querySelectorAll('.booking-slot-cell.selected').forEach(c => {
    c.classList.remove('selected');
    c.classList.add('free');
  });
  el.classList.remove('free');
  el.classList.add('selected');

  const info = document.getElementById('booking-selected-info');
  info.style.display = 'block';
  const durTxt = `${_bk.duration} мин`;
  info.textContent = `📅 ${date} · ${time} · ${durTxt}`;
  updateBookingConfirmBtn();
}

function selectBookingType(btn) {
  document.querySelectorAll('.booking-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _bk.lessonType = btn.dataset.type;
}

function updateBookingConfirmBtn() {
  const btn = document.getElementById('booking-confirm-btn');
  if (!btn) return;
  const ready = !!(_bk.selectedDate && _bk.selectedTime);
  btn.disabled = !ready;
  const labels = { ru:'Подтвердить запись', he:'אשר הזמנה', en:'Confirm booking' };
  btn.textContent = ready
    ? (labels[window.currentLang] || 'Подтвердить запись') + ` — ${_bk.selectedDate} ${_bk.selectedTime}`
    : (window.currentLang==='ru'?'Выберите время':window.currentLang==='en'?'Select a time slot':'בחר זמן');
}

function confirmBooking() {
  const user = auth.currentUser;
  if (!user || !_bk.selectedDate || !_bk.selectedTime) return;

  const btn = document.getElementById('booking-confirm-btn');
  btn.disabled = true;
  btn.textContent = '…';

  const booking = {
    schoolId:       _bk.schoolId,
    schoolName:     _bk.schoolName || '',
    instructorName: _bk.instructorName,
    studentId:      user.uid,
    studentName:    user.displayName || user.email.split('@')[0],
    date:           _bk.selectedDate,
    time:           _bk.selectedTime,
    duration:       _bk.duration,
    type:           _bk.lessonType,
    status:         'confirmed',
    createdAt:      firebase.firestore.FieldValue.serverTimestamp(),
  };

  db.collection('bookings').add(booking).then(function() {
    closeBookingModal();
    // Navigate calendar to the booked month
    const [bd,bm,by] = _bk.selectedDate.split('.');
    window._cal.year = +by; window._cal.month = +bm - 1; window._cal.selectedDate = _bk.selectedDate;
    loadScheduleData();
    const msg = window.currentLang==='ru' ? `Урок записан: ${_bk.selectedDate} в ${_bk.selectedTime} ✓`
              : window.currentLang==='en' ? `Lesson booked: ${_bk.selectedDate} at ${_bk.selectedTime} ✓`
              : `שיעור הוזמן: ${_bk.selectedDate} ב-${_bk.selectedTime} ✓`;
    window.notify(msg);
  }).catch(function() {
    window.notify('Ошибка при записи. Попробуйте снова.');
    btn.disabled = false;
    updateBookingConfirmBtn();
  });
}

// ══════════════════════════════════════════════════════
// SCHOOL ADD LESSON MODAL
// ══════════════════════════════════════════════════════

function openSchoolLessonModal(presetDateStr) {
  const user = auth.currentUser;
  if (!user || !window._userIsSchool) return;

  const overlay = document.getElementById('sl-overlay');
  overlay.style.display = 'flex';

  // Labels
  const L = {
    title:   window.currentLang==='ru'?'Добавить урок':window.currentLang==='en'?'Add lesson':'הוסף שיעור',
    date:    window.currentLang==='ru'?'Дата':window.currentLang==='en'?'Date':'תאריך',
    time:    window.currentLang==='ru'?'Время':window.currentLang==='en'?'Time':'שעה',
    instr:   window.currentLang==='ru'?'Машина':window.currentLang==='en'?'Car':'מכונית',
    student: window.currentLang==='ru'?'Ученик':window.currentLang==='en'?'Student':'תלמיד',
    confirm: window.currentLang==='ru'?'Добавить урок':window.currentLang==='en'?'Add lesson':'הוסף שיעור',
  };
  document.getElementById('sl-title').textContent = L.title;
  document.getElementById('sl-lbl-date').textContent = L.date;
  document.getElementById('sl-lbl-time').textContent = L.time;
  document.getElementById('sl-lbl-instr').textContent = L.instr;
  document.getElementById('sl-lbl-student').textContent = L.student;
  const confirmBtnEl = document.getElementById('sl-confirm-btn');
  confirmBtnEl.textContent = L.confirm;
  confirmBtnEl.disabled = false;

  // Default date = preset (from calendar click) or tomorrow; min = today
  const today = new Date();
  const pad = n => String(n).padStart(2,'0');
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth()+1)}-${pad(tomorrow.getDate())}`;
  const dateInput = document.getElementById('sl-date');
  dateInput.min = todayStr;
  dateInput.value = (presetDateStr && presetDateStr >= todayStr) ? presetDateStr : tomorrowStr;

  // Default time: from 09:00, to 10:00
  const fromSel = document.getElementById('sl-time-from');
  const toSel   = document.getElementById('sl-time-to');
  if (fromSel) fromSel.value = '9';
  if (toSel)   toSel.value   = '10';
  // Update from/to labels
  const fromLbl = document.getElementById('sl-lbl-from');
  const toLbl   = document.getElementById('sl-lbl-to');
  if (fromLbl) fromLbl.textContent = window.currentLang==='ru'?'С':window.currentLang==='en'?'From':'מ-';
  if (toLbl)   toLbl.textContent   = window.currentLang==='ru'?'До':window.currentLang==='en'?'To':'עד';

  // Reset type + translate labels
  const typeLabels = window.currentLang==='ru'
    ? ['Вождение','Теория','Шоссе']
    : window.currentLang==='en'
    ? ['Driving','Theory','Highway']
    : ['נהיגה','תיאוריה','כביש מהיר'];
  document.querySelectorAll('#sl-type-row .booking-type-btn').forEach(function(b, i) {
    b.classList.toggle('active', i===0);
    b.textContent = typeLabels[i];
  });

  // Reset repeat controls
  const repeatN = document.getElementById('sl-repeat-n');
  if (repeatN) repeatN.textContent = '1';
  const rl = window.currentLang;
  const repeatQtyLbl = document.getElementById('sl-repeat-qty-lbl');
  if (repeatQtyLbl) repeatQtyLbl.textContent = rl==='ru'?'Уроков:':rl==='en'?'Lessons:':'שיעורים:';
  _updateRepeatHint();
  _updateRepeatConfirmBtn();

  // Load cars (instructors field stores car objects)
  db.collection('schools').doc(user.uid).get().then(function(doc) {
    const cars = doc.exists ? (doc.data().instructors || []) : [];
    const isel = document.getElementById('sl-instr');
    const none = window.currentLang==='ru'?'— не указана —':window.currentLang==='en'?'— none —':'— לא צוין —';
    const colorNames = { black: window.currentLang==='ru'?'Чёрный':window.currentLang==='en'?'Black':'שחור', white: window.currentLang==='ru'?'Белый':window.currentLang==='en'?'White':'לבן', silver: window.currentLang==='ru'?'Серый':window.currentLang==='en'?'Silver':'כסף', blue: window.currentLang==='ru'?'Синий':window.currentLang==='en'?'Blue':'כחול', red: window.currentLang==='ru'?'Красный':window.currentLang==='en'?'Red':'אדום', brown: window.currentLang==='ru'?'Коричн.':window.currentLang==='en'?'Brown':'חום', green: window.currentLang==='ru'?'Зелёный':window.currentLang==='en'?'Green':'ירוק' };
    const transNames = { auto: window.currentLang==='ru'?'Автомат':window.currentLang==='en'?'Auto':'אוטומט', manual: window.currentLang==='ru'?'Механика':window.currentLang==='en'?'Manual':'ידני' };
    isel.innerHTML = `<option value="">${none}</option>` +
      cars.map(function(c, i) {
        const model = typeof c === 'string' ? c : (c.model || c.name || '?');
        const color = (typeof c === 'object' && c.color) ? (' · ' + (colorNames[c.color] || c.color)) : '';
        const trans = (typeof c === 'object' && c.transmission) ? (' · ' + (transNames[c.transmission] || c.transmission)) : '';
        const label = model + color + trans;
        return `<option value="${window.escapeHtml(model)}">${window.escapeHtml(label)}</option>`;
      }).join('');
    // Restore last selected car
    const lastCar = localStorage.getItem('sl_last_car');
    if (lastCar) {
      for (let i = 0; i < isel.options.length; i++) {
        if (isel.options[i].value === lastCar) { isel.selectedIndex = i; break; }
      }
    }
  });

  // Load confirmed students
  db.collection('enrollments').where('schoolId','==',user.uid).where('status','==','confirmed').get()
    .then(function(snap) {
      const ssel = document.getElementById('sl-student');
      const none = window.currentLang==='ru'?'— не указан —':window.currentLang==='en'?'— none —':'— לא צוין —';
      const opts = [];
      snap.forEach(d => {
        const e = d.data();
        opts.push({ id: e.userId||d.id, name: e.studentName||e.studentEmail||'?' });
      });
      ssel.innerHTML = `<option value="">${none}</option>` +
        opts.map(s => `<option value="${s.id}" data-name="${window.escapeHtml(s.name)}">${window.escapeHtml(s.name)}</option>`).join('');
    });

  // Load routes for route selector
  const routeLblEl = document.getElementById('sl-lbl-route');
  if (routeLblEl) routeLblEl.textContent = window.currentLang==='ru'?'Маршрут':window.currentLang==='en'?'Route':'מסלול';
  const rsel = document.getElementById('sl-route');
  if (rsel) {
    const noneRoute = window.currentLang==='ru'?'— без маршрута —':window.currentLang==='en'?'— no route —':'— ללא מסלול —';
    rsel.innerHTML = `<option value="">${noneRoute}</option>`;
    db.collection('routes').where('schoolId','==',user.uid).get().then(function(snap) {
      snap.forEach(function(d) {
        const r = d.data();
        const diffLabel = { easy: window.currentLang==='ru'?'Лёгкий':window.currentLang==='en'?'Easy':'קל', medium: window.currentLang==='ru'?'Средний':window.currentLang==='en'?'Medium':'בינוני', hard: window.currentLang==='ru'?'Сложный':window.currentLang==='en'?'Hard':'קשה' };
        const dist = r.distance ? ' · ' + r.distance.toFixed(1) + ' км' : '';
        const diff = r.difficulty ? ' (' + (diffLabel[r.difficulty]||r.difficulty) + ')' : '';
        rsel.innerHTML += `<option value="${d.id}">${window.escapeHtml(r.name||'—')}${dist}${diff}</option>`;
      });
    });
  }
}

function closeSchoolLessonModal() {
  document.getElementById('sl-overlay').style.display = 'none';
}

function handleSlOverlay(e) {
  if (e.target === document.getElementById('sl-overlay')) closeSchoolLessonModal();
}

function selectSlType(btn) {
  document.querySelectorAll('#sl-type-row .booking-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function toggleRepeatOption() { /* no-op, kept for compatibility */ }

function changeRepeatCount(delta) {
  const el = document.getElementById('sl-repeat-n');
  if (!el) return;
  let n = parseInt(el.textContent, 10) + delta;
  if (n < 1) n = 1;
  if (n > 52) n = 52;
  el.textContent = n;
  _updateRepeatHint();
  _updateRepeatConfirmBtn();
}

function _updateRepeatHint() {
  const el = document.getElementById('sl-repeat-n');
  const hint = document.getElementById('sl-repeat-hint');
  if (!el || !hint) return;
  const n = parseInt(el.textContent, 10);
  if (n <= 1) { hint.textContent = ''; return; }
  const weeks = n - 1;
  hint.textContent = window.currentLang === 'ru' ? `≈ ${weeks} нед.`
    : window.currentLang === 'en' ? `≈ ${weeks} wks`
    : `≈ ${weeks} שב'`;
}

function _updateRepeatConfirmBtn() {
  const btn = document.getElementById('sl-confirm-btn');
  if (!btn) return;
  const n = parseInt((document.getElementById('sl-repeat-n') || {}).textContent || '1', 10);
  const ruForm = n === 1 ? 'урок' : (n >= 2 && n <= 4) ? 'урока' : 'уроков';
  btn.textContent = window.currentLang === 'ru' ? `Добавить ${n} ${ruForm}`
    : window.currentLang === 'en' ? (n === 1 ? 'Add lesson' : `Add ${n} lessons`)
    : (n === 1 ? 'הוסף שיעור' : `הוסף ${n} שיעורים`);
}

// DD.MM.YYYY → Date, add N days → DD.MM.YYYY
function _addDaysToDateStr(dateStr, n) {
  const parts = dateStr.split('.');
  const dt = new Date(+parts[2], +parts[1] - 1, +parts[0]);
  dt.setDate(dt.getDate() + n);
  const pad = x => String(x).padStart(2, '0');
  return `${pad(dt.getDate())}.${pad(dt.getMonth()+1)}.${dt.getFullYear()}`;
}

function confirmSchoolLesson() {
  const user = auth.currentUser;
  if (!user) return;

  const dateVal = document.getElementById('sl-date').value; // YYYY-MM-DD
  if (!dateVal) { window.notify(window.currentLang==='ru'?'Выберите дату':'בחר תאריך'); return; }

  const [y,m,d] = dateVal.split('-');
  const dateStr = `${d}.${m}.${y}`;
  const fromH = parseInt(document.getElementById('sl-time-from').value, 10);
  const toH   = parseInt(document.getElementById('sl-time-to').value,   10);
  const pad = n => String(n).padStart(2,'0');
  const time = `${pad(fromH)}:00`;
  const timeTo = `${pad(toH)}:00`;
  const instrSel = document.getElementById('sl-instr');
  if (instrSel.value) localStorage.setItem('sl_last_car', instrSel.value);
  const studSel  = document.getElementById('sl-student');
  const typeBtn  = document.querySelector('#sl-type-row .booking-type-btn.active');
  const studOpt  = studSel.options[studSel.selectedIndex];

  const routeSel   = document.getElementById('sl-route');
  const confirmBtn = document.getElementById('sl-confirm-btn');
  confirmBtn.disabled = true; confirmBtn.textContent = '…';

  // Validate from < to
  if (fromH >= toH) {
    window.notify(window.currentLang==='ru'?'Время "До" должно быть позже "С"':window.currentLang==='en'?'"To" must be after "From"':'"עד" חייב להיות אחרי "מ-"');
    confirmBtn.disabled = false; _updateRepeatConfirmBtn();
    return;
  }

  // Validate: no past dates/times
  const selectedDateObj = new Date(+y, +m-1, +d);
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (selectedDateObj < todayMidnight) {
    window.notify(window.currentLang==='ru'?'Нельзя добавить урок на прошедшую дату':window.currentLang==='en'?'Cannot schedule in the past':'לא ניתן לתזמן בעבר');
    confirmBtn.disabled = false; _updateRepeatConfirmBtn();
    return;
  }
  if (selectedDateObj.getTime() === todayMidnight.getTime() && fromH <= now.getHours()) {
    window.notify(window.currentLang==='ru'?'Выберите будущее время':window.currentLang==='en'?'Choose a future time':'בחר שעה עתידית');
    confirmBtn.disabled = false; _updateRepeatConfirmBtn();
    return;
  }

  const repeatN = parseInt((document.getElementById('sl-repeat-n') || {}).textContent || '1', 10);

  const duration = (toH - fromH) * 60;

  db.collection('schools').doc(user.uid).get().then(function(doc) {
    const school = doc.exists ? doc.data() : {};
    const baseBooking = {
      schoolId:       user.uid,
      schoolName:     school.name || '',
      instructorName: instrSel.value || '',
      studentId:      studSel.value || 'open',
      studentName:    (studSel.value && studOpt) ? (studOpt.dataset.name || studOpt.textContent) : '—',
      routeId:        (routeSel && routeSel.value) ? routeSel.value : null,
      routeName:      (routeSel && routeSel.value) ? (routeSel.options[routeSel.selectedIndex].textContent) : null,
      time:           time,
      timeTo:         timeTo,
      duration:       duration,
      type:           typeBtn ? typeBtn.dataset.type : 'lesson_practical',
      status:         'confirmed',
      createdBy:      'school',
      createdAt:      firebase.firestore.FieldValue.serverTimestamp(),
    };

    // Generate a shared group ID for repeat series
    const groupId = repeatN > 1 ? (user.uid + '_' + Date.now()) : null;

    const batch = db.batch();
    for (let i = 0; i < repeatN; i++) {
      const lessonDateStr = i === 0 ? dateStr : _addDaysToDateStr(dateStr, i * 7);
      const ref = db.collection('bookings').doc();
      batch.set(ref, Object.assign({}, baseBooking, {
        date: lessonDateStr,
        repeatGroup: groupId,
        repeatIndex: repeatN > 1 ? i : null,
      }));
    }

    batch.commit().then(function() {
      closeSchoolLessonModal();
      window._cal.year = +y; window._cal.month = +m - 1; window._cal.pendingSelect = dateStr;
      loadScheduleData();
      const msg = repeatN > 1
        ? (window.currentLang==='ru' ? `${repeatN} уроков добавлено ✓`
           : window.currentLang==='en' ? `${repeatN} lessons added ✓`
           : `${repeatN} שיעורים נוספו ✓`)
        : (window.currentLang==='ru' ? `Урок добавлен: ${dateStr} ${time}–${timeTo} ✓`
           : window.currentLang==='en' ? `Lesson added: ${dateStr} ${time}–${timeTo} ✓`
           : `שיעור נוסף: ${dateStr} ${time}–${timeTo} ✓`);
      window.notify(msg);
    }).catch(function() {
      window.notify(window.currentLang==='ru'?'Ошибка добавления':'שגיאה');
      confirmBtn.disabled = false;
      _updateRepeatConfirmBtn();
    });
  });
}

// ── Window exports (called from HTML onclick handlers) ──
window.saveAvailability = saveAvailability;
window.toggleAvailCell = toggleAvailCell;
window.toggleAvailDay = toggleAvailDay;
window.updateAvailHours = updateAvailHours;
window.setDuration = setDuration;
window.loadScheduleData = loadScheduleData;
window.renderCalendarView = renderCalendarView;
window.renderCalendarGrid = renderCalendarGrid;
window.schedCalNav = schedCalNav;
window.schedCalSelect = schedCalSelect;
window.quickBook = quickBook;
window.joinSchool = joinSchool;
window.cancelBooking = cancelBooking;
window.openBookingModal = openBookingModal;
window.openBookingModalForDate = openBookingModalForDate;
window.closeBookingModal = closeBookingModal;
window.handleBookingOverlay = handleBookingOverlay;
window.onBookingSchoolChange = onBookingSchoolChange;
window.onBookingInstructorChange = onBookingInstructorChange;
window.bookingWeekNav = bookingWeekNav;
window.renderBookingSlots = renderBookingSlots;
window.selectBookingSlot = selectBookingSlot;
window.selectBookingType = selectBookingType;
window.updateBookingConfirmBtn = updateBookingConfirmBtn;
window.confirmBooking = confirmBooking;
window.openSchoolLessonModal = openSchoolLessonModal;
window.closeSchoolLessonModal = closeSchoolLessonModal;
window.handleSlOverlay = handleSlOverlay;
window.selectSlType = selectSlType;
window.confirmSchoolLesson = confirmSchoolLesson;
window.toggleRepeatOption = toggleRepeatOption;
window.changeRepeatCount = changeRepeatCount;
window.loadScheduleData = loadScheduleData;

// ─── LOCKED CALENDAR (student states 1 & 2) ───

function _renderFakeCalendarGrid() {
  const lang = window.currentLang || 'ru';
  const days = lang === 'ru' ? ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']
             : lang === 'en' ? ['Mo','Tu','We','Th','Fr','Sa','Su']
             : ['ב','ג','ד','ה','ו','ש','א'];
  let html = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;padding:8px 4px 4px;">';
  days.forEach(function(d) {
    html += `<div style="text-align:center;font-size:0.7rem;color:rgba(255,255,255,0.3);padding:4px 0;">${d}</div>`;
  });
  const nums = [28,29,30,31,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,1];
  nums.forEach(function(n, i) {
    const hasLesson = [2,5,9,14,18,22,26].includes(i);
    html += `<div style="height:38px;background:${hasLesson?'rgba(99,102,241,0.4)':'rgba(255,255,255,0.05)'};border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:0.75rem;color:rgba(255,255,255,0.2);">${n}</div>`;
  });
  return html + '</div>';
}

function renderLockedCalendar(state, schoolName) {
  const container = document.getElementById('schedule-body');
  if (!container) return;
  const lang = window.currentLang || 'ru';

  const isNoSchool = state === 'no_school';

  let overlayContent;
  if (isNoSchool) {
    overlayContent = `
      <div style="font-size:3rem;line-height:1;">🏫</div>
      <div style="font-size:1.05rem;font-weight:700;color:white;">${lang==='ru'?'Присоединитесь к школе':lang==='en'?'Join a driving school':'הצטרף לבית ספר'}</div>
      <div style="font-size:0.82rem;color:rgba(255,255,255,0.55);max-width:260px;line-height:1.5;">${lang==='ru'?'Выберите автошколу чтобы видеть расписание и записываться на уроки':lang==='en'?'Choose a school to see their schedule and book lessons':'בחר בית ספר כדי לראות את הלוח ולהזמין שיעורים'}</div>
      <button onclick="window.showPage('schools')" style="margin-top:6px;padding:12px 32px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:12px;color:white;font-weight:700;cursor:pointer;font-size:0.9rem;font-family:inherit;">${lang==='ru'?'Найти школу':lang==='en'?'Find a school':'מצא בית ספר'}</button>`;
  } else {
    const sName = schoolName ? `<div style="font-size:0.9rem;font-weight:700;color:rgba(255,255,255,0.9);background:rgba(255,255,255,0.08);padding:8px 18px;border-radius:20px;margin-top:2px;">${schoolName}</div>` : '';
    overlayContent = `
      <div style="font-size:3rem;line-height:1;">📬</div>
      <div style="font-size:1.05rem;font-weight:700;color:white;">${lang==='ru'?'Заявка на рассмотрении':lang==='en'?'Application under review':'הבקשה בבדיקה'}</div>
      ${sName}
      <div style="font-size:0.82rem;color:rgba(255,255,255,0.5);max-width:280px;line-height:1.6;">${lang==='ru'?'Учитель рассматривает вашу заявку. Как только он подтвердит — вы получите доступ к расписанию и урокам.':lang==='en'?'The teacher is reviewing your application. Once confirmed, you will get access to the schedule and lessons.':'המורה בוחן את הבקשה שלך. לאחר האישור תקבל גישה ללוח ולשיעורים.'}</div>
      <div style="display:flex;align-items:center;gap:8px;padding:10px 20px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.25);border-radius:12px;">
        <div style="width:8px;height:8px;border-radius:50%;background:#f59e0b;animation:sched-pulse 1.5s infinite;flex-shrink:0;"></div>
        <span style="font-size:0.8rem;color:#fcd34d;font-weight:600;">${lang==='ru'?'Ожидаем подтверждения учителя':lang==='en'?'Awaiting teacher confirmation':'ממתין לאישור המורה'}</span>
      </div>`;
  }

  container.innerHTML = `
    <div style="position:relative;overflow:hidden;border-radius:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);min-height:320px;">
      <div style="filter:blur(5px);pointer-events:none;opacity:0.3;user-select:none;">
        ${_renderFakeCalendarGrid()}
      </div>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:32px;">
        ${overlayContent}
      </div>
    </div>
    <style>@keyframes sched-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.4)}}</style>`;
}
window.renderAvailabilityEditor = renderAvailabilityEditor;
