// Package main implements the NEO Tracker backend.
// It proxies the NASA NeoWS API, normalises the nested date-keyed response
// into a flat sorted slice, and exposes three endpoints:
//
//	GET /api/neo/feed    — NEOs for the next 7 days
//	GET /api/neo/{id}    — raw NASA JPL detail for a single asteroid
//	GET /health          — liveness probe
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"
)

const nasaAPIKey = "pdkwwOmrwfdkqeJW31ohOEb6TGQHqqIfLe1SUeTc"

// port reads the PORT env var injected by Railway (and similar platforms).
// Falls back to 7777 for local development.
func port() string {
	if p := os.Getenv("PORT"); p != "" {
		return ":" + p
	}
	return ":7777"
}

// nasaBaseURL is a var rather than a const so tests can redirect requests to
// an httptest.Server without spawning a real internet connection.
var nasaBaseURL = "https://api.nasa.gov/neo/rest/v1"

// corsMiddleware adds permissive CORS headers so the Vite dev server (which
// runs on a different port) can call this API during local development.
func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

// neoFeedHandler fetches the NeoWS feed for a 7-day window (defaulting to
// today + 7 days) and returns a normalised NEOResponse JSON object.
func neoFeedHandler(w http.ResponseWriter, r *http.Request) {
	now := time.Now()
	startDate := now.Format("2006-01-02")
	endDate := now.AddDate(0, 0, 7).Format("2006-01-02")

	if s := r.URL.Query().Get("start_date"); s != "" {
		startDate = s
	}
	if e := r.URL.Query().Get("end_date"); e != "" {
		endDate = e
	}

	url := fmt.Sprintf("%s/feed?start_date=%s&end_date=%s&api_key=%s",
		nasaBaseURL, startDate, endDate, nasaAPIKey)

	resp, err := http.Get(url)
	if err != nil {
		http.Error(w, `{"error":"Failed to fetch NASA data"}`, http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, `{"error":"Failed to read response"}`, http.StatusInternalServerError)
		return
	}

	var raw map[string]interface{}
	if err := json.Unmarshal(body, &raw); err != nil {
		http.Error(w, `{"error":"Failed to parse response"}`, http.StatusInternalServerError)
		return
	}

	neos := transformNEOs(raw)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(neos)
}

// NEO holds the normalised fields the frontend needs for display.
// Only the data available from the NeoWS feed endpoint is populated here;
// richer orbital data requires a separate lookup by ID.
type NEO struct {
	ID                     string  `json:"id"`
	Name                   string  `json:"name"`
	NasaURL                string  `json:"nasa_url"`
	AbsMagnitude           float64 `json:"absolute_magnitude"`
	EstDiameterMinKm       float64 `json:"est_diameter_min_km"`
	EstDiameterMaxKm       float64 `json:"est_diameter_max_km"`
	IsPotentiallyHazardous bool    `json:"is_potentially_hazardous"`
	CloseApproachDate      string  `json:"close_approach_date"`
	CloseApproachTime      string  `json:"close_approach_time"`
	MissDistanceKm         float64 `json:"miss_distance_km"`
	MissDistanceLunar      float64 `json:"miss_distance_lunar"` // 1 LD ≈ 384,400 km
	RelativeVelocityKmh    float64 `json:"relative_velocity_kmh"`
	OrbitingBody           string  `json:"orbiting_body"`
}

type NEOResponse struct {
	StartDate    string `json:"start_date"`
	EndDate      string `json:"end_date"`
	TotalObjects int    `json:"total_objects"`
	NEOs         []NEO  `json:"neos"`
}

// getFloat coerces a value to float64. The NASA API returns most numeric fields
// as JSON numbers (float64 after unmarshalling into interface{}) but some fields
// such as miss_distance.kilometers and relative_velocity.kilometers_per_hour
// arrive as quoted strings in the feed response. This handles both cases.
func getFloat(v interface{}) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case string:
		var f float64
		fmt.Sscanf(val, "%f", &f)
		return f
	}
	return 0
}

// transformNEOs converts the raw NeoWS feed payload into a NEOResponse.
// The NASA response groups asteroids by calendar date in a top-level map;
// we flatten that into a single slice and attach the date to each record.
func transformNEOs(raw map[string]interface{}) NEOResponse {
	response := NEOResponse{}

	if links, ok := raw["links"].(map[string]interface{}); ok {
		_ = links
	}

	neoObjects, _ := raw["near_earth_objects"].(map[string]interface{})

	var allNEOs []NEO
	for date, objects := range neoObjects {
		objectList, ok := objects.([]interface{})
		if !ok {
			continue
		}
		for _, obj := range objectList {
			asteroid, ok := obj.(map[string]interface{})
			if !ok {
				continue
			}

			neo := NEO{}
			neo.ID, _ = asteroid["id"].(string)
			neo.Name, _ = asteroid["name"].(string)
			neo.NasaURL, _ = asteroid["nasa_jpl_url"].(string)
			neo.AbsMagnitude = getFloat(asteroid["absolute_magnitude_h"])
			neo.IsPotentiallyHazardous, _ = asteroid["is_potentially_hazardous_asteroid"].(bool)

			if diam, ok := asteroid["estimated_diameter"].(map[string]interface{}); ok {
				if km, ok := diam["kilometers"].(map[string]interface{}); ok {
					neo.EstDiameterMinKm = getFloat(km["estimated_diameter_min"])
					neo.EstDiameterMaxKm = getFloat(km["estimated_diameter_max"])
				}
			}

			if approaches, ok := asteroid["close_approach_data"].([]interface{}); ok && len(approaches) > 0 {
				approach, ok := approaches[0].(map[string]interface{})
				if ok {
					neo.CloseApproachDate = date
					if cadt, ok := approach["close_approach_date_full"].(string); ok {
						neo.CloseApproachTime = cadt
					}
					neo.OrbitingBody, _ = approach["orbiting_body"].(string)

					if vel, ok := approach["relative_velocity"].(map[string]interface{}); ok {
						neo.RelativeVelocityKmh = getFloat(vel["kilometers_per_hour"])
					}
					if miss, ok := approach["miss_distance"].(map[string]interface{}); ok {
						neo.MissDistanceKm = getFloat(miss["kilometers"])
						neo.MissDistanceLunar = getFloat(miss["lunar"])
					}
				}
			}

			allNEOs = append(allNEOs, neo)
		}
	}

	// Sort by close approach date (primary, ascending) then miss distance
	// (secondary, ascending). The 7-day window yields at most ~70 objects,
	// so O(n²) is negligible here and avoids importing sort.
	for i := 0; i < len(allNEOs)-1; i++ {
		for j := i + 1; j < len(allNEOs); j++ {
			if allNEOs[i].CloseApproachDate > allNEOs[j].CloseApproachDate ||
				(allNEOs[i].CloseApproachDate == allNEOs[j].CloseApproachDate &&
					allNEOs[i].MissDistanceKm > allNEOs[j].MissDistanceKm) {
				allNEOs[i], allNEOs[j] = allNEOs[j], allNEOs[i]
			}
		}
	}

	response.TotalObjects = len(allNEOs)
	response.NEOs = allNEOs
	// Ensure a non-nil slice so the field marshals as "[]" instead of "null".
	if response.NEOs == nil {
		response.NEOs = []NEO{}
	}

	return response
}

// neoLookupHandler proxies a single-asteroid detail request to NASA JPL and
// streams the raw JSON response unchanged. The frontend uses this to populate
// the asteroid detail modal.
func neoLookupHandler(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Path[len("/api/neo/"):]
	if id == "" {
		http.Error(w, `{"error":"Missing asteroid ID"}`, http.StatusBadRequest)
		return
	}

	url := fmt.Sprintf("%s/neo/%s?api_key=%s", nasaBaseURL, id, nasaAPIKey)
	resp, err := http.Get(url)
	if err != nil {
		http.Error(w, `{"error":"Failed to fetch data"}`, http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, `{"error":"Failed to read response"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(body)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// newMux constructs and returns the router with all routes registered.
// Extracted from main so tests can obtain a fully wired handler without
// starting a real TCP listener.
func newMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/neo/feed", corsMiddleware(neoFeedHandler))
	mux.HandleFunc("/api/neo/", corsMiddleware(neoLookupHandler))
	mux.HandleFunc("/health", corsMiddleware(healthHandler))
	return mux
}

func main() {
	addr := port()
	log.Printf("NEO Tracker backend running on %s", addr)
	if err := http.ListenAndServe(addr, newMux()); err != nil {
		log.Fatal(err)
	}
}
