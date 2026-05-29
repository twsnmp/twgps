<script>
  import { onMount } from 'svelte';
  import * as echarts from 'echarts';
  import 'echarts-gl';

  // Local offline images imported for packaging
  import earthImg from '../assets/globe/earth.jpg';
  import bathymetryImg from '../assets/globe/bathymetry.jpg';
  import starfieldImg from '../assets/globe/starfield.jpg';
  import nightImg from '../assets/globe/night.jpg';
  import cloudsImg from '../assets/globe/clouds.png';

  // Svelte 5 props
  let { gpsState = { satellites: {}, latitude: 35.68, longitude: 139.76, hasFix: false } } = $props();

  let chartContainer = $state(null);
  let chart = null;
  let webglError = $state(false);

  // Convert Hex color to RGBA string for transparent effects
  function funcHexToRGBA(hex, alpha) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function isWebGLSupported() {
    try {
      const canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }

  function updateGlobe() {
    if (!chart || webglError) return;

    // Base position of local PC on the globe
    const baseLon = gpsState.longitude || 139.76;
    const baseLat = gpsState.latitude || 35.68;
    const baseColor = gpsState.hasFix ? '#10b981' : '#f59e0b';

    // Retrieve and preserve existing user interactive viewControl zoom and rotation
    let viewControlConfig = {
      autoRotate: !gpsState.hasFix,
      autoRotateSpeed: 4,
      targetCoord: [baseLon, baseLat],
      distance: 180,
      minDistance: 120,
      maxDistance: 300
    };

    const currentOption = chart.getOption();
    if (currentOption && currentOption.globe && currentOption.globe[0]) {
      const currentViewControl = currentOption.globe[0].viewControl;
      if (currentViewControl) {
        viewControlConfig = {
          ...viewControlConfig,
          distance: currentViewControl.distance !== undefined ? currentViewControl.distance : viewControlConfig.distance,
          alpha: currentViewControl.alpha !== undefined ? currentViewControl.alpha : currentViewControl.alpha,
          beta: currentViewControl.beta !== undefined ? currentViewControl.beta : currentViewControl.beta,
          targetCoord: currentViewControl.targetCoord || [baseLon, baseLat]
        };
      }
    }

    // Prepare active satellites data
    const scatterData = [];
    const lineData = [];

    // 1. Add PC beacon point
    scatterData.push({
      name: 'Local PC',
      value: [baseLon, baseLat, 0],
      symbolSize: 18,
      itemStyle: {
        color: baseColor,
        borderColor: '#ffffff',
        borderWidth: 2,
        shadowBlur: 20,
        shadowColor: baseColor
      }
    });

    // 2. Loop and map constellations to active orbits
    const colors = {
      'GPS': '#3b82f6',
      'GLONASS': '#ef4444',
      'Galileo': '#ec4899',
      'BeiDou': '#a855f7',
      'みちびき(QZ)': '#10b981',
      '補正信号(SBAS/MSAS)': '#6b7280'
    };

    if (gpsState.satellites) {
      Object.entries(gpsState.satellites).forEach(([system, list]) => {
        const baseColorHex = colors[system] || '#ffffff';
        Object.values(list).forEach(sat => {
          const elRad = (sat.elevation * Math.PI) / 180;
          const azRad = (sat.azimuth * Math.PI) / 180;

          const scale = 15 * Math.cos(elRad);
          const satLat = Math.min(89, Math.max(-89, baseLat + scale * Math.cos(azRad)));
          
          const latCos = Math.cos((baseLat * Math.PI) / 180);
          const satLon = baseLon + (scale * Math.sin(azRad)) / (latCos > 0.1 ? latCos : 1);

          const isActive = sat.snr > 0;
          const nodeColor = isActive ? baseColorHex : '#6b7280';
          const nodeSize = isActive ? 14 : 10;

          scatterData.push({
            name: `No.${sat.prn} [${system}]`,
            value: [satLon, satLat, 250000],
            symbolSize: nodeSize,
            itemStyle: {
              color: nodeColor,
              shadowBlur: isActive ? 10 : 0,
              shadowColor: baseColorHex
            }
          });

          if (isActive) {
            lineData.push({
              coords: [
                [satLon, satLat, 250000],
                [baseLon, baseLat, 0]
              ],
              lineStyle: {
                color: baseColorHex,
                opacity: 0.35,
                width: 1.5
              }
            });
          }
        });
      });
    }

    const option = {
      backgroundColor: '#000',
      globe: {
        baseTexture: earthImg,
        heightTexture: bathymetryImg,
        displacementScale: 0.08,
        shading: 'lambert',
        environment: starfieldImg,
        light: {
          ambient: {
            intensity: 0.15
          },
          main: {
            intensity: 1.5,
            shadow: true
          }
        },
        layers: [
          {
            type: 'blend',
            blendTo: 'emission',
            texture: nightImg
          },
          {
            type: 'overlay',
            texture: cloudsImg,
            shading: 'lambert',
            distance: 4
          }
        ],
        viewControl: viewControlConfig
      },
      series: [
        {
          type: 'scatter3D',
          coordinateSystem: 'globe',
          blendMode: 'lighter',
          zlevel: 10,
          label: {
            show: false
          },
          emphasis: {
            label: {
              show: true,
              formatter: function(params) {
                return params.name;
              },
              textStyle: {
                color: '#fff',
                fontSize: 12,
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                padding: [4, 8],
                borderRadius: 4
              }
            }
          },
          data: scatterData
        },
        {
          type: 'lines3D',
          coordinateSystem: 'globe',
          blendMode: 'lighter',
          zlevel: 9,
          effect: {
            show: false
          },
          lineStyle: {
            width: 1,
            opacity: 0.25
          },
          data: lineData
        }
      ]
    };

    chart.setOption(option);
  }

  // 2D Skyplot Calculations
  const systemColors = {
    'GPS': '#3b82f6',
    'GLONASS': '#ef4444',
    'Galileo': '#ec4899',
    'BeiDou': '#a855f7',
    'みちびき(QZ)': '#10b981',
    '補正信号(SBAS/MSAS)': '#9ca3af'
  };

  let satelliteList = $derived.by(() => {
    const list = [];
    if (gpsState && gpsState.satellites) {
      Object.entries(gpsState.satellites).forEach(([system, sats]) => {
        Object.values(sats).forEach(sat => {
          list.push({
            ...sat,
            system
          });
        });
      });
    }
    return list;
  });

  function getSkyplotCoords(azimuth, elevation, size = 320) {
    const center = size / 2;
    const maxRadius = (size / 2) - 30; // 30px margin for outer label
    
    // Elevation 90 (zenith) is at the center (radius 0)
    // Elevation 0 (horizon) is at the edge (maxRadius)
    const r = maxRadius * (1 - elevation / 90);
    
    // Azimuth is clockwise from North (0 deg). Convert to radians with North straight up (-90 deg).
    const angleRad = ((azimuth - 90) * Math.PI) / 180;
    
    const x = center + r * Math.cos(angleRad);
    const y = center + r * Math.sin(angleRad);
    
    return { x, y };
  }

  function getSatLabel(system, prn) {
    let prefix = 'S';
    if (system === 'GPS') prefix = 'G';
    else if (system === 'GLONASS') prefix = 'R';
    else if (system === 'Galileo') prefix = 'E';
    else if (system === 'BeiDou') prefix = 'B';
    else if (system === 'みちびき(QZ)') prefix = 'Q';
    return `${prefix}${prn}`;
  }

  // Watch state changes and redraw
  $effect(() => {
    if (gpsState && !webglError) {
      updateGlobe();
    }
  });

  onMount(() => {
    if (!isWebGLSupported()) {
      console.warn("WebGL not supported by browser. Falling back to 2D Skyplot mode.");
      webglError = true;
      return;
    }

    try {
      chart = echarts.init(chartContainer);
      updateGlobe();
    } catch (err) {
      console.error("Failed to initialize ECharts GL (WebGL hardware acceleration error):", err);
      webglError = true;
    }

    const handleResize = () => {
      chart && chart.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart && chart.dispose();
    };
  });
</script>

<div class="globe-wrapper">
  {#if webglError}
    <div class="skyplot-container">
      <div class="skyplot-header">
        <span class="warning-icon">⚠</span>
        <span class="warning-text">2D Skyplot Mode (Hardware acceleration unavailable)</span>
      </div>
      
      <svg viewBox="0 0 320 320" class="skyplot-svg">
        <defs>
          <radialGradient id="skyplot-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#0b1329" />
            <stop offset="85%" stop-color="#050a14" />
            <stop offset="100%" stop-color="#020408" />
          </radialGradient>
          <filter id="radar-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <!-- Radar Plate Background -->
        <circle cx="160" cy="160" r="130" fill="url(#skyplot-bg)" stroke="#1e293b" stroke-width="1.5" />
        
        <!-- Concentric Grids (Elevation 30, 60) -->
        <circle cx="160" cy="160" r="86.6" stroke="rgba(59, 130, 246, 0.15)" stroke-width="1" stroke-dasharray="3,3" fill="none" />
        <circle cx="160" cy="160" r="43.3" stroke="rgba(59, 130, 246, 0.15)" stroke-width="1" stroke-dasharray="3,3" fill="none" />

        <!-- Grid Axis Crosshairs -->
        <line x1="160" y1="30" x2="160" y2="290" stroke="rgba(59, 130, 246, 0.2)" stroke-width="1" stroke-dasharray="4,4" />
        <line x1="30" y1="160" x2="290" y2="160" stroke="rgba(59, 130, 246, 0.2)" stroke-width="1" stroke-dasharray="4,4" />

        <!-- Elevation Labels -->
        <text x="164" y="112" fill="rgba(148, 163, 184, 0.4)" font-size="8" font-family="monospace">60°</text>
        <text x="164" y="68" fill="rgba(148, 163, 184, 0.4)" font-size="8" font-family="monospace">30°</text>

        <!-- Cardinal Points (N, S, E, W) -->
        <text x="160" y="22" fill="#3b82f6" font-size="12" font-weight="bold" font-family="sans-serif" text-anchor="middle">N</text>
        <text x="160" y="308" fill="#cbd5e1" font-size="11" font-weight="bold" font-family="sans-serif" text-anchor="middle">S</text>
        <text x="306" y="164" fill="#cbd5e1" font-size="11" font-weight="bold" font-family="sans-serif" text-anchor="start">E</text>
        <text x="14" y="164" fill="#cbd5e1" font-size="11" font-weight="bold" font-family="sans-serif" text-anchor="end">W</text>

        <!-- Dynamic Satellites -->
        {#each satelliteList as sat}
          {@const pos = getSkyplotCoords(sat.azimuth, sat.elevation, 320)}
          {@const color = systemColors[sat.system] || '#fff'}
          {@const label = getSatLabel(sat.system, sat.prn)}
          {@const isActive = sat.snr > 0}
          
          <g class="sat-node" opacity={isActive ? 1 : 0.4}>
            <!-- Satellite beam signal radius indicator if active -->
            {#if isActive}
              <circle cx={pos.x} cy={pos.y} r="12" fill={color} opacity="0.12" />
            {/if}
            <!-- Satellite Core Dot -->
            <circle 
              cx={pos.x} 
              cy={pos.y} 
              r={isActive ? 6 : 4.5} 
              fill={isActive ? color : '#475569'} 
              stroke="#0f172a" 
              stroke-width="1.5" 
            />
            <!-- Satellite Code Label -->
            <text 
              x={pos.x} 
              y={pos.y - 9} 
              fill={isActive ? '#cbd5e1' : '#64748b'} 
              font-size="8" 
              font-weight={isActive ? 'bold' : 'normal'} 
              font-family="monospace" 
              text-anchor="middle"
              stroke="#0b1329"
              stroke-width="2"
              paint-order="stroke"
            >
              {label}
            </text>
          </g>
        {/each}

        <!-- User/Receiver Zenith Center Dot (Glows green if GPS has lock) -->
        <g filter="url(#radar-glow)">
          <circle cx="160" cy="160" r="7" fill={gpsState.hasFix ? '#10b981' : '#f59e0b'} stroke="#ffffff" stroke-width="1.5" />
          {#if gpsState.hasFix}
            <circle cx="160" cy="160" r="16" fill="none" stroke="#10b981" stroke-width="1.5" opacity="0.5" class="radar-ping" />
          {/if}
        </g>
      </svg>
    </div>
  {:else}
    <div bind:this={chartContainer} class="globe-container"></div>
  {/if}
</div>

<style>
  .globe-wrapper {
    width: 100%;
    height: 100%;
    position: relative;
    border-radius: 16px;
    overflow: hidden;
    background: #000;
  }
  .globe-container {
    width: 100%;
    height: 100%;
  }

  /* 2D Skyplot Mode Styles */
  .skyplot-container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #050a14;
    position: relative;
    padding: 24px;
    box-sizing: border-box;
  }

  .skyplot-header {
    position: absolute;
    top: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.2);
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 0.75rem;
    color: #f59e0b;
    pointer-events: none;
    z-index: 10;
  }

  .skyplot-svg {
    width: 100%;
    height: 100%;
    max-width: 320px;
    max-height: 320px;
    user-select: none;
  }

  /* Pinging radar animation for central receiver node */
  .radar-ping {
    transform-origin: center;
    animation: ping 2.5s cubic-bezier(0.16, 1, 0.3, 1) infinite;
  }

  @keyframes ping {
    0% {
      r: 4px;
      opacity: 0.8;
    }
    100% {
      r: 28px;
      opacity: 0;
    }
  }
</style>
