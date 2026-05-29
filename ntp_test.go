package main

import (
	"fmt"
	"net"
	"testing"
	"time"
)

func TestTimeToNtp(t *testing.T) {
	testTime := time.Date(2026, 5, 29, 16, 0, 0, 0, time.UTC)
	ntpTime := timeToNtp(testTime)

	// Check if the seconds part is correct
	secs := ntpTime >> 32
	expectedSecs := uint64(testTime.Unix() + ntpEpochOffset)
	if secs != expectedSecs {
		t.Errorf("Expected seconds %d, got %d", expectedSecs, secs)
	}

	// Verify fractional part
	nanos := uint64(testTime.Nanosecond())
	expectedFrac := (nanos << 32) / 1000000000
	frac := ntpTime & 0xFFFFFFFF
	if frac != expectedFrac {
		t.Errorf("Expected fractional part %d, got %d", expectedFrac, frac)
	}
}

func TestNTPServer(t *testing.T) {
	gps := NewGPSService()
	server := NewNTPServer(gps)

	// Start server on a dynamic port (0 lets the OS pick one)
	err := server.Start(0)
	if err != nil {
		t.Fatalf("Failed to start NTP server: %v", err)
	}
	defer server.Stop()

	stats := server.GetStats()
	if !stats.Running {
		t.Fatal("Expected NTP server to be running")
	}

	// Retrieve actual listening port
	server.Lock()
	connAddr := server.conn.LocalAddr()
	server.Unlock()

	udpAddr, ok := connAddr.(*net.UDPAddr)
	if !ok {
		t.Fatalf("Expected UDPAddr, got %T", connAddr)
	}
	port := udpAddr.Port

	// Set up UDP client
	raddr, err := net.ResolveUDPAddr("udp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		t.Fatalf("Failed to resolve UDP address: %v", err)
	}

	conn, err := net.DialUDP("udp", nil, raddr)
	if err != nil {
		t.Fatalf("Failed to dial UDP: %v", err)
	}
	defer conn.Close()

	// Send an NTP client request packet (48 bytes, VN=4, Mode=3)
	req := make([]byte, 48)
	req[0] = (0 << 6) | (4 << 3) | 3 // LI=0, VN=4, Mode=3

	_, err = conn.Write(req)
	if err != nil {
		t.Fatalf("Failed to write UDP request: %v", err)
	}

	// Read response
	resp := make([]byte, 1024)
	err = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	if err != nil {
		t.Fatalf("Failed to set read deadline: %v", err)
	}

	n, err := conn.Read(resp)
	if err != nil {
		t.Fatalf("Failed to read UDP response: %v", err)
	}

	if n < 48 {
		t.Errorf("Expected response size to be at least 48 bytes, got %d", n)
	}

	// Verify server response mode (4)
	liVnMode := resp[0]
	mode := liVnMode & 0x07
	if mode != 4 {
		t.Errorf("Expected NTP mode 4 (server), got %d", mode)
	}

	// Verify Stratum (1 for Stratum 1 / GPS)
	stratum := resp[1]
	if stratum != 1 {
		t.Errorf("Expected stratum 1, got %d", stratum)
	}

	// Verify Reference Identifier is "GPS "
	refID := string(resp[12:16])
	if refID != "GPS " {
		t.Errorf("Expected Reference ID 'GPS ', got %q", refID)
	}

	// Check client stats tracking
	time.Sleep(100 * time.Millisecond) // Wait for async packet handling
	stats = server.GetStats()
	if stats.ClientCount != 1 {
		t.Errorf("Expected client count to be 1, got %d", stats.ClientCount)
	}
}
