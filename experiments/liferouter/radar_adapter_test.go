// Original RADAR compatibility test. Copy into the pinned LifeRouter internal/grid package.
package grid

import (
 "encoding/json"
 "os"
 "path/filepath"
 "testing"
 "github.com/Kentalives/LifeRouter/internal/config"
)

func TestRADARCampusExport(t *testing.T) {
 dir:=os.Getenv("RADAR_CAMPUS_EXPORT"); if dir=="" {t.Fatal("Set RADAR_CAMPUS_EXPORT to the adapter generated directory")}
 file:=filepath.Join(dir,"campus-demo.yaml"); cfg,err:=config.LoadConfig(&file);if err!=nil{t.Fatal(err)}
 config.Setup(cfg,nil)
 var manifest struct{Rooms []struct{ID string; Layer int; DemoMeters [2]float64}}
 raw,err:=os.ReadFile(filepath.Join(dir,"manifest.json"));if err!=nil{t.Fatal(err)}
 if err=json.Unmarshal(raw,&manifest);err!=nil{t.Fatal(err)}
 if len(cfg.Grid.FloorLayers)!=12||len(cfg.Grid.Portals)!=10||len(manifest.Rooms)!=35{t.Fatal("unexpected campus counts")}
 grids:=make([]*Grid,len(cfg.Grid.FloorLayers))
 cell:=func(p [2]float64)Coords{return Coords{X:uint(p[0]/cfg.Grid.CellSizeM),Y:uint(p[1]/cfg.Grid.CellSizeM)}}
 for i,layer:=range cfg.Grid.FloorLayers {
  g,e:=FromImg(cfg.Grid.Rows,cfg.Grid.Cols,filepath.Join(dir,layer.ImgPath),cfg.Grid.PxPerCell);if e!=nil{t.Fatal(e)};grids[i]=g
  if !IsBlocked(g.GetValue(Coords{X:0,Y:0})){t.Fatal("outside-map cell must be blocked")}
 }
 // Flood-fill from actual portal approaches. Every room must reach one without crossing walls.
 reachable:=make([]map[Coords]bool,len(grids))
 for i,g:=range grids {
  seen:=map[Coords]bool{};q:=[]Coords{}
  for _,p:=range cfg.Grid.Portals {if p.FromLayer==i{q=append(q,cell(p.From))};if p.ToLayer==i{q=append(q,cell(p.To))}}
  for _,c:=range q{if IsBlocked(g.GetValue(c)){t.Fatal("portal on blocked cell")};seen[c]=true}
  for k:=0;k<len(q);k++{c:=q[k];for _,d:=range [][2]int{{1,0},{-1,0},{0,1},{0,-1}}{
   x,y:=int(c.X)+d[0],int(c.Y)+d[1];if x<0||y<0||x>=int(cfg.Grid.Cols)||y>=int(cfg.Grid.Rows){continue}
   n:=Coords{X:uint(x),Y:uint(y)};if !seen[n]&&!IsBlocked(g.GetValue(n)){seen[n]=true;q=append(q,n)}
  }};reachable[i]=seen
 }
 for _,room:=range manifest.Rooms{if !reachable[room.Layer][cell(room.DemoMeters)]{t.Errorf("room %s cannot reach a portal",room.ID)}}
 t.Log("12 source masks parsed by LifeRouter; 10 portal pairs valid; 35 rooms reach a portal")
}
