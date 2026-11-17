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
