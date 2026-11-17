import * as Astronomy from 'astronomy-engine';

const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;
const AU_TO_KM = 149597870.7;
const EARTH_RADIUS_KM = 6378.137;
const MOON_RADIUS_KM = 1737.4;

function normalizeDeg(deg) {
  return ((deg % 360) + 360) % 360;
}

function getMoonPhaseKey(phaseDeg) {
  if (phaseDeg < 22.5 || phaseDeg >= 337.5) return 'new';
  if (phaseDeg < 67.5) return 'waxingCrescent';
  if (phaseDeg < 112.5) return 'firstQuarter';
  if (phaseDeg < 157.5) return 'waxingGibbous';
  if (phaseDeg < 202.5) return 'full';
  if (phaseDeg < 247.5) return 'waningGibbous';
  if (phaseDeg < 292.5) return 'thirdQuarter';
  return 'waningCrescent';
}

function getTraditionalMoonKey(lunarDay, phaseDeg) {
  if (phaseDeg < 10 || phaseDeg >= 350) return 'shingetsu';
  if (lunarDay === 2) return 'sengetsu';
  if (lunarDay === 3) return 'mikazuki';
  if (phaseDeg >= 80 && phaseDeg <= 100) return 'jogen';
  if (lunarDay === 10) return 'tokaya';
  if (lunarDay === 13) return 'jusanya';
  if (lunarDay === 14) return 'komochizuki';
  if (phaseDeg >= 170 && phaseDeg <= 190) return 'mangetsu';
  if (lunarDay === 16) return 'izayoi';
  if (lunarDay === 17) return 'tachimachizuki';
  if (lunarDay === 18) return 'imachizuki';
  if (lunarDay === 19) return 'nemachizuki';
  if (lunarDay === 20) return 'fukemachizuki';
  if (phaseDeg >= 260 && phaseDeg <= 280) return 'kagen';
  if (lunarDay >= 24 && lunarDay <= 28) return 'ariakezuki';
  if (lunarDay >= 29) return 'tsugomori';
  return phaseDeg < 180 ? 'waxing' : 'waning';
}

function findRiseSetForLocalDay(body, observer, localStartOfDay, localEndOfDay) {
  let rise = null;
  let set = null;

  const r1 = Astronomy.SearchRiseSet(body, observer, +1, localStartOfDay, 1.2);
  if (r1 && r1.date >= localStartOfDay && r1.date < localEndOfDay) {
    rise = r1.date;
  }

  const s1 = Astronomy.SearchRiseSet(body, observer, -1, localStartOfDay, 1.2);
  if (s1 && s1.date >= localStartOfDay && s1.date < localEndOfDay) {
    set = s1.date;
  }

  let transit = null;
  let transitAltitude = null;
  const t1 = Astronomy.SearchHourAngle(body, observer, 0, localStartOfDay, 1);
  if (t1 && t1.time.date >= localStartOfDay && t1.time.date < localEndOfDay) {
    transit = t1.time.date;
    transitAltitude = t1.hor.altitude;
  }

  return { rise, set, transit, transitAltitude };
}

function buildDailyTrack(body, observer, localStartOfDay) {
  const points = [];
  for (let m = 0; m <= 24 * 60; m += 30) {
    const t = new Date(localStartOfDay.getTime() + m * 60000);
    const eq = Astronomy.Equator(body, t, observer, true, true);
    const hor = Astronomy.Horizon(t, observer, eq.ra, eq.dec, 'normal');
    points.push({
      time: t,
      azimuth: hor.azimuth,
      altitude: hor.altitude
    });
  }
  return points;
}

/**
 * Compute comprehensive Moon and Sun data for a given Date and observer coordinates.
 */
export function getMoonAndSunInfo(date, latitude = 35.6812, longitude = 139.7671, altitudeMeters = 0) {
  const observer = new Astronomy.Observer(latitude, longitude, altitudeMeters);
  const time = Astronomy.MakeTime(date);

  // Equatorial & Horizontal coordinates
  const eqMoon = Astronomy.Equator(Astronomy.Body.Moon, time, observer, true, true);
  const horMoon = Astronomy.Horizon(time, observer, eqMoon.ra, eqMoon.dec, 'normal');

  const eqSun = Astronomy.Equator(Astronomy.Body.Sun, time, observer, true, true);
  const horSun = Astronomy.Horizon(time, observer, eqSun.ra, eqSun.dec, 'normal');

  // Illumination & Phase
  const phaseDeg = Astronomy.MoonPhase(time);
  const illum = Astronomy.Illumination(Astronomy.Body.Moon, time);
  const illuminationPct = illum.phase_fraction * 100;

  // Distance & Angular Diameter
  const distanceKm = eqMoon.dist * AU_TO_KM;
  const distanceEarthRadii = distanceKm / EARTH_RADIUS_KM;
  const angularDiameterArcmin = 2 * Math.asin(MOON_RADIUS_KM / distanceKm) * RAD2DEG * 60;

  // Moon Age (days since previous New Moon)
  const prevNewMoon = Astronomy.SearchMoonPhase(0, date, -35);
  const ageDays = prevNewMoon ? (date.getTime() - prevNewMoon.date.getTime()) / 86400000 : 0;

  // Noon Moon Age (standard Japanese Koyomi definition: age at local 12:00)
  const localNoon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  const prevNewMoonForNoon = Astronomy.SearchMoonPhase(0, localNoon, -35);
  const noonAgeDays = prevNewMoonForNoon
    ? (localNoon.getTime() - prevNewMoonForNoon.date.getTime()) / 86400000
    : ageDays;

  // Bright limb position angle (chi) & Parallactic angle (q)
  const raM = eqMoon.ra * 15 * DEG2RAD;
  const decM = eqMoon.dec * DEG2RAD;
  const raS = eqSun.ra * 15 * DEG2RAD;
  const decS = eqSun.dec * DEG2RAD;

  const chi = Math.atan2(
    Math.cos(decS) * Math.sin(raS - raM),
    Math.sin(decS) * Math.cos(decM) - Math.cos(decS) * Math.sin(decM) * Math.cos(raS - raM)
  ) * RAD2DEG;

  const gmstHours = Astronomy.SiderealTime(time);
  const lstDeg = normalizeDeg(gmstHours * 15 + longitude);
  const hourAngleRad = normalizeDeg(lstDeg - eqMoon.ra * 15) * DEG2RAD;
  const latRad = latitude * DEG2RAD;

  const q = Math.atan2(
    Math.sin(hourAngleRad),
    Math.tan(latRad) * Math.cos(decM) - Math.sin(decM) * Math.cos(hourAngleRad)
  ) * RAD2DEG;

  // Clockwise angle from observer's zenith (top) to the bright limb
  const zenithLitAngleDeg = normalizeDeg(-(chi - q));
  // Ecliptic/celestial standard orientation (North up, clockwise to bright limb)
  const northLitAngleDeg = normalizeDeg(-chi);

  // Local day boundaries
  const localStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const localEnd = new Date(localStart.getTime() + 86400000);

  const moonEvents = findRiseSetForLocalDay(Astronomy.Body.Moon, observer, localStart, localEnd);
  const sunEvents = findRiseSetForLocalDay(Astronomy.Body.Sun, observer, localStart, localEnd);

  let dayLengthMinutes = null;
  if (sunEvents.rise && sunEvents.set && sunEvents.set > sunEvents.rise) {
    dayLengthMinutes = (sunEvents.set.getTime() - sunEvents.rise.getTime()) / 60000;
  }

  // Next major phases
  const nextNew = Astronomy.SearchMoonPhase(0, date, 35)?.date || null;
  const nextFirstQuarter = Astronomy.SearchMoonPhase(90, date, 35)?.date || null;
  const nextFull = Astronomy.SearchMoonPhase(180, date, 35)?.date || null;
  const nextThirdQuarter = Astronomy.SearchMoonPhase(270, date, 35)?.date || null;

  const lunarDayApprox = Math.floor(ageDays) + 1;

  return {
    moon: {
      ageDays,
      noonAgeDays,
      phaseDeg,
      illuminationPct,
      phaseKey: getMoonPhaseKey(phaseDeg),
      traditionalKey: getTraditionalMoonKey(lunarDayApprox, phaseDeg),
      azimuth: horMoon.azimuth,
      altitude: horMoon.altitude,
      distanceKm,
      distanceEarthRadii,
      angularDiameterArcmin,
      zenithLitAngleDeg,
      northLitAngleDeg,
      rise: moonEvents.rise,
      set: moonEvents.set,
      transit: moonEvents.transit,
      transitAltitude: moonEvents.transitAltitude,
      nextPhases: {
        new: nextNew,
        firstQuarter: nextFirstQuarter,
        full: nextFull,
        thirdQuarter: nextThirdQuarter
      },
      track: buildDailyTrack(Astronomy.Body.Moon, observer, localStart)
    },
    sun: {
      azimuth: horSun.azimuth,
      altitude: horSun.altitude,
      rise: sunEvents.rise,
      set: sunEvents.set,
      transit: sunEvents.transit,
      transitAltitude: sunEvents.transitAltitude,
      dayLengthMinutes,
      track: buildDailyTrack(Astronomy.Body.Sun, observer, localStart)
    }
  };
}
