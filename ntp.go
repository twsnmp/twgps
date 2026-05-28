package main

import (
	"encoding/binary"
	"fmt"
	"net"
	"sync"
	"time"
)

const (
	ntpEpochOffset = 2208988800 // Secs between 1900 and 1970
)

type NTPServer struct {
	sync.Mutex
	conn        *net.UDPConn
	gpsService  *GPSService
	port        int
	running     bool
	clientCount int
	stopChan    chan struct{}
}

func NewNTPServer(gps *GPSService) *NTPServer {
	return &NTPServer{
		gpsService: gps,
		port:       123, // Default to standard port 123
		stopChan:   make(chan struct{}),
	}
}

type NTPServerStats struct {
	Running     bool `json:"running"`
	Port        int  `json:"port"`
	ClientCount int  `json:"clientCount"`
}

func (n *NTPServer) GetStats() NTPServerStats {
	n.Lock()
	defer n.Unlock()
	return NTPServerStats{
		Running:     n.running,
		Port:        n.port,
		ClientCount: n.clientCount,
	}
}

func (n *NTPServer) Start(port int) error {
	n.Lock()
	if n.running {
		n.Unlock()
		return fmt.Errorf("NTP server already running")
	}
	n.port = port
	n.Unlock()

	addr, err := net.ResolveUDPAddr("udp", fmt.Sprintf(":%d", port))
	if err != nil {
		return err
	}

	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		return err
	}

	n.Lock()
	n.conn = conn
	n.running = true
	n.stopChan = make(chan struct{})
	n.Unlock()

	go n.serve()
	return nil
}

func (n *NTPServer) Stop() {
	n.Lock()
	if !n.running {
		n.Unlock()
		return
	}
	n.running = false
	if n.conn != nil {
		n.conn.Close()
	}
	close(n.stopChan)
	n.clientCount = 0
	n.Unlock()
}

func (n *NTPServer) serve() {
	buf := make([]byte, 1024)
	for {
		n.Lock()
		running := n.running
		n.Unlock()
		if !running {
			break
		}

		nbytes, raddr, err := n.conn.ReadFromUDP(buf)
		if err != nil {
			continue
		}

		if nbytes < 48 {
			continue // Invalid packet size
		}

		// Handle NTP packet
		recTime := time.Now()
		go n.handleRequest(buf[:nbytes], raddr, recTime)
	}
}

// Convert time to 64-bit NTP timestamp
func timeToNtp(t time.Time) uint64 {
	secs := uint64(t.Unix() + ntpEpochOffset)
	nanos := uint64(t.Nanosecond())
	frac := (nanos << 32) / 1000000000
	return (secs << 32) | frac
}

func (n *NTPServer) handleRequest(req []byte, raddr *net.UDPAddr, recTime time.Time) {
	n.Lock()
	n.clientCount++
	n.Unlock()

	// Parse client VN (version) and Mode
	liVnMode := req[0]
	vn := (liVnMode >> 3) & 0x07
	clientTransmitTimestamp := req[40:48]

	// Formulate Server Response
	resp := make([]byte, 48)

	// Byte 0: LI=0 (No warning), VN=Client Version, Mode=4 (Server)
	resp[0] = (0 << 6) | (vn << 3) | 4

	// Stratum: 1 (Primary reference / GPS)
	resp[1] = 1

	// Poll and Precision
	resp[2] = 4    // Log2 poll interval (min value)
	precision := int8(-20)
	resp[3] = byte(precision)  // Log2 precision (approx 1 microsecond)

	// Root Delay & Root Dispersion (0 for Stratum 1)
	binary.BigEndian.PutUint32(resp[4:8], 0)
	binary.BigEndian.PutUint32(resp[8:12], 0)

	// Reference Identifier: "GPS "
	copy(resp[12:16], []byte("GPS "))

	// Get latest GPS update time or fallback to system time
	refTime := recTime
	gpsState := n.gpsService.GetState()
	if gpsState.HasFix && gpsState.Date != "" && gpsState.Time != "" {
		if t, err := time.Parse("2006-01-02 15:04:05", gpsState.Date+" "+gpsState.Time); err == nil {
			refTime = t
		}
	}

	// Timestamps
	binary.BigEndian.PutUint64(resp[16:24], timeToNtp(refTime))                 // Reference Timestamp
	copy(resp[24:32], clientTransmitTimestamp)                                  // Originate Timestamp
	binary.BigEndian.PutUint64(resp[32:40], timeToNtp(recTime))                 // Receive Timestamp
	binary.BigEndian.PutUint64(resp[40:48], timeToNtp(time.Now()))              // Transmit Timestamp

	n.Lock()
	conn := n.conn
	n.Unlock()

	if conn != nil {
		_, _ = conn.WriteToUDP(resp, raddr)
	}
}
