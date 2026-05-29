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

  // Convert Hex color to RGBA string for transparent effects
  function funcHexToRGBA(hex, alpha) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  let lastUpdateTime = 0;

  function updateGlobe() {
    if (!chart) return;

    const now = Date.now();
    // Throttle 3D globe updates to at most once every 10 seconds.
    // Constantly redrawing the 3D WebGL scene every 1 second consumes 100% CPU in software rendering
    // (Mesa llvmpipe), completely starving the UI thread and freezing all buttons.
    if (lastUpdateTime !== 0 && now - lastUpdateTime < 10000) {
      return;
    }
    lastUpdateTime = now;

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
          // Mathematically project local Azimuth & Elevation relative to the user's base position.
          // This creates a beautiful visual dome centered above the user and prevents lines from passing inside the solid Earth sphere.
          const elRad = (sat.elevation * Math.PI) / 180;
          const azRad = (sat.azimuth * Math.PI) / 180;

          // Scale factor maps the local dome spread around the user (max 15 degrees at horizon)
          const scale = 15 * Math.cos(elRad);
          const satLat = Math.min(89, Math.max(-89, baseLat + scale * Math.cos(azRad)));
          
          const latCos = Math.cos((baseLat * Math.PI) / 180);
          const satLon = baseLon + (scale * Math.sin(azRad)) / (latCos > 0.1 ? latCos : 1);

          const isActive = sat.snr > 0;

          // Symbol sizes per user request: active = 14, inactive = 10
          const nodeColor = isActive ? baseColorHex : '#6b7280';
          const nodeSize = isActive ? 14 : 10;

          scatterData.push({
            name: `No.${sat.prn} [${system}]`,
            value: [satLon, satLat, 250000], // Elevated above Earth (250km)
            symbolSize: nodeSize,
            itemStyle: {
              color: nodeColor,
              shadowBlur: isActive ? 10 : 0,
              shadowColor: baseColorHex
            }
          });

          // Draw neon beam links from visible satellites to user
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
            show: false // Pulse animation disabled per user request
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

  // Watch state changes and redraw
  $effect(() => {
    if (gpsState) {
      updateGlobe();
    }
  });

  onMount(() => {
    chart = echarts.init(chartContainer);
    updateGlobe();

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
  <div bind:this={chartContainer} class="globe-container"></div>
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
</style>
