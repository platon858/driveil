import firebase from 'firebase/compat/app';
import { auth, db } from './firebase.js';
import { i18n } from './data/translations.js';
import { S, catCfg, cityRegionMap } from './data/signs.js';
import { questions } from './data/questions.js';

const EMAILJS_PUBLIC_KEY    = 'eRJ-MZjHIVvd2WeQw';
const EMAILJS_SERVICE_ID    = 'service_032c1cn';
const EMAILJS_TEMPLATE_ID   = 'template_wjy8fw6';

// ══════════════════════════════════════════════════════
// TRANSLATIONS
// ══════════════════════════════════════════════════════

// Школы загружаются из Firestore — статичных данных нет
let schools = [];


// ── SVG ROAD SIGN GENERATORS ──




// ── State ──
let currentLang = 'he';
let t = i18n.he;
let currentQ = 0, score = 0, answered = false, shuffled = [];
let activeTestimonial = 0;
let testimonialTimer = null;

// ── Set Language ──
function setLang(lang) {
  currentLang = lang;
  t = i18n[lang];
  document.documentElement.lang = t.lang;
  document.documentElement.dir = t.dir;
  document.getElementById('lang-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  applyTranslations();
  setTimeout(() => updateNavSpotlight('home'), 50);
  loadFirestoreSchools(); // загружаем школы из Firestore (обновит карточки и карту)
  renderTestimonials();
  renderFAQ();
  startTest();
  initScrollAnimations();
  setTimeout(animateStats, 400);
}

function backToLang() {
  document.getElementById('lang-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key] !== undefined) el.textContent = t[key];
  });
  // Update theme button label and tooltip
  const isDark = document.documentElement.classList.contains('dark');
  const lbl = document.getElementById('tt-label');
  const btn = document.getElementById('sb-theme-btn');
  const labelText = isDark ? (t.theme_light || 'Светлая тема') : (t.theme_dark || 'Тёмная тема');
  if (lbl) lbl.textContent = labelText;
  if (btn) btn.title = labelText;
}

// ── FIREBASE ──
// ── Security: HTML escaping to prevent XSS from Firestore data ──
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// ── Security: validate Israeli phone format ──
function isValidIsraeliPhone(phone) {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  return /^(\+972|972|0)[5][0-9]{8}$/.test(cleaned) ||
         /^(\+972|972|0)[2-9][0-9]{7,8}$/.test(cleaned);
}


// Слушаем — вошёл пользователь или вышел
auth.onAuthStateChanged(function(user) {
  const wrap = document.getElementById('auth-header-btn');
  const sbAuth = document.getElementById('sb-auth-area');
  const dashBtn = document.getElementById('snav-dashboard');
  if (user) {
    const name = user.displayName || user.email.split('@')[0];
    const letter = name.charAt(0).toUpperCase();
    // old header compat
    if (wrap) wrap.innerHTML = `<div class="user-chip"><div class="user-avatar">${letter}</div><span class="user-name">${name}</span><button class="logout-btn" onclick="logoutUser()">✕</button></div>`;
    // sidebar user area
    if (sbAuth) sbAuth.innerHTML = `
      <div class="sb-user">
        <div class="sb-avatar">${letter}</div>
        <span class="sb-user-name">${escapeHtml(name)}</span>
      </div>
      <button class="sb-btn" onclick="showPage('dashboard')">
        <span class="sb-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></span>
        <span class="sb-label" data-i18n="nav_dashboard">${t.nav_dashboard||'Кабинет'}</span>
      </button>
      <button class="sb-btn" onclick="logoutUser()" style="color:rgba(255,100,100,0.8)">
        <span class="sb-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></span>
        <span class="sb-label" data-i18n="nav_logout">${t.nav_logout||'Выйти'}</span>
      </button>`;
    if (dashBtn) dashBtn.style.display = 'flex';
    closeAuthModal();
  } else {
    if (wrap) wrap.innerHTML = `<button class="auth-btn" onclick="openAuthModal()">Войти</button>`;
    if (sbAuth) sbAuth.innerHTML = `<button class="sb-auth-btn" onclick="openAuthModal()"><span class="sb-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg></span><span class="sb-label" data-i18n="nav_login">${t.nav_login||'Войти'}</span></button>`;
    if (dashBtn) dashBtn.style.display = 'none';
  }
});

// Открыть / закрыть модальное окно
function openAuthModal() {
  document.getElementById('auth-overlay').style.display = 'flex';
  document.getElementById('auth-email').focus();
}
function closeAuthModal() {
  document.getElementById('auth-overlay').style.display = 'none';
  document.getElementById('auth-error').style.display = 'none';
  document.getElementById('auth-email').value = '';
  document.getElementById('auth-password').value = '';
  document.getElementById('auth-name').value = '';
}
function handleOverlayClick(e) {
  if (e.target === document.getElementById('auth-overlay')) closeAuthModal();
}

// Переключение вкладок Войти / Регистрация
let authMode = 'login';
let authRole = 'student'; // 'student' или 'school'

function switchAuthTab(mode) {
  authMode = mode;
  document.getElementById('tab-login').classList.toggle('active', mode === 'login');
  document.getElementById('tab-register').classList.toggle('active', mode === 'register');
  const isReg = mode === 'register';
  document.getElementById('auth-name-wrap').style.display = isReg ? 'flex' : 'none';
  document.getElementById('auth-role-block').style.display = isReg ? 'flex' : 'none';
  document.getElementById('auth-submit-btn').textContent = isReg ? 'Зарегистрироваться' : 'Войти';
  document.getElementById('auth-error').style.display = 'none';
  const titleEl = document.getElementById('auth-form-title');
  const subEl   = document.getElementById('auth-subtitle');
  if (titleEl) titleEl.textContent = isReg ? 'Создать аккаунт' : 'Войти';
  if (subEl)   subEl.textContent   = isReg ? 'Зарегистрируйся бесплатно' : 'Войди в свой аккаунт DriveIL';
  // reset password strength bar
  document.getElementById('pw-strength').classList.remove('show');
  document.getElementById('auth-email').classList.remove('error','valid');
  document.getElementById('email-hint').classList.remove('show');
  if (isReg) selectRole(authRole);
}

function selectRole(role) {
  authRole = role;
  document.getElementById('role-student').classList.toggle('active', role === 'student');
  document.getElementById('role-school').classList.toggle('active', role === 'school');
  const nameLabel = document.getElementById('auth-name-label');
  const nameInput = document.getElementById('auth-name');
  const schoolFields = document.getElementById('auth-school-fields');
  if (role === 'school') {
    nameLabel.textContent = 'Ваше имя (владелец)';
    nameInput.placeholder = 'Матфей';
    schoolFields.classList.add('visible');
  } else {
    nameLabel.textContent = 'Ваше имя';
    nameInput.placeholder = 'Матфей';
    schoolFields.classList.remove('visible');
  }
}

// ── Email / password validation helpers ──
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}
function validateEmailField() {
  const input = document.getElementById('auth-email');
  const hint  = document.getElementById('email-hint');
  const val   = input.value.trim();
  if (!val) { input.classList.remove('error','valid'); hint.classList.remove('show'); return; }
  if (isValidEmail(val)) {
    input.classList.remove('error'); input.classList.add('valid'); hint.classList.remove('show');
  } else {
    input.classList.remove('valid'); input.classList.add('error'); hint.classList.add('show');
  }
}
function getPwStrength(pw) {
  if (pw.length < 6) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) || /[א-ת]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9א-ת]/.test(pw)) score++;
  return Math.min(score + 1, 4);
}
function updatePwStrength() {
  const pw   = document.getElementById('auth-password').value;
  const wrap = document.getElementById('pw-strength');
  const lbl  = document.getElementById('pw-label');
  if (authMode !== 'register') { wrap.classList.remove('show'); return; }
  wrap.classList.toggle('show', pw.length > 0);
  const strength = getPwStrength(pw);
  const bars = [document.getElementById('pw-bar-1'), document.getElementById('pw-bar-2'), document.getElementById('pw-bar-3'), document.getElementById('pw-bar-4')];
  const cls  = strength <= 1 ? 'weak' : strength <= 2 ? 'medium' : 'strong';
  const labels = { weak: 'Слабый пароль', medium: 'Средний пароль', strong: 'Надёжный пароль' };
  bars.forEach(function(b, i) {
    b.className = 'auth-pw-bar' + (i < strength ? ' ' + cls : '');
  });
  if (lbl) lbl.textContent = labels[cls] || '';
}
function togglePwVisibility() {
  const input = document.getElementById('auth-password');
  const icon  = document.getElementById('eye-icon');
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  icon.innerHTML = isHidden
    ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>'
    : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
}

// Войти или зарегистрироваться
function submitAuth() {
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const name     = document.getElementById('auth-name').value.trim();
  const btn      = document.getElementById('auth-submit-btn');

  if (!email || !password) { showAuthError('Заполни все поля'); return; }
  if (!isValidEmail(email)) { showAuthError('Введи корректный email (example@gmail.com)'); validateEmailField(); return; }
  if (authMode === 'register' && password.length < 8) { showAuthError('Пароль минимум 8 символов'); return; }
  if (authMode === 'login'    && password.length < 6) { showAuthError('Введи пароль'); return; }

  btn.textContent = '...';
  btn.disabled = true;

  if (authMode === 'login') {
    auth.signInWithEmailAndPassword(email, password)
      .catch(function(err) {
        btn.disabled = false;
        btn.textContent = 'Войти';
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          showAuthError('Неверный email или пароль');
        } else {
          showAuthError('Ошибка: ' + err.message);
        }
      });
  } else {
    if (!name) { btn.disabled = false; btn.textContent = 'Зарегистрироваться'; showAuthError('Введи своё имя'); return; }

    // Если регистрируется автошкола — проверяем доп. поля
    if (authRole === 'school') {
      const schoolName    = document.getElementById('auth-school-name').value.trim();
      const citySelect    = document.getElementById('auth-school-city');
      const cityOption    = citySelect.options[citySelect.selectedIndex];
      const schoolAddress = document.getElementById('auth-school-address').value.trim();
      const schoolPhone   = document.getElementById('auth-school-phone').value.trim();
      if (!schoolName) { btn.disabled = false; btn.textContent = 'Зарегистрироваться'; showAuthError('Введи название автошколы'); return; }
      if (!citySelect.value) { btn.disabled = false; btn.textContent = 'Зарегистрироваться'; showAuthError('Выбери город'); return; }
      if (!schoolAddress) { btn.disabled = false; btn.textContent = 'Зарегистрироваться'; showAuthError('Введи адрес'); return; }
      // Валидация: координаты выбранного города должны быть в Израиле (широта 29–34, долгота 34–36)
      const lat = parseFloat(cityOption.dataset.lat);
      const lng = parseFloat(cityOption.dataset.lng);
      if (isNaN(lat) || isNaN(lng) || lat < 29 || lat > 34 || lng < 34 || lng > 36) {
        btn.disabled = false; btn.textContent = 'Зарегистрироваться';
        showAuthError('Выбранный город находится вне Израиля. Мы работаем только в Израиле.'); return;
      }

      // Проверяем дублирующийся телефон
      const phoneCheckPromise = schoolPhone
        ? db.collection('schools').where('phone', '==', schoolPhone).get().then(function(snap) {
            if (!snap.empty) throw { code: 'phone-duplicate' };
          })
        : Promise.resolve();

      phoneCheckPromise.then(function() {
        return auth.createUserWithEmailAndPassword(email, password);
      }).then(function(result) {
          const uid = result.user.uid;
          return result.user.updateProfile({ displayName: name }).then(function() {
            const lat = parseFloat(cityOption.dataset.lat);
            const lng = parseFloat(cityOption.dataset.lng);
            return db.collection('schools').doc(uid).set({
              uid: uid,
              name: schoolName,
              ownerName: name,
              email: email,
              phone: schoolPhone || '',
              address: schoolAddress,
              city: cityOption.dataset.he || '',
              cityEn: cityOption.dataset.en || '',
              cityRu: cityOption.dataset.ru || '',
              lat: lat,
              lng: lng,
              rating: 0,
              students: 0,
              pass_rate: 0,
              price: '—',
              badge: '',
              region: '',
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          });
        })
        .then(function() { loadFirestoreSchools(); })
        .catch(function(err) {
          btn.disabled = false;
          btn.textContent = 'Зарегистрироваться';
          if (err.code === 'phone-duplicate') {
            showAuthError('Этот номер телефона уже зарегистрирован');
          } else if (err.code === 'auth/email-already-in-use') {
            showAuthError('Этот email уже зарегистрирован');
          } else {
            showAuthError('Ошибка: ' + err.message);
          }
        });
      return;
    } else {
      // Ученик
      auth.createUserWithEmailAndPassword(email, password)
        .then(function(result) {
          const uid = result.user.uid;
          return result.user.updateProfile({ displayName: name }).then(function() {
            return db.collection('users').doc(uid).set({
              uid: uid,
              name: name,
              email: email,
              role: 'student',
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          });
        })
        .catch(function(err) {
          btn.disabled = false;
          btn.textContent = 'Зарегистрироваться';
          if (err.code === 'auth/email-already-in-use') {
            showAuthError('Этот email уже зарегистрирован');
          } else {
            showAuthError('Ошибка: ' + err.message);
          }
        });
    }
  }
}

// ══ EMAILJS CONFIG (see top of file) ══

// ══ SCHOOL PROFILE ══
let spCurrentSchool = null;

function openSchoolProfile(schoolId) {
  const s = schools.find(x => x.id === schoolId);
  if (!s) return;
  spCurrentSchool = s;

  const initials = s.name.trim().split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('sp-avatar').textContent = initials;
  document.getElementById('sp-name').textContent = s.name;
  document.getElementById('sp-city').textContent = (currentLang==='ru'?s.cityRu:currentLang==='en'?s.cityEn:s.city) || '';
  document.getElementById('sp-address').textContent = s.address || '';
  document.getElementById('sp-phone').textContent = s.phone || '';
  document.getElementById('sp-students').textContent = s.students || 0;
  document.getElementById('sp-price').textContent = s.price || '—';
  document.getElementById('sp-pass').textContent = s.pass_rate ? s.pass_rate + '%' : '—';

  // Инструкторы
  renderSpInstructors(s.instructors || []);

  // Рейтинг
  updateStarDisplay(s.rating || 0);
  const cnt = s.ratingCount || 0;
  document.getElementById('sp-rating-count').textContent = cnt > 0 ? `${(s.rating||0).toFixed(1)} (${cnt} отзывов)` : 'Нет оценок';

  // Проверяем — оценивал ли пользователь
  document.getElementById('sp-rating-note').style.display = 'none';
  const user = auth.currentUser;
  if (user) {
    db.collection('ratings').doc(schoolId + '_' + user.uid).get().then(doc => {
      if (doc.exists) {
        document.getElementById('sp-rating-note').style.display = 'block';
        updateStarDisplay(doc.data().rating);
      }
    });
  }

  // Панель редактирования — только владелец школы
  const editSection = document.getElementById('sp-edit-section');
  if (user && user.uid === schoolId) {
    editSection.style.display = 'block';
    document.getElementById('sp-price-input').value = s.price || '';
    renderEditInstructors(s.instructors || []);
    document.getElementById('sp-enroll-btn').style.display = 'none';
  } else {
    editSection.style.display = 'none';
    document.getElementById('sp-enroll-btn').style.display = 'block';
  }

  document.getElementById('sp-overlay').style.display = 'flex';
}

function closeSchoolProfile() {
  document.getElementById('sp-overlay').style.display = 'none';
  spCurrentSchool = null;
}

function handleSpOverlay(e) {
  if (e.target === document.getElementById('sp-overlay')) closeSchoolProfile();
}

function renderSpInstructors(list) {
  const el = document.getElementById('sp-instructor-list');
  if (!list || list.length === 0) {
    el.innerHTML = '<span class="instructor-empty">Инструкторы не добавлены</span>';
  } else {
    el.innerHTML = list.map(name => `<div class="instructor-chip">${name}</div>`).join('');
  }
}

function renderEditInstructors(list) {
  const el = document.getElementById('sp-edit-instructors');
  el.innerHTML = (list||[]).map((name,i) =>
    `<div class="instructor-chip" style="cursor:pointer" onclick="removeInstructor(${i})">${name} ✕</div>`
  ).join('');
}

function updateStarDisplay(rating) {
  document.querySelectorAll('.star-btn').forEach((btn, i) => {
    btn.classList.toggle('lit', i < Math.round(rating));
  });
}

function rateSchool(stars) {
  const user = auth.currentUser;
  if (!user) { alert('Войдите чтобы поставить оценку'); return; }
  if (!spCurrentSchool) return;
  const schoolId = spCurrentSchool.id;
  if (user.uid === schoolId) { alert('Нельзя оценивать собственную школу'); return; }

  const ratingRef = db.collection('ratings').doc(schoolId + '_' + user.uid);
  const schoolRef = db.collection('schools').doc(schoolId);

  ratingRef.get().then(doc => {
    if (doc.exists) {
      document.getElementById('sp-rating-note').style.display = 'block';
      return;
    }
    return ratingRef.set({ userId: user.uid, schoolId, rating: stars, createdAt: firebase.firestore.FieldValue.serverTimestamp() })
      .then(() => {
        // Пересчитываем средний рейтинг
        return db.collection('ratings').where('schoolId','==',schoolId).get();
      }).then(snap => {
        let total = 0;
        snap.forEach(d => total += d.data().rating);
        const avg = total / snap.size;
        return schoolRef.update({ rating: Math.round(avg*10)/10, ratingCount: snap.size });
      }).then(() => {
        updateStarDisplay(stars);
        document.getElementById('sp-rating-note').style.display = 'block';
        document.getElementById('sp-rating-count').textContent = 'Спасибо за оценку!';
      });
  });
}

function saveSchoolPrice() {
  if (!spCurrentSchool) return;
  const price = document.getElementById('sp-price-input').value.trim();
  if (!price) return;
  db.collection('schools').doc(spCurrentSchool.id).update({ price })
    .then(() => { document.getElementById('sp-price').textContent = price; notify('Цена сохранена!'); });
}

function addInstructor() {
  if (!spCurrentSchool) return;
  const name = document.getElementById('sp-instructor-input').value.trim();
  if (!name) return;
  const list = [...(spCurrentSchool.instructors || []), name];
  db.collection('schools').doc(spCurrentSchool.id).update({ instructors: list })
    .then(() => {
      spCurrentSchool.instructors = list;
      renderSpInstructors(list);
      renderEditInstructors(list);
      document.getElementById('sp-instructor-input').value = '';
    });
}

function removeInstructor(idx) {
  if (!spCurrentSchool) return;
  const list = [...(spCurrentSchool.instructors || [])];
  list.splice(idx, 1);
  db.collection('schools').doc(spCurrentSchool.id).update({ instructors: list })
    .then(() => {
      spCurrentSchool.instructors = list;
      renderSpInstructors(list);
      renderEditInstructors(list);
    });
}

function enrollFromProfile() {
  if (!spCurrentSchool) return;
  closeSchoolProfile();
  openEnrollModal(spCurrentSchool.id, spCurrentSchool.name, spCurrentSchool.email);
}

// ── ENROLL MODAL ──
let enrollTargetSchool = null; // { id, name, email }

function openEnrollModal(schoolId, schoolName, schoolEmail) {
  enrollTargetSchool = { id: schoolId, name: schoolName, email: schoolEmail || '' };
  document.getElementById('enroll-school-name-lbl').textContent = schoolName;
  document.getElementById('enroll-form-wrap').style.display = 'block';
  document.getElementById('enroll-success-wrap').style.display = 'none';
  document.getElementById('enroll-error').style.display = 'none';
  // Сбрасываем поля
  ['enroll-fname','enroll-lname','enroll-phone','enroll-email-inp','enroll-id','enroll-notes'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('enroll-license').value = '';
  // Ставим минимальную дату — сегодня
  document.getElementById('enroll-date').min = new Date().toISOString().split('T')[0];
  document.getElementById('enroll-date').value = '';
  // Если пользователь залогинен — подставляем его email
  const user = auth.currentUser;
  if (user) {
    if (user.email) document.getElementById('enroll-email-inp').value = user.email;
    if (user.displayName) {
      const parts = user.displayName.trim().split(' ');
      document.getElementById('enroll-fname').value = parts[0] || '';
      document.getElementById('enroll-lname').value = parts.slice(1).join(' ') || '';
    }
  }
  document.getElementById('enroll-overlay').style.display = 'flex';
  document.getElementById('enroll-submit-btn').disabled = false;
  document.getElementById('enroll-submit-btn').textContent = currentLang === 'ru' ? 'Отправить заявку' : currentLang === 'en' ? 'Send Request' : 'שלח בקשה';
}

function closeEnrollModal() {
  document.getElementById('enroll-overlay').style.display = 'none';
  enrollTargetSchool = null;
}

function handleEnrollOverlay(e) {
  if (e.target === document.getElementById('enroll-overlay')) closeEnrollModal();
}

function submitEnrollment() {
  const fname   = document.getElementById('enroll-fname').value.trim();
  const lname   = document.getElementById('enroll-lname').value.trim();
  const phone   = document.getElementById('enroll-phone').value.trim();
  const email   = document.getElementById('enroll-email-inp').value.trim();
  const idNum   = document.getElementById('enroll-id').value.trim();
  const license = document.getElementById('enroll-license').value;
  const date    = document.getElementById('enroll-date').value;
  const notes   = document.getElementById('enroll-notes').value.trim();
  const btn     = document.getElementById('enroll-submit-btn');
  const errEl   = document.getElementById('enroll-error');

  if (!fname || !phone) {
    errEl.textContent = currentLang === 'ru' ? 'Обязательные поля: Имя и Телефон' : 'Required: Name and Phone';
    errEl.style.display = 'block'; return;
  }
  if (!isValidIsraeliPhone(phone)) {
    errEl.textContent = currentLang === 'ru' ? 'Введи израильский номер телефона (+972 или 05X)' : 'Enter a valid Israeli phone number';
    errEl.style.display = 'block'; return;
  }
  // Rate limiting — не чаще 1 заявки в школу в 3 минуты
  const rlKey = 'enroll_ts_' + (enrollTargetSchool ? enrollTargetSchool.id : 'x');
  const lastTs = parseInt(localStorage.getItem(rlKey) || '0');
  if (Date.now() - lastTs < 3 * 60 * 1000) {
    errEl.textContent = currentLang === 'ru' ? 'Вы уже отправили заявку. Подождите 3 минуты.' : 'You already sent a request. Wait 3 minutes.';
    errEl.style.display = 'block'; return;
  }
  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = '...';

  const fullName   = fname + ' ' + lname;
  const schoolName = enrollTargetSchool ? enrollTargetSchool.name : '—';
  const schoolId   = enrollTargetSchool ? enrollTargetSchool.id : null;
  const schoolEmail = enrollTargetSchool ? enrollTargetSchool.email : '';

  const enrollData = {
    studentName:  fullName,
    studentPhone: phone,
    studentEmail: email,
    studentId:    idNum,
    licenseType:  license || '—',
    preferredDate: date || '—',
    notes:        notes || '—',
    schoolId:     schoolId,
    schoolName:   schoolName,
    status:       'new',
    createdAt:    firebase.firestore.FieldValue.serverTimestamp()
  };

  // 1. Сохраняем в Firestore + увеличиваем счётчик студентов
  db.collection('enrollments').add(enrollData)
    .then(function() {
      if (schoolId) {
        db.collection('schools').doc(schoolId).update({
          students: firebase.firestore.FieldValue.increment(1)
        });
      }
    }).then(function() {
      // 2. Отправляем email через EmailJS
      if (schoolEmail) {
        return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
          to_email:      schoolEmail,
          school_name:   schoolName,
          student_name:  fullName,
          student_phone: phone,
          student_email: email || '—',
          student_id:    idNum || '—',
          license_type:  license || '—',
          preferred_date: date || '—',
          notes:         notes || '—'
        });
      }
    })
    .then(function() {
      localStorage.setItem(rlKey, Date.now().toString());
      document.getElementById('enroll-form-wrap').style.display = 'none';
      document.getElementById('enroll-success-wrap').style.display = 'block';
    })
    .catch(function(err) {
      console.error('Enroll error:', err);
      // Даже если email не отправился — показываем успех (данные в Firestore сохранены)
      localStorage.setItem(rlKey, Date.now().toString());
      document.getElementById('enroll-form-wrap').style.display = 'none';
      document.getElementById('enroll-success-wrap').style.display = 'block';
    });
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.style.display = 'block';
}

function logoutUser() {
  auth.signOut();
}

// ── Theme ──
function applyTheme(dark) {
  if (dark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  const lbl = document.getElementById('tt-label');
  const btn = document.getElementById('sb-theme-btn');
  const labelText = dark ? (t && t.theme_light || 'Светлая тема') : (t && t.theme_dark || 'Тёмная тема');
  if (lbl) {
    lbl.style.opacity = '0';
    setTimeout(function() {
      lbl.textContent = labelText;
      lbl.style.opacity = '';
    }, 180);
  }
  if (btn) btn.title = labelText;
}
function toggleTheme() {
  const isDark = !document.documentElement.classList.contains('dark');
  applyTheme(isDark);
  localStorage.setItem('driveIL-theme', isDark ? 'dark' : 'light');
}
// Restore saved theme
(function() {
  const saved = localStorage.getItem('driveIL-theme');
  if (saved === 'dark') applyTheme(true);
})();

// ── Mobile nav ──
function toggleMobileNav() {
  const nav = document.getElementById('mobile-nav');
  const btn = document.getElementById('hamburger');
  const isOpen = nav.classList.contains('open');
  nav.classList.toggle('open', !isOpen);
  btn.classList.toggle('open', !isOpen);
}
function closeMobileNav() {
  document.getElementById('mobile-nav').classList.remove('open');
  document.getElementById('hamburger').classList.remove('open');
}

// ── Navigation ──
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById('page-' + name);
  if (pg) pg.classList.add('active');
  // sidebar active
  document.querySelectorAll('.sb-btn').forEach(b => b.classList.remove('active'));
  const sb = document.getElementById('snav-' + name);
  if (sb) sb.classList.add('active');
  // mobile bottom nav active
  document.querySelectorAll('.mbn-btn').forEach(b => b.classList.remove('active'));
  const mb = document.getElementById('mnav-' + name);
  if (mb) mb.classList.add('active');
  // old nav-btn compat
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const nb = document.getElementById('nav-' + name);
  if (nb) nb.classList.add('active');
  if (name === 'test') startTest();
  if (name === 'dashboard') loadDashboard();
  if (name === 'schedule') loadScheduleData();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateNavSpotlight(pageName) {
  const navOrder = ['home', 'schools', 'test', 'schedule', 'register'];
  const activeIdx = navOrder.indexOf(pageName);
  const indicator = document.getElementById('nav-indicator');
  const nav = document.querySelector('.header-nav');
  navOrder.forEach((page, i) => {
    const btn = document.getElementById('nav-' + page);
    if (!btn) return;
    const spotlight = btn.querySelector('.nav-spotlight');
    if (!spotlight) return;
    const dist = Math.abs(activeIdx - i);
    spotlight.style.opacity = activeIdx === i ? 1 : Math.max(0, 1 - dist * 0.6);
  });
  const activeBtn = document.getElementById('nav-' + pageName);
  if (activeBtn && indicator) {
    indicator.style.left = activeBtn.offsetLeft + 'px';
    indicator.style.width = activeBtn.offsetWidth + 'px';
  }
}

// ── STAT COUNTER ANIMATION ──
function animateStats() {
  document.querySelectorAll('.stat-card').forEach((card, i) => {
    card.style.transitionDelay = (i * 0.1) + 's';
    card.classList.add('visible');
    const numEl = card.querySelector('.stat-num');
    const target = parseInt(numEl.dataset.target);
    const suffix = numEl.dataset.suffix || '';
    const duration = 1800;
    const start = performance.now();
    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(eased * target);
      numEl.textContent = current.toLocaleString() + suffix;
      if (progress < 1) requestAnimationFrame(update);
    }
    setTimeout(() => requestAnimationFrame(update), i * 100);
  });
}

// ── SCHOOLS ──
let currentSchoolFilter = 'all';

function renderSchools(filter) {
  currentSchoolFilter = filter || currentSchoolFilter;
  const list = document.getElementById('school-list');
  if (!list) return;
  const filtered = currentSchoolFilter === 'all' ? schools : schools.filter(s => s.region === currentSchoolFilter);

  if (schools.length === 0) {
    const emptyMsg = currentLang === 'ru'
      ? 'Школы пока не зарегистрированы.<br>Будьте первыми — зарегистрируйте автошколу!'
      : currentLang === 'en'
      ? 'No schools registered yet.<br>Be the first — register your driving school!'
      : 'אין בתי ספר רשומים עדיין.<br>היו הראשונים — רשמו את בית הספר שלכם!';
    list.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:#6c757d;font-size:1rem;line-height:1.7">${emptyMsg}</div>`;
    return;
  }

  if (filtered.length === 0) {
    const noMatch = currentLang === 'ru' ? 'В этом регионе школ пока нет' : currentLang === 'en' ? 'No schools in this region yet' : 'אין בתי ספר באזור זה עדיין';
    list.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:#6c757d">${noMatch}</div>`;
    return;
  }

  const city     = s => currentLang === 'ru' ? (s.cityRu||s.city) : currentLang === 'en' ? (s.cityEn||s.city) : s.city;
  const ratingLbl = currentLang === 'ru' ? 'Рейтинг'     : currentLang === 'en' ? 'Rating'    : 'דירוג';
  const passLbl   = currentLang === 'ru' ? 'Сдаваемость' : currentLang === 'en' ? 'Pass Rate' : 'מעבר';
  const studLbl   = currentLang === 'ru' ? 'Студенты'    : currentLang === 'en' ? 'Students'  : 'תלמידים';
  const enrollLbl = currentLang === 'ru' ? 'Записаться'  : currentLang === 'en' ? 'Enroll'    : 'הרשמה';
  const lessonLbl = currentLang === 'ru' ? '/урок'       : currentLang === 'en' ? '/lesson'   : '/שיעור';
  const avatarCls = ['', 'av-gold', 'av-green', 'av-purple', 'av-teal', 'av-green'];

  list.innerHTML = filtered.map((s, i) => {
    const initials = s.name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const addrLine = s.address ? `<div style="font-size:0.72rem;color:#6c757d;margin-top:2px">${s.address}</div>` : '';
    const phoneLine = s.phone ? `<div style="font-size:0.75rem;color:#1a73e8;margin-top:4px">${s.phone}</div>` : '';
    const stars = s.rating ? '★'.repeat(Math.round(s.rating)) + '☆'.repeat(5-Math.round(s.rating)) : '☆☆☆☆☆';
    return `
      <div class="school-card" onclick="openSchoolProfile('${s.id}')" style="cursor:pointer">
        <div class="sc-head">
          <div class="sc-avatar ${avatarCls[i % avatarCls.length]}">${initials}</div>
          <div style="flex:1;min-width:0">
            <div class="sc-name">${s.name}</div>
            <div class="sc-location">${city(s)}</div>
            ${addrLine}
            ${phoneLine}
          </div>
        </div>
        <div style="color:#f59e0b;font-size:0.9rem;margin-bottom:6px">${stars} <span style="color:#6c757d;font-size:0.75rem">${s.rating ? '('+s.rating+')' : ''}</span></div>
        <div class="sc-stats">
          <div class="sc-stat"><div class="sc-stat-val">${s.pass_rate ? s.pass_rate+'%' : '—'}</div><div class="sc-stat-lbl">${passLbl}</div></div>
          <div class="sc-stat"><div class="sc-stat-val">${s.students || 0}</div><div class="sc-stat-lbl">${studLbl}</div></div>
          <div class="sc-stat"><div class="sc-stat-val">${s.price || '—'}</div><div class="sc-stat-lbl">${lessonLbl}</div></div>
        </div>
        <div class="sc-footer">
          <button class="sc-enroll" onclick="event.stopPropagation();openEnrollModal('${s.id}','${s.name.replace(/'/g,"\\'")}','${(s.email||'').replace(/'/g,"\\'")}')">${enrollLbl}</button>
        </div>
      </div>`;
  }).join('');
}

function filterSchools(region, btn) {
  document.querySelectorAll('.sfilter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderSchools(region);
}

// ── SCHEDULE — see loadScheduleData() / renderScheduleFromBookings() below ──

// ── TESTIMONIALS ──
function renderTestimonials() {
  const track = document.getElementById('testimonials-track');
  const dots = document.getElementById('t-dots');
  const list = t.testimonials;
  track.innerHTML = list.map((item, i) => `
    <div class="testimonial-card" id="tc-${i}" style="${i === 0 ? '' : 'display:none;'}">
      <div class="testimonial-img-wrap">
        <img class="testimonial-img front" src="${item.img}" alt="${item.name}" loading="lazy"/>
        ${list[(i+1)%list.length] ? `<img class="testimonial-img behind" src="${list[(i+1)%list.length].img}" alt="" loading="lazy"/>` : ''}
      </div>
      <div class="testimonial-content">
        <div class="testimonial-stars">${'⭐'.repeat(item.rating)}</div>
        <div class="testimonial-quote">"</div>
        <div class="testimonial-text">${item.quote}</div>
        <div class="testimonial-name">${item.name}</div>
        <div class="testimonial-role">${item.role}</div>
      </div>
    </div>`).join('');
  dots.innerHTML = list.map((_, i) => `<div class="t-dot ${i===0?'active':''}" onclick="goTestimonial(${i})"></div>`).join('');
  clearInterval(testimonialTimer);
  testimonialTimer = setInterval(nextTestimonial, 5000);
}

function goTestimonial(idx) {
  const list = t.testimonials;
  document.querySelectorAll('[id^="tc-"]').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.t-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
  const card = document.getElementById('tc-' + idx);
  if (card) { card.style.display = 'grid'; card.style.opacity = 0; setTimeout(() => card.style.opacity = 1, 10); card.style.transition = 'opacity 0.4s'; }
  activeTestimonial = idx;
  clearInterval(testimonialTimer);
  testimonialTimer = setInterval(nextTestimonial, 5000);
}

function nextTestimonial() { goTestimonial((activeTestimonial + 1) % t.testimonials.length); }
function prevTestimonial() { goTestimonial((activeTestimonial - 1 + t.testimonials.length) % t.testimonials.length); }

// ── FAQ ──
function renderFAQ() {
  document.getElementById('faq-list').innerHTML = t.faqs.map((item, i) => `
    <div class="faq-item" id="faq-${i}">
      <div class="faq-q" onclick="toggleFAQ(${i})">
        <span>${item.q}</span>
        <span class="faq-icon">+</span>
      </div>
      <div class="faq-a" id="faq-a-${i}">
        <div class="faq-a-inner">${item.a}</div>
      </div>
    </div>`).join('');
}

function toggleFAQ(i) {
  const item = document.getElementById('faq-' + i);
  const ans = document.getElementById('faq-a-' + i);
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item').forEach(el => { el.classList.remove('open'); el.querySelector('.faq-a').style.maxHeight = '0'; });
  if (!isOpen) { item.classList.add('open'); ans.style.maxHeight = ans.scrollHeight + 'px'; }
}

// ── THEORY TEST ──
let testTimerInterval = null;
let testSecondsLeft = 40 * 60; // 40 minutes — real Israeli exam
const PASS_THRESHOLD = 90; // 90% = real Israeli exam (27/30)

function startTest() {
  currentQ = 0; score = 0; answered = false;
  testSecondsLeft = 40 * 60;
  shuffled = [...questions].sort(() => Math.random() - 0.5);
  clearInterval(testTimerInterval);
  renderIntro();
}

function renderIntro() {
  const container = document.getElementById('test-container');
  // hide/show hero while in question mode
  const hero = document.getElementById('test-page-hero');
  if (hero) hero.style.display = '';

  const L = {
    he: {
      q:'שאלות', min:'דקות', pass:'אחוז מעבר', feat:'מרכזי',
      start:'התחל בחינה',
      rulesTitle:'חוקי הבחינה',
      r1:`${shuffled.length} שאלות רב-ברירה`,
      r2:'40 דקות לבחינה',
      r3:`דרוש 90% — ${Math.ceil(shuffled.length*0.9)} תשובות נכונות`,
      r4:'אין חזרה אחורה לשאלה קודמת',
    },
    ru: {
      q:'Вопросов', min:'Минут', pass:'Проходной балл', feat:'Главный',
      start:'Начать экзамен',
      rulesTitle:'Правила экзамена',
      r1:`${shuffled.length} вопросов с вариантами ответа`,
      r2:'40 минут на экзамен',
      r3:`Требуется 90% — ${Math.ceil(shuffled.length*0.9)} правильных ответов`,
      r4:'Нельзя вернуться к предыдущему вопросу',
    },
    en: {
      q:'Questions', min:'Minutes', pass:'Pass Score', feat:'Key',
      start:'Begin Examination',
      rulesTitle:'Examination Rules',
      r1:`${shuffled.length} multiple-choice questions`,
      r2:'40 minutes total',
      r3:`90% required — ${Math.ceil(shuffled.length*0.9)} correct answers`,
      r4:'No going back to previous questions',
    },
  }[currentLang];

  // SVG icons (no emoji)
  const iconQ = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>`;
  const iconT = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
  const iconP = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  const iconArr = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;

  container.innerHTML = `
    <div class="intro-cards-row">
      <div class="intro-card-wrap">
        <div class="intro-card">
          <div class="intro-card-icon-box">${iconQ}</div>
          <div class="intro-card-val">${shuffled.length}</div>
          <div class="intro-card-lbl">${L.q}</div>
        </div>
      </div>
      <div class="intro-card-wrap">
        <div class="intro-popular-pill">${L.feat}</div>
        <div class="intro-card featured">
          <div class="intro-card-icon-box">${iconT}</div>
          <div class="intro-card-val">40</div>
          <div class="intro-card-lbl">${L.min}</div>
        </div>
      </div>
      <div class="intro-card-wrap">
        <div class="intro-card">
          <div class="intro-card-icon-box">${iconP}</div>
          <div class="intro-card-val">90%</div>
          <div class="intro-card-lbl">${L.pass}</div>
        </div>
      </div>
    </div>
    <div class="intro-rules">
      <div class="intro-rules-title">${L.rulesTitle}</div>
      <div class="intro-rule"><div class="intro-rule-dot"></div>${L.r1}</div>
      <div class="intro-rule"><div class="intro-rule-dot"></div>${L.r2}</div>
      <div class="intro-rule"><div class="intro-rule-dot"></div>${L.r3}</div>
      <div class="intro-rule"><div class="intro-rule-dot"></div>${L.r4}</div>
    </div>
    <button class="intro-start-btn" onclick="beginTest()">
      <span style="display:inline-flex;align-items:center;gap:10px;">${iconArr} ${L.start}</span>
    </button>`;
}

function beginTest() {
  const hero = document.getElementById('test-page-hero');
  if (hero) hero.style.display = 'none';
  clearInterval(testTimerInterval);
  testTimerInterval = setInterval(tickTimer, 1000);
  renderQuestion();
}

function tickTimer() {
  testSecondsLeft--;
  updateTimerDisplay();
  if (testSecondsLeft <= 0) {
    clearInterval(testTimerInterval);
    showResult(true); // time up
  }
}

function updateTimerDisplay() {
  const el = document.getElementById('test-timer-display');
  if (!el) return;
  const m = Math.floor(testSecondsLeft / 60);
  const s = testSecondsLeft % 60;
  el.textContent = String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  const wrap = document.getElementById('test-timer-wrap');
  if (!wrap) return;
  wrap.className = 'test-timer';
  if (testSecondsLeft <= 60)        wrap.className = 'test-timer danger';
  else if (testSecondsLeft <= 300)  wrap.className = 'test-timer warning';
}

function renderQuestion() {
  const container = document.getElementById('test-container');
  if (currentQ >= shuffled.length) { clearInterval(testTimerInterval); showResult(false); return; }
  answered = false;
  const qData = shuffled[currentQ];
  const q = qData[currentLang];
  const cat = catCfg[qData.cat] || catCfg.safety;
  const catLabel = cat[currentLang] || cat.en;
  const pct = Math.round((currentQ / shuffled.length) * 100);
  const letters = currentLang === 'en' ? ['A','B','C','D'] : currentLang === 'ru' ? ['А','Б','В','Г'] : ['א','ב','ג','ד'];
  const m = Math.floor(testSecondsLeft / 60);
  const s = testSecondsLeft % 60;
  const timerTxt = String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  const timerCls = testSecondsLeft <= 60 ? 'danger' : testSecondsLeft <= 300 ? 'warning' : '';

  container.innerHTML = `
    <div class="test-header">
      <div class="score-badge">${score}✓</div>
      <div class="test-progress-wrap">
        <div class="test-progress-bar"><div class="test-progress-fill" style="width:${pct}%"></div></div>
        <div class="test-meta">${t.q_num} ${currentQ+1} ${t.of} ${shuffled.length}</div>
      </div>
      <div class="test-timer ${timerCls}" id="test-timer-wrap">
        ⏱ <span id="test-timer-display">${timerTxt}</span>
      </div>
    </div>
    <div class="q-category" style="background:${cat.bg};color:${cat.color}">${cat.icon} ${catLabel}</div>
    <div class="q-sign-box">${qData.sign}</div>
    <div class="q-text">${q.q}</div>
    <div class="answers" id="answers-wrap">
      ${q.answers.map((a, i) => `
        <button class="answer-btn" id="ans-${i}" onclick="selectAnswer(${i},${q.correct},${currentQ})">
          <span class="answer-letter">${letters[i]}</span>${a}
        </button>`).join('')}
    </div>
    <div id="explanation-box"></div>`;
}

function selectAnswer(idx, correct, qIdx) {
  if (answered) return;
  answered = true;
  const isCorrect = idx === correct;
  if (isCorrect) score++;

  // Color buttons
  document.getElementById('ans-'+idx).classList.add(isCorrect ? 'correct' : 'wrong');
  if (!isCorrect) document.getElementById('ans-'+correct).classList.add('correct');

  // Disable all buttons
  document.querySelectorAll('.answer-btn').forEach(b => b.style.pointerEvents = 'none');

  // Show explanation
  const qData = shuffled[qIdx];
  const explain = qData[currentLang].explain;
  const expBox = document.getElementById('explanation-box');
  expBox.innerHTML = `
    <div class="q-explanation ${isCorrect ? 'correct-exp' : 'wrong-exp'}">
      ${isCorrect ? '✅' : '❌'} ${explain}
    </div>
    <button class="btn-next" onclick="nextQuestion()">
      ${currentQ + 1 < shuffled.length
        ? (currentLang==='he' ? 'שאלה הבאה ←' : currentLang==='ru' ? 'Следующий вопрос →' : 'Next Question →')
        : (currentLang==='he' ? 'סיים בחינה ✓' : currentLang==='ru' ? 'Завершить экзамен ✓' : 'Finish Exam ✓')}
    </button>`;
}

function nextQuestion() {
  currentQ++;
  renderQuestion();
}

function showResult(timeUp) {
  clearInterval(testTimerInterval);
  const pct = Math.round((score / shuffled.length) * 100);
  const pass = !timeUp && pct >= PASS_THRESHOLD;

  document.getElementById('result-icon').textContent = pass ? '🎉' : '😔';
  document.getElementById('result-title').textContent = pass ? t.result_pass_title : t.result_fail_title;
  document.getElementById('result-score').textContent = timeUp ? t.time_up_label : pct + '%';
  document.getElementById('result-msg').textContent = pass ? t.result_pass_msg : (timeUp ? t.time_up_msg : t.result_fail_msg);
  document.getElementById('btn-try-again').textContent = t.try_again;
  document.getElementById('btn-close').textContent = t.close_btn;

  const subEl = document.getElementById('result-sub');
  const btnsEl = document.getElementById('modal-btns');

  if (!pass) {
    subEl.textContent = t.result_fail_sub;
    subEl.style.display = 'block';
    btnsEl.innerHTML = `
      <button class="btn-accent" onclick="restartTest()">${t.try_again}</button>
      <button class="btn-primary" style="background:var(--green);color:white;" onclick="findTeacher()">${t.find_teacher_btn}</button>`;
  } else {
    subEl.style.display = 'none';
    btnsEl.innerHTML = `
      <button class="btn-accent" onclick="restartTest()">${t.try_again}</button>
      <button class="btn-secondary" style="color:var(--text);border-color:var(--border);" onclick="document.getElementById('result-modal').style.display='none'">${t.close_btn}</button>`;
  }

  document.getElementById('result-modal').style.display = 'flex';
}

function findTeacher() {
  document.getElementById('result-modal').style.display = 'none';
  showPage('schools');
}

// ── MAP ──
let schoolsMap = null;
let userMarker = null;
let schoolMarkers = [];

function initSchoolsMap() {
  if (schoolsMap) { schoolsMap.invalidateSize(); return; }
  schoolsMap = L.map('schools-map', {
    zoomControl: false, attributionControl: true,
    scrollWheelZoom: true
  }).setView([32.05, 34.95], 7);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd', maxZoom: 19
  }).addTo(schoolsMap);

  L.control.zoom({ position: 'bottomright' }).addTo(schoolsMap);
  updateLocateLabel();
  // Рисуем маркеры только из Firestore (schools уже загружены)
  renderMapMarkers(schools);
}

let firestoreUnsubscribe = null;

function loadFirestoreSchools() {
  const list = document.getElementById('school-list');
  if (list) list.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#6c757d">⏳ Загружаем школы...</div>';

  // Отписываемся от предыдущего слушателя если есть
  if (firestoreUnsubscribe) firestoreUnsubscribe();

  // onSnapshot — обновляет автоматически когда добавляется новая школа
  firestoreUnsubscribe = db.collection('schools').onSnapshot(function(snapshot) {
    schools = [];
    snapshot.forEach(function(doc) {
      const d = doc.data();
      if (d.name) {
        schools.push({
          id: doc.id,
          name: d.name,
          city: d.city || '',
          cityEn: d.cityEn || '',
          cityRu: d.cityRu || '',
          region: cityRegionMap[d.city] || 'center',
          rating: d.rating || 0,
          students: d.students || 0,
          price: d.price || '—',
          badge: '',
          pass_rate: d.pass_rate || 0,
          lat: d.lat || null,
          lng: d.lng || null,
          phone: d.phone || '',
          address: d.address || '',
          email: d.email || ''
        });
      }
    });
    renderSchools(currentSchoolFilter);
    if (schoolsMap) renderMapMarkers(schools);

    // Обновляем счётчик на главной
    const countEl = document.getElementById('stat-schools-count');
    if (countEl) {
      countEl.dataset.target = schools.length;
      countEl.textContent = schools.length;
    }

    // Обновляем дропдаун выбора школы в форме регистрации
    const regSelect = document.getElementById('reg-school');
    if (regSelect) {
      const selectLbl = currentLang === 'ru' ? '-- Выбрать --' : currentLang === 'en' ? '-- Select --' : '-- בחר --';
      regSelect.innerHTML = `<option value="">${selectLbl}</option>` +
        schools.map(s => {
          const name = currentLang === 'ru' ? (s.cityRu ? s.name + ' — ' + s.cityRu : s.name)
                     : currentLang === 'en' ? (s.cityEn ? s.name + ' — ' + s.cityEn : s.name)
                     : (s.city ? s.name + ' - ' + s.city : s.name);
          return `<option value="${s.id}">${name}</option>`;
        }).join('');
    }
  }, function(err) {
    console.error('Firestore error:', err);
    const list2 = document.getElementById('school-list');
    if (list2) list2.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:40px 20px">
        <div style="font-size:2rem;margin-bottom:12px">⚠️</div>
        <div style="font-weight:700;color:#c0392b;margin-bottom:8px">Firestore не подключён</div>
        <div style="color:#6c757d;font-size:0.85rem;margin-bottom:16px">Нужно включить Firestore в Firebase Console.<br>Перейди: Firebase Console → Firestore Database → Create database</div>
        <button onclick="loadFirestoreSchools()" style="padding:10px 24px;background:#1a73e8;color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:0.9rem">Попробовать снова</button>
      </div>`;
  });
}

function renderMapMarkers(list) {
  schoolMarkers.forEach(m => schoolsMap.removeLayer(m));
  schoolMarkers = [];
  const city      = s => currentLang === 'ru' ? s.cityRu : currentLang === 'en' ? s.cityEn : s.city;
  const enrollLbl = currentLang === 'ru' ? 'Записаться' : currentLang === 'en' ? 'Enroll' : 'הרשמה';
  const lessonLbl = currentLang === 'ru' ? '/урок'      : currentLang === 'en' ? '/lesson' : '/שיעור';
  const ratingLbl = currentLang === 'ru' ? 'Рейтинг'   : currentLang === 'en' ? 'Rating'  : 'דירוג';
  const passLbl   = currentLang === 'ru' ? 'Сдача'     : currentLang === 'en' ? 'Pass'    : 'מעבר';
  const countEl = document.getElementById('map-count');
  if (countEl) countEl.textContent = `${list.length} ${currentLang === 'ru' ? 'школы' : currentLang === 'en' ? 'schools' : 'בתי ספר'}`;

  const pinColors = ['#4285f4','#fbbc04','#34a853','#ea4335','#9c27b0','#00acc1'];
  const avGrads  = [
    'linear-gradient(135deg,#4285f4,#0d47a1)',
    'linear-gradient(135deg,#fbbc04,#e67e22)',
    'linear-gradient(135deg,#34a853,#1a73e8)',
    'linear-gradient(135deg,#ea4335,#c0392b)',
    'linear-gradient(135deg,#9c27b0,#1a73e8)',
    'linear-gradient(135deg,#00acc1,#27ae60)'
  ];

  const makeIcon = (color) => L.divIcon({
    className: '',
    html: `<div style="position:relative;width:36px;height:48px">
      <svg viewBox="0 0 36 48" width="36" height="48" xmlns="http://www.w3.org/2000/svg">
        <filter id="sh"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.4)"/></filter>
        <path d="M18 0C8.06 0 0 8.06 0 18c0 13.25 18 30 18 30S36 31.25 36 18C36 8.06 27.94 0 18 0z" fill="${color}" filter="url(#sh)"/>
        <circle cx="18" cy="18" r="8" fill="rgba(255,255,255,0.95)"/>
        <circle cx="18" cy="18" r="4" fill="${color}"/>
      </svg>
    </div>`,
    iconSize: [36, 48], iconAnchor: [18, 48], popupAnchor: [0, -52]
  });

  // Только школы с координатами показываем на карте
  list.filter(s => s.lat && s.lng).forEach((s, i) => {
    const initials = escapeHtml(s.name.trim().split(/\s+/).map(w => w[0]).join('').slice(0,2).toUpperCase());
    const addrLine = s.address ? `<div style="font-size:0.72rem;color:#888;margin-top:2px">${escapeHtml(s.address)}</div>` : '';
    const phoneLine = s.phone ? `<div style="font-size:0.75rem;color:#1a73e8;margin-top:4px">${escapeHtml(s.phone)}</div>` : '';
    const safeId    = escapeHtml(s.id);
    const safeName  = escapeHtml(s.name);
    const safeEmail = escapeHtml(s.email || '');
    const popup = `
      <div class="map-popup" dir="ltr">
        <div class="map-popup-top">
          <div class="map-popup-avatar" style="background:${avGrads[i % avGrads.length]}">${initials}</div>
          <div>
            <div class="map-popup-name">${safeName}</div>
            <div class="map-popup-city">${escapeHtml(city(s))}</div>
            ${addrLine}
            ${phoneLine}
          </div>
        </div>
        <button class="map-popup-btn" onclick="openEnrollModal('${safeId}','${safeName}','${safeEmail}')">${enrollLbl}</button>
      </div>`;
    const marker = L.marker([s.lat, s.lng], { icon: makeIcon(pinColors[i % pinColors.length]) })
      .addTo(schoolsMap).bindPopup(popup, { maxWidth: 230, closeButton: false });
    schoolMarkers.push(marker);
  });
}

function locateUser() {
  if (!schoolsMap) return;
  const btn = document.querySelector('.locate-btn');
  btn.textContent = '...';
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude: lat, longitude: lng } = pos.coords;
    if (userMarker) schoolsMap.removeLayer(userMarker);
    userMarker = L.circleMarker([lat, lng], {
      radius: 10, fillColor: '#1a73e8', color: 'white',
      weight: 3, fillOpacity: 1
    }).addTo(schoolsMap).bindPopup(currentLang === 'ru' ? 'Вы здесь' : currentLang === 'en' ? 'You are here' : 'אתה כאן').openPopup();
    schoolsMap.flyTo([lat, lng], 11, { duration: 1.4 });
    updateLocateLabel();
  }, () => { updateLocateLabel(); });
}

function updateLocateLabel() {
  const el = document.getElementById('locate-label');
  if (el) el.textContent = currentLang === 'ru' ? 'Моё место' : currentLang === 'en' ? 'My Location' : 'המיקום שלי';
}

// ── showPage hooks (unified) ──
const _origShowPage = showPage;
showPage = function(name) {
  _origShowPage(name);
  if (name === 'schools')  setTimeout(initSchoolsMap, 80);
  if (name === 'register') setTimeout(renderRegCalendar, 30);
};

function restartTest() {
  document.getElementById('result-modal').style.display = 'none';
  startTest();
}

// ── CALENDAR ──
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let calSelectedDate = null;

function renderRegCalendar() {
  const today = new Date();
  const monthNames = {
    he: ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'],
    ru: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
    en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  };
  const dayNames = {
    he: ['א','ב','ג','ד','ה','ו','ש'],
    ru: ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'],
    en: ['Su','Mo','Tu','We','Th','Fr','Sa'],
  };
  const selectHint = { he:'לא נבחר תאריך', ru:'Дата не выбрана', en:'No date selected' };
  const legendTxt  = { he:'שיעור מתוכנן', ru:'Запланированный урок', en:'Scheduled lesson' };
  const calTitle   = { he:'בחר תאריך שיעור', ru:'Выберите дату урока', en:'Choose Lesson Date' };
  const formTitle  = { he:'פרטים אישיים', ru:'Личные данные', en:'Personal Details' };

  // update labels
  document.getElementById('cal-month-label').textContent = monthNames[currentLang][calMonth] + ' ' + calYear;
  document.getElementById('cal-legend-txt').textContent = legendTxt[currentLang];
  const calTitleEl = document.getElementById('reg-cal-title');
  if (calTitleEl) calTitleEl.textContent = calTitle[currentLang];
  const formTitleEl = document.getElementById('reg-form-title');
  if (formTitleEl) formTitleEl.textContent = formTitle[currentLang];

  // weekdays
  document.getElementById('cal-weekdays').innerHTML = dayNames[currentLang].map(d =>
    `<div class="cal-wd">${d}</div>`).join('');

  // lesson dates set (from schedule data)
  const lessonDates = new Set(schedule.map(s => {
    const [d, m, y] = s.date.split('.');
    return `${y}-${m}-${d}`;
  }));

  // build grid
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrev = new Date(calYear, calMonth, 0).getDate();

  let cells = '';
  // prev month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    cells += `<button class="cal-day cal-other">${daysInPrev - i}</button>`;
  }
  // current month
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(calMonth + 1).padStart(2,'0');
    const dd = String(d).padStart(2,'0');
    const key = `${calYear}-${mm}-${dd}`;
    const isToday = d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
    const isSel   = calSelectedDate === key;
    const hasLes  = lessonDates.has(key);
    let cls = 'cal-day';
    if (isToday)  cls += ' cal-today';
    if (isSel)    cls += ' cal-selected';
    if (hasLes)   cls += ' cal-has-lesson';
    cells += `<button class="${cls}" onclick="calSelect('${key}',${d})">${d}</button>`;
  }
  // next month padding
  const total = firstDay + daysInMonth;
  const rem = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let i = 1; i <= rem; i++) {
    cells += `<button class="cal-day cal-other">${i}</button>`;
  }
  document.getElementById('cal-grid').innerHTML = cells;

  // selected display
  const dispEl = document.getElementById('cal-selected-display');
  if (calSelectedDate) {
    const [y,m,d] = calSelectedDate.split('-');
    dispEl.innerHTML = `<span style="color:#1a73e8;font-weight:800;">${d} ${monthNames[currentLang][parseInt(m)-1]} ${y}</span>`;
  } else {
    dispEl.textContent = selectHint[currentLang];
    dispEl.style.color = '#6c757d';
  }
}

function calNav(dir) {
  calMonth += dir;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  if (calMonth < 0)  { calMonth = 11; calYear--; }
  renderRegCalendar();
}

function calSelect(key, day) {
  calSelectedDate = calSelectedDate === key ? null : key;
  renderRegCalendar();
}

// (calendar hook merged into unified showPage above)

// ── REGISTRATION ──
function submitRegistration() {
  const fname = document.getElementById('reg-fname').value;
  const phone = document.getElementById('reg-phone').value;
  if (!fname || !phone) {
    notify(currentLang==='ru' ? 'Пожалуйста, заполните обязательные поля' : currentLang==='en' ? 'Please fill required fields' : 'אנא מלא את השדות הנדרשים');
    return;
  }
  document.querySelectorAll('#page-register input, #page-register select').forEach(el => el.value = '');
  notify(t.notify_reg);
}

// ── NOTIFICATION ──
function notify(msg) {
  const n = document.getElementById('notification');
  n.textContent = msg;
  n.classList.add('show');
  setTimeout(() => n.classList.remove('show'), 3500);
}

// ── SCROLL ANIMATIONS ──
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const delay = el.dataset.delay || 0;
        setTimeout(() => el.classList.add('visible'), delay);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.step-card, .feature-card').forEach((el, i) => {
    el.dataset.delay = i * 80;
    observer.observe(el);
  });
}

// ── DASHBOARD ──
function loadDashboard() {
  const user = auth.currentUser;
  if (!user) { showPage('home'); openAuthModal(); return; }
  const body = document.getElementById('db-body');
  const name = user.displayName || user.email.split('@')[0];
  const letter = name.charAt(0).toUpperCase();
  document.getElementById('db-avatar').textContent = letter;
  document.getElementById('db-title').textContent = name;
  body.innerHTML = '<div class="db-loading">Загружаем данные...</div>';

  // Определяем роль
  db.collection('schools').doc(user.uid).get().then(function(schoolDoc) {
    if (schoolDoc.exists) {
      document.getElementById('db-subtitle').textContent = 'Кабинет автошколы';
      document.getElementById('db-role-badge').textContent = '🏫 Автошкола';
      loadSchoolDashboard(user, schoolDoc.data());
    } else {
      document.getElementById('db-subtitle').textContent = 'Кабинет ученика';
      document.getElementById('db-role-badge').textContent = '🎓 Ученик';
      loadStudentDashboard(user);
    }
  }).catch(function() { loadStudentDashboard(user); });
}

function loadSchoolDashboard(user, school) {
  const body = document.getElementById('db-body');
  db.collection('enrollments').where('schoolId', '==', user.uid).get().then(function(snap) {
    const all = [];
    snap.forEach(function(d) { all.push({ id: d.id, ...d.data() }); });
    const pending = all.filter(function(e) { return e.status === 'pending'; });
    const confirmed = all.filter(function(e) { return e.status === 'confirmed'; });

    const statsHtml = `
      <div class="db-stats-row">
        <div class="db-stat-card"><div class="db-stat-icon blue">👥</div><div><div class="db-stat-val">${all.length}</div><div class="db-stat-label">Всего заявок</div></div></div>
        <div class="db-stat-card"><div class="db-stat-icon orange">⏳</div><div><div class="db-stat-val">${pending.length}</div><div class="db-stat-label">Ожидают ответа</div></div></div>
        <div class="db-stat-card"><div class="db-stat-icon green">✅</div><div><div class="db-stat-val">${confirmed.length}</div><div class="db-stat-label">Подтверждены</div></div></div>
        <div class="db-stat-card"><div class="db-stat-icon purple">⭐</div><div><div class="db-stat-val">${school.rating ? school.rating.toFixed(1) : '—'}</div><div class="db-stat-label">Рейтинг</div></div></div>
      </div>`;

    const enrollCards = pending.length === 0
      ? '<div class="db-empty"><div class="db-empty-icon">📋</div><div>Новых заявок нет</div></div>'
      : pending.map(function(e) {
          return `<div class="db-enroll-item">
            <div class="db-enroll-avatar">${(e.studentName||'?').charAt(0).toUpperCase()}</div>
            <div><div class="db-enroll-name">${escapeHtml(e.studentName||'—')}</div><div class="db-enroll-meta">${escapeHtml(e.studentPhone||e.studentEmail||'')}</div></div>
            <span class="db-enroll-status st-new">Новая</span>
            <div style="margin-inline-start:8px">
              <button class="db-confirm-btn" onclick="confirmEnrollment('${e.id}')">✓</button>
              <button class="db-reject-btn" onclick="rejectEnrollment('${e.id}')">✕</button>
            </div>
          </div>`;
        }).join('');

    const recentAll = all.slice(-5).reverse().map(function(e) {
      const st = e.status === 'confirmed' ? {txt:'Подтверждён',cls:'st-confirmed'} : e.status === 'cancelled' ? {txt:'Отменён',cls:'st-cancelled'} : {txt:'Новая',cls:'st-new'};
      return `<div class="db-enroll-item">
        <div class="db-enroll-avatar">${(e.studentName||'?').charAt(0).toUpperCase()}</div>
        <div><div class="db-enroll-name">${escapeHtml(e.studentName||'—')}</div><div class="db-enroll-meta">${escapeHtml(e.studentPhone||e.studentEmail||'')}</div></div>
        <span class="db-enroll-status ${st.cls}">${st.txt}</span>
      </div>`;
    }).join('') || '<div class="db-empty"><div class="db-empty-icon">📋</div><div>Заявок пока нет</div></div>';

    body.innerHTML = statsHtml + `
      <div class="db-grid">
        <div class="db-card">
          <div class="db-card-header">
            <div class="db-card-title">Новые заявки</div>
            ${pending.length > 0 ? `<span class="db-card-badge orange">${pending.length} новых</span>` : ''}
          </div>
          <div class="db-card-body">${enrollCards}</div>
        </div>
        <div class="db-card">
          <div class="db-card-header"><div class="db-card-title">Все заявки</div><span class="db-card-badge">${all.length}</span></div>
          <div class="db-card-body">${recentAll}</div>
        </div>
      </div>
      <button class="db-action-btn secondary" style="margin-top:16px" onclick="openSchoolProfile()">✏️ Редактировать профиль школы</button>
      <div class="db-card" style="margin-top:16px">
        <div class="db-card-header"><div class="db-card-title">📅 Расписание доступности</div></div>
        <div class="db-card-body" id="avail-editor-body"><div style="color:var(--muted);font-size:0.85rem">Загружаем…</div></div>
      </div>`;
    renderAvailabilityEditor(school.instructors || [], user.uid);
  }).catch(function() {
    body.innerHTML = '<div class="db-loading">Ошибка загрузки данных</div>';
  });
}

function loadStudentDashboard(user) {
  const body = document.getElementById('db-body');
  db.collection('enrollments').where('userId', '==', user.uid).get().then(function(snap) {
    const enrollments = [];
    snap.forEach(function(d) { enrollments.push({ id: d.id, ...d.data() }); });
    const confirmed = enrollments.filter(function(e) { return e.status === 'confirmed'; });
    const pending   = enrollments.filter(function(e) { return e.status === 'pending'; });

    const statsHtml = `
      <div class="db-stats-row">
        <div class="db-stat-card"><div class="db-stat-icon blue">🏫</div><div><div class="db-stat-val">${enrollments.length}</div><div class="db-stat-label">Мои записи</div></div></div>
        <div class="db-stat-card"><div class="db-stat-icon green">✅</div><div><div class="db-stat-val">${confirmed.length}</div><div class="db-stat-label">Подтверждены</div></div></div>
        <div class="db-stat-card"><div class="db-stat-icon orange">⏳</div><div><div class="db-stat-val">${pending.length}</div><div class="db-stat-label">На рассмотрении</div></div></div>
      </div>`;

    const enrollList = enrollments.length === 0
      ? '<div class="db-empty"><div class="db-empty-icon">🏫</div><div>Вы ещё не записаны ни в одну школу</div><button class="db-action-btn" style="max-width:240px;margin:12px auto 0" onclick="showPage(\'schools\')">Найти школу</button></div>'
      : enrollments.map(function(e) {
          const st = e.status === 'confirmed' ? {txt:'Подтверждён',cls:'st-confirmed'} : e.status === 'cancelled' ? {txt:'Отменён',cls:'st-cancelled'} : {txt:'На рассмотрении',cls:'st-new'};
          return `<div class="db-enroll-item">
            <div class="db-enroll-avatar" style="background:linear-gradient(135deg,#27ae60,#1a73e8)">${(e.schoolName||'?').charAt(0).toUpperCase()}</div>
            <div><div class="db-enroll-name">${escapeHtml(e.schoolName||'—')}</div><div class="db-enroll-meta">${escapeHtml(e.schoolCity||'')}${e.date ? ' · ' + e.date : ''}</div></div>
            <span class="db-enroll-status ${st.cls}">${st.txt}</span>
          </div>`;
        }).join('');

    body.innerHTML = statsHtml + `
      <div class="db-grid">
        <div class="db-card">
          <div class="db-card-header"><div class="db-card-title">Мои записи в школы</div><span class="db-card-badge">${enrollments.length}</span></div>
          <div class="db-card-body">${enrollList}</div>
        </div>
        <div class="db-card">
          <div class="db-card-header"><div class="db-card-title">Быстрые действия</div></div>
          <div class="db-card-body" style="display:flex;flex-direction:column;gap:10px;padding-top:16px">
            <button class="db-action-btn" onclick="showPage('schools')">🏫 Найти автошколу</button>
            <button class="db-action-btn secondary" onclick="showPage('test')">📝 Пройти теорию</button>
            <button class="db-action-btn secondary" onclick="showPage('schedule')">📅 Моё расписание</button>
          </div>
        </div>
      </div>`;
  }).catch(function() {
    body.innerHTML = '<div class="db-loading">Ошибка загрузки данных</div>';
  });
}

function confirmEnrollment(id) {
  db.collection('enrollments').doc(id).update({ status: 'confirmed' }).then(function() {
    loadDashboard();
  });
}
function rejectEnrollment(id) {
  db.collection('enrollments').doc(id).update({ status: 'cancelled' }).then(function() {
    loadDashboard();
  });
}

// ── Expose functions to window (called from HTML onclick handlers) ──
window.setLang = setLang;
window.backToLang = backToLang;
window.showPage = showPage;
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.handleOverlayClick = handleOverlayClick;
window.switchAuthTab = switchAuthTab;
window.selectRole = selectRole;
window.validateEmailField = validateEmailField;
window.updatePwStrength = updatePwStrength;
window.togglePwVisibility = togglePwVisibility;
window.submitAuth = submitAuth;
window.logoutUser = logoutUser;
window.openSchoolProfile = openSchoolProfile;
window.closeSchoolProfile = closeSchoolProfile;
window.handleSpOverlay = handleSpOverlay;
window.rateSchool = rateSchool;
window.saveSchoolPrice = saveSchoolPrice;
window.addInstructor = addInstructor;
window.removeInstructor = removeInstructor;
window.enrollFromProfile = enrollFromProfile;
window.openEnrollModal = openEnrollModal;
window.closeEnrollModal = closeEnrollModal;
window.handleEnrollOverlay = handleEnrollOverlay;
window.submitEnrollment = submitEnrollment;
window.filterSchools = filterSchools;
window.loadFirestoreSchools = loadFirestoreSchools;
window.locateUser = locateUser;
window.goTestimonial = goTestimonial;
window.nextTestimonial = nextTestimonial;
window.prevTestimonial = prevTestimonial;
window.toggleFAQ = toggleFAQ;
window.beginTest = beginTest;
window.selectAnswer = selectAnswer;
window.nextQuestion = nextQuestion;
window.restartTest = restartTest;
window.findTeacher = findTeacher;
window.calNav = calNav;
window.calSelect = calSelect;
window.submitRegistration = submitRegistration;
window.confirmEnrollment = confirmEnrollment;
window.rejectEnrollment = rejectEnrollment;
window.toggleTheme = toggleTheme;
// ── Scheduling exports ──
window.saveAvailability = saveAvailability;
window.toggleAvailCell = toggleAvailCell;
window.setDuration = setDuration;
window.openBookingModal = openBookingModal;
window.closeBookingModal = closeBookingModal;
window.handleBookingOverlay = handleBookingOverlay;
window.onBookingSchoolChange = onBookingSchoolChange;
window.onBookingInstructorChange = onBookingInstructorChange;
window.bookingWeekNav = bookingWeekNav;
window.selectBookingSlot = selectBookingSlot;
window.selectBookingType = selectBookingType;
window.confirmBooking = confirmBooking;
window.cancelBooking = cancelBooking;
window.schedCalNav = schedCalNav;
window.schedCalSelect = schedCalSelect;


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
    const days = DAY_LABELS[currentLang] || DAY_LABELS.ru;

    let html = '<div class="avail-editor">';
    instructors.forEach(function(iname) {
      const idata = saved[iname] || { weeklySlots: {}, duration: 90 };
      _avail[iname] = JSON.parse(JSON.stringify(idata)); // deep copy

      html += `<div class="avail-instructor-block">
        <div class="avail-instructor-name">👨‍🏫 ${escapeHtml(iname)}</div>
        <div class="duration-picker">
          <span style="font-size:0.8rem;font-weight:700;color:var(--muted);align-self:center;margin-inline-end:4px">Длит.:</span>
          ${[45,60,90].map(d => `<button class="duration-btn ${idata.duration===d?'active':''}" onclick="setDuration('${iname.replace(/'/g,"\\'")}',${d},this)">${d} мин</button>`).join('')}
        </div>
        <div class="avail-days-grid" id="grid-${CSS.escape(iname)}">
          <div class="avail-day-header"></div>
          ${days.map(d => `<div class="avail-day-header">${d}</div>`).join('')}
          ${HOURS.map(h => {
            const rowHtml = days.map((_, di) => {
              const on = (idata.weeklySlots[di] || []).includes(h);
              return `<div class="avail-cell ${on?'on':''}" onclick="toggleAvailCell('${iname.replace(/'/g,"\\'")}',${di},${h},this)" title="${h}:00"></div>`;
            }).join('');
            return `<div class="avail-hour-label">${h}:00</div>${rowHtml}`;
          }).join('')}
        </div>
      </div>`;
    });
    html += `<button class="avail-save-btn" onclick="saveAvailability('${schoolId}')">💾 Сохранить расписание</button>`;
    html += '</div>';
    wrap.innerHTML = html;
  }).catch(function() {
    wrap.innerHTML = '<div style="color:#c0392b;font-size:0.85rem">Ошибка загрузки расписания</div>';
  });
}

function setDuration(iname, dur, btn) {
  if (!_avail[iname]) return;
  _avail[iname].duration = dur;
  const block = btn.closest('.avail-instructor-block');
  block.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function toggleAvailCell(iname, day, hour, el) {
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
      notify(currentLang === 'ru' ? 'Расписание сохранено ✓' : currentLang === 'en' ? 'Schedule saved ✓' : 'לוח זמנים נשמר ✓');
      if (btn) { btn.disabled = false; btn.textContent = '💾 Сохранить расписание'; }
    })
    .catch(function() {
      notify('Ошибка сохранения');
      if (btn) { btn.disabled = false; btn.textContent = '💾 Сохранить расписание'; }
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
      <h3>${currentLang==='ru'?'Войдите чтобы видеть расписание':currentLang==='en'?'Sign in to see your schedule':'התחבר כדי לראות את לוח הזמנים'}</h3>
      <button class="schedule-add-btn" style="margin:0 auto;display:flex" onclick="openAuthModal()">
        ${currentLang==='ru'?'Войти':currentLang==='en'?'Sign in':'כניסה'}
      </button>
    </div>`;
    return;
  }

  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">⏳ Загружаем уроки…</div>';

  db.collection('schools').doc(user.uid).get().then(function(schoolDoc) {
    const isSchool = schoolDoc.exists;
    const query = isSchool
      ? db.collection('bookings').where('schoolId', '==', user.uid)
      : db.collection('bookings').where('studentId', '==', user.uid);
    query.get().then(function(snap) {
      const bookings = [];
      snap.forEach(d => bookings.push({ id: d.id, ...d.data() }));
      bookings.sort((a,b) => a.date < b.date ? -1 : 1);
      renderCalendarView(bookings, isSchool);
    }).catch(function() { renderCalendarView([], isSchool); });
  }).catch(function() {
    db.collection('bookings').where('studentId', '==', user.uid).get()
      .then(function(snap) {
        const bookings = [];
        snap.forEach(d => bookings.push({ id: d.id, ...d.data() }));
        bookings.sort((a,b) => a.date < b.date ? -1 : 1);
        renderCalendarView(bookings, false);
      }).catch(function() { renderCalendarView([], false); });
  });
}

// _calState: { year, month, bookings, selectedDate, isSchool }
const _cal = { year: new Date().getFullYear(), month: new Date().getMonth(), bookings: [], selectedDate: null, isSchool: false };

function renderCalendarView(bookings, isSchool) {
  _cal.bookings = bookings;
  _cal.isSchool = isSchool;
  _cal.selectedDate = null;
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

  _cal.withStatus = withStatus;

  const upcoming = withStatus.filter(b => b._st === 'upcoming').length;
  const done     = withStatus.filter(b => b._st === 'done').length;

  const L = {
    total:    currentLang==='ru'?'Всего':currentLang==='en'?'Total':'סה"כ',
    upcoming: currentLang==='ru'?'Предстоит':currentLang==='en'?'Upcoming':'קרובים',
    done:     currentLang==='ru'?'Завершено':currentLang==='en'?'Done':'הושלמו',
    book:     currentLang==='ru'?'Записаться на урок':currentLang==='en'?'Book a lesson':'הזמן שיעור',
    noLess:   currentLang==='ru'?'Уроков пока нет':currentLang==='en'?'No lessons yet':'אין שיעורים עדיין',
    noSub:    currentLang==='ru'?'Нажмите «+» чтобы записаться':currentLang==='en'?'Tap «+» to book a lesson':'לחץ «+» להזמנת שיעור',
    clickDay: currentLang==='ru'?'Нажмите на дату чтобы увидеть уроки':currentLang==='en'?'Click a date to see lessons':'לחץ על תאריך לצפייה בשיעורים',
  };

  const statsHtml = `
    <div class="cal-stats-row">
      <div class="cal-stat"><span class="cal-stat-val">${withStatus.length}</span><span class="cal-stat-lbl">${L.total}</span></div>
      <div class="cal-stat accent"><span class="cal-stat-val">${upcoming}</span><span class="cal-stat-lbl">${L.upcoming}</span></div>
      <div class="cal-stat"><span class="cal-stat-val">${done}</span><span class="cal-stat-lbl">${L.done}</span></div>
    </div>`;

  const bookBtn = isSchool ? '' : `<button class="schedule-add-btn" onclick="openBookingModal()">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    ${L.book}
  </button>`;

  container.innerHTML = statsHtml + bookBtn + `
    <div class="cal-wrap">
      <div class="cal-header">
        <button class="cal-nav-btn" onclick="schedCalNav(-1)">‹</button>
        <span class="cal-month-label" id="cal-month-label"></span>
        <button class="cal-nav-btn" onclick="schedCalNav(1)">›</button>
      </div>
      <div class="cal-grid" id="cal-grid"></div>
    </div>
    <div class="cal-day-lessons" id="cal-day-lessons"><p class="cal-hint">${L.clickDay}</p></div>`;

  renderCalendarGrid();
}

function renderCalendarGrid() {
  const grid = document.getElementById('cal-grid');
  const label = document.getElementById('cal-month-label');
  if (!grid) return;

  const { year, month, withStatus } = _cal;
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

  label.textContent = (monthNames[currentLang] || monthNames.ru)[month] + ' ' + year;

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

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days = dayNames[currentLang] || dayNames.ru;
  let html = days.map(d => `<div class="cal-day-name">${d}</div>`).join('');

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) html += '<div class="cal-cell empty"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${String(d).padStart(2,'0')}.${String(month+1).padStart(2,'0')}.${year}`;
    const cellDate = new Date(year, month, d);
    cellDate.setHours(0,0,0,0);
    const isToday = cellDate.getTime() === today.getTime();
    const isSelected = _cal.selectedDate === dateStr;
    const lessons = bookedDates[dateStr] || [];
    const hasDot = lessons.length > 0;
    const isPast = cellDate < today;

    const typeColors = { lesson_practical:'#1a73e8', lesson_theory:'#8e44ad', lesson_highway:'#27ae60' };
    const dots = lessons.slice(0,3).map(b => `<span class="cal-dot" style="background:${typeColors[b.type]||'#1a73e8'}"></span>`).join('');

    html += `<div class="cal-cell ${isToday?'today':''} ${isSelected?'selected':''} ${isPast?'past':''} ${hasDot?'has-lesson':''}" onclick="schedCalSelect('${dateStr}')">
      <span class="cal-cell-num">${d}</span>
      ${hasDot ? `<div class="cal-dots">${dots}</div>` : ''}
    </div>`;
  }

  grid.innerHTML = html;
}

function schedCalNav(dir) {
  _cal.month += dir;
  if (_cal.month > 11) { _cal.month = 0; _cal.year++; }
  if (_cal.month < 0)  { _cal.month = 11; _cal.year--; }
  _cal.selectedDate = null;
  renderCalendarGrid();
  const panel = document.getElementById('cal-day-lessons');
  if (panel) {
    const hint = currentLang==='ru'?'Нажмите на дату чтобы увидеть уроки':currentLang==='en'?'Click a date to see lessons':'לחץ על תאריך לצפייה בשיעורים';
    panel.innerHTML = `<p class="cal-hint">${hint}</p>`;
  }
}

function schedCalSelect(dateStr) {
  _cal.selectedDate = dateStr;
  renderCalendarGrid();

  const lessons = (_cal.withStatus || []).filter(b => b.date === dateStr);
  const panel = document.getElementById('cal-day-lessons');
  if (!panel) return;

  const typeColors = { lesson_practical:'#1a73e8', lesson_theory:'#8e44ad', lesson_highway:'#27ae60' };
  const statusCls  = { upcoming:'ls-confirmed', done:'ls-done' };
  const personSvg  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`;
  const cancelLbl  = currentLang==='ru'?'Отменить':currentLang==='en'?'Cancel':'בטל';

  if (lessons.length === 0) {
    const empty = currentLang==='ru'?'Нет уроков в этот день':currentLang==='en'?'No lessons this day':'אין שיעורים ביום זה';
    panel.innerHTML = `<p class="cal-hint">${empty}</p>`;
    return;
  }

  panel.innerHTML = lessons.map(b => {
    const color   = typeColors[b.type] || '#1a73e8';
    const stCls   = statusCls[b._st] || 'ls-pending';
    const stTxt   = t[b._st === 'upcoming' ? 'status_confirmed' : 'status_done'] || b._st;
    const typeTxt = t[b.type] || b.type;
    const canCancel = b._st === 'upcoming';
    const nameRow = _cal.isSchool
      ? `<div class="lesson-instr-row">${personSvg}<span class="lesson-instr-name">${escapeHtml(b.studentName||'')}</span></div>`
      : `<div class="lesson-instr-row">${personSvg}<span class="lesson-instr-name">${escapeHtml(b.instructorName||'')}</span></div>`;
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
        ${b.schoolName && !_cal.isSchool ? `<div class="lesson-instr-row">🏫 <span class="lesson-instr-name" style="color:var(--muted)">${escapeHtml(b.schoolName)}</span></div>` : ''}
        ${canCancel && !_cal.isSchool ? `<button class="lesson-cancel-btn" onclick="cancelBooking('${b.id}')">${cancelLbl}</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function cancelBooking(bookingId) {
  if (!confirm(currentLang==='ru'?'Отменить этот урок?':currentLang==='en'?'Cancel this lesson?':'לבטל את השיעור?')) return;
  db.collection('bookings').doc(bookingId).update({ status: 'cancelled' })
    .then(loadScheduleData)
    .catch(function() { notify('Ошибка отмены'); });
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
  if (!user) { openAuthModal(); return; }

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
  sel.innerHTML = '<option value="">— выбрать —</option>';

  const titleMap = { ru:'Записаться на урок', he:'הזמן שיעור', en:'Book a lesson' };
  document.getElementById('booking-modal-title').textContent = titleMap[currentLang] || 'Записаться на урок';

  // Populate schools from confirmed enrollments
  db.collection('enrollments').where('userId', '==', user.uid).where('status', '==', 'confirmed').get()
    .then(function(snap) {
      const opts = [];
      snap.forEach(d => {
        const e = d.data();
        if (e.schoolId && e.schoolName) opts.push({ id: e.schoolId, name: e.schoolName });
      });
      if (opts.length === 0) {
        sel.innerHTML = '<option value="">Нет подтверждённых записей</option>';
        return;
      }
      sel.innerHTML = '<option value="">— выбрать —</option>' +
        opts.map(o => `<option value="${o.id}" data-name="${escapeHtml(o.name)}">${escapeHtml(o.name)}</option>`).join('');
    });
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
      instructors.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
    document.getElementById('booking-instructor-field').style.display = 'block';
  });
}

function onBookingInstructorChange() {
  const isel = document.getElementById('booking-instr-sel');
  _bk.instructorName = isel.value || null;
  document.getElementById('booking-step2').style.display = 'none';
  if (!_bk.instructorName) return;
  _bk.weekOffset = 0;
  _bk.selectedDate = null;
  _bk.selectedTime = null;

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

  const days = DAY_LABELS[currentLang] || DAY_LABELS.ru;

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
    ? (labels[currentLang] || 'Подтвердить запись') + ` — ${_bk.selectedDate} ${_bk.selectedTime}`
    : (currentLang==='ru'?'Выберите время':currentLang==='en'?'Select a time slot':'בחר זמן');
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
    loadScheduleData();
    const msg = currentLang==='ru' ? `Урок записан: ${_bk.selectedDate} в ${_bk.selectedTime} ✓`
              : currentLang==='en' ? `Lesson booked: ${_bk.selectedDate} at ${_bk.selectedTime} ✓`
              : `שיעור הוזמן: ${_bk.selectedDate} ב-${_bk.selectedTime} ✓`;
    notify(msg);
  }).catch(function() {
    notify('Ошибка при записи. Попробуйте снова.');
    btn.disabled = false;
    updateBookingConfirmBtn();
  });
}
