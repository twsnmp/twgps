/**
 * World Calendar Conversions (Fourmilab-compatible algorithms)
 * Pure offline JS implementation based on John Walker / Dershowitz & Reingold / Jean Meeus.
 */

const GREGORIAN_EPOCH = 1721425.5;
const JULIAN_EPOCH = 1721423.5;
const HEBREW_EPOCH = 347995.5;
const ISLAMIC_EPOCH = 1948439.5;
const PERSIAN_EPOCH = 1948320.5;
const BAHAI_EPOCH = 2394646.5;
const FRENCH_EPOCH = 2375839.5;
const MAYAN_COUNT_EPOCH = 584282.5; // GMT correlation (584283)

function mod(a, b) {
  return a - b * Math.floor(a / b);
}

function jwday(j) {
  return mod(Math.floor(j + 1.5), 7);
}

function leapGregorian(year) {
  return (year % 4 === 0) && (!(year % 100 === 0) || (year % 400 === 0));
}

function leapJulian(year) {
  return mod(year, 4) === (year > 0 ? 0 : 3);
}

export function gregorianToJD(year, month, day) {
  return (
    GREGORIAN_EPOCH - 1 +
    365 * (year - 1) +
    Math.floor((year - 1) / 4) -
    Math.floor((year - 1) / 100) +
    Math.floor((year - 1) / 400) +
    Math.floor(
      (367 * month - 362) / 12 +
      (month <= 2 ? 0 : leapGregorian(year) ? -1 : -2) +
      day
    )
  );
}

export function jdToGregorian(jd) {
  const wjd = Math.floor(jd - 0.5) + 0.5;
  const depoch = wjd - GREGORIAN_EPOCH;
  const quadricent = Math.floor(depoch / 146097);
  const dqc = mod(depoch, 146097);
  const cent = Math.floor(dqc / 36524);
  const dcent = mod(dqc, 36524);
  const quad = Math.floor(dcent / 1461);
  const dquad = mod(dcent, 1461);
  const yindex = Math.floor(dquad / 365);
  let year = quadricent * 400 + cent * 100 + quad * 4 + yindex;
  if (!(cent === 4 || yindex === 4)) {
    year++;
  }
  const yearday = wjd - gregorianToJD(year, 1, 1);
  const leapadj = wjd < gregorianToJD(year, 3, 1) ? 0 : leapGregorian(year) ? 1 : 2;
  const month = Math.floor(((yearday + leapadj) * 12 + 373) / 367);
  const day = wjd - gregorianToJD(year, month, 1) + 1;
  return { year, month, day };
}

export function jdToJulian(jd) {
  let z = Math.floor(jd + 0.5);
  let a = z;
  let b = a + 1524;
  let c = Math.floor((b - 122.1) / 365.25);
  let d = Math.floor(365.25 * c);
  let e = Math.floor((b - d) / 30.6001);
  const month = Math.floor(e < 14 ? e - 1 : e - 13);
  let year = Math.floor(month > 2 ? c - 4716 : c - 4715);
  const day = b - d - Math.floor(30.6001 * e);
  if (year < 1) year--;
  return { year, month, day };
}

export function jdToISOWeek(year, month, day) {
  const jd = gregorianToJD(year, month, day);
  const dayOfYear = jd - gregorianToJD(year, 1, 1) + 1;
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const isoYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return { isoYear, week, dayOfWeek: dayNum, dayOfYear };
}

// --- Hebrew Calendar ---
function hebrewLeap(year) {
  return mod(year * 7 + 1, 19) < 7;
}

function hebrewYearMonths(year) {
  return hebrewLeap(year) ? 13 : 12;
}

function hebrewDelay1(year) {
  const months = Math.floor((235 * year - 234) / 19);
  const parts = 12084 + 13753 * months;
  let day = months * 29 + Math.floor(parts / 25920);
  if (mod(3 * (day + 1), 7) < 3) {
    day++;
  }
  return day;
}

function hebrewDelay2(year) {
  const last = hebrewDelay1(year - 1);
  const present = hebrewDelay1(year);
  const next = hebrewDelay1(year + 1);
  if (next - present === 356) return 2;
  if (present - last === 382) return 1;
  return 0;
}

function hebrewYearDays(year) {
  return hebrewToJD(year + 1, 7, 1) - hebrewToJD(year, 7, 1);
}

function hebrewMonthDays(year, month) {
  if (month === 2 || month === 4 || month === 6 || month === 10 || month === 13) return 29;
  if (month === 12 && !hebrewLeap(year)) return 29;
  if (month === 8 && mod(hebrewYearDays(year), 10) !== 5) return 29;
  if (month === 9 && mod(hebrewYearDays(year), 10) === 3) return 29;
  return 30;
}

function hebrewToJD(year, month, day) {
  const months = hebrewYearMonths(year);
  let jd = HEBREW_EPOCH + hebrewDelay1(year) + hebrewDelay2(year) + day + 1;
  if (month < 7) {
    for (let mon = 7; mon <= months; mon++) jd += hebrewMonthDays(year, mon);
    for (let mon = 1; mon < month; mon++) jd += hebrewMonthDays(year, mon);
  } else {
    for (let mon = 7; mon < month; mon++) jd += hebrewMonthDays(year, mon);
  }
  return jd;
}

const HEBREW_MONTHS = [
  'Nisan', 'Iyyar', 'Sivan', 'Tammuz', 'Av', 'Elul',
  'Tishrei', 'Cheshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar', 'Adar II'
];

export function jdToHebrew(jd) {
  jd = Math.floor(jd) + 0.5;
  const count = Math.floor(((jd - HEBREW_EPOCH) * 98496.0) / 35975351.0);
  let year = count - 1;
  for (let i = count; jd >= hebrewToJD(i, 7, 1); i++) year++;
  const first = jd < hebrewToJD(year, 1, 1) ? 7 : 1;
  let month = first;
  for (let i = first; jd > hebrewToJD(year, i, hebrewMonthDays(year, i)); i++) month++;
  const day = jd - hebrewToJD(year, month, 1) + 1;
  let monthName = HEBREW_MONTHS[month - 1];
  if (month === 12 && hebrewLeap(year)) monthName = 'Adar I';
  return { year, month, monthName, day };
}

// --- Islamic Calendar ---
const ISLAMIC_MONTHS = [
  'Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani",
  'Jumada al-Awwal', 'Jumada al-Thani', 'Rajab', "Sha'ban",
  'Ramadan', 'Shawwal', "Dhu al-Qi'dah", 'Dhu al-Hijjah'
];

function islamicToJD(year, month, day) {
  return (
    day +
    Math.ceil(29.5 * (month - 1)) +
    (year - 1) * 354 +
    Math.floor((3 + 11 * year) / 30) +
    ISLAMIC_EPOCH - 1
  );
}

export function jdToIslamic(jd) {
  jd = Math.floor(jd) + 0.5;
  const year = Math.floor((30 * (jd - ISLAMIC_EPOCH) + 10646) / 10631);
  let month = Math.min(12, Math.ceil((jd - (29 + islamicToJD(year, 1, 1))) / 29.5) + 1);
  const day = jd - islamicToJD(year, month, 1) + 1;
  return { year, month, monthName: ISLAMIC_MONTHS[month - 1], day };
}

// --- Persian (Jalali) Calendar ---
const PERSIAN_MONTHS = [
  'Farvardin', 'Ordibehesht', 'Khordad', 'Tir', 'Mordad', 'Shahrivar',
  'Mehr', 'Aban', 'Azar', 'Dey', 'Bahman', 'Esfand'
];

function persianToJD(year, month, day) {
  const epbase = year - (year >= 0 ? 474 : 473);
  const epyear = 474 + mod(epbase, 2820);
  return (
    day +
    (month <= 7 ? (month - 1) * 31 : (month - 1) * 30 + 6) +
    Math.floor((epyear * 682 - 110) / 2816) +
    (epyear - 1) * 365 +
    Math.floor(epbase / 2820) * 1029983 +
    (PERSIAN_EPOCH - 1)
  );
}

export function jdToPersian(jd) {
  jd = Math.floor(jd) + 0.5;
  const depoch = jd - persianToJD(475, 1, 1);
  const cycle = Math.floor(depoch / 1029983);
  const cyear = mod(depoch, 1029983);
  let ycycle;
  if (cyear === 1029982) {
    ycycle = 2820;
  } else {
    const aux1 = Math.floor(cyear / 366);
    const aux2 = mod(cyear, 366);
    ycycle = Math.floor((2134 * aux1 + 2816 * aux2 + 2815) / 1028522) + aux1 + 1;
  }
  let year = ycycle + 2820 * cycle + 474;
  if (year <= 0) year--;
  const yday = jd - persianToJD(year, 1, 1) + 1;
  const month = yday <= 186 ? Math.ceil(yday / 31) : Math.ceil((yday - 6) / 30);
  const day = jd - persianToJD(year, month, 1) + 1;
  return { year, month, monthName: PERSIAN_MONTHS[month - 1], day };
}

// --- Bahá'í Calendar ---
const BAHAI_MONTHS = [
  'Bahá', 'Jalál', 'Jamál', '‘Aẓamat', 'Núr', 'Raḥmat', 'Kalimát',
  'Kamál', 'Asmá’', '‘Izzat', 'Mashíyyat', '‘Ilm', 'Qudrat', 'Qawl',
  'Masá’il', 'Sharaf', 'Sulṭán', 'Mulk', 'Ayyám-i-Há', '‘Alá’'
];

export function jdToBahai(jd) {
  jd = Math.floor(jd) + 0.5;
  const gy = jdToGregorian(jd).year;
  const bstarty = gy - (jd >= gregorianToJD(gy, 3, 21) ? 1843 : 1844);
  const jdn = gregorianToJD(gy, 3, 21);
  const prevEq = jd >= jdn ? jdn : gregorianToJD(gy - 1, 3, 21);
  const days = Math.floor(jd - prevEq);
  const leap = leapGregorian(gy + (jd >= jdn ? 1 : 0));
  const ayyamDays = leap ? 5 : 4;
  let month, day;
  if (days < 18 * 19) {
    month = Math.floor(days / 19) + 1;
    day = (days % 19) + 1;
  } else if (days < 18 * 19 + ayyamDays) {
    month = 19; // Ayyam-i-Ha
    day = days - 18 * 19 + 1;
  } else {
    month = 20; // 'Ala'
    day = days - (18 * 19 + ayyamDays) + 1;
  }
  const vahid = Math.floor((bstarty - 1) / 19) + 1;
  const kull = Math.floor((vahid - 1) / 19) + 1;
  const yearInVahid = ((bstarty - 1) % 19) + 1;
  return {
    year: bstarty,
    kull,
    vahid,
    yearInVahid,
    month,
    monthName: BAHAI_MONTHS[month - 1],
    day
  };
}

// --- Indian Civil Calendar (Saka) ---
const INDIAN_MONTHS = [
  'Chaitra', 'Vaisakha', 'Jyaistha', 'Asadha', 'Sravana', 'Bhadra',
  'Asvina', 'Kartika', 'Agrahayana', 'Pausa', 'Magha', 'Phalguna'
];

export function jdToIndianCivil(jd) {
  const Saka = 78;
  const start = 80;
  jd = Math.floor(jd) + 0.5;
  const greg = jdToGregorian(jd);
  const leap = leapGregorian(greg.year);
  let year = greg.year - Saka;
  const greg0 = gregorianToJD(greg.year, 1, 1);
  let yday = jd - greg0;
  const Chaitra = leap ? 31 : 30;
  if (yday < start) {
    year--;
    yday += Chaitra + 31 * 5 + 30 * 3 + 10 + start;
  }
  yday -= start;
  let month, day;
  if (yday < Chaitra) {
    month = 1;
    day = yday + 1;
  } else {
    let mday = yday - Chaitra;
    if (mday < 31 * 5) {
      month = Math.floor(mday / 31) + 2;
      day = (mday % 31) + 1;
    } else {
      mday -= 31 * 5;
      month = Math.floor(mday / 30) + 7;
      day = (mday % 30) + 1;
    }
  }
  return { year, month, monthName: INDIAN_MONTHS[month - 1], day };
}

// --- French Republican Calendar ---
const FRENCH_MONTHS = [
  'Vendémiaire', 'Brumaire', 'Frimaire',
  'Nivôse', 'Pluviôse', 'Ventôse',
  'Germinal', 'Floréal', 'Prairial',
  'Messidor', 'Thermidor', 'Fructidor',
  'Sansculottides'
];

function frenchLeap(year) {
  // Romme rule after year 20
  return mod(year, 4) === 0 && (mod(year, 100) !== 0 || mod(year, 400) === 0);
}

export function jdToFrenchRepublican(jd) {
  jd = Math.floor(jd) + 0.5;
  let days = Math.floor(jd - FRENCH_EPOCH);
  if (days < 0) {
    return null; // Before 1792-09-22
  }
  let year = 1;
  while (true) {
    const ydays = frenchLeap(year) ? 366 : 365;
    if (days < ydays) break;
    days -= ydays;
    year++;
  }
  const month = Math.floor(days / 30) + 1;
  const day = (days % 30) + 1;
  const decade = Math.floor((day - 1) / 10) + 1;
  return {
    year,
    month,
    monthName: FRENCH_MONTHS[month - 1],
    day,
    decade
  };
}

// --- Mayan Calendar ---
const MAYAN_HAAB_MONTHS = [
  'Pop', 'Uo', 'Zip', 'Zotz', 'Tzec', 'Xul', 'Yaxkin', 'Mol', 'Chen', 'Yax',
  'Zac', 'Ceh', 'Mac', 'Kankin', 'Muan', 'Pax', 'Kayab', 'Cumku', 'Uayeb'
];

const MAYAN_TZOLKIN_DAYS = [
  'Imix', 'Ik', 'Akbal', 'Kan', 'Chicchan', 'Cimi', 'Manik', 'Lamat', 'Muluc', 'Oc',
  'Chuen', 'Eb', 'Ben', 'Ix', 'Men', 'Cib', 'Caban', 'Etznab', 'Cauac', 'Ahau'
];

export function jdToMayan(jd) {
  jd = Math.floor(jd) + 0.5;
  const d = Math.floor(jd - MAYAN_COUNT_EPOCH);
  const baktun = Math.floor(d / 144000);
  let r = mod(d, 144000);
  const katun = Math.floor(r / 7200);
  r = mod(r, 7200);
  const tun = Math.floor(r / 360);
  r = mod(r, 360);
  const uinal = Math.floor(r / 20);
  const kin = mod(r, 20);

  // Haab
  const lcount = d + 348;
  const haabDayOfYear = mod(lcount, 365);
  const haabMonthIdx = Math.floor(haabDayOfYear / 20);
  const haabDay = mod(haabDayOfYear, 20);

  // Tzolkin
  const tzolkinNum = mod(d + 3, 13) + 1;
  const tzolkinNameIdx = mod(d + 19, 20);

  return {
    longCount: `${baktun}.${katun}.${tun}.${uinal}.${kin}`,
    haab: `${haabDay} ${MAYAN_HAAB_MONTHS[haabMonthIdx]}`,
    tzolkin: `${tzolkinNum} ${MAYAN_TZOLKIN_DAYS[tzolkinNameIdx]}`
  };
}

/**
 * Compute all world calendars for a given local Date.
 */
export function getAllWorldCalendars(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();

  // Midnight JD for calendar date, plus exact fractional JD for current time
  const midnightJD = gregorianToJD(y, m, d);
  const exactJD =
    gregorianToJD(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate()
    ) +
    (date.getUTCHours() +
      date.getUTCMinutes() / 60 +
      (date.getUTCSeconds() + date.getUTCMilliseconds() / 1000) / 3600) /
      24;
  const mjd = exactJD - 2400000.5;

  return {
    gregorian: { year: y, month: m, day: d, weekday: jwday(midnightJD) },
    julian: jdToJulian(midnightJD),
    julianDay: exactJD,
    modifiedJulianDay: mjd,
    iso: jdToISOWeek(y, m, d),
    hebrew: jdToHebrew(midnightJD),
    islamic: jdToIslamic(midnightJD),
    persian: jdToPersian(midnightJD),
    bahai: jdToBahai(midnightJD),
    indian: jdToIndianCivil(midnightJD),
    french: jdToFrenchRepublican(midnightJD),
    mayan: jdToMayan(midnightJD)
  };
}
