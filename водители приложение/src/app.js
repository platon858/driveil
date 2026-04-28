import firebase from 'firebase/compat/app';
import { auth, db, storage } from './firebase.js';
import { i18n } from './data/translations.js';
import { S, catCfg, cityRegionMap } from './data/signs.js';
import { questions } from './data/questions.js';
import './schedule.js';

const EMAILJS_PUBLIC_KEY    = 'eRJ-MZjHIVvd2WeQw';
const EMAILJS_SERVICE_ID    = 'service_032c1cn';
const EMAILJS_TEMPLATE_ID   = 'template_wjy8fw6';

// ══════════════════════════════════════════════════════
// TRANSLATIONS
// ══════════════════════════════════════════════════════

// Школы загружаются из Firestore — статичных данных нет
let schools = [];

// Fallback coords by city name (Hebrew city names used in Firestore)
const cityCoords = {
  'תל אביב': [32.0853, 34.7818],
  'Tel Aviv': [32.0853, 34.7818],
  'Тель-Авив': [32.0853, 34.7818],
  'ירושלים': [31.7683, 35.2137],
  'Jerusalem': [31.7683, 35.2137],
  'Иерусалим': [31.7683, 35.2137],
  'חיפה': [32.7940, 34.9896],
  'Haifa': [32.7940, 34.9896],
  'Хайфа': [32.7940, 34.9896],
  'באר שבע': [31.2530, 34.7915],
  'Beer Sheva': [31.2530, 34.7915],
  'Беэр-Шева': [31.2530, 34.7915],
  'רמת גן': [32.0824, 34.8137],
  'Ramat Gan': [32.0824, 34.8137],
  'פתח תקווה': [32.0870, 34.8878],
  'Petah Tikva': [32.0870, 34.8878],
  'ראשון לציון': [31.9730, 34.8007],
  'Rishon LeZion': [31.9730, 34.8007],
  'נתניה': [32.3226, 34.8534],
  'Netanya': [32.3226, 34.8534],
  'Нетания': [32.3226, 34.8534],
  'אשדוד': [31.8044, 34.6553],
  'Ashdod': [31.8044, 34.6553],
  'Ашдод': [31.8044, 34.6553],
  'חולון': [32.0114, 34.7747],
  'Holon': [32.0114, 34.7747],
  'Холон': [32.0114, 34.7747],
  'בני ברק': [32.0837, 34.8337],
  'Bnei Brak': [32.0837, 34.8337],
  'Бней-Брак': [32.0837, 34.8337],
  'רחובות': [31.8944, 34.8077],
  'Rehovot': [31.8944, 34.8077],
  'Реховот': [31.8944, 34.8077],
  'רמת גן': [32.0824, 34.8137],
  'Ramat Gan': [32.0824, 34.8137],
  'Рамат-Ган': [32.0824, 34.8137],
  'פתח תקווה': [32.0870, 34.8878],
  'Petah Tikva': [32.0870, 34.8878],
  'Петах-Тиква': [32.0870, 34.8878],
  'ראשון לציון': [31.9730, 34.8007],
  'Rishon LeZion': [31.9730, 34.8007],
  'Ришон-ле-Цион': [31.9730, 34.8007],
};


// ── SVG ROAD SIGN GENERATORS ──




// ── State ──
let currentLang = localStorage.getItem('driveil_lang') || 'he';
let t = i18n[currentLang] || i18n.he;
let currentQ = 0, score = 0, answered = false, shuffled = [];
let activeTestimonial = 0;

// ── Auth screen state ──
let _appInitialized = false;
let _isRegistering = false;
let _authResolved = false; // true after first real onAuthStateChanged callback
let _asMode = 'register';
let _asRole = 'student';
let testimonialTimer = null;

// ── Scheduling state (shared with schedule.js via window bridge) ──
const _cal = { year: new Date().getFullYear(), month: new Date().getMonth(), bookings: [], selectedDate: null, isSchool: false, pendingSelect: null };
let _userIsSchool = false;
let _scheduleUnsub = null;
let _activeSchoolName = null;
let _studentState = null; // 'no_school' | 'pending' | 'active'
const _schoolCal = { year: new Date().getFullYear(), month: new Date().getMonth(), bookings: [] };
let _schoolCalUnsub = null;

// Window bridge: allows schedule.js to read/write these module-scoped vars
Object.defineProperties(window, {
  currentLang:      { get: () => currentLang,      set: v => { currentLang = v; },      configurable: true },
  t:                { get: () => t,                set: v => { t = v; },                configurable: true },
  _cal:             { get: () => _cal,                                                   configurable: true },
  _userIsSchool:    { get: () => _userIsSchool,    set: v => { _userIsSchool = v; },    configurable: true },
  _scheduleUnsub:   { get: () => _scheduleUnsub,   set: v => { _scheduleUnsub = v; },   configurable: true },
  _activeSchoolName:{ get: () => _activeSchoolName,set: v => { _activeSchoolName = v; },configurable: true },
  _schoolCal:       { get: () => _schoolCal,                                             configurable: true },
  _schoolCalUnsub:  { get: () => _schoolCalUnsub,  set: v => { _schoolCalUnsub = v; },  configurable: true },
  _studentState:    { get: () => _studentState,    set: v => { _studentState = v; },    configurable: true },
});

// ── Language picker (inside auth screen) ──
function pickLang(lang) {
  currentLang = lang;
  t = i18n[lang];
  localStorage.setItem('driveil_lang', lang);
  // Apply direction immediately so auth screen text aligns correctly
  document.documentElement.dir = t.dir;
  document.documentElement.lang = t.lang;
  ['he', 'ru', 'en'].forEach(function(l) {
    const btn = document.getElementById('as-lang-' + l);
    if (btn) btn.classList.toggle('active', l === lang);
    const sbBtn = document.getElementById('snav-lang-' + l);
    if (sbBtn) sbBtn.classList.toggle('active', l === lang);
  });
  if (document.getElementById('snav-lang-ru')) applyTranslations();
  _updateAsLabels();
}

function _updateAsLabels() {
  const L = currentLang || 'he';
  const g = function(id) { return document.getElementById(id); };
  const sub = g('as-subtitle');
  const loginLbl = g('as-login-lbl');
  const regLbl = g('as-reg-lbl');
  const nameLbl = g('as-name-lbl');
  const pwLbl = g('as-pw-lbl');
  const btn = g('as-submit-btn');
  const loggedIn = document.getElementById('as-logged-in');
  const isLoggedIn = loggedIn && loggedIn.style.display !== 'none';
  if (sub) sub.textContent = isLoggedIn
    ? (L === 'ru' ? 'Выберите язык' : L === 'en' ? 'Choose language' : 'בחר שפה')
    : (L === 'ru' ? 'Войдите, чтобы продолжить' : L === 'en' ? 'Sign in to continue' : 'כדי להמשיך, יש להתחבר');
  if (loginLbl) loginLbl.textContent = L === 'ru' ? 'Войти' : L === 'en' ? 'Sign In' : 'התחבר';
  if (regLbl) regLbl.textContent = L === 'ru' ? 'Регистрация' : L === 'en' ? 'Register' : 'הרשמה';
  if (nameLbl) nameLbl.textContent = L === 'ru' ? 'Имя' : L === 'en' ? 'Name' : 'שם';
  if (pwLbl) pwLbl.textContent = L === 'ru' ? 'Пароль' : L === 'en' ? 'Password' : 'סיסמה';
  if (btn) btn.textContent = _asMode === 'register'
    ? (L === 'ru' ? 'Зарегистрироваться' : L === 'en' ? 'Register' : 'הרשמה')
    : (L === 'ru' ? 'Войти' : L === 'en' ? 'Sign In' : 'התחבר');
  const continueBtn = g('as-continue-btn');
  const logoutBtn = g('as-logout-btn');
  if (continueBtn) continueBtn.textContent = L === 'ru' ? 'Продолжить' : L === 'en' ? 'Continue' : 'המשך';
  if (logoutBtn) logoutBtn.textContent = L === 'ru' ? 'Выйти' : L === 'en' ? 'Sign out' : 'יציאה';
  const switchLbl = g('as-switch-lbl');
  const switchAction = g('as-switch-action');
  if (_asMode === 'register') {
    if (switchLbl) { switchLbl.onclick = function(){ asSwitchTab('login'); }; switchLbl.style.display = ''; }
    if (switchLbl) switchLbl.childNodes[0].textContent = L === 'ru' ? 'Уже есть аккаунт? ' : L === 'en' ? 'Already have an account? ' : 'כבר יש לך חשבון? ';
    if (switchAction) switchAction.textContent = L === 'ru' ? 'Войти' : L === 'en' ? 'Sign In' : 'התחבר';
  } else {
    if (switchLbl) { switchLbl.onclick = function(){ asSwitchTab('register'); }; switchLbl.style.display = ''; }
    if (switchLbl) switchLbl.childNodes[0].textContent = L === 'ru' ? 'Нет аккаунта? ' : L === 'en' ? "Don't have an account? " : 'אין לך חשבון? ';
    if (switchAction) switchAction.textContent = L === 'ru' ? 'Регистрация' : L === 'en' ? 'Register' : 'הרשמה';
  }
  const roleLbl = g('as-role-lbl');
  const roleStudentLbl = g('as-role-student-lbl');
  const roleSchoolLbl = g('as-role-school-lbl');
  if (roleLbl) roleLbl.textContent = L === 'ru' ? 'Я регистрируюсь как:' : L === 'en' ? 'I am registering as:' : 'אני נרשם כ:';
  if (roleStudentLbl) roleStudentLbl.textContent = L === 'ru' ? 'Ученик' : L === 'en' ? 'Student' : 'תלמיד';
  if (roleSchoolLbl) roleSchoolLbl.textContent = L === 'ru' ? 'Учитель вождения' : L === 'en' ? 'Driving instructor' : 'מדריך נהיגה';
  const schoolSub = g('as-role-school-sub'); if (schoolSub) schoolSub.textContent = L==='ru'?'Инструктор / школа':L==='en'?'Instructor / school':'מדריך / בית ספר';
  const studentSub = g('as-role-student-sub'); if (studentSub) studentSub.textContent = L==='ru'?'Студент':L==='en'?'Student':'תלמיד';
  const haveAccLbl = g('as-have-account-lbl'); if (haveAccLbl) haveAccLbl.textContent = L==='ru'?'Уже есть аккаунт?':L==='en'?'Already have an account?':'כבר יש לך חשבון?';
  const swAct = g('as-switch-action'); if (swAct) swAct.textContent = L==='ru'?'Войти':L==='en'?'Sign In':'התחבר';
  const loginTitleLbl = g('as-login-title-lbl'); if (loginTitleLbl) loginTitleLbl.textContent = L==='ru'?'Войти':L==='en'?'Sign In':'התחבר';
  const noAccLbl = g('as-no-account-lbl'); if (noAccLbl) noAccLbl.textContent = L==='ru'?'Нет аккаунта?':L==='en'?"Don't have an account?":'אין לך חשבון?';
  const regLink = g('as-register-link'); if (regLink) regLink.textContent = L==='ru'?'Регистрация':L==='en'?'Register':'הרשמה';
  const loginBtn = g('as-login-btn'); if (loginBtn && !loginBtn.disabled) loginBtn.textContent = L==='ru'?'Войти':L==='en'?'Sign In':'התחבר';
  const backBtn = g('as-back-btn'); if (backBtn) backBtn.textContent = L==='ru'?'← назад':L==='en'?'← back':'← חזרה';
  const pwHint = g('as-pw-lbl'); if (pwHint && pwHint.tagName === 'DIV') pwHint.textContent = L==='ru'?'Мин. 8 симв., A-Z, a-z, 0-9, спецсимвол':L==='en'?'Min 8 chars, A-Z, a-z, 0-9, special char':'מינ. 8 תווים, A-Z, a-z, 0-9, תו מיוחד';

  // Placeholders for school fields
  const sn = g('as-school-name'); if (sn) sn.placeholder = L==='ru'?'Название автошколы':L==='en'?'Driving school name':'שם בית הספר';
  const sp = g('as-school-phone'); if (sp) sp.placeholder = L==='ru'?'Телефон (+972...)':L==='en'?'Phone (+972...)':'טלפון (+972...)';
  // Placeholders for student fields
  const emailEl = g('as-email'); if (emailEl) emailEl.placeholder = L==='ru'?'Email':L==='en'?'Email':'אימייל';
  const nameEl = g('as-name'); if (nameEl) nameEl.placeholder = L==='ru'?'Ваше имя':L==='en'?'Your name':'שם מלא';
  const idEl = g('as-id-number'); if (idEl) idEl.placeholder = L==='ru'?'Номер удостоверения (תז)':L==='en'?'ID number (תז)':'מספר תעודת זהות';
  const dobLbl = g('as-dob-lbl'); if (dobLbl) dobLbl.textContent = L==='ru'?'Дата рождения':L==='en'?'Date of birth':'תאריך לידה';
  const dobEl = g('as-dob');
  if (dobEl) {
    const today = new Date();
    const maxDate = today.toISOString().split('T')[0]; // не в будущем
    const minYear = today.getFullYear() - 100;
    dobEl.max = maxDate;
    dobEl.min = minYear + '-01-01';
  }
  // City select placeholder option
  const cityStudentEl = g('as-city'); if (cityStudentEl && cityStudentEl.options[0]) cityStudentEl.options[0].text = L==='ru'?'— Выберите город —':L==='en'?'— Choose city —':'— בחר עיר —';
  const citySchoolEl = g('as-school-city'); if (citySchoolEl && citySchoolEl.options[0]) citySchoolEl.options[0].text = L==='ru'?'— Выберите город —':L==='en'?'— Choose city —':'— בחר עיר —';
}

function _asShowStep(stepId) {
  ['as-step-1','as-step-2','as-step-login'].forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = id === stepId ? '' : 'none';
  });
}

function asPickRole(role) {
  _asRole = role;
  _asMode = 'register';
  const L = currentLang || 'he';
  const badgeIcon = document.getElementById('as-role-badge-icon');
  const badgeLbl = document.getElementById('as-role-badge-lbl');
  if (badgeIcon) badgeIcon.textContent = role === 'school' ? '🚗' : '🎓';
  if (badgeLbl) badgeLbl.textContent = role === 'school'
    ? (L==='ru'?'Учитель вождения':L==='en'?'Driving instructor':'מדריך נהיגה')
    : (L==='ru'?'Ученик':L==='en'?'Student':'תלמיד');
  const snPh = document.getElementById('as-school-name');
  if (snPh) snPh.placeholder = L==='ru'?'Ваше имя / название школы':L==='en'?'Your name / school name':'שם מלא / שם בית ספר';
  const addrPh = document.getElementById('as-school-address');
  if (addrPh) addrPh.placeholder = L==='ru'?'Улица, номер дома':L==='en'?'Street, house number':'רחוב ומספר בית';
  const sf = document.getElementById('as-school-fields');
  const stf = document.getElementById('as-student-fields');
  if (sf) sf.style.display = role === 'school' ? '' : 'none';
  if (stf) stf.style.display = role === 'student' ? '' : 'none';
  _asShowStep('as-step-2');
}

function asGoBack() {
  _asMode = 'register';
  _asShowStep('as-step-1');
}

function asShowLogin() {
  _asMode = 'login';
  _asShowStep('as-step-login');
  const errEl = document.getElementById('as-error-login');
  if (errEl) errEl.style.display = 'none';
}

function asLoginSubmit() {
  const email = (document.getElementById('as-email-login').value || '').trim();
  const password = (document.getElementById('as-password-login').value || '').trim();
  const errEl = document.getElementById('as-error-login');
  const btn = document.getElementById('as-login-btn');
  const L = currentLang || 'he';
  if (!email || !password) {
    errEl.textContent = L==='ru'?'Заполни email и пароль':L==='en'?'Fill in email and password':'מלא אימייל וסיסמה';
    errEl.style.display = 'block'; return;
  }
  if (!_validateEmail(email)) {
    errEl.textContent = L==='ru'?'Некорректный email':L==='en'?'Invalid email':'כתובת אימייל לא תקינה';
    errEl.style.display = 'block'; return;
  }
  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = '...';
  auth.signInWithEmailAndPassword(email, password)
    .catch(function(err) {
      btn.disabled = false;
      btn.textContent = L==='he'?'התחבר':L==='ru'?'Войти':'Sign In';
      errEl.textContent = L==='ru'?'Неверный email или пароль':L==='en'?'Wrong email or password':'אימייל או סיסמה שגויים';
      errEl.style.display = 'block';
    });
}

// Legacy stubs kept for backward compatibility
function asSwitchTab(mode) { if (mode==='login') asShowLogin(); else asGoBack(); }
function asSelectRole(role) { asPickRole(role); }

function _validatePhone(phone) {
  // Israeli format: +972-XX-XXX-XXXX or 05X-XXXXXXX etc.
  return /^(\+972|0)[- ]?([23489]|5[0-9]|7[0-9])[- ]?\d{3}[- ]?\d{4}$/.test(phone.replace(/\s/g,''));
}

function _validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function _validatePassword(pw) {
  // Score >= 3 (Good/Strong): min 8 chars + letters + digit
  if (pw.length < 8) return false;
  let score = 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score >= 3;
}

function asTogglePw(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.style.color = show ? '#374151' : '#9ca3af';
  // swap icon to crossed-eye when shown
  btn.innerHTML = show
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
}

function asUpdatePwStrength() {
  const pw = (document.getElementById('as-password').value) || '';
  const bars = [1,2,3,4].map(function(n) { return document.getElementById('as-pw-bar-'+n); });
  const colors = ['#ef4444','#f97316','#eab308','#22c55e'];
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  bars.forEach(function(b, i) {
    if (!b) return;
    b.style.background = i < score ? colors[score - 1] : '#e5e7eb';
  });
  const lbl = document.getElementById('as-pw-lbl');
  if (lbl) {
    const L = currentLang || 'he';
    const labels = {
      0: {ru:'Введите пароль', en:'Enter password', he:'הכנס סיסמה'},
      1: {ru:'Слабый', en:'Weak', he:'חלש'},
      2: {ru:'Средний', en:'Fair', he:'בינוני'},
      3: {ru:'Хороший', en:'Good', he:'טוב'},
      4: {ru:'Надёжный', en:'Strong', he:'חזק'}
    };
    lbl.textContent = labels[score][L] || labels[score]['he'];
    lbl.style.color = score === 0 ? '#9ca3af' : colors[score - 1];
  }
}

async function _geocodeAddress(street, cityHe) {
  try {
    const q = encodeURIComponent(street + ', ' + cityHe + ', Israel');
    const ctrl = new AbortController();
    const timer = setTimeout(function() { ctrl.abort(); }, 4000);
    const resp = await fetch(
      'https://nominatim.openstreetmap.org/search?q=' + q + '&format=json&limit=1&countrycodes=il',
      { signal: ctrl.signal }
    );
    clearTimeout(timer);
    const data = await resp.json();
    if (data && data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch(e) {}
  return null;
}

function _showErr(errEl, ru, en, he) {
  const L = currentLang || 'he';
  errEl.textContent = L === 'ru' ? ru : L === 'en' ? en : he;
  errEl.style.display = 'block';
}

function asSubmit() {
  const email = (document.getElementById('as-email').value || '').trim();
  const password = (document.getElementById('as-password').value || '').trim();
  const name = (document.getElementById('as-name').value || '').trim();
  const errEl = document.getElementById('as-error');
  const btn = document.getElementById('as-submit-btn');
  const L = currentLang || 'he';

  if (!email || !password) {
    _showErr(errEl, 'Заполни email и пароль', 'Fill in email and password', 'מלא אימייל וסיסמה');
    return;
  }

  if (!_validateEmail(email)) {
    _showErr(errEl, 'Некорректный email', 'Invalid email address', 'כתובת אימייל לא תקינה');
    return;
  }

  if (_asMode === 'register') {
    if (!_validatePassword(password)) {
      _showErr(errEl,
        'Пароль должен быть "Хорошим" — мин. 8 символов с буквами и цифрой',
        'Password must be "Good" — min 8 chars with letters and a digit',
        'הסיסמה חייבת להיות "טובה" — לפחות 8 תווים עם אותיות וספרה');
      return;
    }

    if (_asRole === 'school') {
      const spEl = document.getElementById('as-school-phone');
      const phone = spEl ? spEl.value.trim() : '';
      if (phone && !_validatePhone(phone)) {
        _showErr(errEl, 'Неверный формат телефона (+972...)', 'Invalid phone format (+972...)', 'פורמט טלפון שגוי (+972...)');
        return;
      }
      const snEl = document.getElementById('as-school-name');
      const schoolName = snEl ? snEl.value.trim() : '';
      if (!schoolName) {
        _showErr(errEl, 'Введите название школы', 'Enter school name', 'הכנס שם בית ספר');
        return;
      }
      if (!name) {
        _showErr(errEl, 'Введите ваше имя', 'Enter your name', 'הכנס את שמך');
        return;
      }
      errEl.style.display = 'none';
      btn.disabled = true;
      btn.textContent = '...';
      _doCreateUser(email, password, name, errEl, btn);
      return;
    }
  }

  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = '...';
  if (_asMode === 'login') {
    auth.signInWithEmailAndPassword(email, password)
      .catch(function(err) {
        btn.disabled = false;
        _updateAsLabels();
        errEl.textContent = L === 'ru' ? 'Неверный email или пароль' : L === 'en' ? 'Wrong email or password' : 'אימייל או סיסמה שגויים';
        errEl.style.display = 'block';
      });
  } else {
    _doCreateUser(email, password, name, errEl, btn);
  }
}

async function _doCreateUser(email, password, name, errEl, btn) {
  const L = currentLang || 'he';
  _isRegistering = true;
  try {
    // If school — geocode address first (non-blocking, fallback to city center)
    let geocodedLat = null, geocodedLng = null;
    if (_asRole === 'school') {
      const addrEl = document.getElementById('as-school-address');
      const scEl   = document.getElementById('as-school-city');
      const street = addrEl ? addrEl.value.trim() : '';
      const cityHe = scEl ? (scEl.options[scEl.selectedIndex] && scEl.options[scEl.selectedIndex].value) : '';
      if (street && cityHe) {
        const statusEl = document.getElementById('as-addr-status');
        if (statusEl) statusEl.textContent = '⏳';
        const geo = await _geocodeAddress(street, cityHe);
        if (geo) { geocodedLat = geo.lat; geocodedLng = geo.lng; if (statusEl) statusEl.textContent = '✅'; }
        else { if (statusEl) statusEl.textContent = ''; }
      }
    }

    const result = await auth.createUserWithEmailAndPassword(email, password);
    await result.user.updateProfile({ displayName: name || email.split('@')[0] });
    await result.user.getIdToken(true); // force token refresh so Firestore rules see auth
    await new Promise(function(r) { setTimeout(r, 300); }); // brief wait for auth to propagate (retries handle the rest)
    const uid = result.user.uid;
    const displayName = name || email.split('@')[0];
    const userData = {
      uid, name: displayName, email, role: _asRole,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (_asRole === 'student') {
      const dobEl  = document.getElementById('as-dob');
      const cityEl = document.getElementById('as-city');
      const idEl   = document.getElementById('as-id-number');
      if (dobEl && dobEl.value) userData.dateOfBirth = dobEl.value;
      if (cityEl && cityEl.value.trim()) userData.city = cityEl.value.trim();
      if (idEl && idEl.value.trim()) userData.idNumber = idEl.value.trim();
    }
    // Write user doc (non-critical)
    try { await db.collection('users').doc(uid).set(userData); }
    catch(e) { console.warn('users write failed (will retry on next login):', e.message); }

    if (_asRole === 'school') {
      const sn = document.getElementById('as-school-name');
      const sc = document.getElementById('as-school-city');
      const sp = document.getElementById('as-school-phone');
      const sa = document.getElementById('as-school-address');
      const schoolName = (sn && sn.value.trim()) || displayName;
      const phone   = (sp && sp.value.trim()) || '';
      const address = (sa && sa.value.trim()) || '';
      const cityOpt = sc && sc.options[sc.selectedIndex];
      const cityHe = (cityOpt && cityOpt.value) || '';
      const cityRu = (cityOpt && cityOpt.dataset.ru) || '';
      const cityEn = (cityOpt && cityOpt.dataset.en) || '';
      const cityLat = cityOpt ? parseFloat(cityOpt.dataset.lat) : NaN;
      const cityLng = cityOpt ? parseFloat(cityOpt.dataset.lng) : NaN;
      const finalLat = geocodedLat !== null ? geocodedLat : (isNaN(cityLat) ? null : cityLat);
      const finalLng = geocodedLng !== null ? geocodedLng : (isNaN(cityLng) ? null : cityLng);
      userData.schoolName = schoolName;
      userData.city = cityHe;
      userData.phone = phone;
      const schoolData = {
        uid, name: schoolName, ownerName: displayName,
        email, city: cityHe, cityRu, cityEn, phone, address, role: 'school',
        lat: finalLat, lng: finalLng,
        rating: 0, students: 0, price: 0, pass_rate: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      // Retry write up to 3 times (token propagation can be slow)
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await db.collection('schools').doc(uid).set(schoolData);
          break;
        } catch(e) {
          if (attempt < 2) {
            await result.user.getIdToken(true);
            await new Promise(function(r) { setTimeout(r, 1500 * (attempt + 1)); });
          } else {
            throw new Error('schools write: ' + e.message);
          }
        }
      }
    }
    // Registration complete — launch app
    _isRegistering = false;
    localStorage.setItem('driveIL-role-' + result.user.uid, _asRole);
    if (_asRole === 'school') { _userIsSchool = true; updateSidebarForSchool(); }
    _launchApp();
  } catch(err) {
    _isRegistering = false;
    if (err.code === 'auth/email-already-in-use') {
      auth.signInWithEmailAndPassword(email, password)
        .catch(function() {
          btn.disabled = false;
          _updateAsLabels();
          errEl.textContent = L === 'ru' ? 'Неверный пароль' : L === 'en' ? 'Wrong password' : 'סיסמה שגויה';
          errEl.style.display = 'block';
        });
    } else {
      btn.disabled = false;
      _updateAsLabels();
      errEl.textContent = 'Error: ' + err.message;
      errEl.style.display = 'block';
    }
  }
}

function _launchApp() {
  if (_appInitialized) return;
  _appInitialized = true;
  const splash = document.getElementById('splash-screen');
  if (splash) splash.style.display = 'none';
  const authScreen = document.getElementById('auth-screen');
  if (authScreen) authScreen.style.display = 'none';
  const appEl = document.getElementById('app');
  appEl.style.display = 'block';
  requestAnimationFrame(function() { appEl.classList.add('visible'); });
  applyTranslations();
  setTimeout(() => updateNavSpotlight('home'), 50);
  loadFirestoreSchools();
  renderTestimonials();
  renderFAQ();
  startTest();
  initScrollAnimations();
  setTimeout(animateStats, 400);
  setTimeout(updateProgressWidget, 600);
  setTimeout(initLiveFeed, 800);
  initGeolocation();
}

function applyTranslations() {
  // Apply direction and lang now that auth screen is gone — no layout jump risk
  document.documentElement.lang = t.lang;
  document.documentElement.dir = t.dir;
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
  ['he', 'ru', 'en'].forEach(function(l) {
    const sbBtn = document.getElementById('snav-lang-' + l);
    if (sbBtn) sbBtn.classList.toggle('active', l === currentLang);
  });
  const footerCity = document.getElementById('footer-city');
  if (footerCity) footerCity.textContent = currentLang==='he' ? 'אשדוד, ישראל' : currentLang==='en' ? 'Ashdod, Israel' : 'Ашдод, Израиль';
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


function asLogout() {
  auth.signOut().then(function() {
    const li = document.getElementById('as-logged-in');
    const fb = document.getElementById('as-form-block');
    const tabsEl = document.querySelector('#auth-screen .auth-tabs');
    if (li) li.style.display = 'none';
    if (fb) fb.style.display = 'block';
    if (tabsEl) tabsEl.style.display = 'flex';
    // Reset to login mode, hiding collapsible fields
    _asMode = 'login';
    _asRole = 'student';
    ['as-name-wrap', 'as-role-block', 'as-school-fields'].forEach(function(id) {
      const el = document.getElementById(id);
      if (el) el.classList.remove('open');
    });
    const studentBtn = document.getElementById('as-role-student');
    const schoolBtn = document.getElementById('as-role-school');
    if (studentBtn) studentBtn.classList.add('active');
    if (schoolBtn) schoolBtn.classList.remove('active');
    _updateAsLabels();
  });
}

// Fallback: если Firebase не ответил за 4с — покажем auth-screen
setTimeout(function() {
  if (!_appInitialized) {
    const splash = document.getElementById('splash-screen');
    if (splash) splash.style.display = 'none';
    const authScreen = document.getElementById('auth-screen');
    if (authScreen) authScreen.style.display = 'flex';
  }
}, 6000);

// Слушаем — вошёл пользователь или вышел
auth.onAuthStateChanged(function(user) {
  _authResolved = true;
  if (user && !_appInitialized) {
    const cachedRole = localStorage.getItem('driveIL-role-' + user.uid);
    const cachedCity = localStorage.getItem('driveIL-city-' + user.uid);
    if (cachedCity) _userCity = cachedCity;
    if (cachedRole === 'school') { _userIsSchool = true; updateSidebarForSchool(); }

    // Fast path: if we have a cached role, launch immediately
    if (cachedRole) { _launchApp(); }

    // Always sync with Firestore to verify and refresh data
    db.collection('users').doc(user.uid).get().then(function(doc) {
      if (doc.exists) {
        if (!_appInitialized) _launchApp();
        const role = doc.data().role;
        if (doc.data().city) {
          _userCity = doc.data().city;
          localStorage.setItem('driveIL-city-' + user.uid, doc.data().city);
        }
        if (role === 'school') {
          localStorage.setItem('driveIL-role-' + user.uid, 'school');
          _userIsSchool = true; updateSidebarForSchool();
        } else if (role === 'student') {
          localStorage.setItem('driveIL-role-' + user.uid, 'student');
          resolveStudentState(user.uid);
        } else {
          db.collection('schools').doc(user.uid).get().then(function(sdoc) {
            if (sdoc.exists) {
              localStorage.setItem('driveIL-role-' + user.uid, 'school');
              _userIsSchool = true; updateSidebarForSchool();
            }
          });
        }
      } else if (!_appInitialized && !_isRegistering) {
        auth.signOut();
      }
    }).catch(function() {
      if (!_appInitialized) {
        const splash = document.getElementById('splash-screen');
        if (splash) splash.style.display = 'none';
        const authScreen = document.getElementById('auth-screen');
        if (authScreen) authScreen.style.display = 'flex';
      }
    });
    return;
  }

  if (!_appInitialized) {
    // No user — but wait 400ms on first call in case Firebase fires null before persisted session loads
    const showAuth = function() {
      if (_appInitialized) return;
      const splash = document.getElementById('splash-screen');
      if (splash) splash.style.display = 'none';
      _asShowStep('as-step-1'); // always show role selection first, never login form
      _asMode = 'register';
      const authScreen = document.getElementById('auth-screen');
      if (authScreen) authScreen.style.display = 'flex';
    };
    if (_authResolved) { showAuth(); } else { setTimeout(showAuth, 400); }
    _authResolved = true;
    return;
  }

  const wrap = document.getElementById('auth-header-btn');
  const sbAuth = document.getElementById('sb-auth-area');
  const dashBtn = document.getElementById('snav-dashboard');
  if (user) {
    const name = user.displayName || user.email.split('@')[0];
    const letter = name.charAt(0).toUpperCase();
    // old header compat
    if (wrap) wrap.innerHTML = `<div class="user-chip"><div class="user-avatar">${letter}</div><span class="user-name">${escapeHtml(name)}</span><button class="logout-btn" onclick="logoutUser()">✕</button></div>`;
    // sidebar user area
    if (sbAuth) sbAuth.innerHTML = `
      <div class="sb-user">
        <div class="sb-avatar">${letter}</div>
        <span class="sb-user-name">${escapeHtml(name)}</span>
      </div>
      <div id="sb-auth-dashboard-btn" style="display:none">
        <button class="sb-btn" onclick="showPage('dashboard')">
          <span class="sb-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></span>
          <span class="sb-label" data-i18n="nav_dashboard">${t.nav_dashboard||'Кабинет'}</span>
        </button>
      </div>
      <button class="sb-btn" onclick="logoutUser()" style="color:rgba(255,100,100,0.8)">
        <span class="sb-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></span>
        <span class="sb-label" data-i18n="nav_logout">${t.nav_logout||'Выйти'}</span>
      </button>`;
    if (dashBtn) dashBtn.style.display = 'none'; // shown only for schools below
    closeAuthModal();
    updateProgressWidget();
    // Apply cached role immediately (no wait)
    const cachedRole = localStorage.getItem('driveIL-role-' + user.uid);
    if (cachedRole === 'school') { _userIsSchool = true; updateSidebarForSchool(); }
    // Verify role from Firestore and update cache
    db.collection('users').doc(user.uid).get().then(function(doc) {
      if (doc.exists && doc.data().role === 'school') {
        localStorage.setItem('driveIL-role-' + user.uid, 'school');
        if (!_userIsSchool) { _userIsSchool = true; updateSidebarForSchool(); }
      } else {
        db.collection('schools').doc(user.uid).get().then(function(sdoc) {
          if (sdoc.exists) {
            localStorage.setItem('driveIL-role-' + user.uid, 'school');
            if (!_userIsSchool) { _userIsSchool = true; updateSidebarForSchool(); }
          } else {
            localStorage.setItem('driveIL-role-' + user.uid, 'student');
            resolveStudentState(user.uid);
          }
        });
      }
    });
    // Resolve student state if role is already known as student
    if (localStorage.getItem('driveIL-role-' + user.uid) === 'student') {
      resolveStudentState(user.uid);
    }
  } else {
    if (wrap) wrap.innerHTML = `<button class="auth-btn" onclick="openAuthModal()">Войти</button>`;
    if (sbAuth) sbAuth.innerHTML = `<button class="sb-auth-btn" onclick="openAuthModal()"><span class="sb-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg></span><span class="sb-label" data-i18n="nav_login">${t.nav_login||'Войти'}</span></button>`;
    if (dashBtn) dashBtn.style.display = 'none';
  }
});

// ─── STUDENT STATE ───
function resolveStudentState(uid) {
  // Apply cached state immediately (before Firestore)
  const cached = localStorage.getItem('driveIL-state-' + uid);
  if (cached) { _studentState = cached; }

  db.collection('enrollments').where('userId', '==', uid).get().then(function(snap) {
    let state;
    if (snap.empty) {
      state = 'no_school';
    } else {
      const statuses = snap.docs.map(function(d) { return d.data().status; });
      state = statuses.includes('confirmed') ? 'active' : 'pending';
    }
    _studentState = state;
    localStorage.setItem('driveIL-state-' + uid, state);
    // Re-render progress widget and schedule if visible
    updateProgressWidget();
    if (document.getElementById('page-schedule') &&
        document.getElementById('page-schedule').classList.contains('active')) {
      if (typeof window.loadScheduleData === 'function') window.loadScheduleData();
    }
  });
}

// ─── PROGRESS WIDGET ───
function updateProgressWidget() {
  const user = auth.currentUser;
  const lang = currentLang || 'ru';

  const labels = {
    ru: { ready: 'готовности', title: 'Ваш прогресс к правам', noSchool: 'Школа не выбрана', chooseSchool: 'Выбери автошколу чтобы начать', lessons: 'Уроков пройдено', theory: 'Теория', theoryDone: 'Тест пройден', theoryHint: 'Пройди пробный тест', timeEst: '~6 месяцев', timeTil: 'До получения прав', choose: 'Выбрать', start: 'Начать', add: 'Добавить', change: 'Изменить', save: 'Сохранить', cancel: 'Отмена', countLbl: 'Кол-во уроков', minsLbl: 'Минут за урок' },
    he: { ready: 'מוכנות', title: 'ההתקדמות שלך לרישיון', noSchool: 'לא נבחר בית ספר', chooseSchool: 'בחר בית ספר כדי להתחיל', lessons: 'שיעורים שהושלמו', theory: 'תיאוריה', theoryDone: 'המבחן עבר', theoryHint: 'עבור מבחן ניסיון', timeEst: '~6 חודשים', timeTil: 'עד לקבלת הרישיון', choose: 'בחר', start: 'התחל', add: 'הוסף', change: 'שנה', save: 'שמור', cancel: 'ביטול', countLbl: 'מספר שיעורים', minsLbl: 'דקות לשיעור' },
    en: { ready: 'ready', title: 'Your progress to license', noSchool: 'No school selected', chooseSchool: 'Choose a driving school to start', lessons: 'Lessons completed', theory: 'Theory', theoryDone: 'Test passed', theoryHint: 'Take a practice test', timeEst: '~6 months', timeTil: 'Until license', choose: 'Choose', start: 'Start', add: 'Add', change: 'Edit', save: 'Save', cancel: 'Cancel', countLbl: 'Lessons', minsLbl: 'Min/lesson' }
  };
  const L = labels[lang] || labels.ru;

  const pct = document.getElementById('pr-pct');
  const lbl = document.getElementById('pr-label');
  const fill = document.getElementById('pr-fill-circle');
  const prsTitle = document.getElementById('prs-title');
  const schoolName = document.getElementById('prs-school-name');
  const schoolHint = document.getElementById('prs-school-hint');
  const schoolBtn = document.getElementById('prs-school-btn');
  const lessonsCount = document.getElementById('prs-lessons-count');
  const theoryHintEl = document.getElementById('prs-theory-hint');
  const timeEst = document.getElementById('prs-time-est');

  if (prsTitle) prsTitle.textContent = L.title;
  if (timeEst) timeEst.textContent = L.timeEst;

  // Translate static labels
  const lessonsLabel = document.getElementById('prs-lessons-label');
  const theoryLabel = document.getElementById('prs-theory-label');
  const timeLabel = document.getElementById('prs-time-label');
  const theoryBtn = document.getElementById('prs-theory-btn');
  const plfLabelCount = document.getElementById('plf-label-count');
  const plfLabelMins = document.getElementById('plf-label-mins');
  const plfSaveBtn = document.getElementById('plf-save-btn');
  const plfCancelBtn = document.getElementById('plf-cancel-btn');
  if (lessonsLabel) lessonsLabel.textContent = L.lessons;
  if (theoryLabel) theoryLabel.textContent = L.theory;
  if (timeLabel) timeLabel.textContent = L.timeTil;
  if (theoryBtn) theoryBtn.textContent = L.start;
  if (plfLabelCount) plfLabelCount.textContent = L.countLbl;
  if (plfLabelMins) plfLabelMins.textContent = L.minsLbl;
  if (plfSaveBtn) plfSaveBtn.textContent = L.save;
  if (plfCancelBtn) plfCancelBtn.textContent = L.cancel;

  let score = 0; // 0-100

  if (!user) {
    // Не залогинен
    if (pct) pct.textContent = '0%';
    if (lbl) lbl.textContent = L.ready;
    if (schoolName) schoolName.textContent = L.noSchool;
    if (schoolHint) schoolHint.textContent = L.chooseSchool;
    if (schoolBtn) { schoolBtn.textContent = L.choose; schoolBtn.style.display = ''; }
    if (lessonsCount) lessonsCount.textContent = '0 / ~28';
    if (theoryHintEl) theoryHintEl.textContent = L.theoryHint;
    const lessonsBtn = document.getElementById('prs-lessons-btn');
    if (lessonsBtn) lessonsBtn.textContent = L.add;
    if (fill) fill.style.strokeDashoffset = 528;
    return;
  }

  // Загружаем данные пользователя
  Promise.all([
    db.collection('enrollments').where('userId','==',user.uid).where('status','==','confirmed').get(),
    db.collection('bookings').where('studentId','==',user.uid).get(),
    db.collection('enrollments').where('userId','==',user.uid).where('status','in',['pending','new']).get()
  ]).then(([enrollSnap, bookingsSnap, pendingSnap]) => {
    const enrolled = !enrollSnap.empty;
    const state = _studentState || (enrolled ? 'active' : (!pendingSnap.empty ? 'pending' : 'no_school'));
    const firestoreLessons = bookingsSnap.docs.filter(d => d.data().status !== 'cancelled').length;
    const localData = JSON.parse(localStorage.getItem('lessonsData') || '{"count":0}');
    const lessonsDone = Math.max(firestoreLessons, localData.count || 0);

    if (state === 'active' && enrolled) {
      score += 30;
      const enroll = enrollSnap.docs[0].data();
      const sName = enroll.schoolName || enroll.schoolId || L.noSchool;
      if (schoolName) schoolName.textContent = sName;
      if (schoolHint) schoolHint.textContent = enroll.licenseType || '';
      if (schoolBtn) schoolBtn.style.display = 'none';
      const schItem = document.getElementById('prs-school');
      if (schItem) { const ico = schItem.querySelector('.prs-icon'); if (ico) { ico.className = 'prs-icon prs-icon--ok'; ico.querySelector('svg').style.stroke = '#27ae60'; } }
    } else if (state === 'pending' && !pendingSnap.empty) {
      const enroll = pendingSnap.docs[0].data();
      const sName = enroll.schoolName || '—';
      if (schoolName) schoolName.textContent = sName;
      if (schoolHint) schoolHint.innerHTML = '<span style="color:#f59e0b;">⏳ ' + (lang==='ru'?'Заявка рассматривается':lang==='en'?'Pending approval':'ממתין לאישור') + '</span>';
      if (schoolBtn) schoolBtn.style.display = 'none';
    } else {
      if (schoolName) schoolName.textContent = L.noSchool;
      if (schoolHint) schoolHint.textContent = L.chooseSchool;
      if (schoolBtn) { schoolBtn.textContent = L.choose; schoolBtn.style.display = ''; }
    }

    const maxLessons = 28;
    score += Math.min(40, Math.round((lessonsDone / maxLessons) * 40));
    const localData2 = JSON.parse(localStorage.getItem('lessonsData') || '{"count":0,"mins":45}');
    const totalMins = (localData2.count || 0) * (localData2.mins || 45);
    const hh = Math.floor(totalMins / 60), mm = totalMins % 60;
    const timeStr = totalMins > 0 ? ` · ${hh}ч ${mm}м` : '';
    if (lessonsCount) lessonsCount.textContent = `${lessonsDone} / ~${maxLessons}${timeStr}`;
    const lessonsBtn = document.getElementById('prs-lessons-btn');
    if (lessonsBtn) lessonsBtn.textContent = lessonsDone > 0 ? L.change : L.add;

    // Theory score (from localStorage)
    const bestScore = parseInt(localStorage.getItem('bestTestScore') || '0');
    if (bestScore >= 72) {
      score += 30;
      if (theoryHintEl) theoryHintEl.textContent = `${bestScore}% — ${L.theoryDone}`;
      const theoryItem = document.getElementById('prs-theory-item');
      if (theoryItem) { const ico = theoryItem.querySelector('.prs-icon'); if (ico) ico.className = 'prs-icon prs-icon--ok'; }
    } else if (bestScore > 0) {
      score += 10;
      if (theoryHintEl) theoryHintEl.textContent = `${bestScore}% — ${L.theoryHint}`;
    } else {
      if (theoryHintEl) theoryHintEl.textContent = L.theoryHint;
    }

    const months = Math.max(1, Math.round(6 * (1 - score / 100)));
    if (timeEst) timeEst.textContent = `~${months} ${lang === 'ru' ? 'мес.' : lang === 'en' ? 'mo.' : 'חודשים'}`;
    if (pct) pct.textContent = score + '%';
    if (lbl) lbl.textContent = L.ready;
    // Animate ring: circumference = 2π*84 ≈ 528
    if (fill) fill.style.strokeDashoffset = 528 - (528 * score / 100);
  }).catch(() => {
    if (pct) pct.textContent = '0%';
    if (fill) fill.style.strokeDashoffset = 528;
  });
}

// ─── GEOLOCATION ───
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

let _userLat = null, _userLng = null; // stored once geolocation succeeds

function showGeoBarWithDistance(uLat, uLng) {
  _userLat = uLat; _userLng = uLng;
  const geoBar = document.getElementById('uhc-geo-bar');
  const geoText = document.getElementById('uhc-geo-text');
  const withCoords = schools.filter(s => s.lat && s.lng);
  if (withCoords.length === 0 || !geoBar || !geoText) return;
  let nearest = null, minDist = Infinity;
  withCoords.forEach(s => {
    const d = haversineKm(uLat, uLng, s.lat, s.lng);
    if (d < minDist) { minDist = d; nearest = s; }
  });
  if (!nearest) return;
  const distStr = minDist < 1 ? (minDist * 1000).toFixed(0) + ' м' : minDist.toFixed(1) + ' км';
  const L = currentLang || 'ru';
  if (L === 'ru') geoText.textContent = `${distStr} до ближайшей школы`;
  else if (L === 'en') geoText.textContent = `${distStr} to nearest school`;
  else geoText.textContent = `${distStr} לבית הספר הקרוב`;
  geoBar.style.display = 'flex';
  // Update hero card with nearby schools
  updateHeroCardNearby(uLat, uLng);
}

function updateHeroCardNearby(uLat, uLng) {
  if (_userIsSchool) return;
  const heroCard = document.querySelector('.uber-hero-card');
  if (!heroCard) return;
  const lang = currentLang || 'ru';
  const RADIUS = 5; // km
  const cityFn = s => lang === 'ru' ? (s.cityRu || s.city || '') : lang === 'en' ? (s.cityEn || s.city || '') : (s.city || '');

  // Schools with coordinates, sorted by distance
  const withDist = schools
    .filter(s => s.lat && s.lng)
    .map(s => ({ ...s, dist: haversineKm(uLat, uLng, s.lat, s.lng) }))
    .sort((a, b) => a.dist - b.dist);

  const nearby = withDist.filter(s => s.dist <= RADIUS);
  const display = nearby.length > 0 ? nearby.slice(0, 3) : withDist.slice(0, 3);

  const labelTxt = nearby.length > 0
    ? (lang === 'ru' ? `В 5 км от вас (${nearby.length})` : lang === 'en' ? `Within 5 km (${nearby.length})` : `במרחק 5 ק"מ (${nearby.length})`)
    : (lang === 'ru' ? 'Ближайшие школы' : lang === 'en' ? 'Nearby schools' : 'בתי ספר קרובים');

  heroCard.innerHTML = `<div class="uhc-label">${labelTxt}</div>` +
    display.map(s => {
      const initials = s.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
      const rating = s.rating ? s.rating.toFixed(1) + ' ★' : '';
      const distStr = s.dist < 1 ? (s.dist * 1000).toFixed(0) + ' м' : s.dist.toFixed(1) + ' км';
      return `<div class="uhc-item">
        <div class="uhc-avatar">${initials}</div>
        <div class="uhc-info">
          <div class="uhc-name">${s.name}</div>
          <div class="uhc-meta">${distStr}${rating ? ' · ' + rating : ''}</div>
        </div>
      </div>`;
    }).join('');
}

function initGeolocation() {
  if (_userIsSchool) return;
  const geoBar = document.getElementById('uhc-geo-bar');
  const geoText = document.getElementById('uhc-geo-text');
  if (!geoBar || !geoText) return;

  // Always show bar with first school name as fallback first
  const withCoords = schools.filter(s => s.lat && s.lng);
  if (withCoords.length > 0) {
    const L = currentLang || 'ru';
    const s0 = withCoords[0];
    const city0 = L === 'ru' ? (s0.cityRu || s0.city) : L === 'en' ? (s0.cityEn || s0.city) : s0.city;
    if (L === 'ru') geoText.textContent = `Ближайшая школа: ${s0.name}${city0 ? ' — ' + city0 : ''}`;
    else if (L === 'en') geoText.textContent = `Nearest school: ${s0.name}${city0 ? ' — ' + city0 : ''}`;
    else geoText.textContent = `${s0.name}${city0 ? ' — ' + city0 : ''}`;
    geoBar.style.display = 'flex';
  } else {
    return; // No schools at all
  }

  // Then try to get exact distance via geolocation
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(function(pos) {
    showGeoBarWithDistance(pos.coords.latitude, pos.coords.longitude);
  }, function() {
    // Permission denied or error — keep the fallback text already shown
  }, { timeout: 10000, maximumAge: 60000 });
}

// ─── LIVE ACTIVITY FEED ───
function initLiveFeed() {
  const ticker = document.getElementById('live-ticker');
  const title = document.getElementById('live-title');
  if (!ticker) return;

  const lang = currentLang || 'ru';
  if (title) {
    title.textContent = lang === 'ru' ? 'Сейчас на платформе' : lang === 'en' ? 'Live on platform' : 'פעיל עכשיו';
  }

  // Fetch real data from Firestore
  Promise.all([
    db.collection('bookings').where('status','==','confirmed').get(),
    db.collection('enrollments').where('status','==','confirmed').get()
  ]).then(([bookSnap, enrollSnap]) => {
    const lessonsToday = bookSnap.size;
    const students = enrollSnap.size;
    const schoolsCount = schools.length;

    const chips = lang === 'ru' ? [
      { val: schoolsCount, label: 'автошкол на платформе' },
      { val: students, label: 'активных студентов' },
      { val: lessonsToday, label: 'урок(ов) записано' },
      { val: '68%', label: 'сдают теорию с 1-го раза' },
      { val: '~28', label: 'уроков до прав в среднем' },
    ] : lang === 'en' ? [
      { val: schoolsCount, label: 'schools on platform' },
      { val: students, label: 'active students' },
      { val: lessonsToday, label: 'lessons booked' },
      { val: '68%', label: 'pass theory 1st try' },
      { val: '~28', label: 'avg lessons to license' },
    ] : [
      { val: schoolsCount, label: 'בתי ספר' },
      { val: students, label: 'תלמידים פעילים' },
      { val: lessonsToday, label: 'שיעורים נקבעו' },
      { val: '68%', label: 'עוברים תיאוריה בפעם הראשונה' },
      { val: '~28', label: 'שיעורים עד הרישיון' },
    ];

    ticker.innerHTML = chips.map(c =>
      `<div class="lt-chip"><div class="lt-chip-dot"></div><span class="lt-chip-val">${c.val}</span>&nbsp;${c.label}</div>`
    ).join('');
  }).catch(() => {
    ticker.innerHTML = `<div class="lt-chip"><div class="lt-chip-dot"></div><span class="lt-chip-val">${schools.length}</span>&nbsp;${lang === 'ru' ? 'школ на платформе' : 'schools'}</div>`;
  });

  // Localize quotes
  const quotes = {
    ru: [
      { t: '"Сдал теорию с первого раза"', a: 'Дмитрий, Тель-Авив' },
      { t: '"Нашёл школу за 5 минут"', a: 'Михаил, Хайфа' },
      { t: '"Лучший трекер прогресса"', a: 'Анна, Иерусалим' },
    ],
    en: [
      { t: '"Passed theory on first try"', a: 'Alex, Tel Aviv' },
      { t: '"Found my school in 5 min"', a: 'Michael, Haifa' },
      { t: '"Best progress tracker"', a: 'Anna, Jerusalem' },
    ],
    he: [
      { t: '"עברתי תיאוריה בפעם הראשונה"', a: 'דמיטרי, תל אביב' },
      { t: '"מצאתי בית ספר תוך 5 דקות"', a: 'מיכאל, חיפה' },
      { t: '"המעקב הטוב ביותר"', a: 'אנה, ירושלים' },
    ]
  };
  const q = quotes[lang] || quotes.ru;
  [1,2,3].forEach(i => {
    const el = document.getElementById('lq' + i);
    const al = document.getElementById('lqa' + i);
    if (el) el.textContent = q[i-1].t;
    if (al) al.textContent = q[i-1].a;
  });
}

// ─── LESSONS INPUT FORM ───
function openLessonsInput() {
  const form = document.getElementById('prs-lessons-form');
  if (!form) return;
  // Prefill saved values
  const saved = JSON.parse(localStorage.getItem('lessonsData') || '{"count":0,"mins":45}');
  document.getElementById('plf-count').value = saved.count || '';
  document.getElementById('plf-mins').value = saved.mins || 45;
  updateLessonsTotal();
  form.style.display = '';
  document.getElementById('plf-count').focus();

  // Live update total
  document.getElementById('plf-count').oninput = updateLessonsTotal;
  document.getElementById('plf-mins').oninput = updateLessonsTotal;
}
function updateLessonsTotal() {
  const count = parseInt(document.getElementById('plf-count').value) || 0;
  const mins = parseInt(document.getElementById('plf-mins').value) || 0;
  const totalMins = count * mins;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const lang = currentLang || 'ru';
  const totalEl = document.getElementById('plf-total');
  if (totalEl) {
    if (lang === 'ru') totalEl.textContent = `Итого: ${h} ч ${m} мин (${count} уроков)`;
    else if (lang === 'en') totalEl.textContent = `Total: ${h}h ${m}m (${count} lessons)`;
    else totalEl.textContent = `סה"כ: ${h} שעות ${m} דקות (${count} שיעורים)`;
  }
}
function saveLessonsInput() {
  const count = parseInt(document.getElementById('plf-count').value) || 0;
  const mins = parseInt(document.getElementById('plf-mins').value) || 45;
  localStorage.setItem('lessonsData', JSON.stringify({ count, mins }));
  closeLessonsInput();
  updateProgressWidget();
}
function closeLessonsInput() {
  const form = document.getElementById('prs-lessons-form');
  if (form) form.style.display = 'none';
}

// Открыть / закрыть модальное окно
function openAuthModal() {
  // If app is showing but user not logged in — show the full auth screen instead
  const authScreen = document.getElementById('auth-screen');
  if (authScreen) {
    _asShowStep('as-step-1'); // always start at role selection, not login
    _asMode = 'register';
    authScreen.style.display = 'flex';
    _appInitialized = false;
    const appEl = document.getElementById('app');
    if (appEl) { appEl.classList.remove('visible'); appEl.style.display = 'none'; }
    return;
  }
  document.getElementById('auth-overlay').style.display = 'flex';
  document.getElementById('auth-email').focus();
}
function closeAuthModal() {
  if (_authGateMode) return; // cannot close during auth gate
  document.getElementById('auth-overlay').style.display = 'none';
  document.getElementById('auth-error').style.display = 'none';
  document.getElementById('auth-email').value = '';
  document.getElementById('auth-password').value = '';
  document.getElementById('auth-name').value = '';
}
function handleOverlayClick(e) {
  if (_authGateMode) return;
  if (e.target === document.getElementById('auth-overlay')) closeAuthModal();
}

// Переключение вкладок Войти / Регистрация
let authMode = 'register';
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
  const studentFields = document.getElementById('auth-student-fields');
  if (role === 'school') {
    nameLabel.textContent = 'Ваше имя (владелец)';
    nameInput.placeholder = 'Матфей';
    schoolFields.classList.add('visible');
    if (studentFields) studentFields.classList.remove('visible');
  } else {
    nameLabel.textContent = 'Ваше имя';
    nameInput.placeholder = 'Матфей';
    schoolFields.classList.remove('visible');
    if (studentFields) studentFields.classList.add('visible');
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

  const L = currentLang || 'he';
  const authTr = {
    fill_fields:     {ru:'Заполни все поля',           en:'Fill in all fields',          he:'מלא את כל השדות'},
    bad_email:       {ru:'Введи корректный email',      en:'Enter a valid email',          he:'הכנס אימייל תקין'},
    pw_short:        {ru:'Пароль минимум 8 символов',   en:'Password min 8 characters',    he:'סיסמה לפחות 8 תווים'},
    pw_enter:        {ru:'Введи пароль',                en:'Enter password',               he:'הכנס סיסמה'},
    wrong_creds:     {ru:'Неверный email или пароль',   en:'Wrong email or password',      he:'אימייל או סיסמה שגויים'},
    enter_name:      {ru:'Введи своё имя',              en:'Enter your name',              he:'הכנס שם'},
    enter_school:    {ru:'Введи название автошколы',    en:'Enter school name',            he:'הכנס שם בית הספר'},
    choose_city:     {ru:'Выбери город',                en:'Choose a city',                he:'בחר עיר'},
    enter_address:   {ru:'Введи адрес',                 en:'Enter address',                he:'הכנס כתובת'},
    not_israel:      {ru:'Только Израиль',              en:'We operate only in Israel',    he:'אנו פועלים בישראל בלבד'},
    phone_dup:       {ru:'Телефон уже зарегистрирован', en:'Phone already registered',     he:'הטלפון כבר רשום'},
    email_dup:       {ru:'Email уже зарегистрирован',   en:'Email already registered',     he:'האימייל כבר רשום'},
    error_pfx:       {ru:'Ошибка: ',                    en:'Error: ',                      he:'שגיאה: '},
    login_btn:       {ru:'Войти',                       en:'Log in',                       he:'כניסה'},
    register_btn:    {ru:'Зарегистрироваться',          en:'Register',                     he:'הרשמה'},
  };
  const at = k => authTr[k][L] || authTr[k]['he'];
  if (!email || !password) { showAuthError(at('fill_fields')); return; }
  if (!isValidEmail(email)) { showAuthError(at('bad_email')); validateEmailField(); return; }
  if (authMode === 'register' && password.length < 8) { showAuthError(at('pw_short')); return; }
  if (authMode === 'login'    && password.length < 6) { showAuthError(at('pw_enter')); return; }

  btn.textContent = '...';
  btn.disabled = true;

  if (authMode === 'login') {
    auth.signInWithEmailAndPassword(email, password)
      .catch(function(err) {
        btn.disabled = false;
        btn.textContent = at('login_btn');
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          showAuthError(at('wrong_creds'));
        } else {
          showAuthError(at('error_pfx') + err.message);
        }
      });
  } else {
    if (!name) { btn.disabled = false; btn.textContent = at('register_btn'); showAuthError(at('enter_name')); return; }

    // Если регистрируется автошкола — проверяем доп. поля
    if (authRole === 'school') {
      const schoolName    = document.getElementById('auth-school-name').value.trim();
      const citySelect    = document.getElementById('auth-school-city');
      const cityOption    = citySelect.options[citySelect.selectedIndex];
      const schoolAddress = document.getElementById('auth-school-address').value.trim();
      const schoolPhone   = document.getElementById('auth-school-phone').value.trim();
      if (!schoolName) { btn.disabled = false; btn.textContent = at('register_btn'); showAuthError(at('enter_school')); return; }
      if (!citySelect.value) { btn.disabled = false; btn.textContent = at('register_btn'); showAuthError(at('choose_city')); return; }
      if (!schoolAddress) { btn.disabled = false; btn.textContent = at('register_btn'); showAuthError(at('enter_address')); return; }
      // Валидация: координаты выбранного города должны быть в Израиле (широта 29–34, долгота 34–36)
      const lat = parseFloat(cityOption.dataset.lat);
      const lng = parseFloat(cityOption.dataset.lng);
      if (isNaN(lat) || isNaN(lng) || lat < 29 || lat > 34 || lng < 34 || lng > 36) {
        btn.disabled = false; btn.textContent = at('register_btn');
        showAuthError(at('not_israel')); return;
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
          btn.textContent = at('register_btn');
          if (err.code === 'phone-duplicate') {
            showAuthError(at('phone_dup'));
          } else if (err.code === 'auth/email-already-in-use') {
            showAuthError(at('email_dup'));
          } else {
            showAuthError(at('error_pfx') + err.message);
          }
        });
      return;
    } else {
      // Ученик
      const dobEl   = document.getElementById('auth-dob');
      const cityEl  = document.getElementById('auth-student-city');
      const phoneEl = document.getElementById('auth-student-phone');
      const idEl    = document.getElementById('auth-id-number');
      const dob   = dobEl   && dobEl.value   ? dobEl.value   : '';
      const cityOpt = cityEl ? cityEl.options[cityEl.selectedIndex] : null;
      const cityRu  = cityOpt && cityOpt.value ? (cityOpt.dataset.ru || cityOpt.text) : '';
      const cityHe  = cityOpt && cityOpt.value ? (cityOpt.dataset.he || '') : '';
      const cityEn  = cityOpt && cityOpt.value ? (cityOpt.dataset.en || '') : '';
      const phone = phoneEl && phoneEl.value.trim() ? phoneEl.value.trim() : '';
      const idNumber = idEl && idEl.value.trim() ? idEl.value.trim() : '';
      auth.createUserWithEmailAndPassword(email, password)
        .then(function(result) {
          const uid = result.user.uid;
          return result.user.updateProfile({ displayName: name }).then(function() {
            const userData = {
              uid: uid,
              name: name,
              email: email,
              role: 'student',
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            if (dob)      userData.dateOfBirth = dob;
            if (cityRu)   { userData.city = cityHe; userData.cityRu = cityRu; userData.cityEn = cityEn; }
            if (phone)    userData.phone = phone;
            if (idNumber) userData.idNumber = idNumber;
            return db.collection('users').doc(uid).set(userData);
          });
        })
        .catch(function(err) {
          btn.disabled = false;
          btn.textContent = at('register_btn');
          if (err.code === 'auth/email-already-in-use') {
            showAuthError(at('email_dup'));
          } else {
            showAuthError(at('error_pfx') + err.message);
          }
        });
    }
  }
}

// ══ EMAILJS CONFIG (see top of file) ══

// ══ SCHOOL PROFILE ══
let spCurrentSchool = null;
let _dashSchool = null; // school object currently shown in dashboard
let _dashInstrEditIdx = -1; // index being edited (-1 = new)
let _dashInstrPhoto = null; // base64 photo for current form

// Normalize instructor: handles both old string format and new object format
function normalizeInstructor(x) {
  if (typeof x === 'string') return { name: x, photo: null, licenseTypes: [], bio: '' };
  return { name: x.name || '', photo: x.photo || null, licenseTypes: x.licenseTypes || [], bio: x.bio || '' };
}

// Compress image file to base64 data URL (max 200px)
function compressImageToBase64(file) {
  return new Promise(function(resolve) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const MAX = 200;
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function openSchoolProfile(schoolId) {
  const cached = schools.find(x => x.id === schoolId);
  if (!cached) return;
  const s = cached;
  spCurrentSchool = s;

  const initials = s.name.trim().split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const avatarEl = document.getElementById('sp-avatar');
  if (s.photoURL) {
    avatarEl.innerHTML = `<img src="${s.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" onerror="this.parentElement.textContent='${initials}'">`;
  } else {
    avatarEl.textContent = initials;
  }
  document.getElementById('sp-name').textContent = s.name;
  document.getElementById('sp-city').textContent = (currentLang==='ru'?s.cityRu:currentLang==='en'?s.cityEn:s.city) || '';
  document.getElementById('sp-address').textContent = s.address || '';
  document.getElementById('sp-phone').textContent = s.phone || '';
  document.getElementById('sp-students').textContent = s.students || 0;
  document.getElementById('sp-price').textContent = s.price || '—';
  document.getElementById('sp-pass').textContent = s.pass_rate ? s.pass_rate + '%' : '—';

  // Инструкторы из кеша (кеш включает instructors через onSnapshot)
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
  const availDiv = document.getElementById('sp-availability');
  const actionsDiv = document.getElementById('sp-student-actions');
  if (user && user.uid === schoolId) {
    editSection.style.display = 'block';
    document.getElementById('sp-price-input').value = s.price || '';
    renderEditInstructors(s.instructors || []);
    document.getElementById('sp-enroll-btn').style.display = 'none';
    if (availDiv) availDiv.style.display = 'none';
  } else {
    editSection.style.display = 'none';
    if (actionsDiv) actionsDiv.innerHTML = `<button class="sp-enroll-btn" id="sp-enroll-btn" onclick="enrollFromProfile()">${currentLang==='ru'?'Записаться в эту школу':currentLang==='en'?'Join this school':'הצטרף לבית ספר זה'}</button>`;
    // Load availability preview for students
    if (availDiv) {
      availDiv.style.display = 'block';
      availDiv.innerHTML = '';
      db.collection('availability').doc(schoolId).get().then(function(doc) {
        _renderSpAvailability(doc.exists ? doc.data() : null, availDiv);
      }).catch(function() { availDiv.style.display = 'none'; });
    }
    // Check enrollment status and update button accordingly
    if (user && actionsDiv) {
      db.collection('enrollments')
        .where('userId','==',user.uid)
        .where('schoolId','==',schoolId)
        .get().then(function(snap) {
          const enroll = snap.empty ? null : snap.docs[0].data();
          const status = enroll ? enroll.status : null;
          _renderSpStudentActions(actionsDiv, status, schoolId);
        }).catch(function() {});
    }
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
    el.innerHTML = `<span class="instructor-empty">${t.instr_empty||'No instructors added'}</span>`;
  } else {
    const instructors = list.map(normalizeInstructor);
    el.innerHTML = '<div class="instr-cards">' + instructors.map(function(instr) {
      const initials = instr.name.trim().split(/\s+/).map(function(w){return w[0];}).join('').slice(0,2).toUpperCase() || '?';
      const photoHtml = instr.photo
        ? `<img src="${instr.photo}" alt="${escapeHtml(instr.name)}">`
        : initials;
      const licensesHtml = instr.licenseTypes.length
        ? `<div class="instr-licenses">${instr.licenseTypes.map(function(l){return `<span class="lic-badge lic-${l}">${l}</span>`;}).join('')}</div>`
        : '';
      const bioHtml = instr.bio ? `<div class="instr-bio">${escapeHtml(instr.bio)}</div>` : '';
      return `<div class="instr-card">
        <div class="instr-photo">${photoHtml}</div>
        <div class="instr-info">
          <div class="instr-name">${escapeHtml(instr.name)}</div>
          ${licensesHtml}${bioHtml}
        </div>
      </div>`;
    }).join('') + '</div>';
  }
}

function renderEditInstructors(list) {
  const el = document.getElementById('sp-edit-instructors');
  if (!el) return;
  el.innerHTML = (list||[]).map(function(x,i) {
    const instr = normalizeInstructor(x);
    return `<div class="instructor-chip" style="cursor:pointer" onclick="removeInstructor(${i})">${escapeHtml(instr.name)} ✕</div>`;
  }).join('');
}

function updateStarDisplay(rating) {
  document.querySelectorAll('.star-btn').forEach((btn, i) => {
    btn.classList.toggle('lit', i < Math.round(rating));
  });
}

function rateSchool(stars) {
  const user = auth.currentUser;
  if (!user) { alert(currentLang==='en'?'Please log in to rate':currentLang==='he'?'יש להתחבר כדי לדרג':'Войдите чтобы поставить оценку'); return; }
  if (!spCurrentSchool) return;
  const schoolId = spCurrentSchool.id;
  if (user.uid === schoolId) { alert(currentLang==='en'?"You can't rate your own school":currentLang==='he'?'לא ניתן לדרג את בית הספר שלך':'Нельзя оценивать собственную школу'); return; }

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
        document.getElementById('sp-rating-count').textContent = currentLang==='en'?'Thanks for rating!':currentLang==='he'?'תודה על הדירוג!':'Спасибо за оценку!';
      });
  });
}

function saveSchoolPrice() {
  if (!spCurrentSchool) return;
  const price = document.getElementById('sp-price-input').value.trim();
  if (!price) return;
  db.collection('schools').doc(spCurrentSchool.id).update({ price })
    .then(() => { document.getElementById('sp-price').textContent = price; notify(currentLang==='en'?'Price saved!':currentLang==='he'?'המחיר נשמר!':'Цена сохранена!'); });
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

// ── Dashboard inline instructor management ──
const _LIC_TYPES = ['A','B','BE','C','CE','D'];

const _CAR_COLORS = [
  { key:'black',  hex:'#1a1a1a' },
  { key:'white',  hex:'#f5f5f5' },
  { key:'silver', hex:'#9e9e9e' },
  { key:'blue',   hex:'#1565c0' },
  { key:'red',    hex:'#c62828' },
  { key:'brown',  hex:'#6d4c41' },
  { key:'green',  hex:'#2e7d32' },
];

function renderDashInstructors(list) {
  const el = document.getElementById('dash-instructors');
  if (!el) return;
  if (!list || !list.length) {
    el.innerHTML = `<div class="instr-cards"><span class="instructor-empty">${t.instr_empty||'No cars added'}</span></div>`;
    return;
  }
  el.innerHTML = '<div class="instr-cards">' + list.map(function(car, i) {
    const model = escapeHtml(car.model || car.name || '?');
    const colorEntry = _CAR_COLORS.find(function(c){ return c.key === car.color; });
    const colorDot = colorEntry
      ? `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${colorEntry.hex};border:1px solid rgba(0,0,0,0.15);vertical-align:middle;margin-inline-end:5px;"></span>`
      : '';
    const colorLbl = colorEntry
      ? (currentLang==='ru' ? ({black:'Чёрный',white:'Белый',silver:'Серый',blue:'Синий',red:'Красный',brown:'Коричневый',green:'Зелёный'}[car.color]||car.color) : currentLang==='en' ? ({black:'Black',white:'White',silver:'Silver',blue:'Blue',red:'Red',brown:'Brown',green:'Green'}[car.color]||car.color) : ({black:'שחור',white:'לבן',silver:'כסוף',blue:'כחול',red:'אדום',brown:'חום',green:'ירוק'}[car.color]||car.color))
      : '';
    const transLbl = car.transmission === 'auto'
      ? (t.car_auto||'Auto')
      : car.transmission === 'manual'
      ? (t.car_manual||'Manual')
      : '';
    const photoHtml = car.photo ? `<img src="${car.photo}" alt="" style="width:40px;height:40px;border-radius:8px;object-fit:cover;flex-shrink:0;">` : `<span style="width:40px;height:40px;border-radius:8px;background:var(--border);display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0;">🚗</span>`;
    return `<div class="instr-card">
      ${photoHtml}
      <div class="instr-info" style="flex:1;min-width:0;">
        <div class="instr-name">${model}</div>
        <div style="font-size:0.78rem;color:var(--muted);margin-top:2px;">${colorDot}${colorLbl}${colorLbl && transLbl ? ' · ' : ''}${transLbl}</div>
      </div>
      <div class="instr-card-actions">
        <button class="instr-edit-btn" onclick="showDashInstrForm(${i})">${t.instr_edit||'Edit'}</button>
        <button class="instr-del-btn" onclick="removeDashInstructor(${i})">✕</button>
      </div>
    </div>`;
  }).join('') + '</div>';
}

function showDashInstrForm(idx) {
  _dashInstrEditIdx = idx;
  _dashInstrPhoto = null;
  const formEl = document.getElementById('dash-instr-form');
  if (!formEl) return;

  const existing = idx >= 0 && _dashSchool && _dashSchool.instructors && _dashSchool.instructors[idx]
    ? _dashSchool.instructors[idx]
    : { model: '', photo: null, color: '', transmission: '' };

  _dashInstrPhoto = existing.photo || null;

  const previewHtml = existing.photo
    ? `<img src="${existing.photo}" alt="">`
    : '<span style="font-size:1.5rem;">🚗</span>';

  const colorBtns = _CAR_COLORS.map(function(c) {
    const sel = existing.color === c.key ? ' style="outline:3px solid var(--text);outline-offset:2px;"' : '';
    return `<button type="button" title="${c.key}" onclick="selectDashCarColor('${c.key}',this)" style="width:28px;height:28px;border-radius:50%;background:${c.hex};border:1px solid rgba(0,0,0,0.15);cursor:pointer;flex-shrink:0;${existing.color===c.key?'outline:3px solid var(--text);outline-offset:2px;':''}"></button>`;
  }).join('');

  const titleLbl = idx >= 0
    ? (currentLang==='ru'?'Редактировать машину':currentLang==='en'?'Edit Car':'ערוך מכונית')
    : (currentLang==='ru'?'Новая машина':currentLang==='en'?'Add Car':'הוסף מכונית');
  const saveLbl = currentLang==='ru'?'Сохранить':currentLang==='en'?'Save':'שמור';
  const cancelLbl = currentLang==='ru'?'Отмена':currentLang==='en'?'Cancel':'ביטול';
  const photoLbl = currentLang==='ru'?'Фото машины':currentLang==='en'?'Car Photo':'תמונת מכונית';
  const chooseLbl = currentLang==='ru'?'Выбрать фото':currentLang==='en'?'Choose Photo':'בחר תמונה';

  formEl.style.display = 'block';
  formEl.innerHTML = `
    <div class="di-form">
      <div class="di-form-title">${titleLbl}</div>
      <div class="di-row">
        <div class="di-label">${t.car_model||'Model'}</div>
        <input class="di-input" id="di-car-model" type="text" placeholder="Toyota Corolla, Hyundai i35..." value="${escapeHtml(existing.model||existing.name||'')}">
      </div>
      <div class="di-row">
        <div class="di-label">${photoLbl}</div>
        <div class="di-photo-wrap">
          <div class="di-photo-preview" id="di-photo-preview" style="font-size:1.5rem;">${previewHtml}</div>
          <label>
            <span class="di-file-btn">${chooseLbl}</span>
            <input type="file" accept="image/*" style="display:none" onchange="onDashPhotoChange(this)">
          </label>
        </div>
      </div>
      <div class="di-row">
        <div class="di-label">${t.car_color||'Color'}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;" id="di-car-colors">${colorBtns}</div>
        <input type="hidden" id="di-car-color-val" value="${existing.color||''}">
      </div>
      <div class="di-row">
        <div class="di-label">${t.car_transmission||'Transmission'}</div>
        <div style="display:flex;gap:8px;">
          <button type="button" class="di-lic-btn${existing.transmission==='auto'?' sel':''}" id="di-trans-auto" onclick="selectDashTransmission('auto',this)">${t.car_auto||'Auto'}</button>
          <button type="button" class="di-lic-btn${existing.transmission==='manual'?' sel':''}" id="di-trans-manual" onclick="selectDashTransmission('manual',this)">${t.car_manual||'Manual'}</button>
        </div>
      </div>
      <div class="di-form-actions">
        <button class="di-save-btn" onclick="saveDashInstructor()">${saveLbl}</button>
        <button class="di-cancel-btn" onclick="cancelDashInstrForm()">${cancelLbl}</button>
      </div>
    </div>`;
}

function selectDashCarColor(key, btn) {
  document.getElementById('di-car-color-val').value = key;
  document.querySelectorAll('#di-car-colors button').forEach(function(b) { b.style.outline = ''; });
  btn.style.outline = '3px solid var(--text)';
  btn.style.outlineOffset = '2px';
}

function selectDashTransmission(val, btn) {
  document.querySelectorAll('#di-trans-auto,#di-trans-manual').forEach(function(b){ b.classList.remove('sel'); });
  btn.classList.add('sel');
}

function toggleDashLic(lic, btn) {
  btn.classList.toggle('sel');
}

function onDashPhotoChange(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  compressImageToBase64(file).then(function(b64) {
    _dashInstrPhoto = b64;
    const preview = document.getElementById('di-photo-preview');
    if (preview) preview.innerHTML = `<img src="${b64}" alt="">`;
  });
}

async function uploadSchoolPhoto(input) {
  const user = auth.currentUser;
  if (!user || !input.files[0]) return;
  const file = input.files[0];
  const L = currentLang || 'he';
  const statusEl = document.getElementById('sdb-photo-status');

  if (file.size > 5 * 1024 * 1024) {
    alert(L==='ru'?'Файл слишком большой (макс. 5 МБ)':L==='en'?'File too large (max 5 MB)':'קובץ גדול מדי (מקס 5 MB)');
    return;
  }
  if (statusEl) statusEl.textContent = L==='ru'?'Загружаем...':L==='en'?'Uploading...':'מעלה...';

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'driveil_photos');
    formData.append('public_id', 'school_' + user.uid);

    const resp = await fetch('https://api.cloudinary.com/v1_1/dnugtd14m/image/upload', {
      method: 'POST',
      body: formData
    });
    const data = await resp.json();
    if (!data.secure_url) throw new Error(data.error?.message || 'Upload failed');
    const url = data.secure_url;

    await db.collection('schools').doc(user.uid).update({ photoURL: url });

    const wrap = document.getElementById('sdb-photo-wrap');
    if (wrap) {
      wrap.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;" id="sdb-photo-img"/>`;
      const inp2 = document.createElement('input');
      inp2.type = 'file'; inp2.id = 'sdb-photo-input'; inp2.accept = 'image/*'; inp2.style.display = 'none';
      inp2.onchange = function() { uploadSchoolPhoto(this); };
      document.body.appendChild(inp2);
    }
    const dbAv = document.getElementById('db-avatar');
    if (dbAv) { dbAv.style.backgroundImage = 'url(' + url + ')'; dbAv.style.backgroundSize = 'cover'; dbAv.textContent = ''; }
    const scAv = document.querySelector('.sc-avatar.av-blue');
    if (scAv) { scAv.style.backgroundImage = 'url(' + url + ')'; scAv.style.backgroundSize = 'cover'; scAv.textContent = ''; }
    if (_dashSchool) _dashSchool.photoURL = url;

    if (statusEl) statusEl.textContent = L==='ru'?'✅ Фото сохранено':L==='en'?'✅ Photo saved':'✅ תמונה נשמרה';
    setTimeout(function() { if (statusEl) statusEl.textContent = ''; }, 3000);
  } catch(e) {
    if (statusEl) statusEl.textContent = '❌ ' + (e.message || 'Error');
  }
}

function saveDashPrice() {
  if (!_dashSchool) return;
  const inp = document.getElementById('dash-price-input');
  const price = inp ? inp.value.trim() : '';
  if (!price) return;
  db.collection('schools').doc(_dashSchool.id).update({ price: price })
    .then(function() {
      notify(currentLang==='ru'?'Цена сохранена ✓':currentLang==='en'?'Price saved ✓':'המחיר נשמר ✓');
      _dashSchool.price = price;
    })
    .catch(function() {
      notify(currentLang==='ru'?'Ошибка сохранения':currentLang==='en'?'Save error':'שגיאה בשמירה');
    });
}

function saveDashInstructor() {
  if (!_dashSchool) return;
  const modelEl = document.getElementById('di-car-model');
  const model = modelEl ? modelEl.value.trim() : '';
  if (!model) { if (modelEl) modelEl.focus(); return; }

  const colorVal = (document.getElementById('di-car-color-val') || {}).value || '';
  const transBtn = document.querySelector('#di-trans-auto.sel,#di-trans-manual.sel');
  const transmission = transBtn ? (transBtn.id === 'di-trans-auto' ? 'auto' : 'manual') : '';

  const car = {
    model: model,
    photo: _dashInstrPhoto || null,
    color: colorVal,
    transmission: transmission,
  };

  const list = [...(_dashSchool.instructors || [])];
  if (_dashInstrEditIdx >= 0) {
    list[_dashInstrEditIdx] = car;
  } else {
    list.push(car);
  }

  db.collection('schools').doc(_dashSchool.id).update({ instructors: list })
    .then(function() {
      _dashSchool.instructors = list;
      if (spCurrentSchool && spCurrentSchool.id === _dashSchool.id) spCurrentSchool.instructors = list;
      renderDashInstructors(list);
      cancelDashInstrForm();
      const savedLbl = currentLang==='ru'?'Машина сохранена':currentLang==='en'?'Car saved':'המכונית נשמרה';
      notify(savedLbl);
    });
}

function cancelDashInstrForm() {
  const formEl = document.getElementById('dash-instr-form');
  if (formEl) { formEl.style.display = 'none'; formEl.innerHTML = ''; }
  _dashInstrEditIdx = -1;
  _dashInstrPhoto = null;
}

function removeDashInstructor(idx) {
  if (!_dashSchool) return;
  const list = (_dashSchool.instructors || []).map(normalizeInstructor);
  list.splice(idx, 1);
  db.collection('schools').doc(_dashSchool.id).update({ instructors: list })
    .then(function() {
      _dashSchool.instructors = list;
      if (spCurrentSchool && spCurrentSchool.id === _dashSchool.id) spCurrentSchool.instructors = list;
      renderDashInstructors(list);
      notify(currentLang==='en'?'Instructor removed':currentLang==='he'?'המדריך הוסר':'Инструктор удалён');
    });
}

function enrollFromProfile() {
  if (spCurrentSchool) {
    const school = spCurrentSchool;
    closeSchoolProfile();
    openEnrollModal(school.id, school.name, school.email || '');
  } else {
    closeSchoolProfile();
    showPage('schedule');
  }
}

function _renderSpStudentActions(wrap, status, schoolId) {
  const L = currentLang;
  if (status === 'confirmed') {
    wrap.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:8px">
        <span style="color:#27ae60;font-size:0.88rem;font-weight:600">✓ ${L==='ru'?'Вы записаны в школу':L==='en'?'You are enrolled':'אתה רשום'}</span>
        <button class="schedule-add-btn" style="margin:0" onclick="closeSchoolProfile();openBookingModal()">${L==='ru'?'Записаться на урок':L==='en'?'Book a lesson':'הזמן שיעור'}</button>
      </div>`;
  } else if (status === 'pending') {
    wrap.innerHTML = `<div style="color:#e67e22;font-size:0.88rem;margin-top:8px;padding:8px;background:#fff8f0;border-radius:8px">⏳ ${L==='ru'?'Заявка отправлена — ожидайте подтверждения школы':L==='en'?'Application sent — awaiting school confirmation':'הבקשה נשלחה — ממתין לאישור'}</div>`;
  } else {
    wrap.innerHTML = `<button class="sp-enroll-btn" id="sp-enroll-btn" onclick="enrollFromProfile()">${L==='ru'?'Записаться в эту школу':L==='en'?'Join this school':'הצטרף לבית ספר זה'}</button>`;
  }
}

function _renderSpAvailability(data, wrap) {
  if (!data || !data.instructors || Object.keys(data.instructors).length === 0) {
    wrap.innerHTML = '';
    return;
  }
  const days = DAY_LABELS[currentLang] || DAY_LABELS.ru;
  const L = currentLang;
  let html = `<div style="margin:12px 0 4px"><div class="sp-section-title" style="margin-bottom:8px">${L==='ru'?'Расписание':L==='en'?'Schedule':'לוח זמנים'}</div>`;
  Object.entries(data.instructors).forEach(function([iname, idata]) {
    const slots = idata.weeklySlots || {};
    const activeDays = Object.keys(slots).filter(k => (slots[k]||[]).length > 0);
    if (activeDays.length === 0) return;
    const dayChips = activeDays.map(function(di) {
      const hrs = slots[di];
      const fromH = Math.min(...hrs);
      const toH = Math.max(...hrs) + 1;
      return `<span class="avail-day-chip">${days[di]} ${fromH}:00–${toH}:00</span>`;
    }).join('');
    html += `<div style="margin-bottom:8px">
      <span style="font-size:0.8rem;color:var(--muted);font-weight:600">${escapeHtml(iname)}</span>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">${dayChips}</div>
    </div>`;
  });
  html += '</div>';
  wrap.innerHTML = html;
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
  const transEl = document.getElementById('enroll-transmission');
  if (transEl) transEl.value = '';
  const colorEl = document.getElementById('enroll-color');
  if (colorEl) colorEl.value = '';

  // Переводим метки новых полей
  const lblTrans = document.getElementById('lbl-transmission');
  if (lblTrans) lblTrans.textContent = currentLang==='ru'?'Коробка передач':currentLang==='en'?'Transmission':'תיבת הילוכים';
  const lblColor = document.getElementById('lbl-car-color');
  if (lblColor) lblColor.textContent = currentLang==='ru'?'Цвет машины':currentLang==='en'?'Car Color':'צבע מכונית';
  if (transEl) {
    transEl.options[0].text = currentLang==='ru'?'— Выбрать —':currentLang==='en'?'— Select —':'— בחר —';
    transEl.options[1].text = currentLang==='ru'?'Автомат':currentLang==='en'?'Automatic':'אוטומט';
    transEl.options[2].text = currentLang==='ru'?'Механика':currentLang==='en'?'Manual':'ידני';
  }
  if (colorEl) {
    const colorNames = {
      ru: ['— Выбрать —','Чёрный','Белый','Серебро','Синий','Красный','Коричневый','Зелёный'],
      en: ['— Select —','Black','White','Silver','Blue','Red','Brown','Green'],
      he: ['— בחר —','שחור','לבן','כסוף','כחול','אדום','חום','ירוק'],
    };
    const names = colorNames[currentLang] || colorNames.he;
    Array.from(colorEl.options).forEach(function(opt, i) { opt.text = names[i] || opt.text; });
  }

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
  const license      = document.getElementById('enroll-license').value;
  const transmission = (document.getElementById('enroll-transmission') || {}).value || '';
  const carColor     = (document.getElementById('enroll-color') || {}).value || '';
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
    transmission: transmission || '—',
    carColor:     carColor || '—',
    preferredDate: date || '—',
    notes:        notes || '—',
    schoolId:     schoolId,
    schoolName:   schoolName,
    userId:       auth.currentUser ? auth.currentUser.uid : null,
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
      // Update student state to pending immediately
      const cu = auth.currentUser;
      if (cu) {
        _studentState = 'pending';
        localStorage.setItem('driveIL-state-' + cu.uid, 'pending');
      }
      closeEnrollModal();
      notify(currentLang==='ru'?'Заявка отправлена! Ожидайте подтверждения школы ✓':currentLang==='en'?'Application sent! Awaiting school confirmation ✓':'הבקשה נשלחה! ממתין לאישור ✓');
      showPage('schedule');
    })
    .catch(function(err) {
      console.error('Enroll error:', err);
      localStorage.setItem(rlKey, Date.now().toString());
      closeEnrollModal();
      notify(currentLang==='ru'?'Заявка отправлена! Ожидайте подтверждения школы ✓':currentLang==='en'?'Application sent! Awaiting school confirmation ✓':'הבקשה נשלחה! ממתין לאישור ✓');
      showPage('schedule');
    });
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.style.display = 'block';
}

function logoutUser() {
  const user = auth.currentUser;
  if (user) {
    localStorage.removeItem('driveIL-role-' + user.uid);
    localStorage.removeItem('driveIL-state-' + user.uid);
    localStorage.removeItem('driveIL-city-' + user.uid);
  }
  _studentState = null;
  _userCity = null;
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
  // Sync mobile nav theme icon with fade
  const moon = document.getElementById('mnav-moon');
  const sun = document.getElementById('mnav-sun');
  const themeLbl = document.getElementById('mnav-theme-lbl');
  const iconWrap = moon && moon.parentElement;
  if (iconWrap) {
    iconWrap.style.transition = 'opacity 0.2s ease';
    iconWrap.style.opacity = '0';
    setTimeout(function() {
      if (moon) moon.style.display = dark ? 'none' : 'block';
      if (sun) sun.style.display = dark ? 'block' : 'none';
      if (themeLbl) themeLbl.textContent = dark ? 'Светлая' : 'Тёмная';
      iconWrap.style.opacity = '1';
    }, 180);
  } else {
    if (moon) moon.style.display = dark ? 'none' : 'block';
    if (sun) sun.style.display = dark ? 'block' : 'none';
    if (themeLbl) themeLbl.textContent = dark ? 'Светлая' : 'Тёмная';
  }
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

// ── Mobile Settings Panel ──
function openMobileSettings() {
  const overlay = document.getElementById('mobile-settings-overlay');
  const panel = document.getElementById('mobile-settings-panel');
  if (!panel) return;
  // Update active lang button
  ['he','ru','en'].forEach(function(l) {
    const btn = document.getElementById('ms-lang-' + l);
    if (btn) btn.style.background = (currentLang === l) ? 'rgba(99,102,241,0.4)' : 'transparent';
    if (btn) btn.style.borderColor = (currentLang === l) ? '#6366f1' : 'rgba(255,255,255,0.15)';
  });
  // Update active theme button
  const isDark = document.documentElement.classList.contains('dark');
  const darkBtn = document.getElementById('ms-theme-dark');
  const lightBtn = document.getElementById('ms-theme-light');
  if (darkBtn) { darkBtn.style.background = isDark ? 'rgba(99,102,241,0.4)' : 'transparent'; darkBtn.style.borderColor = isDark ? '#6366f1' : 'rgba(255,255,255,0.15)'; }
  if (lightBtn) { lightBtn.style.background = !isDark ? 'rgba(99,102,241,0.4)' : 'transparent'; lightBtn.style.borderColor = !isDark ? '#6366f1' : 'rgba(255,255,255,0.15)'; }
  // Translate labels
  const L = currentLang || 'he';
  const el = document.getElementById('ms-title'); if (el) el.textContent = L==='ru'?'Настройки':L==='en'?'Settings':'הגדרות';
  const ll = document.getElementById('ms-lang-lbl'); if (ll) ll.textContent = L==='ru'?'Язык':L==='en'?'Language':'שפה';
  const tl = document.getElementById('ms-theme-lbl'); if (tl) tl.textContent = L==='ru'?'Тема':L==='en'?'Theme':'ערכת נושא';
  const sl = document.getElementById('ms-light-lbl'); if (sl) sl.textContent = L==='ru'?'Светлая':L==='en'?'Light':'בהיר';
  const dl = document.getElementById('ms-dark-lbl'); if (dl) dl.textContent = L==='ru'?'Тёмная':L==='en'?'Dark':'כהה';
  const nl = document.getElementById('mnav-settings-lbl'); if (nl) nl.textContent = L==='ru'?'Настройки':L==='en'?'Settings':'הגדרות';
  overlay.style.display = 'block';
  panel.style.display = 'block';
}
function closeMobileSettings() {
  const overlay = document.getElementById('mobile-settings-overlay');
  const panel = document.getElementById('mobile-settings-panel');
  if (overlay) overlay.style.display = 'none';
  if (panel) panel.style.display = 'none';
}
function pickLangAndClose(lang) {
  pickLang(lang);
  closeMobileSettings();
  // Re-open to update active state briefly, then close
  setTimeout(openMobileSettings, 50);
  setTimeout(closeMobileSettings, 300);
}
function setThemeAndClose(theme) {
  const isDark = theme === 'dark';
  applyTheme(isDark);
  localStorage.setItem('driveIL-theme', theme);
  closeMobileSettings();
}

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
  if (name !== 'schedule' && _scheduleUnsub) { _scheduleUnsub(); _scheduleUnsub = null; }
  if (name !== 'dashboard' && _schoolCalUnsub) { _schoolCalUnsub(); _schoolCalUnsub = null; }
  if (name === 'test') startTest();
  if (name === 'dashboard') loadDashboard();
  if (name === 'schedule') loadScheduleData();
  if (name === 'schools' && _userIsSchool) { showPage('dashboard'); return; }
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Re-trigger hero animations on home page
  if (name === 'home') {
    ['.uber-hero-title', '.uber-hero-btns', '.uber-hero-right'].forEach(function(sel) {
      const el = document.querySelector(sel);
      if (!el) return;
      el.style.animation = 'none';
      el.offsetHeight; // reflow
      el.style.animation = '';
    });
  }
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
  let filtered = currentSchoolFilter === 'all' ? schools : schools.filter(s => s.region === currentSchoolFilter);
  if (!_userIsSchool) {
    const refLat = _userLat || (CITY_COORDS[_userCity] && CITY_COORDS[_userCity].lat);
    const refLng = _userLng || (CITY_COORDS[_userCity] && CITY_COORDS[_userCity].lng);
    if (refLat && refLng) {
      filtered = filtered.filter(function(s) {
        if (s.lat && s.lng) return haversineKm(refLat, refLng, s.lat, s.lng) <= 10;
        return s.city === _userCity; // fallback для старых школ без координат
      });
    }
  }

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
  const enrollLbl = currentLang === 'ru' ? 'Присоединиться' : currentLang === 'en' ? 'Join' : 'הצטרף';
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
            <div class="sc-name">${escapeHtml(s.name)}</div>
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
          <button class="sc-enroll" onclick="event.stopPropagation();joinSchool('${s.id}','${s.name.replace(/'/g,"\\'")}')">${enrollLbl}</button>
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
  if (!track || !list) return;
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
  if (dots) dots.innerHTML = list.map((_, i) => `<div class="t-dot ${i===0?'active':''}" onclick="goTestimonial(${i})"></div>`).join('');
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
  const faqEl = document.getElementById('faq-list');
  if (!faqEl || !t.faqs) return;
  faqEl.innerHTML = t.faqs.map((item, i) => `
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
const CITY_COORDS = {
  'תל אביב':      { lat: 32.0853, lng: 34.7818, zoom: 13 },
  'ירושלים':      { lat: 31.7683, lng: 35.2137, zoom: 13 },
  'חיפה':         { lat: 32.7940, lng: 34.9896, zoom: 13 },
  'ראשון לציון':  { lat: 31.9730, lng: 34.7925, zoom: 13 },
  'פתח תקווה':    { lat: 32.0878, lng: 34.8878, zoom: 13 },
  'אשדוד':        { lat: 31.8044, lng: 34.6553, zoom: 13 },
  'נתניה':        { lat: 32.3226, lng: 34.8534, zoom: 13 },
  'באר שבע':      { lat: 31.2518, lng: 34.7913, zoom: 13 },
  'בני ברק':      { lat: 32.0841, lng: 34.8338, zoom: 13 },
  'חולון':        { lat: 32.0158, lng: 34.7797, zoom: 13 },
  'רמת גן':       { lat: 32.0694, lng: 34.8237, zoom: 13 },
  'אשקלון':       { lat: 31.6688, lng: 34.5742, zoom: 13 },
  'רחובות':       { lat: 31.8969, lng: 34.8085, zoom: 13 },
  'בת ים':        { lat: 32.0234, lng: 34.7511, zoom: 13 },
  'הרצליה':       { lat: 32.1665, lng: 34.8438, zoom: 13 },
  'כפר סבא':      { lat: 32.1798, lng: 34.9078, zoom: 13 },
  'מודיעין':      { lat: 31.8969, lng: 35.0103, zoom: 13 },
  'לוד':          { lat: 31.9516, lng: 34.8958, zoom: 13 },
  'רמלה':         { lat: 31.9296, lng: 34.8713, zoom: 13 },
  'נס ציונה':     { lat: 31.9308, lng: 34.7980, zoom: 13 },
  'אילת':         { lat: 29.5577, lng: 34.9519, zoom: 13 },
  'נצרת':         { lat: 32.6996, lng: 35.3035, zoom: 13 },
  'כרמיאל':       { lat: 32.9221, lng: 35.3025, zoom: 13 },
  'טבריה':        { lat: 32.7940, lng: 35.5316, zoom: 13 },
  'אריאל':        { lat: 32.1066, lng: 35.1714, zoom: 13 },
};

let _userCity = null;
let schoolsMap = null;
let userMarker = null;
let schoolMarkers = [];

function initSchoolsMap() {
  const cityCoords = (!_userIsSchool && _userCity && CITY_COORDS[_userCity]) ? CITY_COORDS[_userCity] : null;
  const initView = cityCoords ? [cityCoords.lat, cityCoords.lng] : [32.05, 34.95];
  const initZoom = cityCoords ? cityCoords.zoom : 7;

  if (schoolsMap) {
    schoolsMap.setView(initView, initZoom);
    schoolsMap.invalidateSize();
    renderMapMarkers(schools);
    return;
  }
  schoolsMap = L.map('schools-map', {
    zoomControl: false, attributionControl: true,
    scrollWheelZoom: true
  }).setView(initView, initZoom);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd', maxZoom: 19
  }).addTo(schoolsMap);

  L.control.zoom({ position: 'bottomright' }).addTo(schoolsMap);
  updateLocateLabel();
  renderMapMarkers(schools);
}

let firestoreUnsubscribe = null;

function loadFirestoreSchools() {
  const list = document.getElementById('school-list');
  if (list) list.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#6c757d">⏳ ${t.db_loading||'...'}</div>`;

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
          lat: d.lat || (cityCoords[d.city] || cityCoords[d.cityEn] || cityCoords[d.cityRu] || [])[0] || null,
          lng: d.lng || (cityCoords[d.city] || cityCoords[d.cityEn] || cityCoords[d.cityRu] || [])[1] || null,
          phone: d.phone || '',
          address: d.address || '',
          email: d.email || '',
          instructors: d.instructors || []
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

    // Обновляем hero-карточку превью реальными школами
    const heroCard = document.querySelector('.uber-hero-card');
    if (heroCard && schools.length > 0 && !_userIsSchool) {
      const top = schools.slice(0, 3);
      const lang = currentLang || 'ru';
      const cityFn = s => lang === 'ru' ? (s.cityRu || s.city || '') : lang === 'en' ? (s.cityEn || s.city || '') : (s.city || '');
      const labelTxt = lang === 'ru' ? 'Ближайшие школы' : lang === 'en' ? 'Nearby schools' : 'בתי ספר קרובים';
      heroCard.innerHTML = `<div class="uhc-label">${labelTxt}</div>` +
        top.map(s => {
          const initials = s.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
          const rating = s.rating ? s.rating.toFixed(1) + ' ★' : '';
          return `<div class="uhc-item">
            <div class="uhc-avatar">${initials}</div>
            <div class="uhc-info">
              <div class="uhc-name">${s.name}</div>
              <div class="uhc-meta">${cityFn(s)}${rating ? ' · ' + rating : ''}</div>
            </div>
          </div>`;
        }).join('');
    }

    // Re-run geolocation now that schools have coordinates
    initGeolocation();

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
  if (!_userIsSchool && _userCity) {
    const uc = CITY_COORDS[_userCity];
    if (uc) list = list.filter(function(s) {
      if (s.lat && s.lng) return haversineKm(uc.lat, uc.lng, s.lat, s.lng) <= 20;
      return s.city === _userCity;
    });
  }
  const city      = s => currentLang === 'ru' ? s.cityRu : currentLang === 'en' ? s.cityEn : s.city;
  const enrollLbl = currentLang === 'ru' ? 'Присоединиться' : currentLang === 'en' ? 'Join' : 'הצטרף';
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
        <button class="map-popup-btn" onclick="joinSchool('${safeId}','${safeName}')">${enrollLbl}</button>
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
  const lessonDates = new Set((_cal.withStatus || []).map(s => {
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
  const dbAvEl = document.getElementById('db-avatar');
  if (dbAvEl) { dbAvEl.textContent = letter; dbAvEl.style.backgroundImage = ''; }
  // Load photo from schools doc (for school users)
  db.collection('schools').doc(user.uid).get().then(function(sd) {
    if (sd.exists && sd.data().photoURL && dbAvEl) {
      dbAvEl.style.backgroundImage = 'url(' + sd.data().photoURL + ')';
      dbAvEl.style.backgroundSize = 'cover';
      dbAvEl.textContent = '';
    }
  }).catch(function() {});
  document.getElementById('db-title').textContent = name;
  body.innerHTML = `<div class="db-loading">${t.db_loading||'...'}</div>`;

  // Определяем роль: сначала schools doc, затем users doc как резерв
  db.collection('schools').doc(user.uid).get().then(function(schoolDoc) {
    if (schoolDoc.exists) {
      document.getElementById('db-subtitle').textContent = t.db_subtitle_school||'School Dashboard';
      document.getElementById('db-role-badge').textContent = t.db_role_school||'School';
      loadSchoolDashboard(user, schoolDoc.data());
    } else {
      // Check users doc for role='school' (fallback if schools doc missing)
      db.collection('users').doc(user.uid).get().then(function(userDoc) {
        if (userDoc.exists && userDoc.data().role === 'school') {
          // School user but missing schools doc — create minimal one and show dashboard
          const schoolData = { uid: user.uid, name: userDoc.data().name || user.displayName || '', email: user.email, role: 'school', rating: 0, students: 0, price: 0 };
          db.collection('schools').doc(user.uid).set(schoolData, { merge: true });
          document.getElementById('db-subtitle').textContent = t.db_subtitle_school||'School Dashboard';
          document.getElementById('db-role-badge').textContent = t.db_role_school||'School';
          loadSchoolDashboard(user, schoolData);
        } else {
          showPage('home');
        }
      }).catch(function() { showPage('home'); });
    }
  }).catch(function() { showPage('home'); });
}

function loadSchoolHomeDash(user) {
  const dash = document.getElementById('school-home-dash');
  if (!dash) return;
  dash.style.display = 'block';
  const today = new Date();
  const pad = n => String(n).padStart(2,'0');
  const todayStr = `${pad(today.getDate())}.${pad(today.getMonth()+1)}.${today.getFullYear()}`;
  const todayEl = document.getElementById('shd-today');
  const pendingEl = document.getElementById('shd-pending');
  const studentsEl = document.getElementById('shd-students');
  Promise.all([
    db.collection('bookings').where('schoolId','==',user.uid).where('date','==',todayStr).get(),
    db.collection('enrollments').where('schoolId','==',user.uid).where('status','==','pending').get(),
    db.collection('enrollments').where('schoolId','==',user.uid).where('status','==','confirmed').get(),
  ]).then(function([todaySnap, pendingSnap, confirmedSnap]) {
    if (todayEl) todayEl.textContent = todaySnap.size;
    if (pendingEl) pendingEl.textContent = pendingSnap.size;
    if (studentsEl) studentsEl.textContent = confirmedSnap.size;
  }).catch(function() {});
}

function updateSidebarForSchool() {
  document.body.classList.add('school-mode');
  // Show dashboard button only for teachers
  const sbDashBtn = document.getElementById('sb-auth-dashboard-btn');
  if (sbDashBtn) sbDashBtn.style.display = 'block';
  const footerTheory = document.getElementById('footer-theory-link');
  if (footerTheory) footerTheory.style.display = 'none';
  const hr = document.querySelector('.uber-hero-right');
  if (hr) hr.style.display = 'none';
  // Schools and Theory are irrelevant for school users — hide both
  ['snav-schools', 'snav-test'].forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  ['mnav-schools', 'mnav-test'].forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  // Rename Schedule → "Мои уроки"
  const schedLbl = document.querySelector('#snav-schedule .sb-label');
  if (schedLbl) schedLbl.textContent = currentLang==='ru'?'Мои уроки':currentLang==='en'?'My Lessons':'השיעורים שלי';
  const mSchedLbl = document.querySelector('#mnav-schedule span[data-i18n]');
  if (mSchedLbl) mSchedLbl.textContent = currentLang==='ru'?'Мои уроки':currentLang==='en'?'My Lessons':'השיעורים שלי';
  const dashBtn = document.getElementById('snav-dashboard');
  if (dashBtn) dashBtn.style.display = 'flex';
  const mDashBtn = document.getElementById('mnav-dashboard');
  if (mDashBtn) mDashBtn.style.display = 'flex';
  // Hide hero buttons — schools don't need to find schools or take theory
  const heroBtns = document.querySelector('.uber-hero-btns');
  if (heroBtns) heroBtns.style.display = 'none';
  // Hide progress widget — irrelevant for schools
  const progressSection = document.querySelector('.progress-section');
  if (progressSection) progressSection.style.display = 'none';
  // Show school setup banner instead
  const setupBanner = document.getElementById('school-setup-banner');
  if (setupBanner) setupBanner.style.display = 'block';
  // Hide CTA section at bottom
  const ctaSection = document.querySelector('.cta-section');
  if (ctaSection) ctaSection.style.display = 'none';
  // Hide student-only home sections
  ['.how-section', '.features-section', '.live-section', '.stats-section'].forEach(function(sel) {
    const el = document.querySelector(sel);
    if (el) el.style.display = 'none';
  });
  // Show school home dashboard
  const user = auth.currentUser;
  if (user) loadSchoolHomeDash(user);
}

function loadSchoolDashboard(user, school) {
  updateSidebarForSchool();
  // Ensure school object has Firestore document id
  const schoolWithId = Object.assign({ id: user.uid }, school);
  _dashSchool = schoolWithId;
  spCurrentSchool = schoolWithId;
  const body = document.getElementById('db-body');
  db.collection('enrollments').where('schoolId', '==', user.uid).get().then(function(snap) {
    const all = [];
    snap.forEach(function(d) { all.push({ id: d.id, ...d.data() }); });
    const pending = all.filter(function(e) { return e.status === 'pending'; });
    const confirmed = all.filter(function(e) { return e.status === 'confirmed'; });

    // Store all enrollment data for fast lookup when opening student card
    window._enrollmentMap = {};
    all.forEach(function(e, i) {
      window._enrollmentMap[i] = e;
      if (e.userId) window._enrollmentMap[e.userId] = e;
    });

    // ── Pending applications rows ──
    const pendingRows = pending.length === 0
      ? `<div style="padding:32px 0;text-align:center;color:var(--muted);font-size:0.95rem;">${t.sdb_no_pending||'No new applications'}</div>`
      : pending.map(function(e) {
          const key = e.userId || e.id;
          return `<div class="sdb-row">
            <div class="sdb-row-avatar">${(e.studentName||'?').charAt(0).toUpperCase()}</div>
            <div class="sdb-row-info">
              <div class="sdb-row-name">${escapeHtml(e.studentName||'—')}</div>
              <div class="sdb-row-meta">${escapeHtml(e.studentPhone||e.studentEmail||'')}</div>
            </div>
            <div class="sdb-row-actions">
              <button class="sdb-accept" onclick="confirmEnrollment('${e.id}')">${t.status_confirmed||'✓'}</button>
              <button class="sdb-reject" onclick="rejectEnrollment('${e.id}')">✕</button>
            </div>
          </div>`;
        }).join('');

    // ── All applications rows ──
    const allRows = all.length === 0
      ? `<div style="padding:32px 0;text-align:center;color:var(--muted);font-size:0.95rem;">${t.sdb_no_students||'No students yet'}</div>`
      : all.slice().reverse().map(function(e) {
          const st = e.status === 'confirmed'
            ? {txt: t.status_confirmed||'Confirmed', color:'#16a34a'}
            : e.status === 'cancelled'
            ? {txt: t.status_done||'Cancelled', color:'#dc2626'}
            : {txt: t.status_pending||'Pending', color:'#d97706'};
          const key = e.userId || e.id;
          return `<div class="sdb-row">
            <div class="sdb-row-avatar">${(e.studentName||'?').charAt(0).toUpperCase()}</div>
            <div class="sdb-row-info">
              <div class="sdb-row-name">${escapeHtml(e.studentName||'—')}</div>
              <div class="sdb-row-meta">${escapeHtml(e.studentPhone||e.studentEmail||'')}</div>
            </div>
            <span style="font-size:0.78rem;font-weight:700;color:${st.color};">${st.txt}</span>
          </div>`;
        }).join('');

    const photoUrl = school.photoURL || '';
    const initials2 = (school.name||'Ш').trim().split(/\s+/).map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
    const L2 = currentLang || 'he';
    const photoLbl = L2==='ru'?'Фото профиля':L2==='en'?'Profile photo':'תמונת פרופיל';
    const uploadLbl = L2==='ru'?'Загрузить фото':L2==='en'?'Upload photo':'העלה תמונה';
    const removeLbl = L2==='ru'?'Удалить':L2==='en'?'Remove':'הסר';

    body.innerHTML = `
      <!-- Photo + Hero greeting -->
      <div class="sdb-hero" style="display:flex;align-items:center;gap:20px;padding:20px 0 16px;">
        <div style="position:relative;flex-shrink:0;">
          <div id="sdb-photo-wrap" style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:1.6rem;font-weight:800;color:white;overflow:hidden;cursor:pointer;" onclick="document.getElementById('sdb-photo-input').click()" title="${uploadLbl}">
            ${photoUrl ? `<img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover;" id="sdb-photo-img"/>` : `<span id="sdb-photo-initials">${initials2}</span>`}
          </div>
          <div style="position:absolute;bottom:0;inset-inline-end:0;width:24px;height:24px;background:#6366f1;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;border:2px solid white;" onclick="document.getElementById('sdb-photo-input').click()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </div>
          <input type="file" id="sdb-photo-input" accept="image/*" style="display:none" onchange="uploadSchoolPhoto(this)"/>
        </div>
        <div style="flex:1;min-width:0;">
          <div class="sdb-hero-name" style="margin:0 0 4px;">${escapeHtml(school.name || user.displayName || 'Школа')}</div>
          <div class="sdb-hero-city" style="margin:0 0 6px;">${escapeHtml(school.cityRu || school.city || '')}</div>
          <div id="sdb-photo-status" style="font-size:0.72rem;color:#6366f1;"></div>
        </div>
      </div>

      <!-- 4 stat pills -->
      <div class="sdb-stats">
        <div class="sdb-stat">
          <div class="sdb-stat-num">${all.length}</div>
          <div class="sdb-stat-lbl">${t.sdb_stat_total||'Total'}</div>
        </div>
        <div class="sdb-stat">
          <div class="sdb-stat-num" style="color:#d97706;">${pending.length}</div>
          <div class="sdb-stat-lbl">${t.sdb_stat_pending||'Pending'}</div>
        </div>
        <div class="sdb-stat">
          <div class="sdb-stat-num" style="color:#16a34a;">${confirmed.length}</div>
          <div class="sdb-stat-lbl">${t.sdb_stat_confirmed||'Confirmed'}</div>
        </div>
        <div class="sdb-stat">
          <div class="sdb-stat-num">${school.rating ? school.rating.toFixed(1) : '—'}</div>
          <div class="sdb-stat-lbl">${t.sdb_stat_rating||'Rating'}</div>
        </div>
      </div>

      <!-- Price setting -->
      <div class="sdb-section" style="margin-bottom:16px">
        <div class="sdb-section-header">
          <span class="sdb-section-title">${currentLang==='ru'?'Моя цена за урок':currentLang==='en'?'My lesson price':'מחיר השיעור שלי'}</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;padding:4px 0;">
          <span style="font-size:1rem;color:var(--muted);">₪</span>
          <input id="dash-price-input" type="number" min="0" placeholder="${currentLang==='ru'?'Напр. 280':currentLang==='en'?'e.g. 280':'לדוג. 280'}" value="${school.price||''}" style="flex:1;padding:9px 12px;border:2px solid var(--border);border-radius:10px;font-size:0.9rem;font-family:inherit;background:var(--bg);color:var(--text);outline:none;"/>
          <button onclick="saveDashPrice()" style="padding:9px 18px;background:var(--text);color:var(--bg);border:none;border-radius:10px;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">${currentLang==='ru'?'Сохранить':currentLang==='en'?'Save':'שמור'}</button>
        </div>
      </div>

      <!-- New applications -->
      <div class="sdb-section">
        <div class="sdb-section-header">
          <span class="sdb-section-title">${t.sdb_new_apps||'New Applications'}</span>
          ${pending.length > 0 ? `<span class="sdb-badge">${pending.length}</span>` : ''}
        </div>
        <div class="sdb-list">${pendingRows}</div>
      </div>

      <!-- All applications -->
      <div class="sdb-section">
        <div class="sdb-section-header">
          <span class="sdb-section-title">${t.sdb_all_students||'All Students'}</span>
          <span class="sdb-badge-outline">${all.length}</span>
        </div>
        <div class="sdb-list">${allRows}</div>
      </div>

      <!-- School card preview (as students see it) -->
      <div class="school-card" style="cursor:default;margin-bottom:0">
        <div class="sc-head">
          <div class="sc-avatar av-blue">${(school.name||'Ш').trim().split(/\s+/).map(function(w){return w[0];}).join('').slice(0,2).toUpperCase()}</div>
          <div style="flex:1;min-width:0">
            <div class="sc-name">${escapeHtml(school.name || 'Школа')}</div>
            <div class="sc-location">${escapeHtml(school.cityRu || school.city || '')}</div>
            ${school.address ? `<div style="font-size:0.72rem;color:#6c757d;margin-top:2px">${escapeHtml(school.address)}</div>` : ''}
            ${school.phone ? `<div style="font-size:0.75rem;color:#1a73e8;margin-top:4px">${escapeHtml(school.phone)}</div>` : ''}
          </div>
        </div>
        <div style="color:#f59e0b;font-size:0.9rem;margin-bottom:6px">
          ${'★'.repeat(Math.round(school.rating||0))}${'☆'.repeat(5-Math.round(school.rating||0))}
          ${school.rating ? `<span style="color:#6c757d;font-size:0.75rem">(${school.rating})</span>` : ''}
        </div>
        <div class="sc-stats">
          <div class="sc-stat"><div class="sc-stat-val">${school.pass_rate ? school.pass_rate+'%' : '—'}</div><div class="sc-stat-lbl">${t.sdb_pass_rate||'Pass Rate'}</div></div>
          <div class="sc-stat"><div class="sc-stat-val">${confirmed.length}</div><div class="sc-stat-lbl">${t.sdb_students||'Students'}</div></div>
          <div class="sc-stat"><div class="sc-stat-val">${school.price || '—'}</div><div class="sc-stat-lbl">${t.sdb_lesson_price||'₪'}</div></div>
        </div>
      </div>

      <!-- Car management -->
      <div class="sdb-section" style="margin-top:24px">
        <div class="sdb-section-header">
          <span class="sdb-section-title">${t.sdb_instructors||'My Cars'}</span>
          <button class="sdb-accept" style="margin-left:auto;border-radius:20px;padding:6px 16px;font-size:0.8rem" onclick="showDashInstrForm(-1)">${t.sdb_add||'+ Add'}</button>
        </div>
        <div id="dash-instructors"></div>
        <div id="dash-instr-form" style="display:none"></div>
      </div>

      <!-- Routes management -->
      <div class="sdb-section" style="margin-top:24px">
        <div class="sdb-section-header">
          <span class="sdb-section-title">${t.routes_title||'Routes'}</span>
          <button class="sdb-accept" style="margin-left:auto;border-radius:20px;padding:6px 16px;font-size:0.8rem" onclick="openRouteRecordModal()">+ ${t.route_record||'Record'}</button>
        </div>
        <div id="dash-routes-map" style="height:220px;border-radius:14px;overflow:hidden;margin-bottom:12px;display:none;"></div>
        <div id="dash-routes-list"></div>
      </div>

      <div id="avail-editor-body" style="display:none;"></div>`;

    renderDashInstructors(school.instructors || []);
    loadDashRoutes(user.uid);
    renderAvailabilityEditor(school.instructors || [], user.uid);
    // Real-time bookings calendar for school
    if (_schoolCalUnsub) { _schoolCalUnsub(); _schoolCalUnsub = null; }
    _schoolCalUnsub = db.collection('bookings')
      .where('schoolId', '==', user.uid)
      .where('status', '==', 'confirmed')
      .onSnapshot(function(snap) {
        const bks = [];
        snap.forEach(d => bks.push({ id: d.id, ...d.data() }));
        _schoolCal.bookings = bks;
        renderSchoolCalendar();
      });
  }).catch(function(err) {
    console.error('loadSchoolDashboard error:', err);
    body.innerHTML = `<div class="db-loading">${t.db_error||'Error'}</div>`;
  });
}

function renderSchoolCalendar() {
  const calBody = document.getElementById('school-cal-body');
  const monthLbl = document.getElementById('school-cal-month-lbl');
  if (!calBody) return;

  const { year, month, bookings } = _schoolCal;
  const MONTH_NAMES = {
    ru: ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'],
    he: ['ינו','פבר','מרץ','אפר','מאי','יונ','יול','אוג','ספט','אוק','נוב','דצמ'],
    en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  };
  const DAY_SHORT = {
    ru: ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'],
    he: ['א','ב','ג','ד','ה','ו','ש'],
    en: ['Su','Mo','Tu','We','Th','Fr','Sa'],
  };
  const L = currentLang || 'ru';
  if (monthLbl) monthLbl.textContent = (MONTH_NAMES[L] || MONTH_NAMES.ru)[month] + ' ' + year;

  // Build set of dates with bookings (DD.MM.YYYY)
  const bookedDates = new Set();
  bookings.forEach(b => { if (b.date) bookedDates.add(b.date); });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = String(today.getDate()).padStart(2,'0') + '.' + String(today.getMonth()+1).padStart(2,'0') + '.' + today.getFullYear();

  const days = DAY_SHORT[L] || DAY_SHORT.ru;
  let html = `<div class="cal-grid" style="font-size:0.78rem;">`;
  days.forEach(d => { html += `<div class="cal-day-header" style="text-align:center;font-weight:700;color:#888;padding:4px 0;">${d}</div>`; });
  for (let i = 0; i < firstDay; i++) html += '<div></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month+1).padStart(2,'0');
    const dd = String(d).padStart(2,'0');
    const dateStr = `${dd}.${mm}.${year}`;
    const isoStr  = `${year}-${mm}-${dd}`;
    const hasLesson = bookedDates.has(dateStr);
    const isToday = dateStr === todayStr;
    const cls = ['cal-day', hasLesson ? 'cal-has-lesson' : '', isToday ? 'cal-today' : ''].filter(Boolean).join(' ');
    html += `<div class="${cls}" onclick="schoolCalSelectDay('${dateStr}','${isoStr}')" style="cursor:pointer;">${d}</div>`;
  }
  html += '</div>';
  calBody.innerHTML = html;
}

function schoolCalNav(dir) {
  _schoolCal.month += dir;
  if (_schoolCal.month < 0) { _schoolCal.month = 11; _schoolCal.year--; }
  if (_schoolCal.month > 11) { _schoolCal.month = 0; _schoolCal.year++; }
  renderSchoolCalendar();
  const dl = document.getElementById('school-day-lessons');
  if (dl) dl.innerHTML = '';
}

function schoolCalSelectDay(dateStr, isoStr) {
  const dl = document.getElementById('school-day-lessons');
  if (dl) {
    const lessons = _schoolCal.bookings.filter(b => b.date === dateStr);
    const typeMap = {
      lesson_practical: currentLang==='ru'?'Практика':currentLang==='en'?'Driving':'נהיגה',
      lesson_theory:    currentLang==='ru'?'Теория':currentLang==='en'?'Theory':'תיאוריה',
      lesson_highway:   currentLang==='ru'?'Шоссе':currentLang==='en'?'Highway':'כביש מהיר',
    };
    const minLbl = currentLang==='ru'?'мин':currentLang==='en'?'min':'דק׳';
    if (lessons.length === 0) {
      const noLessonsLbl = currentLang==='ru'?'Уроков нет':currentLang==='en'?'No lessons':'אין שיעורים';
      dl.innerHTML = `<div style="color:#888;font-size:0.82rem;padding:8px 0;">${noLessonsLbl}</div>`;
    } else {
      dl.innerHTML = lessons.map(b => `
        <div class="lesson-card" style="margin-bottom:6px;padding:10px 12px;">
          <div style="font-weight:700;font-size:0.88rem;">${escapeHtml(b.studentName||'?')} — ${b.time||''}</div>
          <div style="color:#888;font-size:0.78rem;">${escapeHtml(b.instructorName||'')} · ${typeMap[b.type]||b.type||''} · ${b.duration||90} ${minLbl}</div>
        </div>`).join('');
    }
  }
  // Immediately open lesson modal with the selected date (ISO format YYYY-MM-DD)
  openSchoolLessonModal(isoStr || dateStr);
}

function loadStudentDashboard(user) {
  const body = document.getElementById('db-body');
  body.innerHTML = '<div class="db-loading">Загрузка...</div>';

  Promise.all([
    db.collection('users').doc(user.uid).get(),
    db.collection('enrollments').where('userId', '==', user.uid).get()
  ]).then(function(results) {
    const userDoc = results[0];
    const enrollSnap = results[1];
    const udata = userDoc.exists ? userDoc.data() : {};
    const enrollments = [];
    enrollSnap.forEach(function(d) { enrollments.push({ id: d.id, ...d.data() }); });

    const confirmed = enrollments.filter(function(e) { return e.status === 'confirmed'; });
    const pending   = enrollments.filter(function(e) { return e.status === 'pending'; });

    // Student ID: first 12 chars of UID
    const studentId = user.uid.slice(0, 12);

    // Initials from display name
    const fullName = escapeHtml(udata.name || user.displayName || user.email || 'Ученик');
    const nameParts = (udata.name || user.displayName || '').trim().split(/\s+/);
    const initials = nameParts.length >= 2
      ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
      : (udata.name || user.displayName || 'УЧ').slice(0, 2).toUpperCase();

    // School name from first confirmed or first enrollment
    const activeEnroll = confirmed[0] || enrollments[0];
    const schoolName = activeEnroll ? escapeHtml(activeEnroll.schoolName || '—') : '—';
    const isActive = confirmed.length > 0;
    const badgeCls = isActive ? 'active' : 'pending';
    const badgeTxt = isActive ? 'Активен' : 'Ожидает подтверждения';

    // Date of birth — format nicely
    let dobDisplay = '—';
    if (udata.dateOfBirth) {
      const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
      const parts = udata.dateOfBirth.split('-');
      if (parts.length === 3) {
        dobDisplay = parseInt(parts[2], 10) + ' ' + months[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
      } else {
        dobDisplay = escapeHtml(udata.dateOfBirth);
      }
    }

    const cityDisplay = escapeHtml(udata.city || '—');
    const emailDisplay = escapeHtml(user.email || '—');

    // Store for modal/copy use
    window._studentCardData = {
      id: user.uid,
      name: fullName,
      email: emailDisplay,
      dob: dobDisplay,
      city: cityDisplay,
      school: schoolName,
      status: badgeTxt,
      studentId: studentId
    };

    const cardHtml = `
      <div class="student-id-card" onclick="openStudentCardModal()">
        <div class="sic-header">
          <div class="sic-avatar-wrap">
            <div class="sic-avatar">${initials}</div>
          </div>
          <div class="sic-header-info">
            <span class="sic-badge ${badgeCls}">${badgeTxt}</span>
            <div class="sic-school-name">${schoolName}</div>
          </div>
          <div class="sic-qr">🪪</div>
        </div>
        <div class="sic-fields">
          <div class="sic-field">
            <div class="sic-field-label">ИМЯ</div>
            <div class="sic-field-value">${fullName}</div>
          </div>
          <div class="sic-field">
            <div class="sic-field-label">ДАТА РОЖДЕНИЯ</div>
            <div class="sic-field-value">${dobDisplay}</div>
          </div>
          <div class="sic-field">
            <div class="sic-field-label">ГОРОД</div>
            <div class="sic-field-value">${cityDisplay}</div>
          </div>
          <div class="sic-field">
            <div class="sic-field-label">EMAIL</div>
            <div class="sic-field-value" style="font-size:0.78rem;word-break:break-all;">${emailDisplay}</div>
          </div>
        </div>
        <div class="sic-divider"></div>
        <div class="sic-id-row">
          <div>
            <div class="sic-field-label">ID УЧЕНИКА</div>
            <div class="sic-field-value" id="sic-id-display">${studentId}</div>
          </div>
          <button class="sic-copy-btn" id="sic-copy-btn" onclick="event.stopPropagation();copyStudentId()">📋</button>
        </div>
        <button class="sic-action-btn" onclick="event.stopPropagation();showPage('schools')">Моя школа →</button>
      </div>`;

    const enrollList = enrollments.length === 0
      ? '<div class="db-empty"><div>Вы ещё не записаны ни в одну школу</div><button class="db-action-btn" style="max-width:240px;margin:12px auto 0" onclick="showPage(\'schools\')">Найти школу</button></div>'
      : enrollments.map(function(e) {
          const st = e.status === 'confirmed' ? {txt:'Подтверждён',cls:'st-confirmed'} : e.status === 'cancelled' ? {txt:'Отменён',cls:'st-cancelled'} : {txt:'На рассмотрении',cls:'st-new'};
          return `<div class="db-enroll-item">
            <div class="db-enroll-avatar" style="background:linear-gradient(135deg,#27ae60,#1a73e8)">${(e.schoolName||'?').charAt(0).toUpperCase()}</div>
            <div><div class="db-enroll-name">${escapeHtml(e.schoolName||'—')}</div><div class="db-enroll-meta">${escapeHtml(e.schoolCity||'')}${e.date ? ' · ' + e.date : ''}</div></div>
            <span class="db-enroll-status ${st.cls}">${st.txt}</span>
          </div>`;
        }).join('');

    body.innerHTML = cardHtml + `
      <div class="db-card" style="margin-top:8px;">
        <div class="db-card-header">
          <div class="db-card-title">Мои записи в школы</div>
          <span class="db-card-badge">${enrollments.length}</span>
        </div>
        <div class="db-card-body">${enrollList}</div>
      </div>`;

  }).catch(function(err) {
    console.error('loadStudentDashboard error:', err);
    body.innerHTML = `<div class="db-loading">${t.db_error||'Error'}</div>`;
  });
}

function openStudentCardModal() {
  const d = window._studentCardData;
  if (!d) return;
  const existing = document.getElementById('sic-modal-overlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.className = 'sic-modal-overlay';
  overlay.id = 'sic-modal-overlay';
  overlay.innerHTML = `
    <div class="sic-modal" onclick="event.stopPropagation()">
      <div class="sic-modal-header">
        <div class="sic-modal-title">Карточка ученика</div>
        <button class="sic-modal-close" onclick="document.getElementById('sic-modal-overlay').remove()">✕</button>
      </div>
      <div class="sic-modal-field">
        <div class="sic-modal-field-label">ИМЯ</div>
        <div class="sic-modal-field-value">${d.name}</div>
      </div>
      <div class="sic-modal-field">
        <div class="sic-modal-field-label">EMAIL</div>
        <div class="sic-modal-field-value">${d.email}</div>
      </div>
      <div class="sic-modal-field">
        <div class="sic-modal-field-label">ДАТА РОЖДЕНИЯ</div>
        <div class="sic-modal-field-value">${d.dob}</div>
      </div>
      <div class="sic-modal-field">
        <div class="sic-modal-field-label">ГОРОД</div>
        <div class="sic-modal-field-value">${d.city}</div>
      </div>
      <div class="sic-modal-field">
        <div class="sic-modal-field-label">ШКОЛА</div>
        <div class="sic-modal-field-value">${d.school}</div>
      </div>
      <div class="sic-modal-field">
        <div class="sic-modal-field-label">СТАТУС</div>
        <div class="sic-modal-field-value">${d.status}</div>
      </div>
      <div class="sic-modal-field">
        <div class="sic-modal-field-label">ID УЧЕНИКА</div>
        <div class="sic-modal-field-value" style="font-family:monospace;">${d.studentId}</div>
      </div>
    </div>`;
  overlay.addEventListener('click', function() { overlay.remove(); });
  document.body.appendChild(overlay);
}

function copyStudentId() {
  const d = window._studentCardData;
  if (!d) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(d.id).then(function() {
      const btn = document.getElementById('sic-copy-btn');
      if (btn) { btn.textContent = '✓'; setTimeout(function() { btn.textContent = '📋'; }, 1500); }
    });
  } else {
    const ta = document.createElement('textarea');
    ta.value = d.id;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    const btn = document.getElementById('sic-copy-btn');
    if (btn) { btn.textContent = '✓'; setTimeout(function() { btn.textContent = '📋'; }, 1500); }
  }
}

window.openStudentCardModal = openStudentCardModal;
window.copyStudentId = copyStudentId;

function viewStudentCard(userId) {
  const existing = document.getElementById('sic-modal-overlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'sic-modal-overlay';
  overlay.className = 'sic-modal-overlay';
  overlay.innerHTML = '<div class="sic-modal" onclick="event.stopPropagation()"></div>';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);

  const enroll = (window._enrollmentMap && window._enrollmentMap[userId]) || {};
  _renderStudentModal(overlay, {
    name:        enroll.studentName  || '—',
    email:       enroll.studentEmail || enroll.email || '—',
    status:      enroll.status       || 'pending',
    uid:         enroll.userId       || userId,
    phone:       enroll.studentPhone || '',
    dateOfBirth: enroll.dateOfBirth  || '',
    city:        enroll.city         || '',
    idNumber:    enroll.studentId    || '',
    licenseType: enroll.licenseType  || '',
    transmission:enroll.transmission || '',
    carColor:    enroll.carColor     || '',
    notes:       enroll.notes        || '',
    schoolName:  enroll.schoolName   || '',
  });
}

function _renderStudentModal(overlay, d) {
  const initials = (d.name||'?').split(' ').map(function(n) { return n[0]||''; }).join('').toUpperCase().slice(0,2);
  const isActive = d.status === 'confirmed';
  const stTxt = isActive ? (currentLang==='ru'?'Активен':currentLang==='en'?'Active':'פעיל') : (currentLang==='ru'?'Ожидает':currentLang==='en'?'Pending':'ממתין');
  const shortId = 'ID-' + (d.uid||'').slice(0,10).toUpperCase();
  const enrollId = 'ENR-' + (d.uid||'').slice(-8).toUpperCase();
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(d.uid||'student')}`;

  const tabStyle = (active) => active
    ? 'flex:1;padding:8px 4px;background:rgba(255,255,255,0.15);border:none;color:white;border-radius:8px;font-size:0.78rem;font-weight:700;cursor:pointer;font-family:inherit;'
    : 'flex:1;padding:8px 4px;background:transparent;border:none;color:rgba(255,255,255,0.45);border-radius:8px;font-size:0.78rem;font-weight:600;cursor:pointer;font-family:inherit;';

  const lbl = (ru, en, he) => currentLang==='ru'?ru:currentLang==='en'?en:he;
  const field = (label, value, mono) => value && value !== '—' ? `
    <div style="margin-bottom:12px;">
      <div style="font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.4);margin-bottom:3px;">${label}</div>
      <div style="font-size:0.88rem;font-weight:600;color:white;${mono?'font-family:monospace;':''}">${escapeHtml(value)}</div>
    </div>` : '';

  const infoTab = `
    <div style="margin-bottom:12px;">
      <div style="font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.4);margin-bottom:3px;">${lbl('Имя','Name','שם')}</div>
      <div style="font-size:0.88rem;font-weight:600;color:white;">${escapeHtml(d.name||'—')}</div>
    </div>
    ${field(lbl('Email','Email','אימייל'), d.email)}
${field(lbl('Цвет авто','Car Color','צבע רכב'), d.carColor)}
    ${field(lbl('Город','City','עיר'), d.city)}
    ${d.notes && d.notes !== '—' ? `
    <div style="height:1px;background:rgba(255,255,255,0.1);margin:8px 0 12px;"></div>
    <div>
      <div style="font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.4);margin-bottom:4px;">${lbl('Заметки при записи','Enrollment Notes','הערות')}</div>
      <div style="font-size:0.82rem;color:rgba(255,255,255,0.7);line-height:1.4;">${escapeHtml(d.notes)}</div>
    </div>` : ''}`;

  overlay.querySelector('.sic-modal').innerHTML = `
    <button onclick="document.getElementById('sic-modal-overlay').remove()" style="position:absolute;top:12px;right:12px;width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.15);border:none;color:white;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:1;">✕</button>

    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:18px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,0.15);border:2px solid rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;font-size:1.15rem;font-weight:900;color:white;">${initials}</div>
        <div>
          <div style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:0.72rem;font-weight:700;margin-bottom:4px;${isActive?'background:rgba(39,174,96,0.25);color:#6ee7a0;border:1px solid rgba(39,174,96,0.3);':'background:rgba(230,126,34,0.25);color:#fcd34d;border:1px solid rgba(230,126,34,0.3);'}">${stTxt}</div>
          <div style="font-size:0.82rem;color:rgba(255,255,255,0.55);">${escapeHtml(d.schoolName||'DriveIL')}</div>
        </div>
      </div>
      <div style="width:52px;height:52px;background:rgba(255,255,255,0.1);border-radius:8px;padding:4px;border:1px solid rgba(255,255,255,0.15);">
        <img src="${qrUrl}" style="width:100%;height:100%;border-radius:4px;" alt="QR"/>
      </div>
    </div>

    <!-- Tabs -->
    <div style="display:flex;gap:4px;margin-bottom:18px;background:rgba(255,255,255,0.07);border-radius:10px;padding:4px;">
      <button id="stab-info" onclick="switchStudentTab('info','${d.uid||''}')" style="${tabStyle(true)}">${currentLang==='ru'?'Инфо':currentLang==='en'?'Info':'מידע'}</button>
      <button id="stab-lessons" onclick="switchStudentTab('lessons','${d.uid||''}')" style="${tabStyle(false)}">${currentLang==='ru'?'Уроки':currentLang==='en'?'Lessons':'שיעורים'}</button>
      <button id="stab-notes" onclick="switchStudentTab('notes','${d.uid||''}')" style="${tabStyle(false)}">${currentLang==='ru'?'Заметки':currentLang==='en'?'Notes':'הערות'}</button>
    </div>

    <!-- Tab body -->
    <div id="stab-body">${infoTab}</div>

    <div style="margin-top:20px;">
      <button onclick="document.getElementById('sic-modal-overlay').remove()"
        style="width:100%;padding:13px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:white;border-radius:12px;font-size:0.9rem;font-weight:600;cursor:pointer;font-family:inherit;">
        ${currentLang==='ru'?'Закрыть':currentLang==='en'?'Close':'סגור'}
      </button>
    </div>
  `;

  const modal = overlay.querySelector('.sic-modal');
  modal.style.background = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)';
  modal.style.color = 'white';
  modal.style.position = 'relative';

  // Store data for tab switching
  window._sic_d = d;
  window._sic_infoTab = infoTab;
}

function switchStudentTab(tab, uid) {
  const d = window._sic_d || {};
  const body = document.getElementById('stab-body');
  if (!body) return;

  const tabStyle = (active) => active
    ? 'flex:1;padding:8px 4px;background:rgba(255,255,255,0.15);border:none;color:white;border-radius:8px;font-size:0.78rem;font-weight:700;cursor:pointer;font-family:inherit;'
    : 'flex:1;padding:8px 4px;background:transparent;border:none;color:rgba(255,255,255,0.45);border-radius:8px;font-size:0.78rem;font-weight:600;cursor:pointer;font-family:inherit;';
  ['info','lessons','notes'].forEach(function(t2) {
    const btn = document.getElementById('stab-' + t2);
    if (btn) btn.style.cssText = tabStyle(t2 === tab);
  });

  if (tab === 'info') {
    body.innerHTML = window._sic_infoTab || '';
    return;
  }

  if (tab === 'lessons') {
    body.innerHTML = '<div style="color:rgba(255,255,255,0.5);font-size:0.85rem;padding:8px 0;">Загружаем уроки…</div>';
    if (!uid) { body.innerHTML = '<div style="color:rgba(255,255,255,0.4);font-size:0.85rem;padding:8px 0;">—</div>'; return; }
    const schoolUser = auth.currentUser;
    if (!schoolUser) return;
    db.collection('bookings')
      .where('schoolId', '==', schoolUser.uid)
      .where('studentId', '==', uid)
      .get().then(function(snap) {
        if (snap.empty) {
          body.innerHTML = '<div style="color:rgba(255,255,255,0.4);font-size:0.85rem;padding:12px 0;text-align:center;">' + (currentLang==='ru'?'Уроков пока нет':currentLang==='en'?'No lessons yet':'אין שיעורים עדיין') + '</div>';
          return;
        }
        const bks = [];
        snap.forEach(function(doc) { bks.push(doc.data()); });
        bks.sort(function(a,b) { return a.date < b.date ? 1 : -1; });
        const typeColors = { lesson_practical:'#1a73e8', lesson_theory:'#8e44ad', lesson_highway:'#27ae60' };
        const today = new Date(); today.setHours(0,0,0,0);
        let done = 0, upcoming = 0;
        const rows = bks.map(function(b) {
          const [dd,mm,yy] = (b.date||'').split('.');
          const bDate = new Date(+yy, +mm-1, +dd);
          const isPast = bDate < today;
          if (isPast) done++; else upcoming++;
          const color = typeColors[b.type] || '#1a73e8';
          const stLabel = isPast ? (currentLang==='ru'?'Пройден':currentLang==='en'?'Done':'עבר') : (currentLang==='ru'?'Запланирован':currentLang==='en'?'Upcoming':'מתוכנן');
          const stColor = isPast ? 'rgba(255,255,255,0.35)' : '#6ee7a0';
          return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);">
            <div style="width:4px;height:32px;border-radius:2px;background:${color};flex-shrink:0;"></div>
            <div style="flex:1;">
              <div style="font-size:0.82rem;font-weight:600;color:white;">${escapeHtml(b.date||'—')} ${escapeHtml(b.time||'')}</div>
              <div style="font-size:0.72rem;color:rgba(255,255,255,0.45);">${escapeHtml(b.instructorName||'—')}</div>
            </div>
            <span style="font-size:0.68rem;font-weight:700;color:${stColor};">${stLabel}</span>
          </div>`;
        }).join('');
        body.innerHTML = `
          <div style="display:flex;gap:16px;margin-bottom:14px;">
            <div style="flex:1;background:rgba(255,255,255,0.07);border-radius:10px;padding:10px;text-align:center;">
              <div style="font-size:1.3rem;font-weight:800;color:white;">${done}</div>
              <div style="font-size:0.68rem;color:rgba(255,255,255,0.45);">${currentLang==='ru'?'Пройдено':currentLang==='en'?'Done':'עברו'}</div>
            </div>
            <div style="flex:1;background:rgba(255,255,255,0.07);border-radius:10px;padding:10px;text-align:center;">
              <div style="font-size:1.3rem;font-weight:800;color:#6ee7a0;">${upcoming}</div>
              <div style="font-size:0.68rem;color:rgba(255,255,255,0.45);">${currentLang==='ru'?'Предстоит':currentLang==='en'?'Upcoming':'קרובים'}</div>
            </div>
          </div>
          <div style="max-height:220px;overflow-y:auto;">${rows}</div>`;
      }).catch(function() {
        body.innerHTML = '<div style="color:rgba(255,255,255,0.4);font-size:0.85rem;padding:8px 0;">Ошибка загрузки</div>';
      });
    return;
  }

  if (tab === 'notes') {
    const schoolUser = auth.currentUser;
    const noteKey = schoolUser ? ('note_' + schoolUser.uid + '_' + uid) : null;
    const saved = noteKey ? (localStorage.getItem(noteKey) || '') : '';
    const placeholder = currentLang==='ru'?'Заметки о ученике...':currentLang==='en'?'Notes about student...':'הערות על התלמיד...';
    const saveLbl = currentLang==='ru'?'Сохранить':currentLang==='en'?'Save':'שמור';
    body.innerHTML = `
      <textarea id="student-note-ta" placeholder="${placeholder}" style="width:100%;box-sizing:border-box;height:160px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.15);border-radius:10px;color:white;font-size:0.88rem;padding:12px;font-family:inherit;resize:none;outline:none;">${escapeHtml(saved)}</textarea>
      <button onclick="saveStudentNote('${noteKey||''}')" style="margin-top:10px;width:100%;padding:10px;background:rgba(39,174,96,0.25);border:1px solid rgba(39,174,96,0.35);color:#6ee7a0;border-radius:10px;font-size:0.88rem;font-weight:700;cursor:pointer;font-family:inherit;">${saveLbl}</button>`;
  }
}

function saveStudentNote(noteKey) {
  if (!noteKey) return;
  const ta = document.getElementById('student-note-ta');
  if (!ta) return;
  localStorage.setItem(noteKey, ta.value);
  notify(currentLang==='ru'?'Заметка сохранена ✓':currentLang==='en'?'Note saved ✓':'ההערה נשמרה ✓');
}

window.viewStudentCard = viewStudentCard;
window.switchStudentTab = switchStudentTab;
window.saveStudentNote = saveStudentNote;

function confirmEnrollment(id) {
  db.collection('enrollments').doc(id).update({ status: 'confirmed' }).then(function() {
    loadDashboard();
  }).catch(function(err) {
    notify(currentLang==='ru'?'Ошибка подтверждения':currentLang==='en'?'Confirmation error':'שגיאה באישור');
    console.error('confirmEnrollment error:', err);
  });
}
function rejectEnrollment(id) {
  db.collection('enrollments').doc(id).update({ status: 'cancelled' }).then(function() {
    loadDashboard();
  }).catch(function(err) {
    notify(currentLang==='ru'?'Ошибка отклонения':currentLang==='en'?'Rejection error':'שגיאה בדחייה');
    console.error('rejectEnrollment error:', err);
  });
}

// ── Expose functions to window (called from HTML onclick handlers) ──
// Auth screen functions
window.pickLang = pickLang;
window.asSwitchTab = asSwitchTab;
window.asSubmit = asSubmit;
window.asLogout = asLogout;
window.asSelectRole = asSelectRole;
window.asPickRole = asPickRole;
window.asUpdatePwStrength = asUpdatePwStrength;
window.asTogglePw = asTogglePw;
window.asGoBack = asGoBack;
window.asShowLogin = asShowLogin;
window.asLoginSubmit = asLoginSubmit;
window._launchApp = _launchApp;
function generateSparklineSvg(data) {
  const W = 300, H = 56, pad = 4;
  const max = Math.max(...data, 1);
  const stepX = (W - pad * 2) / (data.length - 1);
  const pts = data.map(function(v, i) {
    const x = pad + i * stepX;
    const y = H - pad - (v / max) * (H - pad * 2);
    return [x, y];
  });
  const line = pts.map(function(p, i) { return (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
  const area = line + ' L' + pts[pts.length-1][0].toFixed(1) + ',' + (H-pad) + ' L' + pad + ',' + (H-pad) + ' Z';
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="msp-sg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1a73e8" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#1a73e8" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${area}" fill="url(#msp-sg)"/>
    <path d="${line}" fill="none" stroke="#1a73e8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    ${pts.map(function(p, i) { return data[i] > 0 ? `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.5" fill="#1a73e8"/>` : ''; }).join('')}
  </svg>`;
}

function loadMySchoolPage() { /* removed — school users redirected to dashboard */ }

// ── ROUTES ────────────────────────────────────────────────────────────────
let _routesMap = null;

function loadRoutesPage() {
  const user = auth.currentUser;
  if (!user) { showPage('home'); openAuthModal(); return; }
  const list = document.getElementById('routes-list');
  if (list) list.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);">' + (t.db_loading||'Loading...') + '</div>';

  setTimeout(function() {
    if (!_routesMap) {
      const mapEl = document.getElementById('routes-map');
      if (!mapEl) return;
      _routesMap = L.map('routes-map', { zoomControl: false }).setView([31.7683, 35.2137], 8);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© CartoDB', maxZoom: 19
      }).addTo(_routesMap);
      L.control.zoom({ position: 'bottomright' }).addTo(_routesMap);
    }

    if (_userIsSchool) {
      db.collection('routes').where('schoolId', '==', user.uid).get().then(function(snap) {
        const routes = [];
        snap.forEach(function(d) { routes.push({ id: d.id, ...d.data() }); });
        renderRoutesList(routes, user.uid);
      });
    } else {
      db.collection('enrollments').where('userId', '==', user.uid).where('status', '==', 'confirmed').get().then(function(snap) {
        if (snap.empty) {
          if (list) list.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);">' + (t.routes_empty||'No routes yet') + '</div>';
          return null;
        }
        const schoolId = snap.docs[0].data().schoolId;
        return db.collection('routes').where('schoolId', '==', schoolId).get();
      }).then(function(snap) {
        if (!snap) return;
        const routes = [];
        snap.forEach(function(d) { routes.push({ id: d.id, ...d.data() }); });
        renderRoutesList(routes, null);
      });
    }
  }, 80);
}

function renderRoutesList(routes, ownerUid) {
  const list = document.getElementById('routes-list');
  if (!list) return;

  if (_routesMap) {
    _routesMap.eachLayer(function(layer) {
      if (layer instanceof L.Polyline || layer instanceof L.CircleMarker) _routesMap.removeLayer(layer);
    });
  }

  if (routes.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);">' + (t.routes_empty||'No routes yet') + '</div>';
    return;
  }

  const colors = ['#1a73e8','#ea4335','#34a853','#fbbc05','#9c27b0','#ff6d00'];
  const diffColor = { easy:'#34a853', medium:'#fbbc05', hard:'#ea4335' };
  const allBounds = [];

  routes.forEach(function(route, i) {
    const pts = (route.points || []).map(function(p) { return [p.lat, p.lng]; });
    if (pts.length > 1 && _routesMap) {
      const color = colors[i % colors.length];
      L.polyline(pts, { color: color, weight: 4, opacity: 0.85 }).addTo(_routesMap);
      L.circleMarker(pts[0], { radius: 7, color: color, fillColor: '#fff', fillOpacity: 1, weight: 2 }).addTo(_routesMap);
      L.circleMarker(pts[pts.length-1], { radius: 7, color: color, fillColor: color, fillOpacity: 1, weight: 2 }).addTo(_routesMap);
      allBounds.push(...pts);
    }
  });

  if (allBounds.length > 0 && _routesMap) _routesMap.fitBounds(allBounds, { padding: [20, 20] });

  list.innerHTML = routes.map(function(route, i) {
    const color = colors[i % colors.length];
    const diff = route.difficulty || 'medium';
    const dist = route.distance ? route.distance.toFixed(1) + ' км' : '—';
    const dur = route.duration ? route.duration + ' мин' : '—';
    const deleteBtn = ownerUid
      ? `<button onclick="deleteRoute('${route.id}')" style="margin-top:8px;padding:5px 14px;background:transparent;color:#ea4335;border:1.5px solid #ea4335;border-radius:8px;font-size:0.78rem;cursor:pointer;font-family:inherit;">${currentLang==='he'?'מחק':currentLang==='en'?'Delete':'Удалить'}</button>`
      : '';
    return `<div style="background:var(--card);border-radius:14px;padding:16px;margin-bottom:12px;border-left:4px solid ${color};">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
        <span style="font-weight:700;font-size:1rem;">${escapeHtml(route.name||'—')}</span>
        <span style="font-size:0.75rem;font-weight:700;color:${diffColor[diff]||'#fbbc05'};background:${diffColor[diff]||'#fbbc05'}22;padding:3px 10px;border-radius:20px;">${diff==='easy'?(t.route_easy||'Easy'):diff==='hard'?(t.route_hard||'Hard'):(t.route_medium||'Medium')}</span>
      </div>
      <div style="display:flex;gap:16px;font-size:0.82rem;color:var(--muted);">
        <span>📏 ${dist}</span><span>⏱ ${dur}</span><span>📍 ${(route.points||[]).length} pts</span>
      </div>
      ${deleteBtn}
    </div>`;
  }).join('');
}

function loadDashRoutes(uid) {
  const container = document.getElementById('dash-routes-list');
  const mapDiv = document.getElementById('dash-routes-map');
  if (!container) return;
  container.innerHTML = '<div style="color:var(--muted);font-size:0.85rem;padding:8px 0;">' + (t.db_loading||'...') + '</div>';
  db.collection('routes').where('schoolId', '==', uid).get().then(function(snap) {
    const routes = [];
    snap.forEach(function(d) { routes.push({ id: d.id, ...d.data() }); });
    if (routes.length === 0) {
      container.innerHTML = '<div style="color:var(--muted);font-size:0.85rem;padding:8px 0;">' + (t.routes_empty||'No routes yet') + '</div>';
      if (mapDiv) mapDiv.style.display = 'none';
      return;
    }
    const diffLabel = { easy: t.route_easy||'Easy', medium: t.route_medium||'Medium', hard: t.route_hard||'Hard' };
    const diffColor = { easy:'#34a853', medium:'#fbbc05', hard:'#ea4335' };

    // Render routes list with highlight-on-click
    container.innerHTML = routes.map(function(route) {
      const diff = route.difficulty || 'medium';
      const dist = route.distance ? route.distance.toFixed(1) + ' км' : '—';
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer;" onclick="dashRouteHighlight('${route.id}')">
        <div>
          <div style="font-weight:600;font-size:0.9rem;">${escapeHtml(route.name||'—')}</div>
          <div style="font-size:0.75rem;color:var(--muted);">${dist} · <span style="color:${diffColor[diff]}">${diffLabel[diff]}</span></div>
        </div>
        <button onclick="event.stopPropagation();deleteRoute('${route.id}')" style="background:none;border:none;color:#ea4335;cursor:pointer;font-size:1.1rem;padding:4px 8px;">🗑</button>
      </div>`;
    }).join('');

    // Init map with all routes
    if (mapDiv) {
      mapDiv.style.display = '';
      setTimeout(function() {
        if (window._dashRoutesMap) {
          window._dashRoutesMap.eachLayer(function(l) {
            if (l instanceof L.Polyline || l instanceof L.CircleMarker) window._dashRoutesMap.removeLayer(l);
          });
        } else {
          window._dashRoutesMap = L.map('dash-routes-map', { zoomControl: true }).setView([31.5, 34.9], 9);
          L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '© CartoDB', maxZoom: 19 }).addTo(window._dashRoutesMap);
        }
        window._dashRouteLines = {};
        const allBounds = [];
        routes.forEach(function(route) {
          if (!route.points || route.points.length < 2) return;
          const diff = route.difficulty || 'medium';
          const latlngs = route.points.map(function(p) { return [p.lat, p.lng]; });
          const line = L.polyline(latlngs, { color: diffColor[diff], weight: 4, opacity: 0.85 }).addTo(window._dashRoutesMap);
          L.circleMarker(latlngs[0], { radius: 6, color: diffColor[diff], fillColor: '#fff', fillOpacity: 1, weight: 2 }).addTo(window._dashRoutesMap);
          window._dashRouteLines[route.id] = line;
          allBounds.push(...latlngs);
        });
        if (allBounds.length > 0) window._dashRoutesMap.fitBounds(allBounds, { padding: [20, 20] });
        window._dashRoutesMap.invalidateSize();
      }, 120);
    }
  });
}

function dashRouteHighlight(routeId) {
  if (!window._dashRouteLines) return;
  Object.entries(window._dashRouteLines).forEach(function([id, line]) {
    line.setStyle({ weight: id === routeId ? 6 : 4, opacity: id === routeId ? 1 : 0.5 });
  });
  const line = window._dashRouteLines[routeId];
  if (line && window._dashRoutesMap) window._dashRoutesMap.fitBounds(line.getBounds(), { padding: [20, 20] });
}

function openRouteRecordModal() {
  const existing = document.getElementById('route-record-modal');
  if (existing) existing.remove();
  const lbl = currentLang==='ru' ? {
    title:'Записать маршрут', name:'Название маршрута', diff:'Сложность',
    start:'Начать запись', stop:'Остановить', save:'Сохранить маршрут', cancel:'Отмена',
    easy:'Лёгкий', medium:'Средний', hard:'Сложный', waiting:'Ожидание GPS...'
  } : currentLang==='en' ? {
    title:'Record Route', name:'Route Name', diff:'Difficulty',
    start:'Start Recording', stop:'Stop', save:'Save Route', cancel:'Cancel',
    easy:'Easy', medium:'Medium', hard:'Hard', waiting:'Waiting for GPS...'
  } : {
    title:'הקלט מסלול', name:'שם מסלול', diff:'רמת קושי',
    start:'התחל הקלטה', stop:'עצור', save:'שמור מסלול', cancel:'ביטול',
    easy:'קל', medium:'בינוני', hard:'קשה', waiting:'ממתין ל-GPS...'
  };
  const mo = document.createElement('div');
  mo.id = 'route-record-modal';
  mo.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9000;display:flex;align-items:flex-end;justify-content:center;';
  mo.innerHTML = `<div style="background:var(--card);border-radius:24px 24px 0 0;width:100%;max-width:520px;padding:24px 20px 32px;max-height:92vh;overflow-y:auto;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <span style="font-weight:800;font-size:1.1rem;">${lbl.title}</span>
      <button onclick="closeRouteRecordModal()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--muted);line-height:1;">×</button>
    </div>
    <div style="margin-bottom:14px;">
      <label style="font-size:0.72rem;font-weight:700;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:6px;">${lbl.name}</label>
      <input id="rr-name" type="text" placeholder="${lbl.name}" style="width:100%;box-sizing:border-box;padding:10px 14px;border:2px solid var(--border);border-radius:10px;font-size:0.9rem;background:var(--bg);color:var(--text);font-family:inherit;outline:none;"/>
    </div>
    <div style="margin-bottom:18px;">
      <label style="font-size:0.72rem;font-weight:700;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:8px;">${lbl.diff}</label>
      <div style="display:flex;gap:8px;">
        <button id="rr-diff-easy" onclick="selectRouteDiff('easy')" style="flex:1;padding:8px;border-radius:10px;border:2px solid #34a853;font-size:0.82rem;font-weight:700;cursor:pointer;background:transparent;color:#34a853;font-family:inherit;">${lbl.easy}</button>
        <button id="rr-diff-medium" onclick="selectRouteDiff('medium')" style="flex:1;padding:8px;border-radius:10px;border:2px solid #fbbc05;font-size:0.82rem;font-weight:700;cursor:pointer;background:#fbbc05;color:#000;font-family:inherit;">${lbl.medium}</button>
        <button id="rr-diff-hard" onclick="selectRouteDiff('hard')" style="flex:1;padding:8px;border-radius:10px;border:2px solid #ea4335;font-size:0.82rem;font-weight:700;cursor:pointer;background:transparent;color:#ea4335;font-family:inherit;">${lbl.hard}</button>
      </div>
    </div>
    <div id="rr-status" style="text-align:center;padding:8px;font-size:0.85rem;color:var(--muted);margin-bottom:12px;min-height:36px;"></div>
    <div id="rr-preview-map" style="height:200px;border-radius:12px;margin-bottom:16px;display:none;overflow:hidden;"></div>
    <div style="display:flex;gap:10px;">
      <button id="rr-start-btn" onclick="startGPSRecording()" style="flex:1;padding:12px;background:#1a73e8;color:#fff;border:none;border-radius:12px;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;">${lbl.start}</button>
      <button id="rr-stop-btn" onclick="stopGPSRecording()" style="flex:1;padding:12px;background:#ea4335;color:#fff;border:none;border-radius:12px;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;display:none;">${lbl.stop}</button>
      <button id="rr-save-btn" onclick="saveRecordedRoute()" style="flex:1;padding:12px;background:#34a853;color:#fff;border:none;border-radius:12px;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;display:none;">${lbl.save}</button>
    </div>
  </div>`;
  document.body.appendChild(mo);
  mo.addEventListener('click', function(e) { if (e.target === mo) closeRouteRecordModal(); });
  window._routeDiff = 'medium';
  window._routePoints = [];
  window._routeWatchId = null;
  window._routeLastTime = 0;
  window._routePreviewMap = null;
  window._routePreviewLine = null;
}

function selectRouteDiff(diff) {
  window._routeDiff = diff;
  const bg = { easy:'#34a853', medium:'#fbbc05', hard:'#ea4335' };
  ['easy','medium','hard'].forEach(function(d) {
    const btn = document.getElementById('rr-diff-'+d);
    if (!btn) return;
    btn.style.background = d === diff ? bg[d] : 'transparent';
    btn.style.color = d === diff ? (d==='medium'?'#000':'#fff') : bg[d];
  });
}

function startGPSRecording() {
  if (!navigator.geolocation) {
    notify(currentLang==='ru'?'GPS не поддерживается':currentLang==='en'?'GPS not supported':'GPS לא נתמך');
    return;
  }
  const statusEl = document.getElementById('rr-status');
  const startBtn = document.getElementById('rr-start-btn');
  const stopBtn  = document.getElementById('rr-stop-btn');
  if (statusEl) statusEl.textContent = currentLang==='ru'?'Ожидание GPS...':currentLang==='en'?'Waiting for GPS...':'ממתין ל-GPS...';
  if (startBtn) startBtn.style.display = 'none';
  if (stopBtn)  stopBtn.style.display = '';
  window._routePoints   = [];
  window._routeLastTime = 0;
  window._routeWatchId  = navigator.geolocation.watchPosition(function(pos) {
    const now = Date.now();
    if (now - window._routeLastTime < 5000) return;
    window._routeLastTime = now;
    const pt = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    window._routePoints.push(pt);
    const dist = calcRouteDist(window._routePoints);
    if (statusEl) statusEl.textContent = (currentLang==='ru'?'Запись... ':currentLang==='en'?'Recording... ':'מקליט... ') + window._routePoints.length + ' pts · ' + dist.toFixed(2) + ' km';
    const previewDiv = document.getElementById('rr-preview-map');
    if (previewDiv) {
      previewDiv.style.display = '';
      if (!window._routePreviewMap) {
        window._routePreviewMap = L.map('rr-preview-map', { zoomControl: false, dragging: false }).setView([pt.lat, pt.lng], 14);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '© CartoDB', maxZoom: 19 }).addTo(window._routePreviewMap);
      }
      window._routePreviewMap.setView([pt.lat, pt.lng], 14);
      if (window._routePreviewLine) window._routePreviewMap.removeLayer(window._routePreviewLine);
      if (window._routePoints.length > 1) {
        window._routePreviewLine = L.polyline(window._routePoints.map(function(p) { return [p.lat, p.lng]; }), { color:'#1a73e8', weight:4 }).addTo(window._routePreviewMap);
      }
    }
  }, function(err) {
    if (statusEl) statusEl.textContent = (currentLang==='ru'?'Ошибка GPS: ':currentLang==='en'?'GPS error: ':'שגיאת GPS: ') + err.message;
  }, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
}

function stopGPSRecording() {
  if (window._routeWatchId !== null) { navigator.geolocation.clearWatch(window._routeWatchId); window._routeWatchId = null; }
  const stopBtn = document.getElementById('rr-stop-btn');
  const saveBtn = document.getElementById('rr-save-btn');
  if (stopBtn) stopBtn.style.display = 'none';
  if (saveBtn) saveBtn.style.display = '';
  const statusEl = document.getElementById('rr-status');
  const pts = window._routePoints || [];
  if (statusEl) statusEl.textContent = (currentLang==='ru'?'Записано: ':currentLang==='en'?'Recorded: ':'הוקלטו: ') + pts.length + ' pts · ' + calcRouteDist(pts).toFixed(2) + ' km';
}

function calcRouteDist(pts) {
  if (!pts || pts.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const R = 6371;
    const dLat = (pts[i].lat - pts[i-1].lat) * Math.PI / 180;
    const dLng = (pts[i].lng - pts[i-1].lng) * Math.PI / 180;
    const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(pts[i-1].lat*Math.PI/180)*Math.cos(pts[i].lat*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
  return total;
}

function saveRecordedRoute() {
  const user = auth.currentUser;
  if (!user) return;
  const nameEl = document.getElementById('rr-name');
  const name = nameEl ? nameEl.value.trim() : '';
  if (!name) { notify(currentLang==='ru'?'Введите название маршрута':currentLang==='en'?'Enter route name':'הזן שם מסלול'); return; }
  let pts = window._routePoints || [];
  if (pts.length < 2) { notify(currentLang==='ru'?'Слишком мало точек GPS':currentLang==='en'?'Too few GPS points':'נקודות GPS לא מספיקות'); return; }
  if (pts.length > 300) {
    const step = Math.ceil(pts.length / 300);
    pts = pts.filter(function(_, i) { return i % step === 0; });
    pts.push(window._routePoints[window._routePoints.length - 1]);
  }
  const dist = parseFloat(calcRouteDist(pts).toFixed(2));
  const dur  = Math.round((pts.length * 5) / 60);
  const saveBtn = document.getElementById('rr-save-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '...'; }
  db.collection('routes').add({
    schoolId: user.uid, name: name, points: pts,
    distance: dist, duration: dur,
    difficulty: window._routeDiff || 'medium',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function() {
    notify(currentLang==='ru'?'Маршрут сохранён ✓':currentLang==='en'?'Route saved ✓':'המסלול נשמר ✓');
    closeRouteRecordModal();
    loadDashRoutes(user.uid);
  }).catch(function() {
    notify(currentLang==='ru'?'Ошибка сохранения':currentLang==='en'?'Save error':'שגיאה בשמירה');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = t.route_save||'Save'; }
  });
}

function closeRouteRecordModal() {
  if (window._routeWatchId !== null) { navigator.geolocation.clearWatch(window._routeWatchId); window._routeWatchId = null; }
  const mo = document.getElementById('route-record-modal');
  if (mo) mo.remove();
}

function deleteRoute(routeId) {
  if (!confirm(currentLang==='ru'?'Удалить маршрут?':currentLang==='en'?'Delete route?':'למחוק מסלול?')) return;
  const user = auth.currentUser;
  if (!user) return;
  db.collection('routes').doc(routeId).delete().then(function() {
    notify(currentLang==='ru'?'Маршрут удалён':currentLang==='en'?'Route deleted':'המסלול נמחק');
    loadDashRoutes(user.uid);
    const pg = document.getElementById('page-routes');
    if (pg && pg.classList.contains('active')) loadRoutesPage();
  });
}

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
window.removeDashInstructor = removeDashInstructor;
window.showDashInstrForm = showDashInstrForm;
window.saveDashPrice = saveDashPrice;
window.saveDashInstructor = saveDashInstructor;
window.cancelDashInstrForm = cancelDashInstrForm;
window.selectDashCarColor = selectDashCarColor;
window.selectDashTransmission = selectDashTransmission;
window.toggleDashLic = toggleDashLic;
window.onDashPhotoChange = onDashPhotoChange;
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
window.openMobileSettings = openMobileSettings;
window.closeMobileSettings = closeMobileSettings;
window.pickLangAndClose = pickLangAndClose;
window.setThemeAndClose = setThemeAndClose;
window.notify = notify;
window.escapeHtml = escapeHtml;
window.updateSidebarForSchool = updateSidebarForSchool;
window.loadDashboard = loadDashboard;
window.schoolCalNav = schoolCalNav;
window.schoolCalSelectDay = schoolCalSelectDay;
window.loadRoutesPage = loadRoutesPage;
window.openRouteRecordModal = openRouteRecordModal;
window.closeRouteRecordModal = closeRouteRecordModal;
window.selectRouteDiff = selectRouteDiff;
window.startGPSRecording = startGPSRecording;
window.stopGPSRecording = stopGPSRecording;
window.saveRecordedRoute = saveRecordedRoute;
window.deleteRoute = deleteRoute;
window.loadDashRoutes = loadDashRoutes;
window.dashRouteHighlight = dashRouteHighlight;
window.uploadSchoolPhoto = uploadSchoolPhoto;

