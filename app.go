package main

import (
	"context"
	"fmt"
)

// App struct
type App struct {
	ctx        context.Context
	gpsService *GPSService
	ntpServer  *NTPServer
}

// NewApp creates a new App application struct
func NewApp() *App {
	gps := NewGPSService()
	ntp := NewNTPServer(gps)
	return &App{
		gpsService: gps,
		ntpServer:  ntp,
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.gpsService.Start(ctx)
	// Start NTP server automatically on default port 1230 (non-privileged)
	_ = a.ntpServer.Start(1230)
}

// shutdown is called when the application is terminating
func (a *App) shutdown(ctx context.Context) {
	a.gpsService.Stop()
	a.ntpServer.Stop()
}

// GetGPSState returns the current GPS status and satellite info
func (a *App) GetGPSState() GPSState {
	return a.gpsService.GetState()
}

// ForceGPSScan resets the active GPS connection and rescans
func (a *App) ForceGPSScan() {
	a.gpsService.ForceScan()
}

// GetNTPServerStats returns current running stats of the NTP server
func (a *App) GetNTPServerStats() NTPServerStats {
	return a.ntpServer.GetStats()
}

// ToggleNTPServer controls starting and stopping of the NTP server
func (a *App) ToggleNTPServer(enabled bool, port int) string {
	if enabled {
		a.ntpServer.Stop()
		err := a.ntpServer.Start(port)
		if err != nil {
			return fmt.Sprintf("Error starting NTP: %v", err)
		}
		return "NTP server started successfully"
	}
	a.ntpServer.Stop()
	return "NTP server stopped"
}
