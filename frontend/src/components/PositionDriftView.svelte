<script>
  import { onMount } from 'svelte';
  import * as echarts from 'echarts';
  import { i18n } from '../i18n.svelte.js';
  import { GetPositionHistory, ResetPositionOrigin, ExportPositionHistoryCSV } from '../../wailsjs/go/main/App.js';
  import { Crosshair, Download, RefreshCw, TrendingUp } from '@lucide/svelte';

  let { isDarkMode = true } = $props();

  let rangeKey = $state('1h'); // '1h' | '24h' | '30d' | 'all'
  let chartMode = $state('components'); // 'components' | 'distance'
  let unitMode = $state('auto'); // 'auto' | 'mm' | 'cm' | 'm'
  let historyData = $state(null);
  let statusMsg = $state('');
  let loading = $state(false);

  let tsContainer = $state(null);
  let scatterContainer = $state(null);
  let tsChart = null;
  let scatterChart = null;

  async function fetchHistory() {
    loading = true;
    try {
      const res = await GetPositionHistory(rangeKey);
      if (res) {
        historyData = res;
      }
    } catch (e) {
      console.error('Failed to fetch position history:', e);
    } finally {
      loading = false;
    }
  }

  async function handleResetOrigin() {
    if (typeof window !== 'undefined' && !window.confirm(i18n.t('drift.resetConfirm'))) {
      return;
    }
    const ok = await ResetPositionOrigin();
    if (ok) {
      await fetchHistory();
    }
  }

  async function handleExportCSV() {
    try {
      const savedPath = await ExportPositionHistoryCSV(rangeKey);
      if (savedPath) {
        statusMsg = `${i18n.t('drift.exportedTo')}: ${savedPath}`;
        setTimeout(() => { statusMsg = ''; }, 5000);
      }
    } catch (e) {
      console.error('Export CSV failed:', e);
    }
  }

  function resolveUnitScale(points) {
    if (unitMode === 'mm') return { label: 'mm', factor: 1, decimals: 1 };
    if (unitMode === 'cm') return { label: 'cm', factor: 0.1, decimals: 2 };
    if (unitMode === 'm') return { label: 'm', factor: 0.001, decimals: 3 };

    let maxAbsMm = 0;
    for (const p of points) {
      maxAbsMm = Math.max(
        maxAbsMm,
        Math.abs(p.deltaNorthMm),
        Math.abs(p.deltaEastMm),
        Math.abs(p.deltaAltMm),
        Math.abs(p.distMm)
      );
    }
    if (maxAbsMm < 100) return { label: 'mm', factor: 1, decimals: 1 };
    if (maxAbsMm < 2000) return { label: 'cm', factor: 0.1, decimals: 1 };
    return { label: 'm', factor: 0.001, decimals: 3 };
  }

  function formatMm(mm, forcedScale = null) {
    const abs = Math.abs(mm);
    if (forcedScale) {
      return `${(mm * forcedScale.factor).toFixed(forcedScale.decimals)} ${forcedScale.label}`;
    }
    if (abs < 100) return `${mm.toFixed(1)} mm`;
    if (abs < 2000) return `${(mm * 0.1).toFixed(1)} cm`;
    return `${(mm * 0.001).toFixed(3)} m`;
  }

  function formatDuration(sec) {
    if (!sec || sec <= 0) return '0s';
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (d >= 365) {
      const y = (sec / (365.25 * 86400)).toFixed(2);
      return `${y} yr (${d}d)`;
    }
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${sec % 60}s`;
  }

  function formatTimeLabel(ts) {
    const d = new Date(ts * 1000);
    if (rangeKey === 'all') {
      return d.toLocaleDateString();
    }
    if (rangeKey === '30d') {
      return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:00`;
    }
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: rangeKey === '1h' ? '2-digit' : undefined });
  }

  function renderCharts() {
    if (!historyData || !historyData.points || historyData.points.length === 0) return;
    if (!tsChart || !scatterChart) return;

    const pts = historyData.points;
    const scale = resolveUnitScale(pts);
    const textColor = isDarkMode ? '#cbd5e1' : '#334155';
    const gridColor = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
    const bgTooltip = isDarkMode ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.95)';

    // 1. Time Series Chart
    const times = pts.map((p) => formatTimeLabel(p.ts));
    let series = [];

    if (chartMode === 'components') {
      series = [
        {
          name: i18n.t('drift.north'),
          type: 'line',
          showSymbol: pts.length <= 60,
          symbolSize: 4,
          smooth: false,
          lineStyle: { width: 2, color: '#00d9ff' },
          itemStyle: { color: '#00d9ff' },
          data: pts.map((p) => Number((p.deltaNorthMm * scale.factor).toFixed(scale.decimals)))
        },
        {
          name: i18n.t('drift.east'),
          type: 'line',
          showSymbol: pts.length <= 60,
          symbolSize: 4,
          smooth: false,
          lineStyle: { width: 2, color: '#10b981' },
          itemStyle: { color: '#10b981' },
          data: pts.map((p) => Number((p.deltaEastMm * scale.factor).toFixed(scale.decimals)))
        },
        {
          name: i18n.t('drift.altitude'),
          type: 'line',
          showSymbol: pts.length <= 60,
          symbolSize: 4,
          smooth: false,
          lineStyle: { width: 1.5, type: 'dashed', color: '#f59e0b' },
          itemStyle: { color: '#f59e0b' },
          data: pts.map((p) => Number((p.deltaAltMm * scale.factor).toFixed(scale.decimals)))
        }
      ];
    } else {
      series = [
        {
          name: i18n.t('drift.distance'),
          type: 'line',
          showSymbol: pts.length <= 60,
          symbolSize: 4,
          areaStyle: { opacity: 0.15, color: '#00d9ff' },
          lineStyle: { width: 2, color: '#00d9ff' },
          itemStyle: { color: '#00d9ff' },
          data: pts.map((p) => Number((p.distMm * scale.factor).toFixed(scale.decimals)))
        }
      ];
    }

    tsChart.setOption({
      animation: false,
      tooltip: {
        trigger: 'axis',
        backgroundColor: bgTooltip,
        textStyle: { color: textColor, fontSize: 12 },
        valueFormatter: (val) => `${val} ${scale.label}`
      },
      legend: {
        top: 0,
        textStyle: { color: textColor, fontSize: 11 }
      },
      grid: { left: 56, right: 20, top: 36, bottom: 52 },
      xAxis: {
        type: 'category',
        data: times,
        axisLabel: { color: textColor, fontSize: 11 },
        axisLine: { lineStyle: { color: gridColor } }
      },
      yAxis: {
        type: 'value',
        name: scale.label,
        nameTextStyle: { color: textColor, fontSize: 11 },
        axisLabel: { color: textColor, fontSize: 11 },
        splitLine: { lineStyle: { color: gridColor } }
      },
      dataZoom: [
        { type: 'inside', start: 0, end: 100 },
        { type: 'slider', height: 18, bottom: 8, textStyle: { color: textColor } }
      ],
      series
    }, true);

    // 2. 2D Scatter Chart (East vs North)
    let maxExtent = 0;
    const scatterPts = pts.map((p, idx) => {
      const e = Number((p.deltaEastMm * scale.factor).toFixed(scale.decimals));
      const n = Number((p.deltaNorthMm * scale.factor).toFixed(scale.decimals));
      maxExtent = Math.max(maxExtent, Math.abs(e), Math.abs(n));
      return [e, n, idx, p.ts, p.count];
    });
    if (maxExtent === 0) maxExtent = 1;
    const axisLimit = Number((maxExtent * 1.15).toPrecision(2));
    const latestPt = scatterPts[scatterPts.length - 1];

    scatterChart.setOption({
      animation: false,
      tooltip: {
        trigger: 'item',
        backgroundColor: bgTooltip,
        textStyle: { color: textColor, fontSize: 12 },
        formatter: (params) => {
          const v = params.value;
          const timeStr = new Date(v[3] * 1000).toLocaleString();
          return `${timeStr}<br/>E: ${v[0]} ${scale.label}<br/>N: ${v[1]} ${scale.label}<br/>n=${v[4]}`;
        }
      },
      visualMap: {
        show: false,
        min: 0,
        max: Math.max(1, pts.length - 1),
        dimension: 2,
        inRange: {
          color: ['#3b82f6', '#00d9ff', '#10b981']
        }
      },
      grid: { left: 54, right: 24, top: 24, bottom: 40 },
      xAxis: {
        type: 'value',
        name: `E (${scale.label})`,
        min: -axisLimit,
        max: axisLimit,
        nameTextStyle: { color: textColor, fontSize: 11 },
        axisLabel: { color: textColor, fontSize: 11 },
        splitLine: { lineStyle: { color: gridColor } },
        axisLine: { lineStyle: { color: gridColor } }
      },
      yAxis: {
        type: 'value',
        name: `N (${scale.label})`,
        min: -axisLimit,
        max: axisLimit,
        nameTextStyle: { color: textColor, fontSize: 11 },
        axisLabel: { color: textColor, fontSize: 11 },
        splitLine: { lineStyle: { color: gridColor } },
        axisLine: { lineStyle: { color: gridColor } }
      },
      series: [
        {
          type: 'scatter',
          symbolSize: pts.length > 500 ? 4 : 6,
          data: scatterPts
        },
        {
          type: 'scatter',
          symbolSize: 11,
          itemStyle: { color: '#ec4899', borderColor: '#fff', borderWidth: 1.5 },
          data: [latestPt],
          z: 10
        }
      ]
    }, true);
  }

  onMount(() => {
    tsChart = echarts.init(tsContainer);
    scatterChart = echarts.init(scatterContainer);

    const handleResize = () => {
      tsChart?.resize();
      scatterChart?.resize();
    };
    window.addEventListener('resize', handleResize);

    fetchHistory();
    const timer = setInterval(() => {
      fetchHistory();
    }, 3000);

    return () => {
      clearInterval(timer);
      window.removeEventListener('resize', handleResize);
      tsChart?.dispose();
      scatterChart?.dispose();
    };
  });

  $effect(() => {
    // Re-fetch when range changes
    rangeKey;
    fetchHistory();
  });

  $effect(() => {
    // Re-render charts when data, mode, unit, or theme changes
    historyData;
    chartMode;
    unitMode;
    isDarkMode;
    renderCharts();
  });
</script>

<div class="drift-view">
  <div class="drift-toolbar card">
    <div class="toolbar-left">
      <TrendingUp class="card-icon cyan" />
      <h2>{i18n.t('drift.title')}</h2>
    </div>

    <div class="toolbar-controls">
      <div class="btn-group">
        <button class="seg-btn {rangeKey === '1h' ? 'active' : ''}" onclick={() => (rangeKey = '1h')}>{i18n.t('drift.range1h')}</button>
        <button class="seg-btn {rangeKey === '24h' ? 'active' : ''}" onclick={() => (rangeKey = '24h')}>{i18n.t('drift.range24h')}</button>
        <button class="seg-btn {rangeKey === '30d' ? 'active' : ''}" onclick={() => (rangeKey = '30d')}>{i18n.t('drift.range30d')}</button>
        <button class="seg-btn {rangeKey === 'all' ? 'active' : ''}" onclick={() => (rangeKey = 'all')}>{i18n.t('drift.rangeAll')}</button>
      </div>

      <div class="btn-group">
        <button class="seg-btn {unitMode === 'auto' ? 'active' : ''}" onclick={() => (unitMode = 'auto')}>{i18n.t('drift.unitAuto')}</button>
        <button class="seg-btn {unitMode === 'mm' ? 'active' : ''}" onclick={() => (unitMode = 'mm')}>mm</button>
        <button class="seg-btn {unitMode === 'cm' ? 'active' : ''}" onclick={() => (unitMode = 'cm')}>cm</button>
        <button class="seg-btn {unitMode === 'm' ? 'active' : ''}" onclick={() => (unitMode = 'm')}>m</button>
      </div>

      <button class="tool-btn" onclick={fetchHistory} disabled={loading} title="Refresh">
        <RefreshCw size={14} class={loading ? 'spin' : ''} />
      </button>
      <button class="tool-btn" onclick={handleResetOrigin} title={i18n.t('drift.resetOrigin')}>
        <Crosshair size={14} />
        <span>{i18n.t('drift.resetOrigin')}</span>
      </button>
      <button class="tool-btn" onclick={handleExportCSV} title={i18n.t('drift.exportCsv')}>
        <Download size={14} />
        <span>{i18n.t('drift.exportCsv')}</span>
      </button>
    </div>
  </div>

  {#if statusMsg}
    <div class="status-banner">{statusMsg}</div>
  {/if}

  <div class="stats-grid">
    <div class="stat-card card">
      <div class="stat-title">{i18n.t('drift.originTitle')}</div>
      {#if historyData?.hasOrigin}
        <div class="stat-main mono">{historyData.originLat.toFixed(6)}°, {historyData.originLon.toFixed(6)}°</div>
        <div class="stat-sub">Alt: {historyData.originAlt.toFixed(2)} m · {i18n.t('drift.samples')}: {historyData.stats.totalSamples.toLocaleString()} ({formatDuration(historyData.stats.durationSeconds)})</div>
      {:else}
        <div class="stat-main">--</div>
      {/if}
    </div>

    <div class="stat-card card">
      <div class="stat-title">{i18n.t('drift.latestOffset')}</div>
      {#if historyData?.points?.length > 0}
        <div class="stat-main mono">{formatMm(historyData.stats.latestDistMm)}</div>
        <div class="stat-sub mono">
          N: {formatMm(historyData.stats.latestDeltaNorthMm)} / E: {formatMm(historyData.stats.latestDeltaEastMm)} / Alt: {formatMm(historyData.stats.latestDeltaAltMm)}
        </div>
      {:else}
        <div class="stat-main">--</div>
      {/if}
    </div>

    <div class="stat-card card">
      <div class="stat-title">{i18n.t('drift.annualTrend')}</div>
      {#if historyData?.stats?.hasTrend}
        <div class="stat-main mono trend-accent">
          {historyData.stats.trendSpeedMmPerYear.toFixed(1)} mm/yr ({historyData.stats.trendBearingDeg.toFixed(0)}°)
        </div>
        <div class="stat-sub mono">
          N: {historyData.stats.trendNorthMmPerYear >= 0 ? '+' : ''}{historyData.stats.trendNorthMmPerYear.toFixed(1)} / E: {historyData.stats.trendEastMmPerYear >= 0 ? '+' : ''}{historyData.stats.trendEastMmPerYear.toFixed(1)} mm/yr ({historyData.stats.trendSpanDays.toFixed(1)}d)
        </div>
      {:else}
        <div class="stat-sub">{i18n.t('drift.insufficientTrend')}</div>
      {/if}
    </div>

    <div class="stat-card card">
      <div class="stat-title">{i18n.t('drift.maxMeanDrift')}</div>
      {#if historyData?.points?.length > 0}
        <div class="stat-main mono">{historyData.stats.meanDistM.toFixed(3)} m / {historyData.stats.maxDistM.toFixed(3)} m</div>
        <div class="stat-sub">{i18n.t('drift.note')}</div>
      {:else}
        <div class="stat-main">--</div>
      {/if}
    </div>
  </div>

  <div class="charts-grid">
    <div class="chart-card card ts-card">
      <div class="chart-header">
        <h3>{i18n.t('drift.timeSeriesTitle')}</h3>
        <div class="btn-group">
          <button class="seg-btn {chartMode === 'components' ? 'active' : ''}" onclick={() => (chartMode = 'components')}>{i18n.t('drift.modeComponents')}</button>
          <button class="seg-btn {chartMode === 'distance' ? 'active' : ''}" onclick={() => (chartMode = 'distance')}>{i18n.t('drift.modeDistance')}</button>
        </div>
      </div>
      <div class="chart-box" bind:this={tsContainer}>
        {#if !historyData?.points?.length}
          <div class="empty-overlay">{i18n.t('drift.noData')}</div>
        {/if}
      </div>
    </div>

    <div class="chart-card card scatter-card">
      <div class="chart-header">
        <h3>{i18n.t('drift.scatterTitle')}</h3>
      </div>
      <div class="chart-box" bind:this={scatterContainer}>
        {#if !historyData?.points?.length}
          <div class="empty-overlay">{i18n.t('drift.noData')}</div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .drift-view {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 14px 20px 20px;
    height: 100%;
    overflow-y: auto;
  }

  .drift-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .toolbar-left h2 {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .toolbar-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .btn-group {
    display: inline-flex;
    background: var(--input-bg);
    border: 1px solid var(--card-border);
    border-radius: 8px;
    padding: 2px;
    gap: 2px;
  }

  .seg-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    padding: 5px 10px;
    border-radius: 6px;
    font-size: 0.78rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .seg-btn:hover {
    color: var(--text-primary);
  }

  .seg-btn.active {
    background: var(--accent-cyan);
    color: #04101f;
    font-weight: 600;
  }

  .tool-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--btn-secondary);
    border: 1px solid var(--card-border);
    color: var(--text-primary);
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 0.78rem;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .tool-btn:hover:not(:disabled) {
    background: var(--btn-secondary-hover);
  }

  .status-banner {
    padding: 8px 14px;
    border-radius: 8px;
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.35);
    color: var(--accent-emerald);
    font-size: 0.8rem;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }

  .stat-card {
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .stat-title {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
  }

  .stat-main {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .stat-sub {
    font-size: 0.74rem;
    color: var(--text-secondary);
    line-height: 1.35;
  }

  .mono {
    font-variant-numeric: tabular-nums;
  }

  .trend-accent {
    color: var(--accent-cyan);
  }

  .charts-grid {
    display: grid;
    grid-template-columns: 1.6fr 1fr;
    gap: 14px;
    flex: 1;
    min-height: 360px;
  }

  .chart-card {
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    min-height: 360px;
  }

  .chart-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    gap: 8px;
  }

  .chart-header h3 {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .chart-box {
    position: relative;
    flex: 1;
    width: 100%;
    min-height: 300px;
  }

  .empty-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    font-size: 0.85rem;
    text-align: center;
    padding: 20px;
    pointer-events: none;
  }

  @media (max-width: 1100px) {
    .stats-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .charts-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
