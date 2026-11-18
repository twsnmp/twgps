# twgps

[日本語 (Japanese)](README_ja.md)

`twgps` is a lightweight, cross-platform desktop application that turns your computer into a **Stratum 1 NTP server** using a connected USB/Serial GPS receiver. It automatically detects your GPS receiver, visualizes satellite constellations and signal strengths, and serves high-precision NTP time.

Built with [Wails](https://wails.io/) (Go + Svelte).

![twgps Infographic](images/infographic.png)

![twgps Dashboard](images/screenshot.png)

---

## Required Hardware

To use this software, you need a compatible USB NMEA GPS receiver.

### Verified Hardware:
- **GPS Receiver DOCTORADIO GR7-10HZ** (USB NMEA Receiver)

![DOCTORADIO GR7-10HZ](images/doctoradio_gr7_10hz.png)

---

## Features

- **Automatic GPS Receiver Detection**: Automatically scans all serial/USB ports at common baud rates (115200 and 9600 bps) to locate your GPS receiver and start parsing NMEA sentences.
- **Satellite Constellation Visualization (3D Globe / 2D Skyplot)**: Tracks and displays active satellites, elevation, azimuth, and Signal-to-Noise Ratio (SNR) on an interactive 3D globe (with automatic 2D skyplot fallback on environments without WebGL):
  - **GPS** (USA)
  - **GLONASS** (Russia)
  - **Galileo** (EU)
  - **BeiDou** (China)
  - **QZSS / Michibiki** (Japan)
  - **SBAS / MSAS** (Augmentation systems)
- **Stationary Speed Detection**: Filters minor GPS position jitter to detect stationary state, displaying a `Stationary` badge and stabilized speed readout.
- **Built-in Stratum 1 NTP Server**:
  - Serves high-precision time synced with GPS satellite clocks.
  - Defaults to the standard NTP port `123` (or customizable ports).
  - Flags Stratum 1 with the `"GPS "` reference identifier when active.
  - Automatically falls back to system time if the GPS receiver loses its 3D fix.
- **Calendar & Moon View** *(New in v0.2.0)*:
  - Uses live GPS time and coordinates (or any custom date/time and location) to display astronomical and calendar details.
  - **World Calendars**: Gregorian, Julian, Julian Day (JD), Modified Julian Day (MJD), ISO Week Date, Hebrew, Islamic (Hijri), Persian, Bahá'í, Indian National (Saka), French Republican, and Mayan calendars.
  - **Japanese Koyomi (Traditional Almanac)**: Wareki (Era), Koki, Kyureki (Lunisolar), Rokuyo, 24 Solar Terms, Zassetsu, Sexagenary Cycle (Eto), Natchin, Nine Star Ki, Junichoku, 28 Mansions, and Senjitsu.
  - **Lunar & Solar Sky Dome**: Displays moon age, illumination, geocentric distance, angular size, phase graphic, upcoming moon phases, rise/transit/set times, and an interactive sky dome chart for the Sun and Moon.
- **Long-Term Position Stability & Drift Monitor** *(New in v0.2.0)*:
  - Records GPS fix history and averages vector components (ΔN, ΔE, ΔAlt) per time bucket so random noise cancels out over long-term operation.
  - Supports multiple time scales: **1 Hour (Sec)**, **24 Hours (Min)**, **30 Days (Hour)**, and **All Time (Day)**, along with a 2D scatter plot (East vs North) and annual linear trend estimation.
  - Includes reference origin reset and **CSV export** for external analysis.
- **Modern User Interface**: A responsive dashboard with dark/light themes, real-time updates, and multi-language support (English and Japanese).

---

## Screenshots

### Calendar & Moon View
![Calendar & Moon View](images/screenshot_calendar.png)

### Long-Term Position Stability & Drift Monitor
![Position Drift Monitor](images/screenshot_drift.png)

---

## Installation

You can download pre-built binaries from the [GitHub Releases](https://github.com/twsnmp/twgps/releases) page.

- **Windows**: Download the `.zip` archive, extract it, and run `twgps.exe`.
- **Linux**: Download the `.tar.gz` archive, extract it, and run the binary. See [Linux Setup](#linux-setup) below for important permission and graphics settings.
- **macOS**: Download the `.pkg` installer (or `.app` bundle) and install `twgps` into your `/Applications` folder.

---

## Operation Guide

1. **Connect your GPS Receiver**: Plug your USB or serial NMEA-compatible GPS receiver into your computer.
2. **Start twgps**: Launch the application.
3. **Auto-Scan**: `twgps` will scan your serial ports in the background. Once a valid NMEA stream is detected, the status changes to green, and satellite details will begin updating.
4. **Acquire Fix**: Wait for the GPS receiver to obtain a 3D fix. The dashboard will display your latitude, longitude, altitude, and current UTC time.
5. **Start the NTP Server**:
   - Enter the desired port (default is `123`).
   - Click the **Start Time Server** button.
   - *Note*: Using port `123` on Linux or macOS requires elevated capabilities or root privileges for binding. See [Linux Setup](#linux-setup) below.
6. **Explore Additional Views**:
   - **Calendar & Moon**: Switch to the Calendar & Moon tab in the top navigation bar to view world calendars, Japanese Koyomi, moon phase details, and the solar/lunar sky dome.
   - **Position Drift**: Switch to the Position Drift tab to monitor long-term position displacement relative to a reference origin, inspect 2D distribution, or export history to CSV.

---

## Linux Setup

### 1. Serial Port Permissions (Permission Denied)
To access USB serial adapters (e.g., `/dev/ttyACM0` or `/dev/ttyUSB0`) without root access, you must add your user to the appropriate dialout group:

- **Ubuntu / Debian / Fedora**:
  ```bash
  sudo usermod -a -G dialout $USER
  ```
- **Arch Linux**:
  ```bash
  sudo usermod -a -G uucp $USER
  ```

> [!IMPORTANT]
> You must **log out and log back in** (or restart your system) for the group changes to take effect.

#### Why you shouldn't use `sudo` to run `twgps`
If you attempt to run `twgps` with `sudo` (e.g., `sudo ./twgps`), it will fail to start and crash with `panic: failed to init GTK`. This happens because GUI applications running as root cannot connect to your user's desktop display server (X11 or Wayland). Always grant your user serial port permissions instead.

### 2. Standard NTP Port 123 Binding
Binding to privileged ports (< 1024) like UDP `123` is restricted to root on Linux. Instead of running the entire app with `sudo`, grant the binary net-bind privileges:

```bash
sudo setcap 'cap_net_bind_service=+ep' ./twgps
```

### 3. Blank Screen / Rendering Issues on Older GPUs
If you experience a blank (white) window or crashes on launch, WebKit2GTK may be struggling with your graphics driver. You can bypass this by setting environment variables to disable hardware compositing or DMABUF rendering:

```bash
# Disable DMABUF rendering (Recommended for older GPUs/Intel/Mesa)
WEBKIT_DISABLE_DMABUF_RENDERER=1 ./twgps

# Disable hardware acceleration entirely if issues persist
WEBKIT_DISABLE_COMPOSITING_MODE=1 ./twgps
```

---

## Local Build Instructions

### Prerequisites
To build `twgps` from source, ensure you have the following installed:
- **Go**: Version 1.26 or higher
- **Node.js**: Version 20 or higher
- **Wails CLI**: Version 2
  ```bash
  go install github.com/wailsapp/wails/v2/cmd/wails@latest
  ```
- **Mise** (Optional task runner)

### Build Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/twsnmp/twgps.git
   cd twgps
   ```

2. **Development Mode**:
   Launch the app in live-rebuilding development mode:
   ```bash
   wails dev
   # Or using mise:
   mise run dev
   ```

3. **Production Build**:
   Compile the production bundle for your current OS:
   ```bash
   wails build
   # Or using mise:
   mise run build
   ```

---

## License

This project is licensed under the Apache License, Version 2.0. See the [LICENSE](LICENSE) file for details.
