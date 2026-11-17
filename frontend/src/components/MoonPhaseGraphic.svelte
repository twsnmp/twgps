<script>
  let {
    phaseDeg = 90,
    illuminationPct = 50,
    litAngleDeg = 90,
    size = 160
  } = $props();

  const R = 76;

  // Build SVG path for illuminated region with bright limb oriented at TOP (0 deg),
  // then rotate the group by litAngleDeg clockwise.
  let litPath = $derived.by(() => {
    const k = Math.max(0, Math.min(1, illuminationPct / 100));
    if (k <= 0.002) return '';
    if (k >= 0.998) {
      return `M 0 ${-R} A ${R} ${R} 0 1 1 0 ${R} A ${R} ${R} 0 1 1 0 ${-R} Z`;
    }
    const cosPhi = 1 - 2 * k; // +1 at new, 0 at quarter, -1 at full
    const ry = Math.abs(cosPhi) * R;
    const sweepTerm = k < 0.5 ? 0 : 1;
    // Top semicircle from (-R, 0) to (R, 0), then terminator back to (-R, 0)
    return `M ${-R} 0 A ${R} ${R} 0 0 1 ${R} 0 A ${R} ${ry.toFixed(2)} 0 0 ${sweepTerm} ${-R} 0 Z`;
  });
</script>

<svg
  width={size}
  height={size}
  viewBox="-100 -100 200 200"
  class="moon-svg"
  role="img"
  aria-label="Moon phase {illuminationPct.toFixed(1)}%"
>
  <defs>
    <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
      <stop offset="65%" stop-color="rgba(226, 232, 240, 0.25)" />
      <stop offset="100%" stop-color="rgba(226, 232, 240, 0)" />
    </radialGradient>
    <radialGradient id="moonLitGrad" cx="40%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#fefce8" />
      <stop offset="65%" stop-color="#e2e8f0" />
      <stop offset="100%" stop-color="#cbd5e1" />
    </radialGradient>
    <clipPath id="moonDiskClip">
      <circle cx="0" cy="0" r={R} />
    </clipPath>
  </defs>

  <!-- Atmospheric halo -->
  <circle cx="0" cy="0" r="96" fill="url(#moonGlow)" opacity={0.3 + (illuminationPct / 100) * 0.7} />

  <!-- Dark / Earthshine disk -->
  <circle cx="0" cy="0" r={R} fill="#1e293b" stroke="rgba(148, 163, 184, 0.35)" stroke-width="1" />

  <!-- Subtle lunar maria craters on dark & lit sides -->
  <g clip-path="url(#moonDiskClip)">
    <g opacity="0.22" fill="#0f172a">
      <circle cx="-22" cy="-18" r="18" />
      <circle cx="14" cy="-26" r="14" />
      <circle cx="24" cy="10" r="20" />
      <circle cx="-12" cy="24" r="12" />
      <circle cx="-35" cy="8" r="10" />
    </g>

    <!-- Illuminated phase rotated to match observer's sky tilt -->
    {#if litPath}
      <g transform="rotate({litAngleDeg})">
        <path d={litPath} fill="url(#moonLitGrad)" />
        <!-- Subtle maria shading on lit side -->
        <g transform="rotate({-litAngleDeg})" opacity="0.12" fill="#475569">
          <circle cx="-22" cy="-18" r="18" />
          <circle cx="14" cy="-26" r="14" />
          <circle cx="24" cy="10" r="20" />
          <circle cx="-12" cy="24" r="12" />
        </g>
      </g>
    {/if}
  </g>
</svg>

<style>
  .moon-svg {
    display: block;
    filter: drop-shadow(0 4px 18px rgba(0, 0, 0, 0.45));
  }
</style>
