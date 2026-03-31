export const S = {
  speed: (n) => `<svg width="110" height="110" viewBox="0 0 110 110"><circle cx="55" cy="55" r="52" fill="white" stroke="#e74c3c" stroke-width="9"/><text x="55" y="70" text-anchor="middle" font-size="${n>=100?34:40}" font-weight="900" font-family="Arial" fill="#222">${n}</text></svg>`,
  stop: () => `<svg width="110" height="110" viewBox="0 0 110 110"><polygon points="32,3 78,3 107,32 107,78 78,107 32,107 3,78 3,32" fill="#c0392b"/><text x="55" y="67" text-anchor="middle" font-size="22" font-weight="900" font-family="Arial" fill="white">STOP</text></svg>`,
  yield: () => `<svg width="110" height="110" viewBox="0 0 110 110"><polygon points="55,105 4,12 106,12" fill="white" stroke="#e74c3c" stroke-width="9"/><polygon points="55,88 18,22 92,22" fill="white"/></svg>`,
  noEntry: () => `<svg width="110" height="110" viewBox="0 0 110 110"><circle cx="55" cy="55" r="52" fill="#c0392b"/><rect x="14" y="43" width="82" height="24" rx="4" fill="white"/></svg>`,
  warning: (txt) => `<svg width="110" height="110" viewBox="0 0 110 110"><polygon points="55,5 107,100 3,100" fill="#f39c12" stroke="#222" stroke-width="3"/><text x="55" y="90" text-anchor="middle" font-size="52" font-weight="900" font-family="Arial" fill="#222">${txt}</text></svg>`,
  priority: () => `<svg width="110" height="110" viewBox="0 0 110 110"><rect x="13" y="13" width="84" height="84" fill="#f39c12" rx="4" transform="rotate(45 55 55)"/><rect x="22" y="22" width="66" height="66" fill="white" rx="3" transform="rotate(45 55 55)"/></svg>`,
  noOvertake: () => `<svg width="110" height="110" viewBox="0 0 110 110"><circle cx="55" cy="55" r="52" fill="white" stroke="#e74c3c" stroke-width="9"/><text x="36" y="68" text-anchor="middle" font-size="28" fill="#222">🚗</text><text x="72" y="60" text-anchor="middle" font-size="22" fill="#222">🚗</text><line x1="8" y1="100" x2="100" y2="8" stroke="#e74c3c" stroke-width="9"/></svg>`,
  parking: (cross) => `<svg width="110" height="110" viewBox="0 0 110 110"><rect x="3" y="3" width="104" height="104" rx="10" fill="${cross?'#e74c3c':'#1a73e8'}"/><text x="55" y="78" text-anchor="middle" font-size="72" font-weight="900" font-family="Arial" fill="white">P</text>${cross?'<line x1="10" y1="100" x2="100" y2="10" stroke="white" stroke-width="9"/><line x1="10" y1="10" x2="100" y2="100" stroke="white" stroke-width="9"/>':''}</svg>`,
  light: (top,mid,bot) => `<svg width="70" height="140" viewBox="0 0 70 140"><rect x="5" y="5" width="60" height="130" rx="12" fill="#333"/><circle cx="35" cy="30" r="20" fill="${top}"/><circle cx="35" cy="70" r="20" fill="${mid}"/><circle cx="35" cy="110" r="20" fill="${bot}"/></svg>`,
  scene: (emoji, txt) => `<div style="text-align:center"><div style="font-size:4rem;margin-bottom:10px">${emoji}</div><div style="font-size:0.9rem;color:#555;max-width:240px;margin:0 auto;line-height:1.5">${txt}</div></div>`,
};

export const catCfg = {
  speed:      { icon:'⚡', bg:'#fdecea', color:'#c0392b', he:'מגבלות מהירות', ru:'Скорость', en:'Speed Limits' },
  signs:      { icon:'🔵', bg:'#e8f0fe', color:'#1a73e8', he:'תמרורים',       ru:'Знаки',    en:'Road Signs' },
  priority:   { icon:'⚠️', bg:'#fff8e1', color:'#e67e22', he:'זכות קדימה',   ru:'Приоритет',en:'Right of Way' },
  safety:     { icon:'🛡️', bg:'#e8f5e9', color:'#27ae60', he:'בטיחות',        ru:'Безопасность', en:'Safety' },
  parking:    { icon:'🅿️', bg:'#e3f2fd', color:'#1565c0', he:'חניה',          ru:'Парковка',  en:'Parking' },
  lights:     { icon:'💡', bg:'#fff3e0', color:'#e65100', he:'תאורה',          ru:'Освещение', en:'Lights' },
  overtaking: { icon:'↔️', bg:'#f3e5f5', color:'#7b1fa2', he:'עקיפה',         ru:'Обгон',     en:'Overtaking' },
  pedestrian: { icon:'🚶', bg:'#e0f7fa', color:'#00838f', he:'הולכי רגל',     ru:'Пешеходы',  en:'Pedestrians' },
};

export const cityRegionMap = {
  'חיפה':'north','נצרת':'north','טבריה':'north',
  'תל אביב':'center','ירושלים':'center','ראשון לציון':'center',
  'פתח תקווה':'center','הרצליה':'center','חולון':'center',
  'בת ים':'center','רחובות':'center','כפר סבא':'center','מודיעין':'center','בני ברק':'center',
  'באר שבע':'south','אשדוד':'south','אשקלון':'south','אילת':'south'
};
