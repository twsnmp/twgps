import * as Astronomy from 'astronomy-engine';

const JST_OFFSET_MS = 9 * 3600 * 1000;
const DAY_MS = 86400 * 1000;

export const ROKUYO_NAMES = [
  { key: 'taian', ja: '大安', en: 'Taian (Lucky)' },
  { key: 'shakko', ja: '赤口', en: 'Shakko (Noon Lucky)' },
  { key: 'sensho', ja: '先勝', en: 'Sensho (Morning Lucky)' },
  { key: 'tomobiki', ja: '友引', en: 'Tomobiki (Draw Friends)' },
  { key: 'senbu', ja: '先負', en: 'Senbu (Afternoon Lucky)' },
  { key: 'butsumetsu', ja: '仏滅', en: 'Butsumetsu (Unlucky)' }
];

// 24 Solar Terms indexed by ecliptic longitude / 15 (0 = 0° Shunbun)
export const SOLAR_TERMS = [
  { lon: 0, ja: '春分', en: 'Vernal Equinox' },
  { lon: 15, ja: '清明', en: 'Pure Brightness' },
  { lon: 30, ja: '穀雨', en: 'Grain Rain' },
  { lon: 45, ja: '立夏', en: 'Start of Summer' },
  { lon: 60, ja: '小満', en: 'Grain Buds' },
  { lon: 75, ja: '芒種', en: 'Grain in Ear' },
  { lon: 90, ja: '夏至', en: 'Summer Solstice' },
  { lon: 105, ja: '小暑', en: 'Minor Heat' },
  { lon: 120, ja: '大暑', en: 'Major Heat' },
  { lon: 135, ja: '立秋', en: 'Start of Autumn' },
  { lon: 150, ja: '処暑', en: 'End of Heat' },
  { lon: 165, ja: '白露', en: 'White Dew' },
  { lon: 180, ja: '秋分', en: 'Autumnal Equinox' },
  { lon: 195, ja: '寒露', en: 'Cold Dew' },
  { lon: 210, ja: '霜降', en: 'Frost Descent' },
  { lon: 225, ja: '立冬', en: 'Start of Winter' },
  { lon: 240, ja: '小雪', en: 'Minor Snow' },
  { lon: 255, ja: '大雪', en: 'Major Snow' },
  { lon: 270, ja: '冬至', en: 'Winter Solstice' },
  { lon: 285, ja: '小寒', en: 'Minor Cold' },
  { lon: 300, ja: '大寒', en: 'Major Cold' },
  { lon: 315, ja: '立春', en: 'Start of Spring' },
  { lon: 330, ja: '雨水', en: 'Rain Water' },
  { lon: 345, ja: '啓蟄', en: 'Awakening of Insects' }
];

function toJstDayIndex(date) {
  return Math.floor((date.getTime() + JST_OFFSET_MS) / DAY_MS);
}

function jstDayIndexToDate(dayIdx) {
  return new Date(dayIdx * DAY_MS - JST_OFFSET_MS);
}

function getJstYMD(date) {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  return {
    year: jst.getUTCFullYear(),
    month: jst.getUTCMonth() + 1,
    day: jst.getUTCDate()
  };
}

/**
 * Find the JST day index of the New Moon (朔) on or before targetDayIdx.
 */
function findNewMoonDayOnOrBefore(targetDayIdx) {
  // Search slightly past end of target day to catch New Moon occurring late in the JST day
  const endOfDay = jstDayIndexToDate(targetDayIdx + 1);
  const nm = Astronomy.SearchMoonPhase(0, endOfDay, -35);
  if (!nm) return null;
  let nmDay = toJstDayIndex(nm.date);
  if (nmDay > targetDayIdx) {
    const prev = Astronomy.SearchMoonPhase(0, new Date(nm.date.getTime() - 5 * DAY_MS), -35);
    if (prev) nmDay = toJstDayIndex(prev.date);
  }
  return nmDay;
}

function findNextNewMoonDay(s0DayIdx) {
  const start = jstDayIndexToDate(s0DayIdx + 20);
  const nm = Astronomy.SearchMoonPhase(0, start, 20);
  return nm ? toJstDayIndex(nm.date) : s0DayIdx + 30;
}

/**
 * Determine which Chuki (30° solar longitude) falls in [s0DayIdx, s1DayIdx).
 * Returns { monthNum, isLeap }.
 */
function classifyLunarMonth(s0DayIdx, s1DayIdx) {
  const startDate = jstDayIndexToDate(s0DayIdx);
  const sunLonStart = Astronomy.SunPosition(startDate).elon;
  // Next multiple of 30 degrees >= sunLonStart
  const firstChukiIdx = Math.ceil(sunLonStart / 30) % 12;
  const targetLon = firstChukiIdx * 30;
  const chukiTime = Astronomy.SearchSunLongitude(targetLon, startDate, 40);

  if (chukiTime) {
    const chukiDay = toJstDayIndex(chukiTime.date);
    if (chukiDay >= s0DayIdx && chukiDay < s1DayIdx) {
      const monthNum = ((firstChukiIdx + 1) % 12) + 1;
      return { monthNum, isLeap: false };
    }
  }

  // No Chuki in this lunar month -> Leap month (閏月) taking previous month's number
  const prevS0 = findNewMoonDayOnOrBefore(s0DayIdx - 1);
  if (prevS0 !== null) {
    const prevStart = jstDayIndexToDate(prevS0);
    const prevLon = Astronomy.SunPosition(prevStart).elon;
    const prevChukiIdx = Math.ceil(prevLon / 30) % 12;
    const prevChukiTime = Astronomy.SearchSunLongitude(prevChukiIdx * 30, prevStart, 40);
    if (prevChukiTime) {
      const prevChukiDay = toJstDayIndex(prevChukiTime.date);
      if (prevChukiDay >= prevS0 && prevChukiDay < s0DayIdx) {
        const monthNum = ((prevChukiIdx + 1) % 12) + 1;
        return { monthNum, isLeap: true };
      }
    }
  }

  // Fallback
  const approxMonth = ((firstChukiIdx) % 12) + 1;
  return { monthNum: approxMonth, isLeap: true };
}

/**
 * Compute Japanese Kyureki (旧暦) and Rokuyo (六曜) for a Date.
 */
export function getKyureki(date) {
  const targetDayIdx = toJstDayIndex(date);
  const s0 = findNewMoonDayOnOrBefore(targetDayIdx);
  const s1 = findNextNewMoonDay(s0);
  const day = targetDayIdx - s0 + 1;
  const { monthNum, isLeap } = classifyLunarMonth(s0, s1);

  const { year: gYear, month: gMonth } = getJstYMD(date);
  let kyurekiYear = gYear;
  if (monthNum >= 10 && gMonth <= 3) {
    kyurekiYear = gYear - 1;
  } else if (monthNum <= 2 && gMonth >= 11) {
    kyurekiYear = gYear + 1;
  }

  const rokuyoIdx = (monthNum + day) % 6;

  return {
    year: kyurekiYear,
    month: monthNum,
    day,
    isLeap,
    rokuyo: ROKUYO_NAMES[rokuyoIdx]
  };
}

/**
 * Compute 24 Solar Terms (二十四節気) and Zassetsu (雑節) for a Date.
 */
export function getSolarTermsAndZassetsu(date) {
  const targetDayIdx = toJstDayIndex(date);
  const startOfDay = jstDayIndexToDate(targetDayIdx);
  const sunLon = Astronomy.SunPosition(startOfDay).elon;

  // Current solar term (latest multiple of 15° <= sunLon)
  const currentIdx = Math.floor(sunLon / 15) % 24;
  const nextIdx = (currentIdx + 1) % 24;

  const currentTerm = SOLAR_TERMS[currentIdx];
  const nextTerm = SOLAR_TERMS[nextIdx];

  // Find exact dates of currentTerm and nextTerm
  const curSearchStart = new Date(startOfDay.getTime() - 20 * DAY_MS);
  const curEvent = Astronomy.SearchSunLongitude(currentTerm.lon, curSearchStart, 25);
  const nextEvent = Astronomy.SearchSunLongitude(nextTerm.lon, startOfDay, 25);

  let todayTerm = null;
  if (curEvent && toJstDayIndex(curEvent.date) === targetDayIdx) {
    todayTerm = currentTerm;
  } else if (nextEvent && toJstDayIndex(nextEvent.date) === targetDayIdx) {
    todayTerm = nextTerm;
  }

  // Zassetsu checks for targetDayIdx
  const zassetsu = [];
  const { year: gYear } = getJstYMD(date);
  const yearStart = new Date(Date.UTC(gYear, 0, 1) - JST_OFFSET_MS);

  // Risshun (315°) for this year
  const risshunEvent = Astronomy.SearchSunLongitude(315, yearStart, 60);
  if (risshunEvent) {
    const risshunDay = toJstDayIndex(risshunEvent.date);
    if (targetDayIdx === risshunDay - 1) zassetsu.push({ ja: '節分', en: 'Setsubun' });
    if (targetDayIdx === risshunDay + 87) zassetsu.push({ ja: '八十八夜', en: '88th Night' });
    if (targetDayIdx === risshunDay + 209) zassetsu.push({ ja: '二百十日', en: '210th Day' });
    if (targetDayIdx === risshunDay + 219) zassetsu.push({ ja: '二百二十日', en: '220th Day' });
  }

  // Shunbun (0°) & Shubun (180°) Higan
  const shunbun = Astronomy.SearchSunLongitude(0, yearStart, 100);
  if (shunbun) {
    const d = toJstDayIndex(shunbun.date);
    if (targetDayIdx === d - 3) zassetsu.push({ ja: '春彼岸入り', en: 'Spring Higan Begins' });
    if (targetDayIdx === d) zassetsu.push({ ja: '春彼岸中日', en: 'Spring Higan Middle' });
    if (targetDayIdx === d + 3) zassetsu.push({ ja: '春彼岸明け', en: 'Spring Higan Ends' });
  }

  const shubun = Astronomy.SearchSunLongitude(180, new Date(yearStart.getTime() + 180 * DAY_MS), 120);
  if (shubun) {
    const d = toJstDayIndex(shubun.date);
    if (targetDayIdx === d - 3) zassetsu.push({ ja: '秋彼岸入り', en: 'Autumn Higan Begins' });
    if (targetDayIdx === d) zassetsu.push({ ja: '秋彼岸中日', en: 'Autumn Higan Middle' });
    if (targetDayIdx === d + 3) zassetsu.push({ ja: '秋彼岸明け', en: 'Autumn Higan Ends' });
  }

  // Nyubai (80°) & Hangesho (100°)
  const nyubai = Astronomy.SearchSunLongitude(80, new Date(yearStart.getTime() + 130 * DAY_MS), 60);
  if (nyubai && toJstDayIndex(nyubai.date) === targetDayIdx) {
    zassetsu.push({ ja: '入梅', en: 'Nyubai (Rainy Season)' });
  }
  const hangesho = Astronomy.SearchSunLongitude(100, new Date(yearStart.getTime() + 150 * DAY_MS), 60);
  if (hangesho && toJstDayIndex(hangesho.date) === targetDayIdx) {
    zassetsu.push({ ja: '半夏生', en: 'Hangesho' });
  }

  // Doyo (27°, 117°, 207°, 297°)
  const doyoAngles = [
    { lon: 27, ja: '春土用入り', en: 'Spring Doyo Begins' },
    { lon: 117, ja: '夏土用入り', en: 'Summer Doyo Begins' },
    { lon: 207, ja: '秋土用入り', en: 'Autumn Doyo Begins' },
    { lon: 297, ja: '冬土用入り', en: 'Winter Doyo Begins' }
  ];
  for (const dy of doyoAngles) {
    const ev = Astronomy.SearchSunLongitude(dy.lon, curSearchStart, 30);
    if (ev && toJstDayIndex(ev.date) === targetDayIdx) {
      zassetsu.push({ ja: dy.ja, en: dy.en });
    }
  }

  return {
    todayTerm,
    currentTerm: {
      ...currentTerm,
      date: curEvent ? curEvent.date : null
    },
    nextTerm: {
      ...nextTerm,
      date: nextEvent ? nextEvent.date : null
    },
    zassetsu
  };
}
