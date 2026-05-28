<script>
  import { onMount } from 'svelte';
  import Globe from './components/Globe.svelte';
  import { GetGPSState, ForceGPSScan, GetNTPServerStats, ToggleNTPServer } from '../wailsjs/go/main/App.js';
  import { Play, Square, RefreshCw, Sun, Moon, Compass, Radio, Cpu, Clock } from '@lucide/svelte';

  // Svelte 5 reactive states
  let gpsState = $state({
    hasFix: false,
    time: "",
    date: "",
    latitude: 0,
    longitude: 0,
    altitude: 0,
    speedKnots: 0,
    speedKmh: 0,
    fixQuality: "0",
    numSatellites: 0,
    satellites: {},
    activePort: "",
    scanning: false,
    availablePorts: []
  });

  let ntpStats = $state({
    running: false,
    port: 1230,
    clientCount: 0
  });

  let ntpPortInput = $state(1230);
  let isDarkMode = $state(true);

  // Local clock state for fallback when GPS has no lock
  let systemTime = $state({ utc: "", local: "" });

  // Dynamically compute active UTC time (preferring GPS atomic time, removing subseconds decimals)
  let timeUTC = $derived.by(() => {
    if (gpsState.date && gpsState.time) {
      const cleanTime = gpsState.time.split('.')[0];
      return `${gpsState.date} ${cleanTime}`;
    }
    return systemTime.utc;
  });

  // Dynamically compute active Local time (preferring GPS atomic time converted to local time zone)
  let timeLocal = $derived.by(() => {
    if (gpsState.date && gpsState.time) {
      try {
        const utcISO = `${gpsState.date}T${gpsState.time}Z`;
        const dateObj = new Date(utcISO);
        if (!isNaN(dateObj.getTime())) {
          const yyyy = dateObj.getFullYear();
          const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
          const dd = String(dateObj.getDate()).padStart(2, '0');
          const hh = String(dateObj.getHours()).padStart(2, '0');
          const min = String(dateObj.getMinutes()).padStart(2, '0');
          const ss = String(dateObj.getSeconds()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
        }
      } catch (e) {
        // Fallback
      }
    }
    return systemTime.local;
  });

  // Sync state on startup and via events
  async function refreshAll() {
    try {
      const state = await GetGPSState();
      if (state) gpsState = state;

      const stats = await GetNTPServerStats();
      if (stats) {
        ntpStats = stats;
        ntpPortInput = stats.port;
      }
    } catch (e) {
      console.error(e);
    }
  }

  function toggleTheme() {
    isDarkMode = !isDarkMode;
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }

  async function handleToggleNTP() {
    const nextState = !ntpStats.running;
    const res = await ToggleNTPServer(nextState, parseInt(ntpPortInput));
    console.log(res);
    const stats = await GetNTPServerStats();
    if (stats) ntpStats = stats;
  }

  async function handleForceScan() {
    await ForceGPSScan();
    refreshAll();
  }

  onMount(() => {
    // Initial fetch
    refreshAll();

    // Listen to real-time events emitted from Go
    if (window.runtime) {
      window.runtime.EventsOn("gps-state-update", (newState) => {
        gpsState = newState;
      });
    }

    // Set theme
    document.documentElement.setAttribute('data-theme', 'dark');

    // System clock ticker to maintain live clock display
    const systemClock = setInterval(() => {
      const now = new Date();
      
      // Format Local Time
      const ly = now.getFullYear();
      const lm = String(now.getMonth() + 1).padStart(2, '0');
      const ld = String(now.getDate()).padStart(2, '0');
      const lh = String(now.getHours()).padStart(2, '0');
      const lmin = String(now.getMinutes()).padStart(2, '0');
      const lss = String(now.getSeconds()).padStart(2, '0');
      systemTime.local = `${ly}-${lm}-${ld} ${lh}:${lmin}:${lss}`;
      
      // Format UTC Time
      const uy = now.getUTCFullYear();
      const um = String(now.getUTCMonth() + 1).padStart(2, '0');
      const ud = String(now.getUTCDate()).padStart(2, '0');
      const uh = String(now.getUTCHours()).padStart(2, '0');
      const umin = String(now.getUTCMinutes()).padStart(2, '0');
      const uss = String(now.getUTCSeconds()).padStart(2, '0');
      systemTime.utc = `${uy}-${um}-${ud} ${uh}:${umin}:${uss}`;
    }, 1000);

    // Ticker for NTP stats refresh
    const ntpTicker = setInterval(async () => {
      const stats = await GetNTPServerStats();
      if (stats) ntpStats = stats;
    }, 2000);

    return () => {
      clearInterval(systemClock);
      clearInterval(ntpTicker);
    };
  });

  // Helper count of total satellites currently in view
  let totalSatsInView = $derived(
    Object.values(gpsState.satellites || {}).reduce(
      (sum, list) => sum + Object.keys(list).length,
      0
    )
  );

  // Get active system color styling
  const systemColors = {
    'GPS': '#3b82f6',
    'GLONASS': '#ef4444',
    'Galileo': '#ec4899',
    'BeiDou': '#a855f7',
    'みちびき(QZ)': '#10b981',
    '補正信号(SBAS/MSAS)': '#6b7280'
  };
</script>

<div class="app-layout">
  <!-- Top Glassmorphic Navigation -->
  <header class="navbar">
    <div class="logo-area">
      <div class="logo-circle"></div>
      <h1>twgps <span class="badge">Stratum 1</span></h1>
    </div>
    <div class="nav-controls">
      <div class="status-indicator {gpsState.hasFix ? 'active' : 'searching'}">
        <span class="pulse-dot"></span>
        {gpsState.hasFix ? 'GPS Llocked' : gpsState.scanning ? 'Scanning Ports...' : 'Searching Satellites...'}
      </div>
      <button class="icon-btn theme-toggle" onclick={toggleTheme} title="Toggle Theme">
        {#if isDarkMode}
          <Sun size={20} color="#00d9ff" />
        {:else}
          <Moon size={20} color="#0d1527" />
        {/if}
      </button>
    </div>
  </header>

  <div class="main-content">
    <!-- Left Panel: Coordinates & Controls -->
    <aside class="sidebar-left card">
      <div class="card-header">
        <Compass class="card-icon cyan" />
        <h2>Position Matrix</h2>
      </div>
      <div class="coord-matrix">
        <div class="coord-row">
          <div class="coord-val">
            <span class="label">Latitude</span>
            <span class="value">{gpsState.hasFix ? gpsState.latitude.toFixed(6) + '°' : '---.------'}</span>
          </div>
          <div class="coord-val">
            <span class="label">Longitude</span>
            <span class="value">{gpsState.hasFix ? gpsState.longitude.toFixed(6) + '°' : '---.------'}</span>
          </div>
        </div>
        <div class="coord-row mt-4">
          <div class="coord-val">
            <span class="label">Altitude (MSL)</span>
            <span class="value">{gpsState.hasFix ? gpsState.altitude.toFixed(1) + ' m' : '----.- m'}</span>
          </div>
          <div class="coord-val">
            <span class="label">Speed</span>
            <span class="value">{gpsState.hasFix ? gpsState.speedKmh.toFixed(1) + ' km/h' : '--.- km/h'}</span>
          </div>
        </div>
      </div>

      <hr class="separator" />

      <!-- Time Matrix Panel -->
      <div class="card-header">
        <Clock class="card-icon cyan" />
        <h2>Time Matrix</h2>
      </div>
      <div class="coord-matrix">
        <div class="coord-row">
          <div class="coord-val">
            <span class="label">Local Time</span>
            <span class="value" style="font-size: 13.5px;">{timeLocal}</span>
          </div>
        </div>
        <div class="coord-row mt-4">
          <div class="coord-val">
            <span class="label">UTC Time</span>
            <span class="value" style="font-size: 13.5px;">{timeUTC}</span>
          </div>
        </div>
      </div>

      <hr class="separator" />

      <!-- NTP Control Panel -->
      <div class="card-header">
        <Clock class="card-icon emerald" />
        <h2>NTP / NTS Server</h2>
      </div>
      <div class="ntp-panel">
        <div class="ntp-status-box {ntpStats.running ? 'running' : 'stopped'}">
          <div class="status-label">Server Status</div>
          <div class="status-text">{ntpStats.running ? 'ONLINE' : 'OFFLINE'}</div>
        </div>
        
        <div class="form-row">
          <label for="ntp-port">Server Port</label>
          <input 
            type="number" 
            id="ntp-port" 
            bind:value={ntpPortInput} 
            disabled={ntpStats.running} 
            min="1" 
            max="65535" 
          />
        </div>

        <div class="stats-row">
          <div class="stat-unit">
            <span class="stat-label">Clients Connected</span>
            <span class="stat-value">{ntpStats.clientCount}</span>
          </div>
          <div class="stat-unit">
            <span class="stat-label">Reference ID</span>
            <span class="stat-value">GPS</span>
          </div>
        </div>

        <button 
          class="action-btn {ntpStats.running ? 'btn-danger' : 'btn-success'}" 
          onclick={handleToggleNTP}
        >
          {#if ntpStats.running}
            <Square size={16} /> Stop Time Server
          {:else}
            <Play size={16} /> Start Time Server
          {/if}
        </button>
      </div>

      <hr class="separator" />

      <!-- GPS Connection Panel -->
      <div class="card-header">
        <Cpu class="card-icon amber" />
        <h2>Receiver Interface</h2>
      </div>
      <div class="receiver-panel">
        <div class="field-info">
          <span class="label">Active Port</span>
          <span class="value active-port">{gpsState.activePort || 'None'}</span>
        </div>
        <button 
          class="action-btn btn-secondary" 
          onclick={handleForceScan} 
          disabled={gpsState.scanning}
        >
          <RefreshCw size={16} class={gpsState.scanning ? 'spin' : ''} />
          {gpsState.scanning ? 'Scanning...' : 'Rescan Ports'}
        </button>
      </div>
    </aside>

    <!-- Center/Right Visual Area (Globe on top, Satellites below) -->
    <div class="visual-area">
      <main class="globe-section">
        <Globe {gpsState} />
      </main>

      <section class="satellites-section card">
        <div class="card-header">
          <Radio class="card-icon pink" />
          <h2>Satellite Matrix ({gpsState.numSatellites}/{totalSatsInView})</h2>
        </div>

        <div class="satellites-rows-container">
          {#if Object.keys(gpsState.satellites || {}).length === 0}
            <div class="empty-state">
              <span class="pulse-dot large"></span>
              <p>Searching for GPS receiver or satellite signals...</p>
            </div>
          {:else}
            {#each Object.entries(gpsState.satellites) as [system, sats]}
              {#if Object.keys(sats).length > 0}
                <div class="constellation-row">
                  <h3>
                    <span class="indicator" style="background-color: {systemColors[system] || '#fff'}"></span>
                    {system} ({Object.keys(sats).length})
                  </h3>
                  <div class="sat-horizontal-list">
                    {#each Object.values(sats) as sat}
                      <div class="sat-card {sat.snr > 0 ? 'active' : 'inactive'}">
                        <div class="sat-header">
                          <span class="prn">No.{sat.prn}</span>
                          <span class="snr-val">{sat.snr > 0 ? sat.snr + ' dB' : 'No Sig'}</span>
                        </div>
                        <div class="snr-bar-bg">
                          <div class="snr-bar-fg" style="width: {Math.min(100, (sat.snr / 50) * 100)}%; background-color: {systemColors[system] || '#fff'}"></div>
                        </div>
                        <div class="sat-meta">
                          <span>El: {sat.elevation}°</span>
                          <span>Az: {sat.azimuth}°</span>
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            {/each}
          {/if}
        </div>
      </section>
    </div>
  </div>
</div>
