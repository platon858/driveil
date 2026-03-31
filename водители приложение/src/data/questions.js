import { S } from './signs.js';

export const questions = [
  // ── SPEED ──
  {cat:'speed', sign:S.speed(50),
    he:{q:'מהי המהירות המרבית המותרת לנסיעה בתוך אזור עירוני?', answers:['40 קמ"ש','50 קמ"ש','60 קמ"ש','70 קמ"ש'], correct:1, explain:'בתוך עיר מותר לנסוע עד 50 קמ"ש, אלא אם כן שלט מהירות אחר מוצב בדרך.'},
    ru:{q:'Какова максимально допустимая скорость в черте города?', answers:['40 км/ч','50 км/ч','60 км/ч','70 км/ч'], correct:1, explain:'В городе разрешена скорость до 50 км/ч, если не установлен иной знак ограничения скорости.'},
    en:{q:'What is the maximum permitted speed inside an urban area?', answers:['40 km/h','50 km/h','60 km/h','70 km/h'], correct:1, explain:'The speed limit inside a city is 50 km/h unless a different sign is posted.'}},

  {cat:'speed', sign:S.speed(90),
    he:{q:'מהי המהירות המרבית בכביש בין-עירוני שאינו כביש מהיר?', answers:['80 קמ"ש','90 קמ"ש','100 קמ"ש','110 קמ"ש'], correct:1, explain:'בכביש בין-עירוני רגיל (שאינו כביש מהיר) ניתן לנסוע עד 90 קמ"ש.'},
    ru:{q:'Максимальная скорость на межгородской дороге (не шоссе)?', answers:['80 км/ч','90 км/ч','100 км/ч','110 км/ч'], correct:1, explain:'На обычной межгородской дороге (не скоростном шоссе) разрешено ехать до 90 км/ч.'},
    en:{q:'Maximum speed on an inter-urban road (not a highway)?', answers:['80 km/h','90 km/h','100 km/h','110 km/h'], correct:1, explain:'On a regular inter-urban road (not a motorway), the limit is 90 km/h.'}},

  {cat:'speed', sign:S.speed(110),
    he:{q:'מהי המהירות המרבית המותרת בכביש מהיר בין-עירוני?', answers:['90 קמ"ש','100 קמ"ש','110 קמ"ש','120 קמ"ש'], correct:2, explain:'בכביש מהיר בין-עירוני המהירות המרבית היא 110 קמ"ש.'},
    ru:{q:'Максимальная скорость на скоростном межгородском шоссе?', answers:['90 км/ч','100 км/ч','110 км/ч','120 км/ч'], correct:2, explain:'На скоростном межгородском шоссе максимальная скорость составляет 110 км/ч.'},
    en:{q:'Maximum speed on an inter-urban motorway (kvish mahir)?', answers:['90 km/h','100 km/h','110 km/h','120 km/h'], correct:2, explain:'On an inter-urban motorway the maximum speed is 110 km/h.'}},

  {cat:'speed', sign:S.speed(30),
    he:{q:'מהי המהירות המרבית ליד בית ספר כאשר שלט האזהרה מהבהב?', answers:['20 קמ"ש','30 קמ"ש','40 קמ"ש','50 קמ"ש'], correct:1, explain:'כאשר שלט האזהרה ליד בית הספר מהבהב יש לנסוע בלא יותר מ-30 קמ"ש.'},
    ru:{q:'Максимальная скорость вблизи школы, когда мигает предупреждающий знак?', answers:['20 км/ч','30 км/ч','40 км/ч','50 км/ч'], correct:1, explain:'Когда мигает предупреждающий знак у школы, разрешено ехать не более 30 км/ч.'},
    en:{q:'Max speed near a school when the warning sign is flashing?', answers:['20 km/h','30 km/h','40 km/h','50 km/h'], correct:1, explain:'When the school warning sign is flashing, you must not exceed 30 km/h.'}},

  // ── SIGNS ──
  {cat:'signs', sign:S.stop(),
    he:{q:'מה משמעות תמרור זה?', answers:['תן זכות קדימה','עצור לחלוטין','צמצם מהירות','כביש ראשי'], correct:1, explain:'תמרור "עצור" מחייב עצירה מוחלטת בקו העצירה לפני הצטלבות, גם אם הדרך נראית פנויה.'},
    ru:{q:'Что означает этот знак?', answers:['Уступить дорогу','Полная остановка','Снизить скорость','Главная дорога'], correct:1, explain:'Знак "STOP" обязывает к полной остановке перед линией стоп, даже если дорога кажется свободной.'},
    en:{q:'What does this sign mean?', answers:['Give way','Come to a complete stop','Reduce speed','Main road'], correct:1, explain:'A STOP sign requires a complete stop at the stop line before the intersection, even if the road appears clear.'}},

  {cat:'signs', sign:S.yield(),
    he:{q:'מה צורתו של תמרור "תן זכות קדימה"?', answers:['משולש אדום הפוך','עיגול אדום','משושה אדום','מלבן כחול'], correct:0, explain:'תמרור "תן זכות קדימה" הוא משולש לבן עם מסגרת אדומה, כשהוא הפוך (קודקוד למטה).'},
    ru:{q:'Какова форма знака "Уступите дорогу"?', answers:['Перевёрнутый красный треугольник','Красный круг','Красный шестиугольник','Синий прямоугольник'], correct:0, explain:'Знак "Уступите дорогу" — белый треугольник с красной каймой, перевёрнутый (вершиной вниз).'},
    en:{q:'What shape is the "Give Way" (Yield) sign?', answers:['Inverted red triangle','Red circle','Red hexagon','Blue rectangle'], correct:0, explain:'The Give Way sign is a white triangle with a red border, pointing downward (inverted).'}},

  {cat:'signs', sign:S.noEntry(),
    he:{q:'מה משמעות תמרור זה?', answers:['חניה אסורה','כניסה אסורה','כביש חד סטרי','עצור'], correct:1, explain:'תמרור "כניסה אסורה" — עיגול אדום עם מלבן לבן — אוסר כניסה לכיוון זה.'},
    ru:{q:'Что означает этот знак?', answers:['Стоянка запрещена','Въезд запрещён','Одностороннее движение','Стоп'], correct:1, explain:'Знак "Въезд запрещён" — красный круг с белой горизонтальной полосой — запрещает въезд в данном направлении.'},
    en:{q:'What does this sign mean?', answers:['No parking','No entry','One-way road','Stop'], correct:1, explain:'The No Entry sign — a red circle with a white horizontal bar — prohibits vehicles from entering in that direction.'}},

  {cat:'signs', sign:S.warning('!'),
    he:{q:'איזו צורה יש לתמרורי אזהרה?', answers:['עיגול אדום','משולש צהוב','מלבן כחול','משושה אדום'], correct:1, explain:'תמרורי אזהרה הם בצורת משולש צהוב עם מסגרת שחורה. הם מזהירים מסכנות בדרך.'},
    ru:{q:'Какую форму имеют предупреждающие знаки?', answers:['Красный круг','Жёлтый треугольник','Синий прямоугольник','Красный шестиугольник'], correct:1, explain:'Предупреждающие знаки имеют форму жёлтого треугольника с чёрной каймой и предупреждают об опасностях на дороге.'},
    en:{q:'What shape are warning road signs?', answers:['Red circle','Yellow triangle','Blue rectangle','Red hexagon'], correct:1, explain:'Warning signs are yellow triangles with a black border. They warn of hazards ahead.'}},

  {cat:'signs', sign:S.priority(),
    he:{q:'מה משמעות תמרור זה (מעוין צהוב-לבן)?', answers:['תן זכות קדימה','כביש ראשי — לך יש עדיפות','חניה מותרת','כביש אחד סטרי'], correct:1, explain:'תמרור "כביש ראשי" (מעוין צהוב ולבן) מציין שלרכבים בכביש זה יש זכות קדימה על פני הנכנסים מהצד.'},
    ru:{q:'Что означает этот знак (жёлто-белый ромб)?', answers:['Уступите дорогу','Главная дорога — у вас приоритет','Парковка разрешена','Одностороннее движение'], correct:1, explain:'Знак "Главная дорога" (жёлто-белый ромб) означает, что у водителей на этой дороге приоритет перед въезжающими с боковых дорог.'},
    en:{q:'What does this sign mean (yellow-white diamond)?', answers:['Give way','Main road — you have priority','Parking allowed','One-way road'], correct:1, explain:'The "Main Road" sign (yellow-white diamond) means vehicles on this road have priority over those entering from side roads.'}},

  {cat:'signs', sign:S.noOvertake(),
    he:{q:'מה משמעות תמרור זה?', answers:['חניה אסורה','עקיפה אסורה','כניסה אסורה','נסיעה אסורה'], correct:1, explain:'תמרור "עקיפה אסורה" — עיגול עם שני כלי רכב וקו אלכסוני אדום — אוסר לעקוף כלי רכב נוסעים אחרים.'},
    ru:{q:'Что означает этот знак?', answers:['Стоянка запрещена','Обгон запрещён','Въезд запрещён','Движение запрещено'], correct:1, explain:'Знак "Обгон запрещён" — круг с двумя автомобилями и красной диагональной линией — запрещает обгон других транспортных средств.'},
    en:{q:'What does this sign mean?', answers:['No parking','No overtaking','No entry','No driving'], correct:1, explain:'The "No Overtaking" sign — a circle with two cars and a red diagonal line — prohibits overtaking other vehicles.'}},

  // ── PRIORITY / RIGHT OF WAY ──
  {cat:'priority', sign:S.scene('🚏🚗','הגעת לצומת עם שלט "עצור". מה עליך לעשות?'),
    he:{q:'הגעת לצומת עם תמרור "עצור". מה עליך לעשות?', answers:['האט ועבור אם הדרך פנויה','עצור לחלוטין, הבטח שהדרך פנויה, ואז המשך','צפור ועבור','עבור מהר'], correct:1, explain:'בתמרור "עצור" חובה לעצור עצירה מוחלטת בקו העצירה, לבדוק שהדרך פנויה לחלוטין, ורק אז להמשיך.'},
    ru:{q:'Вы подъехали к перекрёстку со знаком "STOP". Что делать?', answers:['Притормозить и проехать если путь свободен','Полностью остановиться, убедиться что дорога свободна, затем продолжить','Посигналить и проехать','Проехать быстро'], correct:1, explain:'При знаке STOP необходимо полностью остановиться на стоп-линии, убедиться что дорога свободна, и только потом продолжить движение.'},
    en:{q:'You reach an intersection with a STOP sign. What must you do?', answers:['Slow down and proceed if clear','Come to a complete stop, check the road is clear, then proceed','Honk and go','Go quickly'], correct:1, explain:'At a STOP sign you must come to a complete stop at the stop line, ensure the road is fully clear, and only then proceed.'}},

  {cat:'priority', sign:S.scene('🔄🚗','ניגשת לכיכר. מי קודם?'),
    he:{q:'ניגשת לכיכר תנועה. מי בעל זכות הקדימה?', answers:['הרכב הנכנס לכיכר','הרכב שכבר נמצא בכיכר','הרכב הגדול יותר','הרכב מצד ימין'], correct:1, explain:'ברוב הכיכרות בישראל, לרכבים הנמצאים כבר בתוך הכיכר יש זכות קדימה על פני הרכבים הנכנסים אליה.'},
    ru:{q:'Вы подъезжаете к кольцевому перекрёстку. Кто имеет приоритет?', answers:['Въезжающий автомобиль','Автомобиль уже на кольце','Более крупный автомобиль','Автомобиль справа'], correct:1, explain:'На большинстве кольцевых перекрёстков в Израиле приоритет имеют автомобили, уже находящиеся на кольце.'},
    en:{q:'You approach a roundabout. Who has right of way?', answers:['The vehicle entering','The vehicle already on the roundabout','The larger vehicle','The vehicle on the right'], correct:1, explain:'On most roundabouts in Israel, vehicles already on the roundabout have priority over those entering.'}},

  {cat:'priority', sign:S.scene('🚑💨','אמבולנס מתקרב עם אורות וסירנה. מה עליך לעשות?'),
    he:{q:'רכב חירום מתקרב עם אורות מהבהבים וצופר. מה עליך לעשות?', answers:['להמשיך בנסיעה רגילה','לעצור מיד בכל מקום','לפנות לצד ימין ולתת לו לעבור','לצפור בחזרה'], correct:2, explain:'כאשר רכב חירום מתקרב, יש לפנות לצד הדרך (בדרך כלל לצד ימין), לעצור אם צריך, ולאפשר לרכב החירום לעבור.'},
    ru:{q:'Приближается машина экстренных служб с мигалками и сиреной. Что делать?', answers:['Продолжать движение','Немедленно остановиться где угодно','Уступить дорогу, прижавшись вправо','Посигналить в ответ'], correct:2, explain:'Когда приближается машина экстренных служб, нужно прижаться к правому краю дороги, при необходимости остановиться и дать проехать.'},
    en:{q:'An emergency vehicle approaches with flashing lights and siren. What should you do?', answers:['Continue normally','Stop immediately anywhere','Pull to the right side and let it pass','Honk back'], correct:2, explain:'When an emergency vehicle approaches, pull to the right side, stop if necessary, and allow the emergency vehicle to pass.'}},

  // ── SAFETY ──
  {cat:'safety', sign:S.scene('🚗↔️🚗','מרחק בטוח בנסיעה'),
    he:{q:'מהו המרחק הבטוח המינימלי מהרכב שלפניך בתוך עיר?', answers:['כ-1 שניה','כ-2 שניות','כ-3 שניות','כ-5 שניות'], correct:1, explain:'בתוך עיר, יש לשמור על מרחק של לפחות 2 שניות מהרכב שלפניך. בכביש מהיר — לפחות 3 שניות.'},
    ru:{q:'Какова минимальная безопасная дистанция до впереди едущего автомобиля в городе?', answers:['Около 1 секунды','Около 2 секунд','Около 3 секунд','Около 5 секунд'], correct:1, explain:'В городе необходимо соблюдать дистанцию не менее 2 секунд. На шоссе — не менее 3 секунд.'},
    en:{q:'What is the minimum safe following distance in a city?', answers:['About 1 second','About 2 seconds','About 3 seconds','About 5 seconds'], correct:1, explain:'Inside a city, maintain at least 2 seconds following distance. On a motorway — at least 3 seconds.'}},

  {cat:'safety', sign:S.scene('🌧️🚗','גשם כבד. איך לנהוג?'),
    he:{q:'בגשם כבד, כיצד יש לנהוג ביחס למרחק הבטוח?', answers:['להקטין את המרחק','להשאיר מרחק זהה','להגדיל את המרחק','אין חשיבות למרחק בגשם'], correct:2, explain:'בתנאי מזג אוויר גרועים (גשם, ערפל, שלג) יש להגדיל משמעותית את המרחק הבטוח, שכן הבלימה ארוכה יותר.'},
    ru:{q:'В сильный дождь как нужно изменить дистанцию до впереди едущего?', answers:['Уменьшить дистанцию','Оставить ту же дистанцию','Увеличить дистанцию','В дождь дистанция не важна'], correct:2, explain:'В плохую погоду (дождь, туман, снег) необходимо значительно увеличить дистанцию, так как тормозной путь становится длиннее.'},
    en:{q:'In heavy rain, how should you adjust your following distance?', answers:['Reduce it','Keep the same','Increase it','Distance is irrelevant in rain'], correct:2, explain:'In bad weather (rain, fog, snow) you must significantly increase your following distance, as braking distances are much longer.'}},

  {cat:'safety', sign:S.scene('🍺🚗','אלכוהול וכלי רכב'),
    he:{q:'מהי רמת האלכוהול המרבית המותרת בדם לנהג רגיל (ניסיון של מעל 3 שנים)?', answers:['0 מ"ג/מ"ל','0.3 מ"ג/מ"ל','0.5 מ"ג/מ"ל','1.0 מ"ג/מ"ל'], correct:2, explain:'לנהג רגיל (מעל 3 שנות ניסיון) המגבלה היא 0.5 מ"ג לכל מ"ל דם. לנהגים חדשים (רישיון ירוק), נהגי הסעה ורוכבי אופנועים — 0 מ"ג/מ"ל.'},
    ru:{q:'Максимально допустимый уровень алкоголя в крови для опытного водителя (стаж более 3 лет)?', answers:['0 мг/мл','0.3 мг/мл','0.5 мг/мл','1.0 мг/мл'], correct:2, explain:'Для опытного водителя (стаж более 3 лет) допустимо до 0.5 мг/мл. Для новичков (зелёные права), водителей такси и мотоциклистов — 0 мг/мл.'},
    en:{q:'Max permitted blood alcohol level for an experienced driver (over 3 years)?', answers:['0 mg/ml','0.3 mg/ml','0.5 mg/ml','1.0 mg/ml'], correct:2, explain:'For an experienced driver (over 3 years) the limit is 0.5 mg/ml. For new drivers (green licence), taxi drivers and motorcyclists — 0 mg/ml.'}},

  {cat:'safety', sign:S.scene('💺🔒','חגורת בטיחות'),
    he:{q:'מי חייב לחגור חגורת בטיחות ברכב?', answers:['רק הנהג','הנהג והנוסע הקדמי','כל הנוסעים בכל המושבים','רק ילדים'], correct:2, explain:'כל הנוסעים ברכב — בשורה הקדמית ובשורות האחוריות — חייבים לחגור חגורת בטיחות בזמן הנסיעה.'},
    ru:{q:'Кто обязан пристёгиваться ремнём безопасности?', answers:['Только водитель','Водитель и передний пассажир','Все пассажиры на всех сиденьях','Только дети'], correct:2, explain:'Все пассажиры в автомобиле — на передних и задних сиденьях — обязаны пристёгиваться ремнём безопасности.'},
    en:{q:'Who must wear a seatbelt in a vehicle?', answers:['Driver only','Driver and front passenger','All passengers on all seats','Children only'], correct:2, explain:'All occupants of a vehicle — front and rear — are required to wear a seatbelt while the vehicle is in motion.'}},

  {cat:'safety', sign:S.scene('📱🚗','טלפון נייד בנהיגה'),
    he:{q:'האם מותר להשתמש בטלפון נייד בזמן נהיגה?', answers:['כן, תמיד','כן, רק בעצירה','לא, אסור לחלוטין (אלא דיבורית)','כן, רק בכביש ישר'], correct:2, explain:'חל איסור מוחלט להחזיק טלפון נייד בזמן נהיגה. שימוש בדיבורית (ידיים חופשיות) מותר.'},
    ru:{q:'Разрешено ли пользоваться мобильным телефоном во время движения?', answers:['Да, всегда','Да, только на остановке','Нет, категорически запрещено (кроме громкой связи)','Да, только на прямой дороге'], correct:2, explain:'Держать мобильный телефон во время езды категорически запрещено. Использование громкой связи (hands-free) разрешено.'},
    en:{q:'Is it permitted to use a mobile phone while driving?', answers:['Yes, always','Yes, only when stopped','No, strictly prohibited (hands-free allowed)','Yes, only on straight roads'], correct:2, explain:'Holding a mobile phone while driving is strictly prohibited. Using a hands-free device is permitted.'}},

  {cat:'safety', sign:S.scene('💥🚗','פנצ\'ר בנסיעה'),
    he:{q:'התפוצץ לך צמיג בזמן נסיעה. מה עליך לעשות?', answers:['לבלום בחוזקה מיד','לאחוז בהגה בנחישות, לאפשר לרכב להאט בהדרגה ולהתמקם בצד','לסובב את ההגה בכוח לצד','להאיץ כדי לשלוט ברכב'], correct:1, explain:'בפנצ\'ר יש לאחוז בהגה בשתי ידיים, לא לבלום בפתאומיות, לאפשר לרכב להאט מעצמו ולהתמקם בצד הדרך בהדרגה.'},
    ru:{q:'У вас лопнула шина во время движения. Что делать?', answers:['Немедленно резко тормозить','Крепко держать руль, дать машине плавно замедлиться и перестроиться на обочину','Резко повернуть руль в сторону','Ускориться чтобы сохранить контроль'], correct:1, explain:'При пробое шины нужно крепко держать руль двумя руками, не тормозить резко, дать машине плавно замедлиться и аккуратно переместиться на обочину.'},
    en:{q:'A tyre blows out while driving. What should you do?', answers:['Brake hard immediately','Grip the wheel firmly, let the car slow gradually and steer to the side','Turn the wheel sharply to one side','Accelerate to regain control'], correct:1, explain:'With a blowout, grip the wheel firmly with both hands, do not brake suddenly, allow the car to slow on its own, and gradually steer to the side of the road.'}},

  // ── PARKING ──
  {cat:'parking', sign:S.scene('🚒🚗','חניה ליד ברז כיבוי אש'),
    he:{q:'מהו המרחק המינימלי האסור לחניה מברז כיבוי אש?', answers:['3 מטר','5 מטר','8 מטר','12 מטר'], correct:2, explain:'אסור לחנות במרחק של פחות מ-8 מטר מברז כיבוי אש, על מנת לאפשר גישה לכוחות הכיבוי.'},
    ru:{q:'Какое минимальное расстояние до пожарного гидранта запрещено для парковки?', answers:['3 метра','5 метров','8 метров','12 метров'], correct:2, explain:'Парковка ближе 8 метров от пожарного гидранта запрещена, чтобы обеспечить доступ пожарным.'},
    en:{q:'Minimum distance from a fire hydrant where parking is prohibited?', answers:['3 metres','5 metres','8 metres','12 metres'], correct:2, explain:'Parking within 8 metres of a fire hydrant is prohibited in order to allow fire services access.'}},

  {cat:'parking', sign:S.scene('🏔️🚗','חניה בירידה'),
    he:{q:'חונה ברכב בירידה ללא מדרכה. לאיזה כיוון יש להפנות את הגלגלים?', answers:['לכיוון האמצע','לכיוון שפת הכביש','ישר קדימה','לכיוון הגבעה'], correct:1, explain:'בחניה בירידה ללא מדרכה יש לכוון את ההגה לכיוון שפת הכביש, כך שאם ינותק הבלם הרכב ייסחף לצד ולא ייגלל לכביש.'},
    ru:{q:'Вы паркуете машину под уклон без бордюра. В какую сторону нужно повернуть колёса?', answers:['К середине дороги','К краю дороги','Прямо','К склону/горке'], correct:1, explain:'При парковке под уклон без бордюра нужно повернуть колёса к краю дороги, чтобы при отказе тормоза машина не покатилась на дорогу.'},
    en:{q:'You park on a downhill slope with no kerb. Which way should you turn the wheels?', answers:['Toward the centre','Toward the road edge','Straight ahead','Toward the slope'], correct:1, explain:'When parking downhill without a kerb, turn the wheels toward the road edge so that if the brake fails, the car rolls off the road rather than into traffic.'}},

  // ── LIGHTS ──
  {cat:'lights', sign:S.light('#e74c3c','#aaa','#aaa'),
    he:{q:'מתי חובה להשתמש באורות ערפל קדמיים?', answers:['בכל לילה','בערפל צפוף או גשם כבד שבהם הנראות נמוכה מ-150 מטר','בכל גשם','בכניסה למנהרה'], correct:1, explain:'מותר להשתמש באורות ערפל קדמיים רק בערפל, גשם כבד, ואבק שבהם הנראות נמוכה מ-150 מטר. שימוש שלא לצורך — אסור.'},
    ru:{q:'Когда обязательно использовать передние противотуманные фары?', answers:['Каждую ночь','В густом тумане или ливне при видимости менее 150 м','При любом дожде','При въезде в тоннель'], correct:1, explain:'Передние противотуманные фары разрешено использовать только в туман, сильный дождь или пыль, когда видимость менее 150 м. Использование без необходимости запрещено.'},
    en:{q:'When must you use front fog lights?', answers:['Every night','In dense fog or heavy rain when visibility is under 150 m','In any rain','When entering a tunnel'], correct:1, explain:'Front fog lights may only be used in fog, heavy rain or dust when visibility is below 150 m. Using them unnecessarily is prohibited.'}},

  {cat:'lights', sign:S.light('#aaa','#aaa','#2ecc71'),
    he:{q:'מתי חובה לעבור מאורות גבוהים לאורות נמוכים?', answers:['בכניסה לעיר','כאשר רכב בא לקראתך במרחק של עד 150 מטר','רק כשמנהל אומר','בכביש ישר'], correct:1, explain:'יש לעבור לאורות נמוכים כאשר רכב נוסע לקראתך במרחק של עד 150 מ\', או כאשר אתה עוקב אחרי רכב במרחק של עד 75 מ\'.'},
    ru:{q:'Когда нужно переключиться с дальнего света на ближний?', answers:['При въезде в город','Когда встречная машина на расстоянии 150 м или менее','Только по указанию','На прямой дороге'], correct:1, explain:'Нужно переключиться на ближний свет, когда встречный автомобиль находится в 150 м и менее, или вы едете сзади автомобиля в 75 м и менее.'},
    en:{q:'When must you switch from high beam to low beam?', answers:['When entering a city','When an oncoming vehicle is within 150 m','Only when told','On a straight road'], correct:1, explain:'Switch to low beam when an oncoming vehicle is within 150 m, or when following a vehicle within 75 m.'}},

  {cat:'lights', sign:S.scene('⚠️🚗','אורות חירום (מאצלים)'),
    he:{q:'מתי מותר להפעיל אורות חירום (מאצלים)?', answers:['בכל עת שרוצים','כאשר הרכב מתקלקל ועוצר בדרך, או במצב חירום','בנסיעה איטית','בעת חנייה בכפל חניה'], correct:1, explain:'אורות חירום (מאצלים) מיועדים לשימוש כאשר הרכב עוצר עקב תקלה, תאונה, או מצב חירום בדרך.'},
    ru:{q:'Когда разрешено включать аварийную сигнализацию?', answers:['В любое время','Когда машина сломалась или остановилась на дороге, или в экстренной ситуации','При медленной езде','При двойной парковке'], correct:1, explain:'Аварийная сигнализация предназначена для использования, когда автомобиль останавливается из-за поломки, аварии или чрезвычайной ситуации на дороге.'},
    en:{q:'When are you permitted to use hazard warning lights?', answers:['Whenever you like','When the vehicle breaks down or stops on the road, or in an emergency','When driving slowly','When double parking'], correct:1, explain:'Hazard lights are for use when a vehicle stops due to a breakdown, accident or road emergency.'}},

  // ── OVERTAKING ──
  {cat:'overtaking', sign:S.scene('➡️🚗🚗','עקיפה: מה מותר?'),
    he:{q:'מאיזה צד מותר לעקוף רכב בדרך רגילה?', answers:['מצד ימין','מצד שמאל','משני הצדדים','לא מותר לעקוף'], correct:1, explain:'עקיפה מותרת מצד שמאל בלבד. עקיפה מצד ימין מותרת רק במקרים חריגים (למשל רכב הפונה שמאלה).'},
    ru:{q:'С какой стороны разрешено обгонять на обычной дороге?', answers:['Справа','Слева','С обеих сторон','Обгон запрещён'], correct:1, explain:'Обгон разрешён только с левой стороны. Обгон справа допускается лишь в исключительных случаях (например, когда автомобиль впереди поворачивает налево).'},
    en:{q:'On which side may you overtake on a normal road?', answers:['On the right','On the left','Either side','Overtaking is not allowed'], correct:1, explain:'Overtaking is permitted on the left only. Overtaking on the right is allowed only in exceptional cases (e.g. the vehicle ahead is turning left).'}},

  {cat:'overtaking', sign:S.scene('━━━🚗','קו מרכזי רציף'),
    he:{q:'מה הוראת קו מרכזי רציף (מלא) בכביש?', answers:['מותר לחצות אותו בכל עת','אסור לחצות אותו (עקיפה אסורה)','חצייה מותרת בלבד בלילה','רק לרכב כבד אסור לחצות'], correct:1, explain:'קו מרכזי רציף (מלא) אוסר לחצות לצד הנגדי. אסור לבצע עקיפה באזורים אלה.'},
    ru:{q:'Что означает сплошная центральная линия на дороге?', answers:['Можно пересекать в любое время','Пересекать запрещено (обгон запрещён)','Пересечение разрешено только ночью','Запрещено только для грузовиков'], correct:1, explain:'Сплошная центральная линия запрещает пересечение на противоположную сторону. Обгон в таких зонах запрещён.'},
    en:{q:'What does a solid (continuous) centre line on the road mean?', answers:['May be crossed at any time','Must not be crossed (no overtaking)','May be crossed at night only','Forbidden only for heavy vehicles'], correct:1, explain:'A solid centre line prohibits crossing to the opposite side of the road. Overtaking is not permitted in these zones.'}},

  // ── PEDESTRIANS ──
  {cat:'pedestrian', sign:S.scene('🚶‍♂️⬜🚗','מעבר חצייה'),
    he:{q:'הולך רגל נמצא על מעבר חצייה. מה עליך לעשות?', answers:['להמשיך — הולך הרגל יחכה','לצפור ולעבור','לעצור ולתת לו לעבור','להאיץ ולחמוק'], correct:2, explain:'כאשר הולך רגל נמצא על מעבר חצייה (זברה), חובה לעצור ולאפשר לו לעבור את הכביש בבטחה.'},
    ru:{q:'Пешеход находится на пешеходном переходе. Что нужно сделать?', answers:['Продолжить — пешеход подождёт','Посигналить и проехать','Остановиться и пропустить его','Ускориться и объехать'], correct:2, explain:'Когда пешеход находится на пешеходном переходе (зебре), водитель обязан остановиться и дать пешеходу безопасно перейти дорогу.'},
    en:{q:'A pedestrian is on a zebra crossing. What must you do?', answers:['Continue — the pedestrian will wait','Honk and go','Stop and let them cross','Accelerate and swerve'], correct:2, explain:'When a pedestrian is on a pedestrian crossing (zebra), you must stop and allow them to cross the road safely.'}},

  {cat:'pedestrian', sign:S.scene('👶🚗','ילד קרוב לכביש'),
    he:{q:'ילד עומד ליד שפת הכביש ונראה שהוא עומד לחצות. מה עליך לעשות?', answers:['להמשיך בנסיעה רגילה','להאיץ כדי לעבור לפניו','להאט מאוד, להיות מוכן לעצור ולתת לו לעבור','לצפור ולהמשיך'], correct:2, explain:'ילדים קרובים לכביש דורשים זהירות מיוחדת. יש להאט מאוד ולהיות מוכן לעצור, גם אם הילד עדיין לא על הכביש.'},
    ru:{q:'Ребёнок стоит у края дороги и, похоже, собирается перейти. Что нужно сделать?', answers:['Продолжать движение в обычном темпе','Ускориться чтобы проехать перед ним','Значительно замедлиться, быть готовым остановиться и пропустить','Посигналить и продолжить'], correct:2, explain:'Дети вблизи дороги требуют особой осторожности. Нужно сильно замедлиться и быть готовым остановиться, даже если ребёнок ещё не вышел на дорогу.'},
    en:{q:'A child is near the road edge and appears about to cross. What should you do?', answers:['Continue at normal speed','Accelerate to pass before them','Slow significantly, be ready to stop and let them cross','Honk and continue'], correct:2, explain:'Children near the road require special caution. Slow significantly and be prepared to stop, even if the child has not yet stepped onto the road.'}},

  // ── TRAFFIC LIGHTS ──
  {cat:'signs', sign:S.light('#f39c12','#aaa','#aaa'),
    he:{q:'מה משמעות אור כתום (צהוב) ברמזור?', answers:['אפשר לעבור בזהירות','יש להכין את עצמך להתניע','יש לעצור אם ניתן לעשות זאת בבטחה','אפשר לעבור במהירות'], correct:2, explain:'אור כתום ברמזור פירושו להתכונן לעצור. יש לעצור לפני קו העצירה אם ניתן לעשות זאת בבטחה. מותר להמשיך רק אם עצירה עלולה לגרום לתאונה.'},
    ru:{q:'Что означает жёлтый (оранжевый) сигнал светофора?', answers:['Можно проехать осторожно','Приготовиться к отъезду','Остановиться если это можно сделать безопасно','Можно проехать быстро'], correct:2, explain:'Жёлтый сигнал означает подготовку к остановке. Нужно остановиться перед стоп-линией, если это возможно сделать безопасно. Продолжить можно только если остановка может вызвать аварию.'},
    en:{q:'What does an amber (yellow) traffic light mean?', answers:['You may proceed with care','Prepare to move off','Stop if you can do so safely','You may proceed quickly'], correct:2, explain:'An amber light means prepare to stop. Stop before the line if it is safe to do so. You may only continue if stopping would cause a collision.'}},
];
