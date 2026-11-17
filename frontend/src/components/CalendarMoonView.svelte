<script>
  import { i18n } from '../i18n.svelte.js';
  import { getMoonAndSunInfo } from '../lib/astronomy.js';
  import { getAllWorldCalendars } from '../lib/worldCalendars.js';
  import { getKyureki, getSolarTermsAndZassetsu } from '../lib/kyureki.js';
  import { getJapaneseAlmanac } from '../lib/japaneseAlmanac.js';
  import MoonPhaseGraphic from './MoonPhaseGraphic.svelte';
  import SkyDomeChart from './SkyDomeChart.svelte';
  import { Calendar, Moon, Sun, Compass, Globe, RotateCcw, MapPin, Sparkles } from '@lucide/svelte';

  let {
    liveDate = new Date(),
    gpsState = { hasFix: false, latitude: 35.6812, longitude: 139.7671, altitude: 0 }
  } = $props();

  let isCustomMode = $state(false);
  let customDateStr = $state(formatDateTimeLocal(new Date()));
  let customLat = $state(35.6812);
  let customLon = $state(139.7671);
  let useObserverTilt = $state(true);

  function formatDateTimeLocal(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function enableCustomMode() {
    customDateStr = formatDateTimeLocal(activeDate);
    customLat = Number(activeLat.toFixed(4));
    customLon = Number(activeLon.toFixed(4));
    isCustomMode = true;
  }

  function resetToLive() {
    isCustomMode = false;
  }

  let activeDate = $derived.by(() => {
    if (isCustomMode && customDateStr) {
      const parsed = new Date(customDateStr);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return liveDate;
  });

  let activeLat = $derived.by(() => {
    if (isCustomMode) return Number(customLat) || 0;
    return gpsState.hasFix ? gpsState.latitude : 35.6812;
  });

  let activeLon = $derived.by(() => {
    if (isCustomMode) return Number(customLon) || 0;
    return gpsState.hasFix ? gpsState.longitude : 139.7671;
  });

  let activeAlt = $derived(gpsState.hasFix && !isCustomMode ? (gpsState.altitude || 0) : 0);

  // Compute all astronomical and calendar data reactively
  let astro = $derived(getMoonAndSunInfo(activeDate, activeLat, activeLon, activeAlt));
  let world = $derived(getAllWorldCalendars(activeDate));
  let kyureki = $derived(getKyureki(activeDate));
  let terms = $derived(getSolarTermsAndZassetsu(activeDate));
  let almanac = $derived(getJapaneseAlmanac(activeDate, kyureki));

  const COMPASS_16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  function azToCompass(deg) {
    return COMPASS_16[Math.round(((deg % 360) / 22.5)) % 16];
  }

  function fmtTime(d) {
    if (!d) return '--:--';
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function fmtDateShort(d) {
    if (!d) return '--/--';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function fmtDayLength(mins) {
    if (mins == null) return '--h --m';
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h}h ${m}m`;
  }

  const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

  let isJa = $derived(i18n.currentLocale === 'ja');
</script>

<div class="cal-moon-container">
  <!-- Control Bar -->
  <div class="control-bar card">
    <div class="mode-group">
      <button
        class="mode-btn {!isCustomMode ? 'active' : ''}"
        onclick={resetToLive}
      >
        <span class="live-dot {!isCustomMode ? 'pulse' : ''}"></span>
        {i18n.t('cal.liveMode')}
      </button>
      <button
        class="mode-btn {isCustomMode ? 'active' : ''}"
        onclick={enableCustomMode}
      >
        <Calendar size={15} />
        {i18n.t('cal.customMode')}
      </button>
    </div>

    {#if isCustomMode}
      <div class="custom-inputs">
        <label class="input-field">
          <span>{i18n.t('cal.dateTime')}</span>
          <input type="datetime-local" bind:value={customDateStr} />
        </label>
        <label class="input-field small">
          <span>{i18n.t('cal.latitude')}</span>
          <input type="number" step="0.01" min="-90" max="90" bind:value={customLat} />
        </label>
        <label class="input-field small">
          <span>{i18n.t('cal.longitude')}</span>
          <input type="number" step="0.01" min="-180" max="180" bind:value={customLon} />
        </label>
        <button class="reset-btn" onclick={resetToLive} title={i18n.t('cal.resetLive')}>
          <RotateCcw size={14} />
        </button>
      </div>
    {:else}
      <div class="loc-badge">
        <MapPin size={14} />
        <span>
          {gpsState.hasFix ? i18n.t('cal.usingGpsLoc') : i18n.t('cal.usingDefaultLoc')}
          ({activeLat.toFixed(3)}°, {activeLon.toFixed(3)}°)
        </span>
      </div>
    {/if}
  </div>

  <!-- Main 2-Column Grid -->
  <div class="cal-moon-grid">
    <!-- Left Column: Moon Appearance & Sky Dome -->
    <section class="moon-column card">
      <div class="card-header space-between">
        <div class="header-left">
          <Moon class="card-icon cyan" />
          <h2>{i18n.t('moon.title')}</h2>
        </div>
        <button
          class="tilt-toggle"
          onclick={() => (useObserverTilt = !useObserverTilt)}
          title={useObserverTilt ? i18n.t('moon.observerOrientation') : i18n.t('moon.northUpOrientation')}
        >
          {useObserverTilt ? i18n.t('moon.observerOrientation') : i18n.t('moon.northUpOrientation')}
        </button>
      </div>

      <div class="moon-hero">
        <div class="moon-graphic-box">
          <MoonPhaseGraphic
            phaseDeg={astro.moon.phaseDeg}
            illuminationPct={astro.moon.illuminationPct}
            litAngleDeg={useObserverTilt ? astro.moon.zenithLitAngleDeg : astro.moon.northLitAngleDeg}
            size={150}
          />
          <div class="phase-titles">
            <div class="phase-main">{i18n.t('moon.phases.' + astro.moon.phaseKey)}</div>
            <div class="phase-trad">{i18n.t('moon.trad.' + astro.moon.traditionalKey)}</div>
          </div>
        </div>

        <div class="moon-metrics">
          <div class="metric-item">
            <span class="m-label">{i18n.t('moon.age')}</span>
            <span class="m-val">{astro.moon.ageDays.toFixed(1)} {i18n.t('moon.days')}</span>
          </div>
          <div class="metric-item">
            <span class="m-label">{i18n.t('moon.noonAge')}</span>
            <span class="m-val">{astro.moon.noonAgeDays.toFixed(1)} {i18n.t('moon.days')}</span>
          </div>
          <div class="metric-item">
            <span class="m-label">{i18n.t('moon.illumination')}</span>
            <span class="m-val">{astro.moon.illuminationPct.toFixed(1)}%</span>
          </div>
          <div class="metric-item">
            <span class="m-label">{i18n.t('moon.distance')}</span>
            <span class="m-val">{Math.round(astro.moon.distanceKm).toLocaleString()} km</span>
          </div>
          <div class="metric-item">
            <span class="m-label">{i18n.t('moon.angularSize')}</span>
            <span class="m-val">{astro.moon.angularDiameterArcmin.toFixed(1)}′</span>
          </div>
          <div class="metric-item">
            <span class="m-label">{i18n.t('moon.azimuth')} / {i18n.t('moon.altitude')}</span>
            <span class="m-val">
              {astro.moon.azimuth.toFixed(1)}° ({azToCompass(astro.moon.azimuth)}) /
              <span class={astro.moon.altitude >= 0 ? 'above' : 'below'}>
                {astro.moon.altitude >= 0 ? '+' : ''}{astro.moon.altitude.toFixed(1)}°
              </span>
            </span>
          </div>
        </div>
      </div>

      <hr class="separator" />

      <!-- Sky Dome -->
      <div class="sub-header">
        <Compass class="card-icon cyan" size={16} />
        <h3>{i18n.t('moon.skyDomeTitle')}</h3>
        <span class="horizon-pill {astro.moon.altitude >= 0 ? 'above' : 'below'}">
          {astro.moon.altitude >= 0 ? i18n.t('moon.aboveHorizon') : i18n.t('moon.belowHorizon')}
        </span>
      </div>

      <SkyDomeChart moon={astro.moon} sun={astro.sun} />

      <!-- Rise / Transit / Set -->
      <div class="events-grid">
        <div class="event-group">
          <div class="event-title"><Moon size={13} /> {i18n.t('moon.moonLabel')}</div>
          <div class="event-row"><span>{i18n.t('moon.moonrise')}</span><strong>{fmtTime(astro.moon.rise)}</strong></div>
          <div class="event-row"><span>{i18n.t('moon.moonTransit')}</span><strong>{fmtTime(astro.moon.transit)}</strong></div>
          <div class="event-row"><span>{i18n.t('moon.moonset')}</span><strong>{fmtTime(astro.moon.set)}</strong></div>
        </div>
        <div class="event-group">
          <div class="event-title"><Sun size={13} /> {i18n.t('moon.sunLabel')}</div>
          <div class="event-row"><span>{i18n.t('moon.sunrise')}</span><strong>{fmtTime(astro.sun.rise)}</strong></div>
          <div class="event-row"><span>{i18n.t('moon.solarNoon')}</span><strong>{fmtTime(astro.sun.transit)}</strong></div>
          <div class="event-row"><span>{i18n.t('moon.sunset')}</span><strong>{fmtTime(astro.sun.set)}</strong></div>
          <div class="event-row"><span>{i18n.t('moon.dayLength')}</span><strong>{fmtDayLength(astro.sun.dayLengthMinutes)}</strong></div>
        </div>
      </div>

      <!-- Next Phases -->
      <div class="next-phases">
        <div class="np-title">{i18n.t('moon.nextPhases')}</div>
        <div class="np-grid">
          <div class="np-item"><span>🌑 {i18n.t('moon.phases.new')}</span><strong>{fmtDateShort(astro.moon.nextPhases.new)}</strong></div>
          <div class="np-item"><span>🌓 {i18n.t('moon.phases.firstQuarter')}</span><strong>{fmtDateShort(astro.moon.nextPhases.firstQuarter)}</strong></div>
          <div class="np-item"><span>🌕 {i18n.t('moon.phases.full')}</span><strong>{fmtDateShort(astro.moon.nextPhases.full)}</strong></div>
          <div class="np-item"><span>🌗 {i18n.t('moon.phases.thirdQuarter')}</span><strong>{fmtDateShort(astro.moon.nextPhases.thirdQuarter)}</strong></div>
        </div>
      </div>
    </section>

    <!-- Right Column: Japanese Koyomi & World Calendars -->
    <div class="calendars-column">
      <!-- Japanese Koyomi & Almanac -->
      <section class="card">
        <div class="card-header">
          <Sparkles class="card-icon amber" />
          <h2>{i18n.t('cal.japaneseTitle')}</h2>
        </div>

        <div class="cal-grid">
          <div class="cal-item highlight">
            <span class="c-label">{i18n.t('cal.wareki')}</span>
            <span class="c-val">{isJa ? almanac.wareki.formattedJa : almanac.wareki.formattedEn}</span>
          </div>
          <div class="cal-item">
            <span class="c-label">{i18n.t('cal.koki')}</span>
            <span class="c-val">{almanac.wareki.koki}{isJa ? '年' : ''}</span>
          </div>
          <div class="cal-item highlight">
            <span class="c-label">{i18n.t('cal.kyureki')}</span>
            <span class="c-val">
              {kyureki.year}{isJa ? '年 ' : '-'}{kyureki.isLeap ? i18n.t('cal.leapMonth') : ''}{kyureki.month}{isJa ? '月' : '-'}{kyureki.day}{isJa ? '日' : ''}
            </span>
          </div>
          <div class="cal-item">
            <span class="c-label">{i18n.t('cal.rokuyo')}</span>
            <span class="c-val rokuyo-badge">{isJa ? kyureki.rokuyo.ja : kyureki.rokuyo.en}</span>
          </div>

          <div class="cal-item">
            <span class="c-label">{i18n.t('cal.solarTerm')}</span>
            <span class="c-val">
              {#if terms.todayTerm}
                <strong class="term-today">{isJa ? terms.todayTerm.ja : terms.todayTerm.en}</strong>
              {:else}
                {isJa ? terms.currentTerm.ja : terms.currentTerm.en}
                <small class="c-sub">({i18n.t('cal.nextTerm')}: {isJa ? terms.nextTerm.ja : terms.nextTerm.en} {fmtDateShort(terms.nextTerm.date)})</small>
              {/if}
            </span>
          </div>
          <div class="cal-item">
            <span class="c-label">{i18n.t('cal.zassetsu')}</span>
            <span class="c-val">
              {terms.zassetsu.length > 0 ? terms.zassetsu.map((z) => (isJa ? z.ja : z.en)).join(', ') : i18n.t('cal.none')}
            </span>
          </div>

          <div class="cal-item">
            <span class="c-label">{i18n.t('cal.etoYear')} / {i18n.t('cal.etoMonth')}</span>
            <span class="c-val">
              {isJa ? `${almanac.yearEto.ja} / ${almanac.monthEto.ja}` : `${almanac.yearEto.en} / ${almanac.monthEto.en}`}
            </span>
          </div>
          <div class="cal-item">
            <span class="c-label">{i18n.t('cal.etoDay')} ({i18n.t('cal.natchin')})</span>
            <span class="c-val">
              {isJa ? `${almanac.dayEto.ja} (${almanac.dayEto.natchin})` : `${almanac.dayEto.en} (${almanac.dayEto.natchin})`}
            </span>
          </div>

          <div class="cal-item">
            <span class="c-label">{i18n.t('cal.kyuseiYear')} / {i18n.t('cal.kyuseiDay')}</span>
            <span class="c-val">
              {isJa ? `${almanac.yearKyusei.ja} / ${almanac.dayKyusei.ja}` : `${almanac.yearKyusei.en} / ${almanac.dayKyusei.en}`}
            </span>
          </div>
          <div class="cal-item">
            <span class="c-label">{i18n.t('cal.junichoku')} / {i18n.t('cal.nijuhasshuku')}</span>
            <span class="c-val">
              {isJa ? `${almanac.junichoku.ja} / ${almanac.nijuhasshuku}宿` : `${almanac.junichoku.en} / ${almanac.nijuhasshuku}`}
            </span>
          </div>

          <div class="cal-item full-width">
            <span class="c-label">{i18n.t('cal.senjitsu')}</span>
            <div class="senjitsu-pills">
              {#if almanac.senjitsu.length > 0}
                {#each almanac.senjitsu as s}
                  <span class="senjitsu-pill">{isJa ? s.ja : s.en}</span>
                {/each}
              {:else}
                <span class="c-muted">{i18n.t('cal.none')}</span>
              {/if}
            </div>
          </div>
        </div>
      </section>

      <!-- World Calendars (Fourmilab) -->
      <section class="card">
        <div class="card-header">
          <Globe class="card-icon emerald" />
          <h2>{i18n.t('cal.worldTitle')}</h2>
        </div>

        <div class="cal-grid">
          <div class="cal-item">
            <span class="c-label">{i18n.t('cal.gregorian')}</span>
            <span class="c-val">
              {world.gregorian.year}-{String(world.gregorian.month).padStart(2, '0')}-{String(world.gregorian.day).padStart(2, '0')}
              ({isJa ? WEEKDAYS_JA[world.gregorian.weekday] : WEEKDAYS_EN[world.gregorian.weekday]})
            </span>
          </div>
          <div class="cal-item">
            <span class="c-label">{i18n.t('cal.julian')}</span>
            <span class="c-val">
              {world.julian.year}-{String(world.julian.month).padStart(2, '0')}-{String(world.julian.day).padStart(2, '0')}
            </span>
          </div>
          <div class="cal-item">
            <span class="c-label">{i18n.t('cal.julianDay')}</span>
            <span class="c-val mono">{world.julianDay.toFixed(5)}</span>
          </div>
          <div class="cal-item">
            <span class="c-label">{i18n.t('cal.mjd')}</span>
            <span class="c-val mono">{world.modifiedJulianDay.toFixed(5)}</span>
          </div>
          <div class="cal-item">
            <span class="c-label">{i18n.t('cal.isoWeek')}</span>
            <span class="c-val">
              {world.iso.isoYear}-W{String(world.iso.week).padStart(2, '0')}-{world.iso.dayOfWeek} (Day {world.iso.dayOfYear})
            </span>
          </div>
          <div class="cal-item">
            <span class="c-label">{i18n.t('cal.hebrew')}</span>
            <span class="c-val">{world.hebrew.day} {world.hebrew.monthName} {world.hebrew.year}</span>
          </div>
          <div class="cal-item">
            <span class="c-label">{i18n.t('cal.islamic')}</span>
            <span class="c-val">{world.islamic.day} {world.islamic.monthName} {world.islamic.year} AH</span>
          </div>
          <div class="cal-item">
            <span class="c-label">{i18n.t('cal.persian')}</span>
            <span class="c-val">{world.persian.day} {world.persian.monthName} {world.persian.year} SH</span>
          </div>
          <div class="cal-item">
            <span class="c-label">{i18n.t('cal.bahai')}</span>
            <span class="c-val">
              {world.bahai.day} {world.bahai.monthName} {world.bahai.year} BE
              <small class="c-sub">(K{world.bahai.kull}/V{world.bahai.vahid}/Y{world.bahai.yearInVahid})</small>
            </span>
          </div>
          <div class="cal-item">
            <span class="c-label">{i18n.t('cal.indian')}</span>
            <span class="c-val">{world.indian.day} {world.indian.monthName} {world.indian.year} Saka</span>
          </div>
          <div class="cal-item">
            <span class="c-label">{i18n.t('cal.french')}</span>
            <span class="c-val">
              {#if world.french}
                {world.french.day} {world.french.monthName} An {world.french.year}
              {:else}
                {i18n.t('cal.beforeEpoch')}
              {/if}
            </span>
          </div>
          <div class="cal-item">
            <span class="c-label">{i18n.t('cal.mayan')}</span>
            <span class="c-val mono">
              {world.mayan.longCount} · {world.mayan.haab} · {world.mayan.tzolkin}
            </span>
          </div>
        </div>
      </section>
    </div>
  </div>
</div>

<style>
  .cal-moon-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px 24px 24px;
    max-width: 1440px;
    margin: 0 auto;
    width: 100%;
  }

  .control-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 18px;
  }

  .mode-group {
    display: flex;
    gap: 8px;
  }

  .mode-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 7px 14px;
    border-radius: 8px;
    border: 1px solid var(--input-border);
    background: var(--btn-secondary);
    color: var(--text-secondary);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .mode-btn.active {
    background: rgba(0, 217, 255, 0.14);
    border-color: var(--accent-cyan);
    color: var(--text-primary);
  }

  .live-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-muted);
  }

  .live-dot.pulse {
    background: var(--accent-emerald);
    box-shadow: 0 0 8px var(--accent-emerald);
  }

  .custom-inputs {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }

  .input-field {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .input-field input {
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    color: var(--text-primary);
    border-radius: 6px;
    padding: 5px 8px;
    font-size: 0.82rem;
  }

  .input-field.small input {
    width: 85px;
  }

  .reset-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid var(--input-border);
    background: var(--btn-secondary);
    color: var(--text-primary);
    cursor: pointer;
  }

  .loc-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.82rem;
    color: var(--text-secondary);
  }

  .cal-moon-grid {
    display: grid;
    grid-template-columns: 420px 1fr;
    gap: 16px;
    align-items: start;
  }

  @media (max-width: 1024px) {
    .cal-moon-grid {
      grid-template-columns: 1fr;
    }
  }

  .moon-column {
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .space-between {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tilt-toggle {
    font-size: 0.72rem;
    padding: 4px 8px;
    border-radius: 6px;
    border: 1px solid var(--input-border);
    background: var(--btn-secondary);
    color: var(--text-secondary);
    cursor: pointer;
  }

  .tilt-toggle:hover {
    color: var(--text-primary);
    border-color: var(--accent-cyan);
  }

  .moon-hero {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .moon-graphic-box {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px 4px;
  }

  .phase-titles {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .phase-main {
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .phase-trad {
    font-size: 0.88rem;
    color: var(--accent-cyan);
    font-weight: 600;
  }

  .moon-metrics {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .metric-item {
    background: var(--input-bg);
    border: 1px solid var(--separator-color);
    border-radius: 8px;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .m-label {
    font-size: 0.72rem;
    color: var(--text-muted);
  }

  .m-val {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .above {
    color: var(--accent-emerald);
  }

  .below {
    color: var(--text-muted);
  }

  .sub-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sub-header h3 {
    font-size: 0.92rem;
    font-weight: 600;
    color: var(--text-primary);
    flex: 1;
  }

  .horizon-pill {
    font-size: 0.72rem;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--input-bg);
    border: 1px solid var(--separator-color);
  }

  .events-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .event-group {
    background: var(--input-bg);
    border: 1px solid var(--separator-color);
    border-radius: 8px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .event-title {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--accent-cyan);
    margin-bottom: 2px;
  }

  .event-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.78rem;
    color: var(--text-secondary);
  }

  .event-row strong {
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
  }

  .next-phases {
    background: var(--input-bg);
    border: 1px solid var(--separator-color);
    border-radius: 8px;
    padding: 10px;
  }

  .np-title {
    font-size: 0.76rem;
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: 6px;
  }

  .np-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 12px;
  }

  .np-item {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .np-item strong {
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
  }

  .calendars-column {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .calendars-column .card {
    padding: 18px;
  }

  .cal-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(235px, 1fr));
    gap: 10px;
    margin-top: 12px;
  }

  .cal-item {
    background: var(--input-bg);
    border: 1px solid var(--separator-color);
    border-radius: 8px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .cal-item.highlight {
    border-color: rgba(0, 217, 255, 0.35);
  }

  .cal-item.full-width {
    grid-column: 1 / -1;
  }

  .c-label {
    font-size: 0.74rem;
    color: var(--text-muted);
    font-weight: 500;
  }

  .c-val {
    font-size: 0.94rem;
    font-weight: 600;
    color: var(--text-primary);
    word-break: break-word;
  }

  .c-val.mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.86rem;
  }

  .c-sub {
    font-weight: 400;
    font-size: 0.76rem;
    color: var(--text-secondary);
    margin-left: 4px;
  }

  .c-muted {
    font-size: 0.82rem;
    color: var(--text-muted);
  }

  .rokuyo-badge {
    color: var(--accent-amber);
  }

  .term-today {
    color: var(--accent-emerald);
  }

  .senjitsu-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 2px;
  }

  .senjitsu-pill {
    font-size: 0.78rem;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 999px;
    background: rgba(245, 158, 11, 0.14);
    border: 1px solid rgba(245, 158, 11, 0.4);
    color: var(--accent-amber);
  }

  .separator {
    border: none;
    border-top: 1px solid var(--separator-color);
    margin: 2px 0;
  }
</style>
