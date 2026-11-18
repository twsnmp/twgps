import { gregorianToJD } from './worldCalendars.js';
import * as Astronomy from 'astronomy-engine';

const JIKKAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const JIKKAN_EN = ['Kinoe', 'Kinoto', 'Hinoe', 'Hinoto', 'Tsuchinoe', 'Tsuchinoto', 'Kanoe', 'Kanoto', 'Mizunoe', 'Mizunoto'];

const JUNISHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const JUNISHI_EN = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'];

// 30 Natchin (each covers 2 consecutive stem-branches: 0-1, 2-3, ..., 58-59)
const NATCHIN = [
  '海中金', '炉中火', '大林木', '路傍土', '剣鋒金',
  '山頭火', '澗下水', '城頭土', '白鑞金', '楊柳木',
  '泉中水', '屋上土', '霹靂火', '松柏木', '長流水',
  '沙中金', '山下火', '平地木', '壁上土', '金箔金',
  '覆燈火', '天河水', '大駅土', '釵釧金', '桑柘木',
  '大渓水', '沙中土', '天上火', '石榴木', '大海水'
];

const KYUSEI = [
  { num: 1, ja: '一白水星', en: '1 White Water' },
  { num: 2, ja: '二黒土星', en: '2 Black Earth' },
  { num: 3, ja: '三碧木星', en: '3 Jade Wood' },
  { num: 4, ja: '四緑木星', en: '4 Green Wood' },
  { num: 5, ja: '五黄土星', en: '5 Yellow Earth' },
  { num: 6, ja: '六白金星', en: '6 White Metal' },
  { num: 7, ja: '七赤金星', en: '7 Red Metal' },
  { num: 8, ja: '八白土星', en: '8 White Earth' },
  { num: 9, ja: '九紫火星', en: '9 Purple Fire' }
];

const JUNICHOKU = [
  { ja: '建', en: 'Ken (Establish)' },
  { ja: '除', en: 'Jo (Remove)' },
  { ja: '満', en: 'Man (Full)' },
  { ja: '平', en: 'Hei (Balance)' },
  { ja: '定', en: 'Tei (Fix)' },
  { ja: '執', en: 'Shitsu (Execute)' },
  { ja: '破', en: 'Ha (Break)' },
  { ja: '危', en: 'Ki (Danger)' },
  { ja: '成', en: 'Sei (Success)' },
  { ja: '納', en: 'Nou (Receive)' },
  { ja: '開', en: 'Kai (Open)' },
  { ja: '閉', en: 'Hei (Close)' }
];

const NIJUHASSHUKU = [
  '角', '亢', '氐', '房', '心', '尾', '箕',
  '斗', '牛', '女', '虚', '危', '室', '壁',
  '奎', '婁', '胃', '昴', '畢', '觜', '参',
  '井', '鬼', '柳', '星', '張', '翼', '軫'
];

// Ichiryu-manbaibi (一粒万倍日): setsukiMonthIndex (0=寅月/Feb..11=丑月/Jan) -> day junishi indices
const ICHIRYU_MANBAIBI_BRANCHES = {
  0: [1, 6],   // 正月(寅): 丑・午
  1: [9, 2],   // 二月(卯): 酉・寅
  2: [0, 3],   // 三月(辰): 子・卯
  3: [3, 4],   // 四月(巳): 卯・辰
  4: [5, 6],   // 五月(午): 巳・午
  5: [9, 6],   // 六月(未): 酉・午
  6: [0, 7],   // 七月(申): 子・未
  7: [3, 8],   // 八月(酉): 卯・申
  8: [6, 9],   // 九月(戌): 午・酉
  9: [9, 10],  // 十月(亥): 酉・戌
  10: [11, 0], // 十一月(子): 亥・子
  11: [3, 0]   // 十二月(丑): 卯・子
};

// Tensha-nichi (天赦日): season (0=Spring, 1=Summer, 2=Autumn, 3=Winter) -> stem-branch index
const TENSHA_STEM_BRANCH = {
  0: 14, // 春: 戊寅 (4, 2) -> 14
  1: 30, // 夏: 甲午 (0, 6) -> 30
  2: 44, // 秋: 戊申 (4, 8) -> 44
  3: 10  // 冬: 甲戌 (0, 10) -> 10
};

// Fujojubi (不成就日): kyurekiMonth % 6 -> kyurekiDays
const FUJOJUBI_DAYS = {
  1: [3, 11, 19, 27],
  2: [2, 10, 18, 26],
  3: [1, 9, 17, 25],
  4: [4, 12, 20, 28],
  5: [5, 13, 21, 29],
  0: [6, 14, 22, 30] // month 6, 12
};

function mod(a, b) {
  return ((a % b) + b) % b;
}

const JST_OFFSET_MS = 9 * 3600 * 1000;
const solsticeJdnCache = new Map();

function getSolsticeJdnJst(year, isWinter) {
  const key = `${year}:${isWinter ? 'W' : 'S'}`;
  if (solsticeJdnCache.has(key)) return solsticeJdnCache.get(key);

  const targetLon = isWinter ? 270 : 90;
  const searchStart = new Date(Date.UTC(year, isWinter ? 11 : 5, 1));
  const ev = Astronomy.SearchSunLongitude(targetLon, searchStart, 40);
  let sJdn;
  if (ev) {
    const jst = new Date(ev.date.getTime() + JST_OFFSET_MS);
    sJdn = Math.floor(
      gregorianToJD(jst.getUTCFullYear(), jst.getUTCMonth() + 1, jst.getUTCDate()) + 0.5
    );
  } else {
    sJdn = Math.floor(gregorianToJD(year, isWinter ? 12 : 6, 21) + 0.5);
  }
  if (solsticeJdnCache.size > 200) solsticeJdnCache.clear();
  solsticeJdnCache.set(key, sJdn);
  return sJdn;
}

function getKinoeneAnchor(year, isWinter) {
  const sJdn = getSolsticeJdnJst(year, isWinter);
  // 0 = 甲子 (Kinoe-Ne), 30 = 甲午 (Kinoe-Uma), 59 = 癸亥 (Mizunoto-I)
  const k = mod(sJdn + 49, 60);
  const kinoeneJdn = k <= 29 ? sJdn - k : sJdn + (60 - k);
  return { isWinter, kinoeneJdn };
}

/**
 * Compute Day Kyusei (日家九星) using traditional Yoton/Inton switching
 * anchored to the Kinoe-Ne (甲子) nearest to each solstice, including the
 * ~11-12 year leap-period (九星の閏) adjustment starting on Kinoe-Uma (甲午).
 */
function getDayKyusei(year, jdn) {
  const anchors = [
    getKinoeneAnchor(year - 2, true),
    getKinoeneAnchor(year - 1, false),
    getKinoeneAnchor(year - 1, true),
    getKinoeneAnchor(year, false),
    getKinoeneAnchor(year, true),
    getKinoeneAnchor(year + 1, false)
  ];

  let active = null;
  for (let i = 1; i < anchors.length; i++) {
    const prev = anchors[i - 1];
    const curr = anchors[i];
    const isLeapSpan = curr.kinoeneJdn - prev.kinoeneJdn >= 240;
    const dir = curr.isWinter ? 1 : -1;
    const startJdn = isLeapSpan ? curr.kinoeneJdn - 30 : curr.kinoeneJdn;
    const startStar = curr.isWinter ? (isLeapSpan ? 7 : 1) : (isLeapSpan ? 3 : 9);
    if (startJdn <= jdn) {
      active = { startJdn, startStar, dir };
    }
  }

  if (!active) {
    return KYUSEI[mod(jdn, 9)];
  }

  const delta = jdn - active.startJdn;
  const dayKyuseiNum = mod(active.startStar - 1 + active.dir * delta, 9) + 1;
  return KYUSEI[dayKyuseiNum - 1];
}

export function getWareki(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const ymd = y * 10000 + m * 100 + d;

  let eraJa = '';
  let eraEn = '';
  let eraYear = y;

  if (ymd >= 20190501) {
    eraJa = '令和'; eraEn = 'Reiwa'; eraYear = y - 2018;
  } else if (ymd >= 19890108) {
    eraJa = '平成'; eraEn = 'Heisei'; eraYear = y - 1988;
  } else if (ymd >= 19261225) {
    eraJa = '昭和'; eraEn = 'Showa'; eraYear = y - 1925;
  } else if (ymd >= 19120730) {
    eraJa = '大正'; eraEn = 'Taisho'; eraYear = y - 1911;
  } else if (ymd >= 18680125) {
    eraJa = '明治'; eraEn = 'Meiji'; eraYear = y - 1867;
  } else {
    eraJa = '西暦'; eraEn = 'CE'; eraYear = y;
  }

  const yearStrJa = eraYear === 1 && eraJa !== '西暦' ? '元年' : `${eraYear}年`;
  const yearStrEn = `${eraEn} ${eraYear}`;

  return {
    eraJa,
    eraEn,
    eraYear,
    formattedJa: `${eraJa}${yearStrJa}${m}月${d}日`,
    formattedEn: `${yearStrEn}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    koki: y + 660
  };
}

function getEtoFromIndex(idx60) {
  const i = mod(idx60, 60);
  const stem = i % 10;
  const branch = i % 12;
  return {
    index: i,
    stemIdx: stem,
    branchIdx: branch,
    ja: JIKKAN[stem] + JUNISHI[branch],
    en: `${JIKKAN_EN[stem]}-${JUNISHI_EN[branch]}`,
    zodiacEn: JUNISHI_EN[branch],
    natchin: NATCHIN[Math.floor(i / 2)]
  };
}

/**
 * Compute Japanese Traditional Almanac attributes (干支, 納音, 九星, 十二直, 二十八宿, 選日).
 */
export function getJapaneseAlmanac(date, kyurekiInfo) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();

  const wareki = getWareki(date);

  // Year Eto (switches at Jan 1 for standard civic display; also provide setsuki-based info)
  const yearEto = getEtoFromIndex(y - 4);

  // Day Eto
  const jdn = Math.floor(gregorianToJD(y, m, d) + 0.5);
  const dayEtoIdx = mod(jdn + 49, 60);
  const dayEto = getEtoFromIndex(dayEtoIdx);

  // Solar longitude for Setsuki month (節月): 315° = 寅月 (idx 0), 345° = 卯月 (idx 1), etc.
  const sunLon = Astronomy.SunPosition(date).elon;
  const setsukiMonthIdx = Math.floor(mod(sunLon - 315, 360) / 30); // 0..11
  const setsukiBranch = (setsukiMonthIdx + 2) % 12; // 寅=2 .. 丑=1

  // Month Eto (五虎遁: yearStem % 5 * 2 + 2 -> 寅月天干)
  const monthStemStart = (yearEto.stemIdx % 5) * 2 + 2;
  const monthStem = (monthStemStart + setsukiMonthIdx) % 10;
  const monthEtoIdx = ((monthStem - setsukiBranch + 60) % 12) * 5 + setsukiBranch; // find matching 0..59
  // Simpler: just construct Month Eto directly
  const monthEto = {
    ja: JIKKAN[monthStem] + JUNISHI[setsukiBranch],
    en: `${JIKKAN_EN[monthStem]}-${JUNISHI_EN[setsukiBranch]}`
  };

  // Year Kyusei: (11 - ((y - 1900) % 9)) -> 1..9 (2026: 126%9=0 -> 11%9 -> 2? Wait: 2026 is 一白水星!)
  // Let's check: 2020=7(七赤), 2021=6(六白), 2022=5(五黄), 2023=4(四緑), 2024=3(三碧), 2025=2(二黒), 2026=1(一白)!
  // Formula: ((2027 - y) % 9) or mod(11 - mod(y, 9), 9) -> if 0 then 9!
  // Check 2026: 2026 % 9 = 1 -> 11 - 1 = 10 -> 10 % 9 = 1 (一白水星)!
  // Check 2025: 2025 % 9 = 0 -> 11 - 0 = 11 -> 11 % 9 = 2 (二黒土星)!
  // Check 2024: 2024 % 9 = 8 -> 11 - 8 = 3 -> 3 (三碧木星)!
  const yearKyuseiNum = mod(11 - mod(y, 9), 9) || 9;
  const yearKyusei = KYUSEI[yearKyuseiNum - 1];

  // Day Kyusei (日家九星: Yoton/Inton anchored to solstice Kinoe-Ne, with Kinoe-Uma leap)
  const dayKyusei = getDayKyusei(y, jdn);

  // 十二直 (Junichoku): (dayBranch - setsukiBranch + 12) % 12
  const junichokuIdx = mod(dayEto.branchIdx - setsukiBranch, 12);
  const junichoku = JUNICHOKU[junichokuIdx];

  // 二十八宿 (Nijuhasshuku): JDN 2451545 (2000-01-01) was 箕(6)? Wait: 2000-01-01 was 虚(10) or 翼?
  // Standard Japanese calendar: 2024-01-01 (JDN 2460311) was 亢(1). Let's check: (2460311 + 17) % 28 = 1!
  const nijuhasshuku = NIJUHASSHUKU[mod(jdn + 17, 28)];

  // 選日 (Senjitsu)
  const senjitsu = [];
  if (ICHIRYU_MANBAIBI_BRANCHES[setsukiMonthIdx]?.includes(dayEto.branchIdx)) {
    senjitsu.push({ ja: '一粒万倍日', en: 'Ichiryumanbaibi (Lucky)' });
  }
  const seasonIdx = Math.floor(setsukiMonthIdx / 3); // 0:Spring, 1:Summer, 2:Autumn, 3:Winter
  if (dayEto.index === TENSHA_STEM_BRANCH[seasonIdx]) {
    senjitsu.push({ ja: '天赦日', en: 'Tenshanichi (Best Lucky)' });
  }
  if (dayEto.branchIdx === 2) {
    senjitsu.push({ ja: '寅の日', en: 'Tiger Day' });
  }
  if (dayEto.branchIdx === 5) {
    if (dayEto.stemIdx === 5) {
      senjitsu.push({ ja: '己巳の日', en: 'Tsuchinoto-Mi Day' });
    } else {
      senjitsu.push({ ja: '巳の日', en: 'Snake Day' });
    }
  }
  if (dayEto.index === 0) {
    senjitsu.push({ ja: '甲子の日', en: 'Kinoe-Ne Day' });
  }
  if (dayEto.index === 56) {
    senjitsu.push({ ja: '庚申の日', en: 'Koshin Day' });
  }
  if (kyurekiInfo) {
    const fujojubiList = FUJOJUBI_DAYS[kyurekiInfo.month % 6] || [];
    if (fujojubiList.includes(kyurekiInfo.day)) {
      senjitsu.push({ ja: '不成就日', en: 'Fujojubi (Unlucky)' });
    }
  }

  return {
    wareki,
    yearEto,
    monthEto,
    dayEto,
    yearKyusei,
    dayKyusei,
    junichoku,
    nijuhasshuku,
    senjitsu
  };
}
