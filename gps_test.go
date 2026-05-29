package main

import (
	"testing"

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
