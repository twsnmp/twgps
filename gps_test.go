package main

import (
	"math"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/adrianmo/go-nmea"
)

func TestGPSUpdateState_RMC(t *testing.T) {
	g := NewGPSService()

	// Parse a standard RMC sentence with a valid fix
	sentence, err := nmea.Parse("$GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6A")
	if err != nil {
		t.Fatalf("Failed to parse NMEA sentence: %v", err)
	}

	g.updateState(sentence)
	state := g.GetState()

	if !state.HasFix {
		t.Error("Expected GPS state to have a fix")
	}

	if state.Latitude == 0.0 || state.Longitude == 0.0 {
		t.Errorf("Expected valid Lat/Lon, got Lat: %f, Lon: %f", state.Latitude, state.Longitude)
	}

	if state.Time != "12:35:19.0000" {
		t.Errorf("Expected Time '12:35:19.0000', got '%s'", state.Time)
	}

	if state.Date != "23/03/94" {
		t.Errorf("Expected Date '23/03/94', got '%s'", state.Date)
	}

	// Parse a standard RMC sentence with an invalid fix
	sentenceInvalid, err := nmea.Parse("$GPRMC,123519,V,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*7D")
	if err != nil {
		t.Fatalf("Failed to parse NMEA sentence: %v", err)
	}

	g.updateState(sentenceInvalid)
	state = g.GetState()

	if state.HasFix {
		t.Error("Expected GPS state to not have a fix for invalid sentence")
	}
}

func TestGPSUpdateState_GGA(t *testing.T) {
	g := NewGPSService()

	// Parse a standard GGA sentence with a valid fix
	sentence, err := nmea.Parse("$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47")
	if err != nil {
		t.Fatalf("Failed to parse NMEA sentence: %v", err)
	}

	g.updateState(sentence)
	state := g.GetState()

	if !state.HasFix {
		t.Error("Expected GPS state to have a fix")
	}

	if state.NumSatellites != 8 {
		t.Errorf("Expected 8 satellites, got %d", state.NumSatellites)
	}

	if state.Altitude != 545.4 {
		t.Errorf("Expected altitude 545.4, got %f", state.Altitude)
	}

	// Parse GGA with no fix (FixQuality "0")
	sentenceNoFix, err := nmea.Parse("$GPGGA,123519,4807.038,N,01131.000,E,0,00,99.9,,,,,,*45")
	if err != nil {
		t.Fatalf("Failed to parse NMEA sentence: %v", err)
	}

	g.updateState(sentenceNoFix)
	state = g.GetState()

	if state.HasFix {
		t.Error("Expected GPS state to not have a fix")
	}
}

func TestGPSUpdateState_GSV(t *testing.T) {
	g := NewGPSService()

	// GPS GSV Sentence
	sentence1, err := nmea.Parse("$GPGSV,2,1,08,01,40,083,46,02,17,308,41,12,07,344,39,14,22,228,45*75")
	if err != nil {
		t.Fatalf("Failed to parse GPGSV sentence: %v", err)
	}

	g.updateState(sentence1)
	state := g.GetState()

	gpsSatellites, exists := state.Satellites["GPS"]
	if !exists {
		t.Fatal("Expected 'GPS' category in satellites")
	}

	if len(gpsSatellites) != 4 {
		t.Errorf("Expected 4 satellites, got %d", len(gpsSatellites))
	}

	sat1, exists := gpsSatellites[1]
	if !exists {
		t.Fatal("Expected satellite PRN 1 to exist")
	}
	if sat1.Elevation != 40 || sat1.Azimuth != 83 || sat1.SNR != 46 {
		t.Errorf("Unexpected satellite detail for PRN 1: %+v", sat1)
	}

	// QZSS (Michibiki) SVPRNNumber in GSV (e.g., 193)
	sentence2, err := nmea.Parse("$GPGSV,1,1,01,193,40,083,46*7E")
	if err != nil {
		t.Fatalf("Failed to parse GPGSV sentence: %v", err)
	}

	g.updateState(sentence2)
	state = g.GetState()

	qzssSatellites, exists := state.Satellites["みちびき(QZ)"]
	if !exists {
		t.Fatal("Expected 'みちびき(QZ)' category in satellites")
	}

	if len(qzssSatellites) != 1 {
		t.Errorf("Expected 1 satellite, got %d", len(qzssSatellites))
	}

	sat193, exists := qzssSatellites[193]
	if !exists {
		t.Fatal("Expected satellite PRN 193 to exist")
	}
	if sat193.Elevation != 40 || sat193.SNR != 46 {
		t.Errorf("Unexpected satellite detail for PRN 193: %+v", sat193)
	}
}

func TestSpeedFilter_StationaryAndMoving(t *testing.T) {
	g := NewGPSService()
	baseTime := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)

	// Simulate stationary jitter: 0.4 ~ 0.8 km/h with tiny coordinate noise (< 1m)
	g.Lock()
	for i := 0; i < 5; i++ {
		ts := baseTime.Add(time.Duration(i) * time.Second)
		lat := 35.681200 + float64(i%2)*0.000001
		lon := 139.767100 + float64(i%2)*0.000001
		g.updateSpeedFilterLocked(0.5+float64(i%3)*0.15, lat, lon, ts)
	}
	stationary := g.state.IsStationary
	dispSpeed := g.state.DisplaySpeedKmh
	g.Unlock()

	if !stationary {
		t.Errorf("Expected stationary=true under small jitter, got false (dispSpeed=%.2f)", dispSpeed)
	}
	if dispSpeed != 0.0 {
		t.Errorf("Expected DisplaySpeedKmh=0.0 when stationary, got %.2f", dispSpeed)
	}

	// Simulate real movement: speed 6.0 km/h and moving north ~1.6m/s
	g.Lock()
	for i := 5; i < 15; i++ {
		ts := baseTime.Add(time.Duration(i) * time.Second)
		lat := 35.681200 + float64(i-5)*0.000015 // ~1.67m per second
		lon := 139.767100
		g.updateSpeedFilterLocked(6.0, lat, lon, ts)
	}
	stationary = g.state.IsStationary
	dispSpeed = g.state.DisplaySpeedKmh
	g.Unlock()

	if stationary {
		t.Errorf("Expected stationary=false when moving at 6.0 km/h")
	}
	if dispSpeed < 4.0 {
		t.Errorf("Expected smoothed DisplaySpeedKmh > 4.0 km/h, got %.2f", dispSpeed)
	}
}

func TestPositionHistory_FourTiersAndMillimeterTrend(t *testing.T) {
	h := NewPositionHistory("")
	baseLat := 35.681200000
	baseLon := 139.767100000
	baseAlt := 40.0

	// 1 degree of latitude is ~110,946 meters at 35.68N -> 1 mm ≈ 9.013e-9 deg
	const mmToDegLat = 1.0 / (110946.0 * 1000.0)
	start := time.Date(2025, 1, 1, 0, 0, 0, 0, time.Local)

	// Simulate 365 days, 2 samples per day with symmetric +/- 1.0 m noise (cancels out per day)
	// and a steady northward drift of 5.0 mm/year (~0.01369 mm/day).
	for day := 0; day <= 365; day++ {
		tDay := start.AddDate(0, 0, day)
		driftMm := (5.0 / 365.25) * float64(day)
		noiseDeg := 1.0 * 1000.0 * mmToDegLat // 1m noise

		h.AddSample(tDay.Add(1*time.Hour), baseLat+driftMm*mmToDegLat+noiseDeg, baseLon, baseAlt)
		h.AddSample(tDay.Add(2*time.Hour), baseLat+driftMm*mmToDegLat-noiseDeg, baseLon, baseAlt)
	}

	resp := h.GetHistory("all")
	if !resp.HasOrigin {
		t.Fatal("Expected origin to be set")
	}
	if len(resp.Points) != 366 {
		t.Fatalf("Expected 366 daily buckets, got %d", len(resp.Points))
	}
	if !resp.Stats.HasTrend {
		t.Fatal("Expected HasTrend=true")
	}
	if math.Abs(resp.Stats.TrendNorthMmPerYear-5.0) > 0.2 {
		t.Errorf("Expected TrendNorthMmPerYear ≈ 5.0 mm/yr, got %.3f", resp.Stats.TrendNorthMmPerYear)
	}
	if math.Abs(resp.Stats.TrendEastMmPerYear) > 0.1 {
		t.Errorf("Expected TrendEastMmPerYear ≈ 0.0 mm/yr, got %.3f", resp.Stats.TrendEastMmPerYear)
	}

	// Verify 1h seconds cap (3600)
	hCap := NewPositionHistory("")
	t0 := time.Now().Add(-4000 * time.Second)
	for i := 0; i < 3700; i++ {
		hCap.AddSample(t0.Add(time.Duration(i)*time.Second), baseLat, baseLon, baseAlt)
	}
	secResp := hCap.GetHistory("1h")
	if len(secResp.Points) != maxSecondBuckets {
		t.Errorf("Expected max %d second buckets, got %d", maxSecondBuckets, len(secResp.Points))
	}
}

func TestPositionHistory_SaveLoadAndCSV(t *testing.T) {
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "history.json.gz")

	h1 := NewPositionHistory(path)
	now := time.Now().Truncate(time.Second)
	h1.AddSample(now.Add(-20*time.Second), 35.6812, 139.7671, 40.0)
	h1.AddSample(now.Add(-10*time.Second), 35.6812001, 139.7671001, 40.5)

	if err := h1.Save(); err != nil {
		t.Fatalf("Failed to save history: %v", err)
	}

	h2 := NewPositionHistory(path)
	if err := h2.Load(); err != nil {
		t.Fatalf("Failed to load history: %v", err)
	}

	resp := h2.GetHistory("all")
	if !resp.HasOrigin {
		t.Fatal("Expected restored origin")
	}
	if resp.Stats.TotalSamples != 2 {
		t.Errorf("Expected TotalSamples=2, got %d", resp.Stats.TotalSamples)
	}
	if len(resp.Points) != 1 {
		t.Errorf("Expected 1 daily bucket, got %d", len(resp.Points))
	}

	csvStr, err := h2.ExportCSV("1h")
	if err != nil {
		t.Fatalf("ExportCSV failed: %v", err)
	}
	lines := strings.Split(strings.TrimSpace(csvStr), "\n")
	if len(lines) != 3 { // header + 2 rows
		t.Errorf("Expected 3 CSV lines, got %d:\n%s", len(lines), csvStr)
	}
}
