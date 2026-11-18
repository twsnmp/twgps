# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-11-18

### Added
- **Calendar & Moon View**:
  - World calendars (Gregorian, Julian, Julian Day, MJD, ISO Week Date, Hebrew, Islamic/Hijri, Persian, Bahá'í, Indian National/Saka, French Republican, and Mayan).
  - Japanese traditional almanac / Koyomi (Wareki, Koki, Kyureki/Tenpo, Rokuyo, 24 Solar Terms, Zassetsu, Sexagenary Cycle, Natchin, Nine Star Ki, Junichoku, 28 Mansions, and Senjitsu).
  - Lunar and solar astronomy panel with moon age, illumination, distance, angular size, phase graphic, upcoming phases, rise/transit/set times, and an interactive sky dome chart.
  - Supports both live GPS time/location and custom date/time/coordinate inspection.
- **Long-Term Position Stability & Drift Monitor**:
  - Persistent GPS position history recording relative to a configurable reference origin (ΔN, ΔE, ΔAlt, and horizontal distance).
  - Multi-scale bucketed time-series views (`1 Hour (Sec)`, `24 Hours (Min)`, `30 Days (Hour)`, `All Time (Day)`), 2D position distribution scatter plot, and annual linear trend estimation.
  - CSV export and reference origin reset.
- **Stationary Speed Detection**:
  - Filters minor GPS position jitter to detect stationary state and displays a `Stationary` / `静止` badge in the Position Matrix.

### Fixed & Improved
- Restored WebGL detection in `Globe.svelte` with automatic 2D skyplot fallback on environments without WebGL support.
- Resolved serial port sniffing issues and `wails dev` port conflicts.
- Prevented macOS `.app` bundle relocation in the installer package (`scripts/release-mac.sh`) so `twgps.app` installs reliably to `/Applications` and appears in Launchpad.
- Updated Wails, Echo, Vite, `golang.org/x/net`, and frontend dependencies to address security vulnerabilities.
- Set application product version metadata to `0.2.0` in `wails.json` and `frontend/package.json`.

## [0.1.0] (tagged as v0.0.1)

### Added
- Initial release of `twgps`: cross-platform Stratum 1 NTP server powered by USB/Serial NMEA GPS receivers.
- Automatic serial port scanning (115200 / 9600 bps) and NMEA parsing for GPS, GLONASS, Galileo, BeiDou, QZSS (Michibiki), and SBAS/MSAS.
- Interactive 3D Globe / 2D Skyplot satellite visualization and SNR bar matrix.
- Built-in NTP server with Stratum 1 `"GPS "` reference ID and system-clock fallback when 3D fix is lost.
- Bilingual UI (English / Japanese) with dark and light themes.
- Unit, integration, and Playwright E2E test suites.
