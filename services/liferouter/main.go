// RADAR simulation bridge to the public LifeRouter v1.0.0 API.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	_ "image/png"
	"io"
	"log"
	"math"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"sync"
	"syscall"
	"time"

	"github.com/Kentalives/LifeRouter/embedded"
	"github.com/Kentalives/LifeRouter/pkg/config"
	"github.com/Kentalives/LifeRouter/pkg/domain"
	"github.com/Kentalives/LifeRouter/pkg/pathfinding"
	"github.com/Kentalives/LifeRouter/pkg/subjects"
	"github.com/go-viper/mapstructure/v2"
	"github.com/google/uuid"
	"github.com/midtxwn/geotruth/pkg/natspublish"
	"github.com/midtxwn/geotruth/pkg/natsquery"
	"github.com/nats-io/nats-server/v2/server"
	"github.com/nats-io/nats.go"
)

const engineCommit = "99e468e4ae7b382832dcf0026914c4d08ce53ff0"

type point struct {
	Scene string  `json:"scene"`
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
}
type routeRequest struct {
	Start point `json:"start"`
	Goal  point `json:"goal"`
}

// Each request has a disposable, simulated agent. No accounts or GPS enter this store.
type world struct {
	mu      sync.Mutex
	layers  []string
	objects map[string]natsquery.Object
	paths   map[string][]point
}

func (w *world) layer(z float64) (string, error) {
	i := int(math.Round(z / 4))
	if i < 0 || i >= len(w.layers) || math.Abs(z-float64(i)*4) > .001 {
		return "", errors.New("invalid simulation layer")
	}
	return w.layers[i], nil
}
func (w *world) height(s string) (float64, error) {
	for i, l := range w.layers {
		if l == s {
			return float64(i) * 4, nil
		}
	}
	return 0, errors.New("unknown scene")
}
func (w *world) ObjectTraversalCost(context.Context, string, string) (domain.Cost, error) {
	return domain.COST_EMPTY_SPACE, nil
}
func (w *world) PointFloorHeight(_ context.Context, x, y, z float64) (float64, error) {
	_, e := w.layer(z)
	return z, e
}
func (w *world) HeightAtFloorPoint(_ context.Context, x, y float64, s string) (float64, error) {
	return w.height(s)
}
func (w *world) SignalingSetDirection(context.Context, string, domain.Direction) error {
	return errors.New("physical signaling unavailable")
}
func (w *world) SignalingDirection(context.Context, string) (domain.Direction, error) {
	return domain.DIR_UNKNOWN, errors.New("physical signaling unavailable")
}
func (w *world) LightNodeRegex(context.Context) (string, error) { return "^NO_PHYSICAL_SIGNALS$", nil }
func (w *world) RegionFromPoint(_ context.Context, x, y, z float64) (string, error) {
	return w.layer(z)
}
func (w *world) NearbyObjectsOf(context.Context, string, float64, *string) ([]natsquery.ObjectOriented, error) {
	return nil, nil
}
func (w *world) AllObjectsOriented(context.Context, *string) (natsquery.AllObjectsOrientedResp, error) {
	return natsquery.AllObjectsOrientedResp{Regions: map[string][]natsquery.ObjectOriented{}}, nil
}
func (w *world) ObjectData(_ context.Context, id string) (*natsquery.Object, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	o, ok := w.objects[id]
	if !ok {
		return nil, errors.New("unknown simulation agent")
	}
	return &o, nil
}
func (w *world) UpdateObjectPosition(ctx context.Context, id string, x, y, z, rot float64) (natspublish.CommitAck, error) {
	if err := ctx.Err(); err != nil {
		return natspublish.CommitAck{}, err
	}
	s, err := w.layer(z)
	if err != nil {
		return natspublish.CommitAck{}, err
	}
	w.mu.Lock()
	defer w.mu.Unlock()
	if _, ok := w.objects[id]; !ok {
		return natspublish.CommitAck{}, errors.New("expired agent")
	}
	w.objects[id] = natsquery.Object{ID: id, Region: &s, X: x, Y: y, Z: z, RotY: rot}
	w.paths[id] = append(w.paths[id], point{s, x / .05, y / .05})
	return natspublish.CommitAck{}, nil
}

type bridge struct {
	world *world
	masks map[string]image.Image
	nc    *nats.Conn
	busy  chan struct{}
}

func start(ctx context.Context, dir string) (*bridge, func(), error) {
	cfg := embedded.DefaultConfig()
	// Preserve every turn: the default publishes only every five cells.
	cfg.Pathfinding.Agent.CellsForRealUpdate = 1
	raw, err := os.ReadFile(filepath.Join(dir, "campus-demo.yaml"))
	if err != nil {
		return nil, nil, err
	}
	var m map[string]any
	if err = json.Unmarshal(raw, &m); err != nil {
		return nil, nil, err
	}
	if err = mapstructure.Decode(m, cfg); err != nil {
		return nil, nil, err
	}
	w := &world{objects: map[string]natsquery.Object{}, paths: map[string][]point{}}
	b := &bridge{world: w, masks: map[string]image.Image{}, busy: make(chan struct{}, 1)}
	for i, l := range cfg.Grid.FloorLayers {
		w.layers = append(w.layers, l.Name)
		p := filepath.Join(dir, filepath.Base(l.ImgPath))
		cfg.Grid.FloorLayers[i].ImgPath = p
		f, e := os.Open(p)
		if e != nil {
			return nil, nil, e
		}
		img, _, e := image.Decode(f)
		f.Close()
		if e != nil {
			return nil, nil, e
		}
		b.masks[l.Name] = img
	}
	ns, err := server.NewServer(&server.Options{Host: "127.0.0.1", Port: -1, NoLog: true, NoSigs: true})
	if err != nil {
		return nil, nil, err
	}
	go ns.Start()
	if !ns.ReadyForConnections(5 * time.Second) {
		ns.Shutdown()
		return nil, nil, errors.New("NATS startup failed")
	}
	cfg.App.NatsServerUrl = ns.ClientURL()
	disp, err := embedded.Run(ctx, cfg, &config.Dependencies{Ex: w, Qu: w, Pu: w})
	if err != nil {
		ns.Shutdown()
		return nil, nil, err
	}
	nc, err := nats.Connect(ns.ClientURL())
	if err != nil {
		disp.Shutdown()
		ns.Shutdown()
		return nil, nil, err
	}
	b.nc = nc
	cleanup := func() { disp.Shutdown(); nc.Close(); ns.Shutdown() }
	// A real round trip proves the subscription is ready; no fixed startup sleep.
	readyCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	tick := time.NewTicker(10 * time.Millisecond)
	defer tick.Stop()
	for {
		_, err = nc.RequestWithContext(readyCtx, subjects.PathfindingAgentNaivePathCost, []byte(`{}`))
		if err == nil {
			break
		}
		if !errors.Is(err, nats.ErrNoResponders) {
			cleanup()
			return nil, nil, err
		}
		select {
		case <-readyCtx.Done():
			cleanup()
			return nil, nil, readyCtx.Err()
		case <-tick.C:
		}
	}
	return b, cleanup, nil
}
func (b *bridge) snap(p point) (point, error) {
	img, ok := b.masks[p.Scene]
	if !ok || math.IsNaN(p.X) || math.IsNaN(p.Y) || math.IsInf(p.X, 0) || math.IsInf(p.Y, 0) || p.X < 0 || p.Y < 0 || p.X >= float64(img.Bounds().Dx()*4) || p.Y >= float64(img.Bounds().Dy()*4) {
		return point{}, errors.New("invalid scene or coordinates")
	}
	x, y := int(p.X/4), int(p.Y/4)
	r, g, bl, _ := img.At(x, y).RGBA()
	if r == 0 || g != 0 || bl != 0 {
		return point{}, errors.New("destination or start is blocked")
	}
	return point{p.Scene, float64(x*4 + 2), float64(y*4 + 2)}, nil
}
func (b *bridge) route(ctx context.Context, req routeRequest) ([]point, error) {
	start, err := b.snap(req.Start)
	if err != nil {
		return nil, err
	}
	goal, err := b.snap(req.Goal)
	if err != nil {
		return nil, err
	}
	if start == goal {
		return []point{start}, nil
	}
	id := "Agent_" + uuid.NewString()
	z, _ := b.world.height(start.Scene)
	gz, _ := b.world.height(goal.Scene)
	b.world.mu.Lock()
	b.world.objects[id] = natsquery.Object{ID: id, Region: &start.Scene, X: start.X * .05, Y: start.Y * .05, Z: z}
	b.world.paths[id] = []point{start}
	b.world.mu.Unlock()
	defer func() { b.world.mu.Lock(); delete(b.world.objects, id); delete(b.world.paths, id); b.world.mu.Unlock() }()
	agent, err := pathfinding.New(b.nc).AgentFindPath(ctx, [3]float64{goal.X * .05, goal.Y * .05, gz}, id, 0, 0)
	if err != nil {
		return nil, err
	}
	defer func() {
		c, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		_ = agent.Terminate(c)
	}()
	// The engine publishes every simulated step; collect those ordered positions.
	_, moveErr := agent.MoveFMeters(ctx, 10000)
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	if err = agent.ExitError(ctx); err != nil {
		return nil, err
	}
	b.world.mu.Lock()
	points := append([]point(nil), b.world.paths[id]...)
	b.world.mu.Unlock()
	if len(points) == 0 || math.Hypot(points[len(points)-1].X-goal.X, points[len(points)-1].Y-goal.Y) > .1 || points[len(points)-1].Scene != goal.Scene {
		return nil, fmt.Errorf("route incomplete: %v", moveErr)
	}
	return points, nil
}
func respond(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func (b *bridge) handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/liferouter/health", func(w http.ResponseWriter, r *http.Request) {
		respond(w, 200, map[string]any{"engine": "LifeRouter", "commit": engineCommit, "simulation": true})
	})
	mux.HandleFunc("POST /api/liferouter/route", func(w http.ResponseWriter, r *http.Request) {
		var req routeRequest
		d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
		d.DisallowUnknownFields()
		if err := d.Decode(&req); err != nil {
			respond(w, 400, map[string]string{"error": "Invalid routing request"})
			return
		}
		var extra any
		if d.Decode(&extra) != io.EOF {
			respond(w, 400, map[string]string{"error": "Expected one request"})
			return
		}
		if _, err := b.snap(req.Start); err != nil {
			respond(w, 400, map[string]string{"error": err.Error()})
			return
		}
		if _, err := b.snap(req.Goal); err != nil {
			respond(w, 400, map[string]string{"error": err.Error()})
			return
		}
		select {
		case b.busy <- struct{}{}:
			defer func() { <-b.busy }()
		default:
			respond(w, 429, map[string]string{"error": "Routing busy; try again"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()
		points, err := b.route(ctx, req)
		if err != nil {
			respond(w, 422, map[string]string{"error": "LifeRouter could not complete this simulation route"})
			return
		}
		respond(w, 200, map[string]any{"engine": "LifeRouter", "commit": engineCommit, "simulation": true, "points": points})
	})
	return mux
}
func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	dir := os.Getenv("CAMPUS_GRID_DIR")
	if dir == "" {
		dir = "../../experiments/liferouter/generated"
	}
	b, cleanup, err := start(ctx, dir)
	if err != nil {
		log.Fatal(err)
	}
	defer cleanup()
	addr := os.Getenv("LISTEN_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8091"
	}
	s := &http.Server{Addr: addr, Handler: b.handler(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 15 * time.Second, IdleTimeout: 30 * time.Second}
	go func() {
		<-ctx.Done()
		c, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		_ = s.Shutdown(c)
	}()
	log.Printf("LifeRouter simulation bridge: %s", addr)
	if err = s.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Print(err)
	}
}
