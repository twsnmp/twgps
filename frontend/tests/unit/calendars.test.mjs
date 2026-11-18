import test from 'node:test';
import assert from 'node:assert/strict';
import { getAllWorldCalendars } from '../../src/lib/worldCalendars.js';
import { getKyureki, getSolarTermsAndZassetsu } from '../../src/lib/kyureki.js';
import { getJapaneseAlmanac, getWareki } from '../../src/lib/japaneseAlmanac.js';
import { getMoonAndSunInfo } from '../../src/lib/astronomy.js';

test('World calendars match Fourmilab reference for 2026-11-17', () => {
  const d = new Date('2026-11-17T12:00:00+09:00');
  const w = getAllWorldCalendars(d);
  assert.equal(w.julian.year, 2026);
  assert.equal(w.julian.month, 11);
  assert.equal(w.julian.day, 4);
  assert.equal(w.hebrew.year, 5787);
  assert.equal(w.hebrew.monthName, 'Kislev');
  assert.equal(w.hebrew.day, 7);
  assert.equal(w.islamic.year, 1448);
  assert.equal(w.islamic.monthName, 'Jumada al-Thani');
  assert.equal(w.persian.year, 1405);
  assert.equal(w.persian.monthName, 'Aban');
  assert.equal(w.persian.day, 26);
  assert.equal(w.mayan.longCount, '13.0.14.1.19');
});

test('Wareki handles era transitions accurately', () => {
  assert.equal(getWareki(new Date('2019-05-01T12:00:00+09:00')).formattedJa, '令和元年5月1日');
  assert.equal(getWareki(new Date('2019-04-30T12:00:00+09:00')).formattedJa, '平成31年4月30日');
  assert.equal(getWareki(new Date('2026-11-17T12:00:00+09:00')).koki, 2686);
});

test('Japanese Almanac & Kyureki for 2026-11-17', () => {
  const d = new Date('2026-11-17T12:00:00+09:00');
  const kyureki = getKyureki(d);
  assert.equal(kyureki.year, 2026);
  assert.equal(kyureki.month, 10);
  assert.equal(kyureki.day, 9);
  assert.equal(kyureki.isLeap, false);
  assert.equal(kyureki.rokuyo.ja, '赤口');

  const terms = getSolarTermsAndZassetsu(d);
  assert.equal(terms.currentTerm.ja, '立冬');
  assert.equal(terms.nextTerm.ja, '小雪');

  const almanac = getJapaneseAlmanac(d, kyureki);
  assert.equal(almanac.yearEto.ja, '丙午');
  assert.equal(almanac.dayEto.ja, '乙未');
  assert.equal(almanac.yearKyusei.ja, '一白水星');
});

test('Moon & Sun astronomical info for Tokyo', () => {
  const d = new Date('2026-11-17T11:30:00+09:00');
  const astro = getMoonAndSunInfo(d, 35.6812, 139.7671, 0);
  assert.ok(astro.moon.ageDays > 7 && astro.moon.ageDays < 8.5);
  assert.ok(astro.moon.illuminationPct > 40 && astro.moon.illuminationPct < 55);
  assert.ok(astro.moon.distanceKm > 350000 && astro.moon.distanceKm < 410000);
  assert.ok(astro.sun.rise instanceof Date);
  assert.ok(astro.sun.set instanceof Date);
  assert.ok(astro.moon.track.length > 40);
});

test('Day Kyusei Yoton/Inton transitions and leap periods (九星の閏)', () => {
  const kyuseiJa = (iso) => getJapaneseAlmanac(new Date(iso)).dayKyusei.ja;

  // 2026 normal transitions: 6/19 甲子 (Inton start), 12/16 甲子 (Yoton start)
  assert.equal(kyuseiJa('2026-06-18T12:00:00+09:00'), '九紫火星');
  assert.equal(kyuseiJa('2026-06-19T12:00:00+09:00'), '九紫火星');
  assert.equal(kyuseiJa('2026-06-20T12:00:00+09:00'), '八白土星');
  assert.equal(kyuseiJa('2026-11-18T12:00:00+09:00'), '一白水星');
  assert.equal(kyuseiJa('2026-12-15T12:00:00+09:00'), '一白水星');
  assert.equal(kyuseiJa('2026-12-16T12:00:00+09:00'), '一白水星');
  assert.equal(kyuseiJa('2026-12-17T12:00:00+09:00'), '二黒土星');

  // 2020 summer solstice leap: 6/20 甲午 (Inton start at 3 三碧木星) -> 2021-01-16 甲子 (Yoton)
  assert.equal(kyuseiJa('2020-06-19T12:00:00+09:00'), '三碧木星');
  assert.equal(kyuseiJa('2020-06-20T12:00:00+09:00'), '三碧木星');
  assert.equal(kyuseiJa('2020-06-21T12:00:00+09:00'), '二黒土星');
  assert.equal(kyuseiJa('2021-01-15T12:00:00+09:00'), '一白水星');
  assert.equal(kyuseiJa('2021-01-16T12:00:00+09:00'), '一白水星');

  // 2008 winter solstice leap: 12/20 甲午 (Yoton start at 7 七赤金星)
  assert.equal(kyuseiJa('2008-12-19T12:00:00+09:00'), '七赤金星');
  assert.equal(kyuseiJa('2008-12-20T12:00:00+09:00'), '七赤金星');
  assert.equal(kyuseiJa('2008-12-21T12:00:00+09:00'), '八白土星');
});

test('2026-11 Shosetsu timestamp, Ichiryumanbaibi, and Moon zenith tilt angle', () => {
  const terms = getSolarTermsAndZassetsu(new Date('2026-11-18T12:00:00+09:00'));
  assert.equal(terms.nextTerm.ja, '小雪');
  // Shosetsu 2026 is 2026-11-22 16:23 JST (07:23 UTC)
  const jstShosetsu = new Date(terms.nextTerm.date.getTime() + 9 * 3600000);
  assert.equal(jstShosetsu.getUTCFullYear(), 2026);
  assert.equal(jstShosetsu.getUTCMonth() + 1, 11);
  assert.equal(jstShosetsu.getUTCDate(), 22);
  assert.equal(jstShosetsu.getUTCHours(), 16);
  assert.equal(jstShosetsu.getUTCMinutes(), 23);

  const hasIchiryu = (iso) =>
    getJapaneseAlmanac(new Date(iso), getKyureki(new Date(iso)))
      .senjitsu.some((s) => s.ja === '一粒万倍日');
  assert.equal(hasIchiryu('2026-11-11T12:00:00+09:00'), false); // 己丑
  assert.equal(hasIchiryu('2026-11-18T12:00:00+09:00'), false); // 丙申
  assert.equal(hasIchiryu('2026-11-19T12:00:00+09:00'), true);  // 丁酉
  assert.equal(hasIchiryu('2026-11-20T12:00:00+09:00'), true);  // 戊戌
  assert.equal(hasIchiryu('2026-11-23T12:00:00+09:00'), false); // 辛丑

  // Moon zenith lit angle (Tokyo, 2026-11-18)
  const m0601 = getMoonAndSunInfo(new Date('2026-11-18T06:01:00+09:00'), 35.6812, 139.7671, 0).moon;
  assert.ok(m0601.altitude < -60 && m0601.zenithLitAngleDeg > 105 && m0601.zenithLitAngleDeg < 115);

  const m1241 = getMoonAndSunInfo(new Date('2026-11-18T12:41:00+09:00'), 35.6812, 139.7671, 0).moon;
  assert.ok(m1241.zenithLitAngleDeg > 50 && m1241.zenithLitAngleDeg < 65);

  const m2100 = getMoonAndSunInfo(new Date('2026-11-18T21:00:00+09:00'), 35.6812, 139.7671, 0).moon;
  assert.ok(m2100.zenithLitAngleDeg > 140 && m2100.zenithLitAngleDeg < 160);
});
