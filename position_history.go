package main

import (
	"compress/gzip"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const (
	// WGS84 ellipsoid constants for accurate local meter/millimeter conversion
	wgs84A  = 6378137.0
	wgs84E2 = 6.69437999014e-3

	maxSecondBuckets = 3600 // 1 hour at 1s resolution
	maxMinuteBuckets = 1440 // 24 hours at 1m resolution
	maxHourBuckets   = 720  // 30 days at 1h resolution
)

// PositionBucket stores aggregated GNSS position statistics for a time bucket.
// MeanLat, MeanLon, and MeanAlt are updated incrementally via online averaging
// so that random noise cancels out over long periods without scalar distance bias.
type PositionBucket struct {
	Timestamp int64   `json:"ts"`
	Count     int64   `json:"count"`
	MeanLat   float64 `json:"meanLat"`
	MeanLon   float64 `json:"meanLon"`
	MeanAlt   float64 `json:"meanAlt"`
	MinDistM  float64 `json:"minDistM"`
	MaxDistM  float64 `json:"maxDistM"`
}

// PersistedPositionHistory is the on-disk representation of long-term position logs.
type PersistedPositionHistory struct {
	Version      int              `json:"version"`
	HasOrigin    bool             `json:"hasOrigin"`
	OriginLat    float64          `json:"originLat"`
	OriginLon    float64          `json:"originLon"`
	OriginAlt    float64          `json:"originAlt"`
	OriginSetAt  int64            `json:"originSetAt"`
	TotalSamples int64            `json:"totalSamples"`
	FirstSeenAt  int64            `json:"firstSeenAt"`
	LastSeenAt   int64            `json:"lastSeenAt"`
	Seconds      []PositionBucket `json:"seconds"`
	Minutes      []PositionBucket `json:"minutes"`
	Hours        []PositionBucket `json:"hours"`
	Days         []PositionBucket `json:"days"`
}

// HistoryPoint is a frontend-friendly point relative to the reference origin.
type HistoryPoint struct {
	Timestamp    int64   `json:"ts"`
	Count        int64   `json:"count"`
	DeltaNorthMm float64 `json:"deltaNorthMm"`
	DeltaEastMm  float64 `json:"deltaEastMm"`
	DeltaAltMm   float64 `json:"deltaAltMm"`
	DistMm       float64 `json:"distMm"`
	MinDistM     float64 `json:"minDistM"`
	MaxDistM     float64 `json:"maxDistM"`
}

// HistoryStats summarizes drift and long-term linear trend.
type HistoryStats struct {
	TotalSamples         int64   `json:"totalSamples"`
	FirstSeenAt          int64   `json:"firstSeenAt"`
	LastSeenAt           int64   `json:"lastSeenAt"`
	DurationSeconds      int64   `json:"durationSeconds"`
	LatestDeltaNorthMm   float64 `json:"latestDeltaNorthMm"`
	LatestDeltaEastMm    float64 `json:"latestDeltaEastMm"`
	LatestDeltaAltMm     float64 `json:"latestDeltaAltMm"`
	LatestDistMm         float64 `json:"latestDistMm"`
	MeanDistM            float64 `json:"meanDistM"`
	MaxDistM             float64 `json:"maxDistM"`
	HasTrend             bool    `json:"hasTrend"`
	TrendNorthMmPerYear  float64 `json:"trendNorthMmPerYear"`
	TrendEastMmPerYear   float64 `json:"trendEastMmPerYear"`
	TrendAltMmPerYear    float64 `json:"trendAltMmPerYear"`
	TrendSpeedMmPerYear  float64 `json:"trendSpeedMmPerYear"`
	TrendBearingDeg      float64 `json:"trendBearingDeg"`
	TrendSpanDays        float64 `json:"trendSpanDays"`
}

// PositionHistoryResponse is returned to the frontend for graphing.
type PositionHistoryResponse struct {
	Range       string         `json:"range"`
	HasOrigin   bool           `json:"hasOrigin"`
	OriginLat   float64        `json:"originLat"`
	OriginLon   float64        `json:"originLon"`
	OriginAlt   float64        `json:"originAlt"`
	OriginSetAt int64          `json:"originSetAt"`
	Points      []HistoryPoint `json:"points"`
	Stats       HistoryStats   `json:"stats"`
}

// PositionHistory manages 4-tier position aggregation and persistence.
type PositionHistory struct {
	mu       sync.RWMutex
	filePath string
	data     PersistedPositionHistory
	dirty    bool
}

// DefaultHistoryFilePath returns the OS user config path for twgps history.
func DefaultHistoryFilePath() string {
	dir, err := os.UserConfigDir()
	if err != nil || dir == "" {
		dir = os.TempDir()
	}
	return filepath.Join(dir, "twgps", "position_history.json.gz")
}

// NewPositionHistory creates a new PositionHistory manager.
func NewPositionHistory(filePath string) *PositionHistory {
	return &PositionHistory{
		filePath: filePath,
		data: PersistedPositionHistory{
			Version: 1,
		},
	}
}

// latLonToLocalMeters converts (lat, lon, alt) relative to origin (lat0, lon0, alt0)
// into North, East, and Up/Alt displacements in meters using WGS84 local radii.
func latLonToLocalMeters(lat0, lon0, alt0, lat, lon, alt float64) (dNorth, dEast, dAlt float64) {
	phi0 := lat0 * math.Pi / 180.0
	sinPhi := math.Sin(phi0)
	denom := 1.0 - wgs84E2*sinPhi*sinPhi
	sqrtDenom := math.Sqrt(denom)

	// Meridian radius of curvature (M) and prime vertical radius (N)
	m := wgs84A * (1.0 - wgs84E2) / (denom * sqrtDenom)
	n := wgs84A / sqrtDenom

	dLatRad := (lat - lat0) * math.Pi / 180.0
	dLonRad := (lon - lon0) * math.Pi / 180.0

	dNorth = dLatRad * m
	dEast = dLonRad * n * math.Cos(phi0)
	dAlt = alt - alt0
	return dNorth, dEast, dAlt
}

// haversineMeters returns horizontal distance in meters between two WGS84 coordinates.
func haversineMeters(lat1, lon1, lat2, lon2 float64) float64 {
	const earthR = 6371000.0
	phi1 := lat1 * math.Pi / 180.0
	phi2 := lat2 * math.Pi / 180.0
	dPhi := (lat2 - lat1) * math.Pi / 180.0
	dLambda := (lon2 - lon1) * math.Pi / 180.0

	a := math.Sin(dPhi/2)*math.Sin(dPhi/2) +
		math.Cos(phi1)*math.Cos(phi2)*math.Sin(dLambda/2)*math.Sin(dLambda/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return earthR * c
}

// AddSample records a valid GNSS fix into all 4 time-resolution tiers.
func (h *PositionHistory) AddSample(t time.Time, lat, lon, alt float64) {
	if math.IsNaN(lat) || math.IsNaN(lon) || math.IsNaN(alt) {
		return
	}
	if lat == 0 && lon == 0 {
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	ts := t.Unix()
	if !h.data.HasOrigin {
		h.data.HasOrigin = true
		h.data.OriginLat = lat
		h.data.OriginLon = lon
		h.data.OriginAlt = alt
		h.data.OriginSetAt = ts
	}

	if h.data.FirstSeenAt == 0 || ts < h.data.FirstSeenAt {
		h.data.FirstSeenAt = ts
	}
	if ts > h.data.LastSeenAt {
		h.data.LastSeenAt = ts
	}
	h.data.TotalSamples++

	dN, dE, _ := latLonToLocalMeters(h.data.OriginLat, h.data.OriginLon, h.data.OriginAlt, lat, lon, alt)
	distM := math.Hypot(dN, dE)

	secTs := ts
	minTs := (ts / 60) * 60
	hourTs := (ts / 3600) * 3600
	lt := t.Local()
	dayTs := time.Date(lt.Year(), lt.Month(), lt.Day(), 0, 0, 0, 0, lt.Location()).Unix()

	h.data.Seconds = upsertBucket(h.data.Seconds, secTs, lat, lon, alt, distM, maxSecondBuckets)
	h.data.Minutes = upsertBucket(h.data.Minutes, minTs, lat, lon, alt, distM, maxMinuteBuckets)
	h.data.Hours = upsertBucket(h.data.Hours, hourTs, lat, lon, alt, distM, maxHourBuckets)
	h.data.Days = upsertBucket(h.data.Days, dayTs, lat, lon, alt, distM, 0) // 0 = unlimited for multi-year retention

	h.dirty = true
}

func upsertBucket(buckets []PositionBucket, bucketTs int64, lat, lon, alt, distM float64, maxLen int) []PositionBucket {
	n := len(buckets)
	if n > 0 && buckets[n-1].Timestamp == bucketTs {
		b := &buckets[n-1]
		b.Count++
		c := float64(b.Count)
		b.MeanLat += (lat - b.MeanLat) / c
		b.MeanLon += (lon - b.MeanLon) / c
		b.MeanAlt += (alt - b.MeanAlt) / c
		if distM < b.MinDistM {
			b.MinDistM = distM
		}
		if distM > b.MaxDistM {
			b.MaxDistM = distM
		}
		return buckets
	}

	// Handle rare out-of-order timestamp if clock jumped backward slightly
	for i := n - 1; i >= 0 && i >= n-5; i-- {
		if buckets[i].Timestamp == bucketTs {
			b := &buckets[i]
			b.Count++
			c := float64(b.Count)
			b.MeanLat += (lat - b.MeanLat) / c
			b.MeanLon += (lon - b.MeanLon) / c
			b.MeanAlt += (alt - b.MeanAlt) / c
			if distM < b.MinDistM {
				b.MinDistM = distM
			}
			if distM > b.MaxDistM {
				b.MaxDistM = distM
			}
			return buckets
		}
	}

	buckets = append(buckets, PositionBucket{
		Timestamp: bucketTs,
		Count:     1,
		MeanLat:   lat,
		MeanLon:   lon,
		MeanAlt:   alt,
		MinDistM:  distM,
		MaxDistM:  distM,
	})

	if maxLen > 0 && len(buckets) > maxLen {
		excess := len(buckets) - maxLen
		// Copy to release old backing array memory
		trimmed := make([]PositionBucket, maxLen)
		copy(trimmed, buckets[excess:])
		buckets = trimmed
	}
	return buckets
}

// ResetOrigin updates the reference origin to the latest recorded position (or provided fallback)
// and recalculates MinDistM/MaxDistM approximations for existing buckets.
func (h *PositionHistory) ResetOrigin(fallbackLat, fallbackLon, fallbackAlt float64, hasFix bool) bool {
	h.mu.Lock()
	defer h.mu.Unlock()

	var newLat, newLon, newAlt float64
	found := false

	if n := len(h.data.Seconds); n > 0 {
		last := h.data.Seconds[n-1]
		newLat, newLon, newAlt = last.MeanLat, last.MeanLon, last.MeanAlt
		found = true
	} else if hasFix && (fallbackLat != 0 || fallbackLon != 0) {
		newLat, newLon, newAlt = fallbackLat, fallbackLon, fallbackAlt
		found = true
	}

	if !found {
		return false
	}

	h.data.HasOrigin = true
	h.data.OriginLat = newLat
	h.data.OriginLon = newLon
	h.data.OriginAlt = newAlt
	h.data.OriginSetAt = time.Now().Unix()

	recalcBucketDist := func(buckets []PositionBucket) {
		for i := range buckets {
			dN, dE, _ := latLonToLocalMeters(newLat, newLon, newAlt, buckets[i].MeanLat, buckets[i].MeanLon, buckets[i].MeanAlt)
			d := math.Hypot(dN, dE)
			buckets[i].MinDistM = d
			buckets[i].MaxDistM = d
		}
	}
	recalcBucketDist(h.data.Seconds)
	recalcBucketDist(h.data.Minutes)
	recalcBucketDist(h.data.Hours)
	recalcBucketDist(h.data.Days)

	h.dirty = true
	return true
}

// GetHistory returns points and statistics for the requested range ("1h", "24h", "30d", "all").
func (h *PositionHistory) GetHistory(rangeKey string) PositionHistoryResponse {
	h.mu.RLock()
	defer h.mu.RUnlock()

	resp := PositionHistoryResponse{
		Range:       rangeKey,
		HasOrigin:   h.data.HasOrigin,
		OriginLat:   h.data.OriginLat,
		OriginLon:   h.data.OriginLon,
		OriginAlt:   h.data.OriginAlt,
		OriginSetAt: h.data.OriginSetAt,
		Points:      []HistoryPoint{},
		Stats: HistoryStats{
			TotalSamples: h.data.TotalSamples,
			FirstSeenAt:  h.data.FirstSeenAt,
			LastSeenAt:   h.data.LastSeenAt,
		},
	}

	if h.data.FirstSeenAt > 0 && h.data.LastSeenAt >= h.data.FirstSeenAt {
		resp.Stats.DurationSeconds = h.data.LastSeenAt - h.data.FirstSeenAt
	}

	if !h.data.HasOrigin {
		return resp
	}

	var src []PositionBucket
	switch rangeKey {
	case "1h":
		src = h.data.Seconds
	case "24h":
		src = h.data.Minutes
	case "30d":
		src = h.data.Hours
	case "all":
		src = h.data.Days
	default:
		resp.Range = "1h"
		src = h.data.Seconds
	}

	points := make([]HistoryPoint, 0, len(src))
	var sumDistM float64
	var maxDistM float64

	for _, b := range src {
		dN, dE, dAlt := latLonToLocalMeters(
			h.data.OriginLat, h.data.OriginLon, h.data.OriginAlt,
			b.MeanLat, b.MeanLon, b.MeanAlt,
		)
		distM := math.Hypot(dN, dE)
		sumDistM += distM
		if b.MaxDistM > maxDistM {
			maxDistM = b.MaxDistM
		}
		if distM > maxDistM {
			maxDistM = distM
		}

		points = append(points, HistoryPoint{
			Timestamp:    b.Timestamp,
			Count:        b.Count,
			DeltaNorthMm: dN * 1000.0,
			DeltaEastMm:  dE * 1000.0,
			DeltaAltMm:   dAlt * 1000.0,
			DistMm:       distM * 1000.0,
			MinDistM:     b.MinDistM,
			MaxDistM:     b.MaxDistM,
		})
	}

	resp.Points = points
	if len(points) > 0 {
		last := points[len(points)-1]
		resp.Stats.LatestDeltaNorthMm = last.DeltaNorthMm
		resp.Stats.LatestDeltaEastMm = last.DeltaEastMm
		resp.Stats.LatestDeltaAltMm = last.DeltaAltMm
		resp.Stats.LatestDistMm = last.DistMm
		resp.Stats.MeanDistM = sumDistM / float64(len(points))
		resp.Stats.MaxDistM = maxDistM
	}

	// Calculate long-term linear regression trend.
	// Prefer daily buckets for multi-day trends; fall back to current view points if < 2 days.
	trendSource := points
	if len(h.data.Days) >= 2 {
		dayPts := make([]HistoryPoint, len(h.data.Days))
		for i, b := range h.data.Days {
			dN, dE, dAlt := latLonToLocalMeters(
				h.data.OriginLat, h.data.OriginLon, h.data.OriginAlt,
				b.MeanLat, b.MeanLon, b.MeanAlt,
			)
			dayPts[i] = HistoryPoint{
				Timestamp:    b.Timestamp,
				DeltaNorthMm: dN * 1000.0,
				DeltaEastMm:  dE * 1000.0,
				DeltaAltMm:   dAlt * 1000.0,
			}
		}
		trendSource = dayPts
	}

	computeLinearTrend(trendSource, &resp.Stats)
	return resp
}

// computeLinearTrend fits ordinary least squares lines for North, East, and Alt (mm/year).
func computeLinearTrend(pts []HistoryPoint, stats *HistoryStats) {
	n := len(pts)
	if n < 2 {
		return
	}
	t0 := pts[0].Timestamp
	spanSec := pts[n-1].Timestamp - t0
	if spanSec <= 0 {
		return
	}

	const secondsPerYear = 365.25 * 86400.0
	var sumX, sumYN, sumYE, sumYA float64
	for _, p := range pts {
		x := float64(p.Timestamp-t0) / secondsPerYear // years
		sumX += x
		sumYN += p.DeltaNorthMm
		sumYE += p.DeltaEastMm
		sumYA += p.DeltaAltMm
	}
	fn := float64(n)
	meanX := sumX / fn
	meanYN := sumYN / fn
	meanYE := sumYE / fn
	meanYA := sumYA / fn

	var sxx, sxyN, sxyE, sxyA float64
	for _, p := range pts {
		dx := float64(p.Timestamp-t0)/secondsPerYear - meanX
		sxx += dx * dx
		sxyN += dx * (p.DeltaNorthMm - meanYN)
		sxyE += dx * (p.DeltaEastMm - meanYE)
		sxyA += dx * (p.DeltaAltMm - meanYA)
	}
	if sxx == 0 {
		return
	}

	slopeN := sxyN / sxx
	slopeE := sxyE / sxx
	slopeA := sxyA / sxx

	bearing := math.Atan2(slopeE, slopeN) * 180.0 / math.Pi
	if bearing < 0 {
		bearing += 360.0
	}

	stats.HasTrend = true
	stats.TrendNorthMmPerYear = slopeN
	stats.TrendEastMmPerYear = slopeE
	stats.TrendAltMmPerYear = slopeA
	stats.TrendSpeedMmPerYear = math.Hypot(slopeN, slopeE)
	stats.TrendBearingDeg = bearing
	stats.TrendSpanDays = float64(spanSec) / 86400.0
}

// ExportCSV formats the requested range into a CSV string.
func (h *PositionHistory) ExportCSV(rangeKey string) (string, error) {
	resp := h.GetHistory(rangeKey)

	var sb strings.Builder
	w := csv.NewWriter(&sb)
	if err := w.Write([]string{
		"timestamp_iso",
		"unix_ts",
		"samples",
		"delta_north_mm",
		"delta_east_mm",
		"delta_alt_mm",
		"distance_mm",
		"min_dist_m",
		"max_dist_m",
	}); err != nil {
		return "", err
	}

	for _, p := range resp.Points {
		iso := time.Unix(p.Timestamp, 0).Local().Format(time.RFC3339)
		row := []string{
			iso,
			fmt.Sprintf("%d", p.Timestamp),
			fmt.Sprintf("%d", p.Count),
			fmt.Sprintf("%.3f", p.DeltaNorthMm),
			fmt.Sprintf("%.3f", p.DeltaEastMm),
			fmt.Sprintf("%.3f", p.DeltaAltMm),
			fmt.Sprintf("%.3f", p.DistMm),
			fmt.Sprintf("%.4f", p.MinDistM),
			fmt.Sprintf("%.4f", p.MaxDistM),
		}
		if err := w.Write(row); err != nil {
			return "", err
		}
	}
	w.Flush()
	if err := w.Error(); err != nil {
		return "", err
	}
	return sb.String(), nil
}

// Load restores persisted position history from disk if available.
func (h *PositionHistory) Load() error {
	if h.filePath == "" {
		return nil
	}

	f, err := os.Open(h.filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	defer f.Close()

	gz, err := gzip.NewReader(f)
	if err != nil {
		return err
	}
	defer gz.Close()

	var loaded PersistedPositionHistory
	if err := json.NewDecoder(gz).Decode(&loaded); err != nil {
		return err
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	now := time.Now().Unix()
	loaded.Seconds = trimOlderThan(loaded.Seconds, now-3600, maxSecondBuckets)
	loaded.Minutes = trimOlderThan(loaded.Minutes, now-86400, maxMinuteBuckets)
	loaded.Hours = trimOlderThan(loaded.Hours, now-30*86400, maxHourBuckets)

	h.data = loaded
	h.dirty = false
	return nil
}

func trimOlderThan(buckets []PositionBucket, cutoff int64, maxLen int) []PositionBucket {
	idx := 0
	for idx < len(buckets) && buckets[idx].Timestamp < cutoff {
		idx++
	}
	if idx > 0 {
		buckets = buckets[idx:]
	}
	if maxLen > 0 && len(buckets) > maxLen {
		buckets = buckets[len(buckets)-maxLen:]
	}
	res := make([]PositionBucket, len(buckets))
	copy(res, buckets)
	return res
}

// Save atomically persists the position history to disk using gzip-compressed JSON.
func (h *PositionHistory) Save() error {
	if h.filePath == "" {
		return nil
	}

	h.mu.RLock()
	if !h.dirty {
		h.mu.RUnlock()
		return nil
	}
	// Shallow-copy header and slices under read lock
	snapshot := h.data
	snapshot.Seconds = append([]PositionBucket(nil), h.data.Seconds...)
	snapshot.Minutes = append([]PositionBucket(nil), h.data.Minutes...)
	snapshot.Hours = append([]PositionBucket(nil), h.data.Hours...)
	snapshot.Days = append([]PositionBucket(nil), h.data.Days...)
	h.mu.RUnlock()

	dir := filepath.Dir(h.filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	tmpPath := h.filePath + ".tmp"
	f, err := os.Create(tmpPath)
	if err != nil {
		return err
	}

	gz := gzip.NewWriter(f)
	encErr := json.NewEncoder(gz).Encode(&snapshot)
	closeGzErr := gz.Close()
	closeFileErr := f.Close()

	if encErr != nil {
		_ = os.Remove(tmpPath)
		return encErr
	}
	if closeGzErr != nil {
		_ = os.Remove(tmpPath)
		return closeGzErr
	}
	if closeFileErr != nil {
		_ = os.Remove(tmpPath)
		return closeFileErr
	}

	if err := os.Rename(tmpPath, h.filePath); err != nil {
		_ = os.Remove(tmpPath)
		return err
	}

	h.mu.Lock()
	h.dirty = false
	h.mu.Unlock()
	return nil
}
