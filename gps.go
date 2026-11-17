package main

import (
	"bufio"
	"context"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/adrianmo/go-nmea"
	"go.bug.st/serial"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type SatelliteDetail struct {
	PRN       int64 `json:"prn"`
	Elevation int64 `json:"elevation"`
	Azimuth   int64 `json:"azimuth"`
	SNR       int64 `json:"snr"`
}

type GPSState struct {
	HasFix          bool                                 `json:"hasFix"`
	Time            string                               `json:"time"`
	Date            string                               `json:"date"`
	Latitude        float64                              `json:"latitude"`
	Longitude       float64                              `json:"longitude"`
	Altitude        float64                              `json:"altitude"`
	SpeedKnots      float64                              `json:"speedKnots"`
	SpeedKmh        float64                              `json:"speedKmh"`
	DisplaySpeedKmh float64                              `json:"displaySpeedKmh"`
	IsStationary    bool                                 `json:"isStationary"`
	FixQuality      string                               `json:"fixQuality"`
	NumSatellites   int64                                `json:"numSatellites"`
	Satellites      map[string]map[int64]SatelliteDetail `json:"satellites"` // Talker -> PRN -> Detail
	ActivePort      string                               `json:"activePort"`
	Scanning        bool                                 `json:"scanning"`
	AvailablePorts  []string                             `json:"availablePorts"`
}

type posSample struct {
	ts  time.Time
	lat float64
	lon float64
}

type GPSService struct {
	sync.Mutex
	state            GPSState
	ctx              context.Context
	cancelRead       context.CancelFunc
	running          bool
	history          *PositionHistory
	smoothedSpeedKmh float64
	hasSpeedSample   bool
	recentPositions  []posSample
}

func NewGPSService() *GPSService {
	return &GPSService{
		state: GPSState{
			Satellites: make(map[string]map[int64]SatelliteDetail),
		},
		history: NewPositionHistory(DefaultHistoryFilePath()),
	}
}

func (g *GPSService) Start(ctx context.Context) {
	g.ctx = ctx
	g.running = true
	if err := g.history.Load(); err != nil {
		log.Printf("[PositionHistory] Failed to load history: %v", err)
	}
	go g.autoScanLoop()
	go g.autoSaveLoop()
}

func (g *GPSService) Stop() {
	g.Lock()
	g.running = false
	if g.cancelRead != nil {
		g.cancelRead()
	}
	g.Unlock()

	if err := g.history.Save(); err != nil {
		log.Printf("[PositionHistory] Failed to save history on stop: %v", err)
	}
}

func (g *GPSService) autoSaveLoop() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()
	for {
		if g.ctx != nil {
			select {
			case <-g.ctx.Done():
				return
			case <-ticker.C:
				if err := g.history.Save(); err != nil {
					log.Printf("[PositionHistory] Periodic save error: %v", err)
				}
			}
		} else {
			time.Sleep(10 * time.Minute)
			if !g.running {
				return
			}
			if err := g.history.Save(); err != nil {
				log.Printf("[PositionHistory] Periodic save error: %v", err)
			}
		}
	}
}

func (g *GPSService) GetState() GPSState {
	g.Lock()
	defer g.Unlock()
	
	// Create a deep copy of the state to avoid concurrent map read/write issues during JSON serialization
	stateCopy := GPSState{
		HasFix:          g.state.HasFix,
		Time:            g.state.Time,
		Date:            g.state.Date,
		Latitude:        g.state.Latitude,
		Longitude:       g.state.Longitude,
		Altitude:        g.state.Altitude,
		SpeedKnots:      g.state.SpeedKnots,
		SpeedKmh:        g.state.SpeedKmh,
		DisplaySpeedKmh: g.state.DisplaySpeedKmh,
		IsStationary:    g.state.IsStationary,
		FixQuality:      g.state.FixQuality,
		NumSatellites:   g.state.NumSatellites,
		ActivePort:      g.state.ActivePort,
		Scanning:        g.state.Scanning,
		AvailablePorts:  make([]string, len(g.state.AvailablePorts)),
		Satellites:      make(map[string]map[int64]SatelliteDetail),
	}
	copy(stateCopy.AvailablePorts, g.state.AvailablePorts)

	for constel, sats := range g.state.Satellites {
		stateCopy.Satellites[constel] = make(map[int64]SatelliteDetail)
		for prn, detail := range sats {
			stateCopy.Satellites[constel][prn] = detail
		}
	}

	return stateCopy
}

func (g *GPSService) autoScanLoop() {
	log.Printf("[GPS Scanner] Starting auto-scan loop...")
	for g.running {
		g.Lock()
		activePort := g.state.ActivePort
		g.Unlock()

		if activePort != "" {
			time.Sleep(2 * time.Second)
			continue
		}

		ports, err := serial.GetPortsList()
		if err != nil {
			log.Printf("[GPS Scanner] Error listing serial ports: %v", err)
			time.Sleep(2 * time.Second)
			continue
		}

		if len(ports) == 0 {
			log.Printf("[GPS Scanner] No serial ports found on system.")
		} else {
			log.Printf("[GPS Scanner] Found serial ports: %v", ports)
		}

		g.Lock()
		g.state.AvailablePorts = ports
		g.state.Scanning = true
		g.Unlock()
		g.publishState()

		foundPort := ""
		for _, portName := range ports {
			// Skip typical internal/bluetooth/debug serial interfaces and macOS /dev/tty.* (prefer /dev/cu.*) to avoid long hangs
			if strings.Contains(portName, "Bluetooth") || strings.Contains(portName, "wlan") || 
				strings.Contains(portName, "IncomingPort") || strings.Contains(portName, "debug-console") ||
				strings.HasPrefix(portName, "/dev/tty.") {
				log.Printf("[GPS Scanner] Skipping internal/bluetooth/debug/tty port: %s", portName)
				continue
			}

			// Try common GPS baud rates: 115200 (standard for DOCTORADIO GR7-10HZ), 9600, 38400, 4800
			for _, baud := range []int{115200, 9600, 38400, 4800} {
				log.Printf("[GPS Scanner] Sniffing port %s at %d baud...", portName, baud)
				if g.sniffPort(portName, baud) {
					log.Printf("[GPS Scanner] Valid GPS data detected on port %s at %d baud!", portName, baud)
					foundPort = portName
					g.Lock()
					g.state.ActivePort = portName
					g.state.Scanning = false
					g.Unlock()
					
					// Start continuous reading
					readCtx, cancel := context.WithCancel(context.Background())
					g.Lock()
					g.cancelRead = cancel
					g.Unlock()

					go g.readGpsData(readCtx, portName, baud)
					break
				}
			}
			if foundPort != "" {
				break
			}
		}

		if foundPort == "" {
			log.Printf("[GPS Scanner] No GPS receiver detected in this scan cycle.")
			g.Lock()
			g.state.Scanning = false
			g.Unlock()
			g.publishState()
			time.Sleep(5 * time.Second) // Wait before scanning again
		}
	}
}

func (g *GPSService) sniffPort(portName string, baud int) bool {
	mode := &serial.Mode{
		BaudRate: baud,
		DataBits: 8,
		Parity:   serial.NoParity,
		StopBits: serial.OneStopBit,
	}

	port, err := serial.Open(portName, mode)
	if err != nil {
		log.Printf("[GPS Sniffer] Failed to open port %s: %v", portName, err)
		return false
	}
	defer port.Close()

	// Set a 1-second timeout per read call
	_ = port.SetReadTimeout(1 * time.Second)

	buf := make([]byte, 1024)
	accumulated := ""
	startTime := time.Now()

	// Sniff for at most 2 seconds total per baud rate
	for time.Since(startTime) < 2000*time.Millisecond {
		n, err := port.Read(buf)
		if err != nil {
			log.Printf("[GPS Sniffer] Read error on port %s: %v", portName, err)
			return false
		}
		if n == 0 {
			time.Sleep(50 * time.Millisecond)
			continue
		}

		accumulated += string(buf[:n])

		// Look for NMEA sentence headers in accumulated data
		if strings.Contains(accumulated, "$GP") || strings.Contains(accumulated, "$GN") ||
			strings.Contains(accumulated, "$GL") || strings.Contains(accumulated, "$GA") ||
			strings.Contains(accumulated, "$GB") || strings.Contains(accumulated, "$BD") ||
			strings.Contains(accumulated, "$QZ") {
			log.Printf("[GPS Sniffer] NMEA header matched on port %s at %d baud!", portName, baud)
			return true
		}

		// Prevent accumulated buffer from growing endlessly if receiving non-NMEA data
		if len(accumulated) > 4096 {
			accumulated = accumulated[2048:]
		}
	}

	log.Printf("[GPS Sniffer] Port %s at %d baud did not produce valid NMEA headers within timeout.", portName, baud)
	return false
}

func (g *GPSService) readGpsData(ctx context.Context, portName string, baud int) {
	// Give the OS a moment to release the serial port after sniffPort closes it.
	// This prevents race conditions or hangs in USB serial drivers on Linux.
	time.Sleep(200 * time.Millisecond)

	mode := &serial.Mode{
		BaudRate: baud,
		DataBits: 8,
		Parity:   serial.NoParity,
		StopBits: serial.OneStopBit,
	}

	port, err := serial.Open(portName, mode)
	if err != nil {
		log.Printf("[GPS Scanner] Failed to reopen port %s for continuous read: %v", portName, err)
		g.clearActivePort()
		return
	}
	defer port.Close()

	// Use a background reader loop
	reader := bufio.NewReader(port)
	errChan := make(chan error, 1)

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			default:
				line, err := reader.ReadString('\n')
				if err != nil {
					errChan <- err
					return
				}
				line = strings.TrimSpace(line)
				if line == "" {
					continue
				}

				sentence, err := nmea.Parse(line)
				if err != nil {
					continue
				}

				g.updateState(sentence)
			}
		}
	}()

	// Event publisher ticker (1Hz dashboard refresh)
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case err := <-errChan:
			log.Printf("GPS Serial read error on port %s: %v", portName, err)
			g.clearActivePort()
			return
		case <-ticker.C:
			g.recordPositionSample(time.Now())
			g.publishState()
		}
	}
}

func (g *GPSService) clearActivePort() {
	g.Lock()
	g.state.ActivePort = ""
	g.state.HasFix = false
	g.state.NumSatellites = 0
	g.state.Satellites = make(map[string]map[int64]SatelliteDetail)
	g.Unlock()
	g.publishState()
}

func (g *GPSService) publishState() {
	if g.ctx != nil {
		runtime.EventsEmit(g.ctx, "gps-state-update", g.GetState())
	}
}

func (g *GPSService) updateState(sentence nmea.Sentence) {
	g.Lock()
	defer g.Unlock()

	switch s := sentence.(type) {
	case nmea.RMC:
		g.state.Time = s.Time.String()
		g.state.Date = s.Date.String()
		g.state.SpeedKnots = s.Speed
		g.state.SpeedKmh = s.Speed * 1.852
		if s.Validity == "A" {
			g.state.HasFix = true
			g.state.Latitude = s.Latitude
			g.state.Longitude = s.Longitude
			g.updateSpeedFilterLocked(g.state.SpeedKmh, s.Latitude, s.Longitude, time.Now())
		} else {
			g.state.HasFix = false
			g.state.DisplaySpeedKmh = 0
			g.state.IsStationary = false
			g.hasSpeedSample = false
			g.recentPositions = nil
		}

	case nmea.GGA:
		g.state.Time = s.Time.String()
		g.state.NumSatellites = s.NumSatellites
		g.state.FixQuality = s.FixQuality
		if s.FixQuality != "0" && s.FixQuality != "" {
			g.state.HasFix = true
			g.state.Latitude = s.Latitude
			g.state.Longitude = s.Longitude
			g.state.Altitude = s.Altitude
		} else {
			g.state.HasFix = false
		}

	case nmea.GLL:
		g.state.Time = s.Time.String()
		if s.Validity == "A" {
			g.state.HasFix = true
			g.state.Latitude = s.Latitude
			g.state.Longitude = s.Longitude
		} else {
			g.state.HasFix = false
		}

	case nmea.GSV:
		talker := "GPS"
		switch s.Talker {
		case "GP":
			talker = "GPS"
		case "GL":
			talker = "GLONASS"
		case "GA":
			talker = "Galileo"
		case "GB", "BD":
			talker = "BeiDou"
		case "QZ":
			talker = "みちびき(QZ)"
		}

		if s.MessageNumber == 1 || g.state.Satellites[talker] == nil {
			g.state.Satellites[talker] = make(map[int64]SatelliteDetail)
		}

		qzsTalker := "みちびき(QZ)"
		sbasTalker := "補正信号(SBAS/MSAS)"
		if s.MessageNumber == 1 && s.Talker == "GP" {
			if g.state.Satellites[qzsTalker] == nil {
				g.state.Satellites[qzsTalker] = make(map[int64]SatelliteDetail)
			}
			if g.state.Satellites[sbasTalker] == nil {
				g.state.Satellites[sbasTalker] = make(map[int64]SatelliteDetail)
			}
		}

		for _, info := range s.Info {
			satTalker := talker

			if info.SVPRNNumber >= 193 && info.SVPRNNumber <= 202 {
				satTalker = qzsTalker
				if g.state.Satellites[satTalker] == nil {
					g.state.Satellites[satTalker] = make(map[int64]SatelliteDetail)
				}
				if g.state.Satellites["GPS"] != nil {
					delete(g.state.Satellites["GPS"], info.SVPRNNumber)
				}
			}

			isSBASStandard := info.SVPRNNumber >= 120 && info.SVPRNNumber <= 158
			isSBASCompat := info.SVPRNNumber >= 33 && info.SVPRNNumber <= 64

			if isSBASStandard || isSBASCompat {
				satTalker = sbasTalker
				if g.state.Satellites[satTalker] == nil {
					g.state.Satellites[satTalker] = make(map[int64]SatelliteDetail)
				}
				if g.state.Satellites["GPS"] != nil {
					delete(g.state.Satellites["GPS"], info.SVPRNNumber)
				}
			}

			g.state.Satellites[satTalker][info.SVPRNNumber] = SatelliteDetail{
				PRN:       info.SVPRNNumber,
				Elevation: info.Elevation,
				Azimuth:   info.Azimuth,
				SNR:       info.SNR,
			}
		}
	}
}

func (g *GPSService) ForceScan() {
	g.Lock()
	g.state.ActivePort = ""
	if g.cancelRead != nil {
		g.cancelRead()
	}
	g.Unlock()
}

// updateSpeedFilterLocked smooths raw GNSS speed (EMA) and determines stationary state
// using both smoothed speed and 10-second net displacement with hysteresis.
// Caller must hold g.Mutex.
func (g *GPSService) updateSpeedFilterLocked(rawSpeedKmh, lat, lon float64, now time.Time) {
	const (
		emaAlpha              = 0.25
		stationaryEnterSpeed  = 1.0 // km/h
		stationaryExitSpeed   = 1.8 // km/h
		stationaryEnterDispM  = 5.0 // meters over window
		stationaryExitDispM   = 8.0 // meters over window
		positionWindowSeconds = 10 * time.Second
	)

	if !g.hasSpeedSample {
		g.smoothedSpeedKmh = rawSpeedKmh
		g.hasSpeedSample = true
	} else {
		g.smoothedSpeedKmh = emaAlpha*rawSpeedKmh + (1.0-emaAlpha)*g.smoothedSpeedKmh
	}

	g.recentPositions = append(g.recentPositions, posSample{ts: now, lat: lat, lon: lon})
	cutoff := now.Add(-positionWindowSeconds)
	keepIdx := 0
	for keepIdx < len(g.recentPositions) && g.recentPositions[keepIdx].ts.Before(cutoff) {
		keepIdx++
	}
	if keepIdx > 0 {
		g.recentPositions = append([]posSample(nil), g.recentPositions[keepIdx:]...)
	}

	netDispM := 0.0
	if len(g.recentPositions) >= 2 {
		first := g.recentPositions[0]
		last := g.recentPositions[len(g.recentPositions)-1]
		netDispM = haversineMeters(first.lat, first.lon, last.lat, last.lon)
	}

	if g.state.IsStationary {
		if g.smoothedSpeedKmh >= stationaryExitSpeed || netDispM >= stationaryExitDispM {
			g.state.IsStationary = false
			g.state.DisplaySpeedKmh = g.smoothedSpeedKmh
		} else {
			g.state.DisplaySpeedKmh = 0.0
		}
	} else {
		if g.smoothedSpeedKmh < stationaryEnterSpeed && netDispM < stationaryEnterDispM {
			g.state.IsStationary = true
			g.state.DisplaySpeedKmh = 0.0
		} else {
			g.state.DisplaySpeedKmh = g.smoothedSpeedKmh
		}
	}
}

func (g *GPSService) recordPositionSample(now time.Time) {
	g.Lock()
	hasFix := g.state.HasFix
	lat := g.state.Latitude
	lon := g.state.Longitude
	alt := g.state.Altitude
	g.Unlock()

	if !hasFix {
		return
	}
	g.history.AddSample(now, lat, lon, alt)
}

func (g *GPSService) GetPositionHistory(rangeKey string) PositionHistoryResponse {
	return g.history.GetHistory(rangeKey)
}

func (g *GPSService) ResetPositionOrigin() bool {
	g.Lock()
	hasFix := g.state.HasFix
	lat := g.state.Latitude
	lon := g.state.Longitude
	alt := g.state.Altitude
	g.Unlock()

	return g.history.ResetOrigin(lat, lon, alt, hasFix)
}

func (g *GPSService) ExportPositionHistoryCSV(rangeKey string) (string, error) {
	return g.history.ExportCSV(rangeKey)
}
