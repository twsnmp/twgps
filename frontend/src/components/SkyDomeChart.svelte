<script>
  import { i18n } from '../i18n.svelte.js';

  let { moon, sun } = $props();

  const R = 105; // Horizon radius

  // Project (azimuth, altitude) to SVG (x, y).
  // Sky chart convention (looking up): North = Top, South = Bottom, East = Left, West = Right.
  function project(azimuthDeg, altitudeDeg) {
    const clampedAlt = Math.max(-15, Math.min(90, altitudeDeg));
    const r = ((90 - clampedAlt) / 90) * R;
    const rad = (azimuthDeg * Math.PI) / 180;
    // Azimuth: 0=N (up: -y), 90=E (left: -x), 180=S (down: +y), 270=W (right: +x)
    const x = -r * Math.sin(rad);
    const y = -r * Math.cos(rad);
    return { x, y, r };
  }

  function buildAboveHorizonSegments(track) {
    if (!track || track.length === 0) return [];
    const segments = [];
    let current = [];
    for (const pt of track) {
      if (pt.altitude >= 0) {
        const p = project(pt.azimuth, pt.altitude);
        current.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
      } else if (current.length > 0) {
        segments.push(current.join(' '));
        current = [];
      }
    }
    if (current.length > 0) {
      segments.push(current.join(' '));
    }
    return segments;
  }

  let moonSegments = $derived(buildAboveHorizonSegments(moon?.track));
  let sunSegments = $derived(buildAboveHorizonSegments(sun?.track));
  let moonPos = $derived(moon ? project(moon.azimuth, moon.altitude) : { x: 0, y: 0 });
  let sunPos = $derived(sun ? project(sun.azimuth, sun.altitude) : { x: 0, y: 0 });
</script>

<div class="sky-dome-wrapper">
  <svg viewBox="-135 -135 270 270" class="sky-dome-svg" role="img" aria-label={i18n.t('moon.skyDomeTitle')}>
    <!-- Outer subtle background -->
    <circle cx="0" cy="0" r={R} class="dome-bg" />

    <!-- Altitude rings: 30° and 60° -->
    <circle cx="0" cy="0" r={(R * 2) / 3} class="dome-grid" />
    <circle cx="0" cy="0" r={R / 3} class="dome-grid" />
    <circle cx="0" cy="0" r={R} class="dome-horizon" />

    <!-- Crosshairs N-S, E-W -->
    <line x1="0" y1={-R} x2="0" y2={R} class="dome-grid" />
    <line x1={-R} y1="0" x2={R} y2="0" class="dome-grid" />

    <!-- Zenith dot -->
    <circle cx="0" cy="0" r="2" class="dome-zenith" />

    <!-- Altitude labels -->
    <text x="4" y={-(R * 2) / 3 + 10} class="alt-label">30°</text>
    <text x="4" y={-R / 3 + 10} class="alt-label">60°</text>

    <!-- Cardinal labels (N top, S bottom, E left, W right) -->
    <text x="0" y={-R - 10} text-anchor="middle" class="cardinal-label north">N</text>
    <text x="0" y={R + 18} text-anchor="middle" class="cardinal-label">S</text>
    <text x={-R - 14} y="4" text-anchor="middle" class="cardinal-label">E</text>
    <text x={R + 14} y="4" text-anchor="middle" class="cardinal-label">W</text>

    <!-- Sun daily track -->
    {#each sunSegments as pts}
      <polyline points={pts} fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.65" />
    {/each}

    <!-- Moon daily track -->
    {#each moonSegments as pts}
      <polyline points={pts} fill="none" stroke="#38bdf8" stroke-width="1.8" stroke-dasharray="4 3" opacity="0.85" />
    {/each}

    <!-- Sun current marker -->
    {#if sun}
      <g transform="translate({sunPos.x}, {sunPos.y})" opacity={sun.altitude >= 0 ? 1 : 0.35}>
        <circle cx="0" cy="0" r="8" fill="rgba(245, 158, 11, 0.25)" />
        <circle cx="0" cy="0" r="4.5" fill="#fbbf24" stroke="#f59e0b" stroke-width="1.5" />
        <text x="8" y="-6" class="body-label sun">{i18n.t('moon.sunLabel')}</text>
      </g>
    {/if}

    <!-- Moon current marker -->
    {#if moon}
      <g transform="translate({moonPos.x}, {moonPos.y})" opacity={moon.altitude >= 0 ? 1 : 0.45}>
        <circle cx="0" cy="0" r="10" fill="rgba(56, 189, 248, 0.25)" />
        <circle cx="0" cy="0" r="5.5" fill="#f8fafc" stroke="#38bdf8" stroke-width="2" />
        <text x="9" y="12" class="body-label moon">{i18n.t('moon.moonLabel')}</text>
      </g>
    {/if}
  </svg>
</div>

<style>
  .sky-dome-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
  }

  .sky-dome-svg {
    width: 100%;
    max-width: 260px;
    height: auto;
    overflow: visible;
  }

  .dome-bg {
    fill: rgba(15, 23, 42, 0.35);
  }

  :global(:root[data-theme="light"]) .dome-bg {
    fill: rgba(15, 23, 42, 0.05);
  }

  .dome-horizon {
    fill: none;
    stroke: var(--accent-cyan);
    stroke-width: 1.5;
    opacity: 0.6;
  }

  .dome-grid {
    fill: none;
    stroke: var(--text-muted);
    stroke-width: 0.8;
    stroke-dasharray: 2 3;
    opacity: 0.45;
  }

  .dome-zenith {
    fill: var(--text-muted);
    opacity: 0.7;
  }

  .cardinal-label {
    font-size: 12px;
    font-weight: 700;
    fill: var(--text-secondary);
  }

  .cardinal-label.north {
    fill: var(--accent-cyan);
  }

  .alt-label {
    font-size: 9px;
    fill: var(--text-muted);
  }

  .body-label {
    font-size: 10px;
    font-weight: 600;
  }

  .body-label.sun {
    fill: #fbbf24;
  }

  .body-label.moon {
    fill: #38bdf8;
  }

  :global(:root[data-theme="light"]) .body-label.sun {
    fill: #b45309;
  }

  :global(:root[data-theme="light"]) .body-label.moon {
    fill: #0284c7;
  }
</style>
