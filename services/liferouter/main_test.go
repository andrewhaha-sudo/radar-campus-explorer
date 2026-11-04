package main

import (
	"context"
	"encoding/json"
	"math"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

func TestBridge(t *testing.T) {
	b, close, err := start(t.Context(), "../../experiments/liferouter/generated")
	if err != nil {
		t.Fatal(err)
	}
	defer close()
	var m struct {
		Rooms []struct {
			Scene  string     `json:"scene"`
			Meters [2]float64 `json:"demoMeters"`
		}
	}
	// Use the exact exported room endpoints as test destinations.
	data, err := os.ReadFile("../../experiments/liferouter/generated/manifest.json")
	if err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(data, &m); err != nil {
		t.Fatal(err)
	}
	room := func(i int) point { r := m.Rooms[i]; return point{r.Scene, r.Meters[0] / .05, r.Meters[1] / .05} }
	for _, tc := range []struct {
		name      string
		req       routeRequest
		wantError bool
	}{
		{"same floor", routeRequest{room(0), room(1)}, false},
		{"campus spawn to lawn", routeRequest{point{"campus", 387, 785}, point{"campus", 720, 490}}, false},
		{"stairs", routeRequest{room(2), room(4)}, false},
		{"campus portals", routeRequest{room(0), room(6)}, false},
		{"unlinked building", routeRequest{room(0), room(len(m.Rooms) - 1)}, true},
		{"blocked", routeRequest{room(0), point{"campus", 0, 0}}, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
			defer cancel()
			p, e := b.route(ctx, tc.req)
			if (e != nil) != tc.wantError {
				t.Fatalf("points=%d error=%v", len(p), e)
			}
			if e == nil {
				for i, v := range p {
					if i > 0 && p[i-1].Scene == v.Scene && math.Hypot(v.X-p[i-1].X, v.Y-p[i-1].Y) > 5.66 {
						t.Fatal("engine omitted intermediate grid steps")
					}
					if _, e = b.snap(v); e != nil {
						t.Fatalf("path crossed blocked cell: %+v", v)
					}
				}
			}
		})
	}
	t.Run("HTTP validation", func(t *testing.T) {
		for _, body := range []string{`{"start":{"scene":"campus","x":0,"y":0}}`, `{"latitude":1}`, `{} {}`} {
			r := httptest.NewRequest("POST", "/api/liferouter/route", strings.NewReader(body))
			w := httptest.NewRecorder()
			b.handler().ServeHTTP(w, r)
			if w.Code != 400 {
				t.Fatalf("got %d: %s", w.Code, w.Body)
			}
		}
	})
	t.Run("busy", func(t *testing.T) {
		b.busy <- struct{}{}
		defer func() { <-b.busy }()
		body, _ := json.Marshal(routeRequest{room(0), room(1)})
		w := httptest.NewRecorder()
		b.handler().ServeHTTP(w, httptest.NewRequest("POST", "/api/liferouter/route", strings.NewReader(string(body))))
		if w.Code != 429 {
			t.Fatal(w.Code)
		}
	})
	t.Run("cancelled", func(t *testing.T) {
		ctx, cancel := context.WithCancel(t.Context())
		cancel()
		_, err := b.route(ctx, routeRequest{room(0), room(1)})
		if err == nil {
			t.Fatal("cancelled request succeeded")
		}
	})
	b.world.mu.Lock()
	defer b.world.mu.Unlock()
	if len(b.world.objects) != 0 || len(b.world.paths) != 0 {
		t.Fatal("request retained agent data")
	}
}
