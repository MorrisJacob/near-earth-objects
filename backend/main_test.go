package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// ── getFloat ─────────────────────────────────────────────────────────────────

func TestGetFloat_Float64(t *testing.T) {
	if got := getFloat(float64(3.14)); got != 3.14 {
		t.Errorf("got %v, want 3.14", got)
	}
}

func TestGetFloat_String(t *testing.T) {
	if got := getFloat("2.718"); got != 2.718 {
		t.Errorf("got %v, want 2.718", got)
	}
}

func TestGetFloat_StringInvalid(t *testing.T) {
	if got := getFloat("not-a-number"); got != 0 {
		t.Errorf("got %v, want 0", got)
	}
}

func TestGetFloat_Nil(t *testing.T) {
	if got := getFloat(nil); got != 0 {
		t.Errorf("got %v, want 0", got)
	}
}

func TestGetFloat_Int(t *testing.T) {
	// int is not float64 or string — should return 0
	if got := getFloat(42); got != 0 {
		t.Errorf("got %v, want 0", got)
	}
}

// ── transformNEOs ─────────────────────────────────────────────────────────────

func TestTransformNEOs_Empty(t *testing.T) {
	resp := transformNEOs(map[string]interface{}{})
	if resp.TotalObjects != 0 {
		t.Errorf("expected 0 objects, got %d", resp.TotalObjects)
	}
	if resp.NEOs == nil {
		t.Error("NEOs slice should not be nil (would marshal as JSON null)")
	}
	if len(resp.NEOs) != 0 {
		t.Errorf("expected empty NEOs, got %d", len(resp.NEOs))
	}
}

func makeSingleNASAPayload(date string, missKm float64, hazardous bool) map[string]interface{} {
	return map[string]interface{}{
		"near_earth_objects": map[string]interface{}{
			date: []interface{}{
				map[string]interface{}{
					"id":             "12345",
					"name":           "(2099 XX1)",
					"nasa_jpl_url":   "https://example.com/12345",
					"absolute_magnitude_h":               float64(22.5),
					"is_potentially_hazardous_asteroid":  hazardous,
					"estimated_diameter": map[string]interface{}{
						"kilometers": map[string]interface{}{
							"estimated_diameter_min": float64(0.1),
							"estimated_diameter_max": float64(0.2),
						},
					},
					"close_approach_data": []interface{}{
						map[string]interface{}{
							"close_approach_date_full": date + " 12:00",
							"orbiting_body":            "Earth",
							"relative_velocity": map[string]interface{}{
								"kilometers_per_hour": float64(50000),
							},
							"miss_distance": map[string]interface{}{
								"kilometers": missKm,
								"lunar":      float64(missKm / 384400),
							},
						},
					},
				},
			},
		},
	}
}

func TestTransformNEOs_SingleObject(t *testing.T) {
	raw := makeSingleNASAPayload("2099-01-01", 1_500_000, false)
	resp := transformNEOs(raw)

	if resp.TotalObjects != 1 {
		t.Fatalf("expected 1 object, got %d", resp.TotalObjects)
	}
	neo := resp.NEOs[0]

	if neo.ID != "12345" {
		t.Errorf("ID: got %q, want %q", neo.ID, "12345")
	}
	if neo.Name != "(2099 XX1)" {
		t.Errorf("Name: got %q, want %q", neo.Name, "(2099 XX1)")
	}
	if neo.AbsMagnitude != 22.5 {
		t.Errorf("AbsMagnitude: got %v, want 22.5", neo.AbsMagnitude)
	}
	if neo.EstDiameterMinKm != 0.1 {
		t.Errorf("EstDiameterMinKm: got %v, want 0.1", neo.EstDiameterMinKm)
	}
	if neo.EstDiameterMaxKm != 0.2 {
		t.Errorf("EstDiameterMaxKm: got %v, want 0.2", neo.EstDiameterMaxKm)
	}
	if neo.IsPotentiallyHazardous {
		t.Error("expected IsPotentiallyHazardous false")
	}
	if neo.CloseApproachDate != "2099-01-01" {
		t.Errorf("CloseApproachDate: got %q, want %q", neo.CloseApproachDate, "2099-01-01")
	}
	if neo.OrbitingBody != "Earth" {
		t.Errorf("OrbitingBody: got %q, want %q", neo.OrbitingBody, "Earth")
	}
	if neo.RelativeVelocityKmh != 50000 {
		t.Errorf("RelativeVelocityKmh: got %v, want 50000", neo.RelativeVelocityKmh)
	}
	if neo.MissDistanceKm != 1_500_000 {
		t.Errorf("MissDistanceKm: got %v, want 1500000", neo.MissDistanceKm)
	}
}

func TestTransformNEOs_HazardousFlag(t *testing.T) {
	raw := makeSingleNASAPayload("2099-03-01", 500_000, true)
	resp := transformNEOs(raw)
	if !resp.NEOs[0].IsPotentiallyHazardous {
		t.Error("expected IsPotentiallyHazardous true")
	}
}

func TestTransformNEOs_SortsByDate(t *testing.T) {
	// Two objects on different dates — earlier date should come first.
	raw := map[string]interface{}{
		"near_earth_objects": map[string]interface{}{
			"2099-06-15": makeSingleNASAPayload("2099-06-15", 1_000_000, false)["near_earth_objects"].(map[string]interface{})["2099-06-15"],
			"2099-06-12": makeSingleNASAPayload("2099-06-12", 2_000_000, false)["near_earth_objects"].(map[string]interface{})["2099-06-12"],
		},
	}
	resp := transformNEOs(raw)
	if resp.TotalObjects != 2 {
		t.Fatalf("expected 2 objects, got %d", resp.TotalObjects)
	}
	if resp.NEOs[0].CloseApproachDate > resp.NEOs[1].CloseApproachDate {
		t.Errorf("expected sorted by date ascending: got %q before %q",
			resp.NEOs[0].CloseApproachDate, resp.NEOs[1].CloseApproachDate)
	}
}

func TestTransformNEOs_SortsByDistanceSameDate(t *testing.T) {
	// Two objects on the same date — closer one should come first.
	date := "2099-07-04"
	entry := func(missKm float64) interface{} {
		return makeSingleNASAPayload(date, missKm, false)["near_earth_objects"].(map[string]interface{})[date].([]interface{})[0]
	}
	raw := map[string]interface{}{
		"near_earth_objects": map[string]interface{}{
			date: []interface{}{entry(5_000_000), entry(1_000_000)},
		},
	}
	resp := transformNEOs(raw)
	if resp.TotalObjects != 2 {
		t.Fatalf("expected 2 objects, got %d", resp.TotalObjects)
	}
	if resp.NEOs[0].MissDistanceKm > resp.NEOs[1].MissDistanceKm {
		t.Errorf("expected sorted by miss distance ascending: got %.0f before %.0f",
			resp.NEOs[0].MissDistanceKm, resp.NEOs[1].MissDistanceKm)
	}
}

func TestTransformNEOs_NilNEOsSerializesAsArray(t *testing.T) {
	resp := transformNEOs(map[string]interface{}{})
	b, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("marshal error: %v", err)
	}
	if !strings.Contains(string(b), `"neos":[]`) {
		t.Errorf("expected neos to serialize as [] not null, got: %s", b)
	}
}

func TestTransformNEOs_SkipsInvalidObjects(t *testing.T) {
	raw := map[string]interface{}{
		"near_earth_objects": map[string]interface{}{
			"2099-01-01": []interface{}{
				"not-an-object",
				42,
			},
		},
	}
	resp := transformNEOs(raw)
	if resp.TotalObjects != 0 {
		t.Errorf("expected 0 after skipping invalid entries, got %d", resp.TotalObjects)
	}
}

// ── healthHandler ─────────────────────────────────────────────────────────────

func TestHealthHandler_Returns200(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()
	healthHandler(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status: got %d, want 200", w.Code)
	}
}

func TestHealthHandler_ReturnsJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()
	healthHandler(w, req)

	var body map[string]string
	if err := json.NewDecoder(w.Body).Decode(&body); err != nil {
		t.Fatalf("response is not valid JSON: %v", err)
	}
	if body["status"] != "ok" {
		t.Errorf("status field: got %q, want %q", body["status"], "ok")
	}
}

func TestHealthHandler_ContentType(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()
	healthHandler(w, req)

	ct := w.Header().Get("Content-Type")
	if !strings.HasPrefix(ct, "application/json") {
		t.Errorf("Content-Type: got %q, want application/json", ct)
	}
}

// ── corsMiddleware ─────────────────────────────────────────────────────────────

func TestCORSMiddleware_SetsHeaders(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := corsMiddleware(inner)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	handler(w, req)

	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "*" {
		t.Errorf("Allow-Origin: got %q, want *", got)
	}
	if got := w.Header().Get("Access-Control-Allow-Methods"); !strings.Contains(got, "GET") {
		t.Errorf("Allow-Methods: got %q, expected to contain GET", got)
	}
}

func TestCORSMiddleware_PreflightReturns204(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("inner handler should not be called for OPTIONS")
	})
	handler := corsMiddleware(inner)

	req := httptest.NewRequest(http.MethodOptions, "/api/neo/feed", nil)
	w := httptest.NewRecorder()
	handler(w, req)

	if w.Code != http.StatusNoContent {
		t.Errorf("OPTIONS status: got %d, want 204", w.Code)
	}
}

func TestCORSMiddleware_PassesThroughNonOptions(t *testing.T) {
	called := false
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})
	handler := corsMiddleware(inner)

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()
	handler(w, req)

	if !called {
		t.Error("inner handler was not called for GET request")
	}
}

// ── neoFeedHandler (via mock NASA server) ─────────────────────────────────────

// nasaFeedResponse returns a minimal NeoWS-shaped JSON payload for use with a
// mock NASA server. Velocity and miss_distance are intentionally quoted strings
// (not JSON numbers) to exercise the string-parsing branch of getFloat.
func nasaFeedResponse(date string, missKm float64) string {
	return fmt.Sprintf(`{
		"near_earth_objects": {
			"%s": [{
				"id": "99999",
				"name": "(Test Asteroid)",
				"nasa_jpl_url": "https://example.com",
				"absolute_magnitude_h": 21.0,
				"is_potentially_hazardous_asteroid": false,
				"estimated_diameter": {
					"kilometers": {
						"estimated_diameter_min": 0.05,
						"estimated_diameter_max": 0.12
					}
				},
				"close_approach_data": [{
					"close_approach_date_full": "%s 08:00",
					"orbiting_body": "Earth",
					"relative_velocity": {"kilometers_per_hour": "40000"},
					"miss_distance": {"kilometers": "%.2f", "lunar": "4.0"}
				}]
			}]
		}
	}`, date, date, missKm)
}

func TestNeoFeedHandler_ReturnsTransformedData(t *testing.T) {
	mock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(nasaFeedResponse("2099-01-10", 1_234_567)))
	}))
	defer mock.Close()

	// Redirect the handler to the mock server for this test only.
	original := nasaBaseURL
	nasaBaseURL = mock.URL
	defer func() { nasaBaseURL = original }()

	req := httptest.NewRequest(http.MethodGet, "/api/neo/feed", nil)
	w := httptest.NewRecorder()
	neoFeedHandler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200", w.Code)
	}
	var resp NEOResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.TotalObjects != 1 {
		t.Errorf("TotalObjects: got %d, want 1", resp.TotalObjects)
	}
	if resp.NEOs[0].Name != "(Test Asteroid)" {
		t.Errorf("Name: got %q, want (Test Asteroid)", resp.NEOs[0].Name)
	}
}

func TestNeoFeedHandler_ForwardsDateParams(t *testing.T) {
	var gotURL string
	mock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotURL = r.URL.RawQuery
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"near_earth_objects":{}}`))
	}))
	defer mock.Close()

	original := nasaBaseURL
	nasaBaseURL = mock.URL
	defer func() { nasaBaseURL = original }()

	req := httptest.NewRequest(http.MethodGet, "/api/neo/feed?start_date=2099-03-01&end_date=2099-03-07", nil)
	w := httptest.NewRecorder()
	neoFeedHandler(w, req)

	if !strings.Contains(gotURL, "start_date=2099-03-01") {
		t.Errorf("start_date not forwarded, got query: %s", gotURL)
	}
	if !strings.Contains(gotURL, "end_date=2099-03-07") {
		t.Errorf("end_date not forwarded, got query: %s", gotURL)
	}
}

func TestNeoFeedHandler_NASAErrorReturns502(t *testing.T) {
	original := nasaBaseURL
	nasaBaseURL = "http://127.0.0.1:1" // nothing listening here
	defer func() { nasaBaseURL = original }()

	req := httptest.NewRequest(http.MethodGet, "/api/neo/feed", nil)
	w := httptest.NewRecorder()
	neoFeedHandler(w, req)

	if w.Code != http.StatusBadGateway {
		t.Errorf("status: got %d, want 502", w.Code)
	}
}

// ── neoLookupHandler ─────────────────────────────────────────────────────────

func TestNeoLookupHandler_MissingIDReturns400(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/neo/", nil)
	w := httptest.NewRecorder()
	neoLookupHandler(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status: got %d, want 400", w.Code)
	}
}

func TestNeoLookupHandler_ProxiesResponse(t *testing.T) {
	mock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"id":"54321","name":"(Proxied)"}`))
	}))
	defer mock.Close()

	original := nasaBaseURL
	nasaBaseURL = mock.URL
	defer func() { nasaBaseURL = original }()

	req := httptest.NewRequest(http.MethodGet, "/api/neo/54321", nil)
	w := httptest.NewRecorder()
	neoLookupHandler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200", w.Code)
	}
	body := w.Body.String()
	if !strings.Contains(body, "Proxied") {
		t.Errorf("expected proxied body, got: %s", body)
	}
}

// ── newMux (integration) ──────────────────────────────────────────────────────

func TestNewMux_HealthRoute(t *testing.T) {
	srv := httptest.NewServer(newMux())
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/health")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("status: got %d, want 200", resp.StatusCode)
	}
}

func TestNewMux_CORSOnAllRoutes(t *testing.T) {
	srv := httptest.NewServer(newMux())
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/health")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	if got := resp.Header.Get("Access-Control-Allow-Origin"); got != "*" {
		t.Errorf("CORS header on /health: got %q, want *", got)
	}
}
