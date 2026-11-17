package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
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
	// Initial state of NTP server is stopped, so do not start automatically here.
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

// GetPositionHistory returns aggregated position drift history for the specified range ("1h", "24h", "30d", "all").
func (a *App) GetPositionHistory(rangeKey string) PositionHistoryResponse {
	return a.gpsService.GetPositionHistory(rangeKey)
}

// ResetPositionOrigin sets the reference origin to the current/latest position.
func (a *App) ResetPositionOrigin() bool {
	return a.gpsService.ResetPositionOrigin()
}

// ExportPositionHistoryCSV opens a save file dialog and writes the requested history range as CSV.
func (a *App) ExportPositionHistoryCSV(rangeKey string) (string, error) {
	csvData, err := a.gpsService.ExportPositionHistoryCSV(rangeKey)
	if err != nil {
		return "", err
	}

	defaultName := fmt.Sprintf("twgps_position_%s_%s.csv", rangeKey, time.Now().Format("20060102_150405"))
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Export Position History CSV",
		DefaultFilename: defaultName,
		Filters: []runtime.FileFilter{
			{DisplayName: "CSV Files (*.csv)", Pattern: "*.csv"},
		},
	})
	if err != nil {
		return "", err
	}
	if path == "" {
		return "", nil
	}
	if err := os.WriteFile(path, []byte(csvData), 0644); err != nil {
		return "", err
	}
	return path, nil
}
