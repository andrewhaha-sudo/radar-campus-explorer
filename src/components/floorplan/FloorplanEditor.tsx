import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Undo2, Redo2, Download, PencilRuler } from "lucide-react";
import { scenes } from "../map/campus-data";
import type { SceneId } from "../map/campus-data";
import type { Point } from "../map/navigation";
import {
  annotationAt,
  createFloorDocument,
  draftKey,
  floorIds,
  MAX_ANNOTATIONS,
  MAX_IMPORT_BYTES,
  parseFloorDocument,
} from "../../lib/floorplan";
import type { Annotation, AnnotationType } from "../../vendor/pathfinder/types";
import { screenToCanvas, toNorm } from "../../vendor/pathfinder/coords";
import { hitTest } from "../../vendor/pathfinder/hittest";
import { renderAnnotations } from "../../vendor/pathfinder/render";
import { commentNumbers } from "../../vendor/pathfinder/export-json";
import { newHistory, pushUndo, undo, redo } from "../../vendor/pathfinder/undo";
import "./floorplan.css";
import { publishFloorDraft } from "../../lib/pathfinder-client";

const tools = [
  ["select", "Select"],
  ["exit", "Exit"],
  ["fireext", "Fire extinguisher"],
  ["aed", "AED"],
  ["stairs", "Stairs"],
  ["door", "Door"],
  ["overhead", "Overhead hazard"],
  ["rect", "Area"],
  ["circle", "Circle"],
  ["arrow", "Arrow"],
  ["comment", "Note"],
] as const;
type Tool = (typeof tools)[number][0];
const labelFor = (type: string) =>
  tools.find(([id]) => id === type)?.[1] ?? type;
const shaped = (tool: Tool) => ["rect", "circle", "arrow"].includes(tool);
function loadDraft(id: SceneId) {
  try {
    const raw = localStorage.getItem(draftKey(id));
    return {
      annotations: raw ? parseFloorDocument(raw, id) : [],
      notice: raw
        ? "Loaded annotations from this device."
        : "No annotations yet. Choose a tool to begin.",
    };
  } catch {
    return {
      annotations: [],
      notice:
        "Saved annotations could not be loaded. Your stored file has not been changed.",
    };
  }
}

function FloorDrawing({ id }: { id: SceneId }) {
  const scene = scenes[id],
    dims = scene.crop;
  const [initial] = useState(() => loadDraft(id));
  const [annotations, setAnnotations] = useState<Annotation[]>(
    initial.annotations,
  );
  const [notice, setNotice] = useState(initial.notice);
  const [tool, setTool] = useState<Tool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Annotation | null>(null);
  const [cursor, setCursor] = useState<Point>({
    x: dims.width / 2,
    y: dims.height / 2,
  });
  const [cursorVisible, setCursorVisible] = useState(false);
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const start = useRef<Point | null>(null);
  const [history, setHistory] = useState(newHistory);
  const selected = annotations.find((a) => a.id === selectedId);
  const dimsWidth = dims.width,
    dimsHeight = dims.height;
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const visible = draft ? [...annotations, draft] : annotations;
    renderAnnotations(
      ctx,
      visible,
      1,
      { width: dimsWidth, height: dimsHeight },
      commentNumbers(visible),
      selectedId,
    );
    if (cursorVisible) {
      ctx.save();
      ctx.strokeStyle = "#5c3d8a";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cursor.x - 10, cursor.y);
      ctx.lineTo(cursor.x + 10, cursor.y);
      ctx.moveTo(cursor.x, cursor.y - 10);
      ctx.lineTo(cursor.x, cursor.y + 10);
      ctx.stroke();
      ctx.restore();
    }
  }, [
    annotations,
    draft,
    selectedId,
    dimsWidth,
    dimsHeight,
    cursor,
    cursorVisible,
  ]);
  function commit(next: Annotation[], record = true) {
    try {
      if (next.length > MAX_ANNOTATIONS)
        throw new Error(
          `A floor supports up to ${MAX_ANNOTATIONS} annotations.`,
        );
      const data = JSON.stringify(createFloorDocument(id, next));
      const valid = parseFloorDocument(data, id);
      if (record)
        setHistory((h) =>
          pushUndo({ undo: [...h.undo], redo: [...h.redo] }, annotations),
        );
      setAnnotations(valid);
      setError("");
      try {
        localStorage.setItem(draftKey(id), data);
        window.dispatchEvent(new Event("radar-floorplan-change"));
        setNotice("Saved on this device.");
      } catch {
        setNotice("Changes are only in memory. Export JSON before closing.");
        setError(
          "Browser storage is unavailable or full. These changes have not been saved.",
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The annotations could not be saved.",
      );
    }
  }
  function point(event: PointerEvent<HTMLCanvasElement>): Point {
    const p = screenToCanvas(
      event.clientX,
      event.clientY,
      event.currentTarget.getBoundingClientRect(),
      dims,
    );
    return {
      x: Math.max(0, Math.min(dims.width, p.x)),
      y: Math.max(0, Math.min(dims.height, p.y)),
    };
  }
  function addAt(p: Point) {
    if (tool === "select") {
      setSelectedId(hitTest(annotations, p.x, p.y, dims));
      return;
    }
    const a = annotationAt(tool as AnnotationType, p, dims);
    if (shaped(tool)) {
      a.nw = Math.min(0.15, 1 - a.nx);
      a.nh = Math.min(0.12, 1 - a.ny);
    }
    commit([...annotations, a]);
    setSelectedId(a.id);
  }
  function pointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus();
    setCursorVisible(false);
    const p = point(event);
    setCursor(p);
    if (!shaped(tool)) {
      addAt(p);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = p;
    setDraft(annotationAt(tool as AnnotationType, p, dims));
  }
  function pointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!start.current) return;
    const p = point(event),
      from = start.current;
    setDraft((a) =>
      a
        ? { ...a, ...toNorm(from.x, from.y, p.x - from.x, p.y - from.y, dims) }
        : null,
    );
  }
  function pointerUp(event: PointerEvent<HTMLCanvasElement>) {
    if (!start.current) return;
    const from = start.current,
      p = point(event);
    start.current = null;
    setDraft(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (Math.hypot(p.x - from.x, p.y - from.y) < 5) {
      addAt(from);
      return;
    }
    const a = {
      ...annotationAt(tool as AnnotationType, from, dims),
      ...toNorm(from.x, from.y, p.x - from.x, p.y - from.y, dims),
    };
    commit([...annotations, a]);
    setSelectedId(a.id);
  }
  function restore(direction: "undo" | "redo") {
    const nextHistory = { undo: [...history.undo], redo: [...history.redo] };
    const next =
      direction === "undo"
        ? undo<Annotation[]>(nextHistory, annotations)
        : redo<Annotation[]>(nextHistory, annotations);
    if (next) {
      setHistory(nextHistory);
      commit(next, false);
      setSelectedId(null);
    }
  }
  async function importFile(file: File) {
    try {
      if (file.size > MAX_IMPORT_BYTES)
        throw new Error("Floorplan file is too large (maximum 1 MB).");
      const incoming = parseFloorDocument(await file.text(), id);
      commit(incoming);
      setSelectedId(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The file could not be imported.",
      );
    }
  }
  function download() {
    const blob = new Blob(
      [JSON.stringify(createFloorDocument(id, annotations), null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `radar-floor-${id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <div className="floorplan-toolbar" aria-label="Floorplan tools">
        {tools.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={tool === value}
            onClick={() => {
              setTool(value);
              start.current = null;
              setDraft(null);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="floorplan-actions">
        <button onClick={() => restore("undo")} disabled={!history.undo.length}>
          <Undo2 size={16} /> Undo
        </button>
        <button onClick={() => restore("redo")} disabled={!history.redo.length}>
          <Redo2 size={16} /> Redo
        </button>
        <button onClick={download}>
          <Download size={16} /> Export floor JSON
        </button>
        <label className="floorplan-import">
          Import floor JSON
          <input
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      <p id="floorplan-help" className="floorplan-help">
        Choose a marker, then tap the drawing. Drag to draw an area or arrow.
        With the drawing focused, use arrow keys to position the cursor and
        Enter to place. Import replaces this floor's annotations; Undo restores
        them.
      </p>
      <div className="floorplan-actions">
        <a href={`/campus-workspace?floor=${id}`}>Open Facilities workspace</a>
        <button
          disabled={publishing || !annotations.length}
          onClick={async () => {
            setPublishing(true);
            setError("");
            setPublishedId(null);
            try {
              const docId = await publishFloorDraft(
                id,
                createFloorDocument(id, annotations),
              );
              setPublishedId(docId);
              setNotice(
                "Published as a new shared draft. Existing floor documents were preserved.",
              );
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Publishing failed. Keep your local draft.",
              );
            } finally {
              setPublishing(false);
            }
          }}
        >
          {publishing ? "Publishing..." : "Publish new shared draft"}
        </button>
        {publishedId && (
          <a href={`/documents/${encodeURIComponent(publishedId)}`}>
            Open published draft
          </a>
        )}
      </div>
      <div className="floorplan-workspace">
        <div>
          <div
            className="floorplan-board"
            style={{ aspectRatio: `${dims.width} / ${dims.height}` }}
          >
            <svg
              viewBox={`${dims.x} ${dims.y} ${dims.width} ${dims.height}`}
              role="img"
              aria-label={`${scene.name} source floorplan`}
            >
              {scene.artworkPieces ? (
                scene.artworkPieces.map((piece, index) => (
                  <svg
                    key={index}
                    x={piece.target.x}
                    y={piece.target.y}
                    width={piece.source.width}
                    height={piece.source.height}
                    viewBox={`${piece.source.x} ${piece.source.y} ${piece.source.width} ${piece.source.height}`}
                    overflow="hidden"
                  >
                    <image
                      href={scene.image}
                      width={scene.imageWidth}
                      height={scene.imageHeight}
                    />
                  </svg>
                ))
              ) : (
                <image
                  href={scene.image}
                  width={scene.imageWidth}
                  height={scene.imageHeight}
                />
              )}
            </svg>
            <canvas
              ref={canvas}
              width={dims.width}
              height={dims.height}
              tabIndex={0}
              role="application"
              aria-label="Floorplan drawing"
              aria-describedby="floorplan-help"
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={pointerUp}
              onPointerCancel={() => {
                start.current = null;
                setDraft(null);
              }}
              onBlur={() => setCursorVisible(false)}
              onKeyDown={(event) => {
                const offsets: Record<string, Point> = {
                  ArrowLeft: { x: -5, y: 0 },
                  ArrowRight: { x: 5, y: 0 },
                  ArrowUp: { x: 0, y: -5 },
                  ArrowDown: { x: 0, y: 5 },
                };
                const offset = offsets[event.key];
                if (offset) {
                  event.preventDefault();
                  event.stopPropagation();
                  setCursorVisible(true);
                  setCursor((p) => ({
                    x: Math.max(0, Math.min(dims.width, p.x + offset.x)),
                    y: Math.max(0, Math.min(dims.height, p.y + offset.y)),
                  }));
                }
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  addAt(cursor);
                }
                if (event.key === "Escape" && start.current) {
                  event.preventDefault();
                  event.stopPropagation();
                  start.current = null;
                  setDraft(null);
                }
              }}
            />
          </div>
          <p className="floorplan-caption">
            {scene.rooms.length} mapped rooms:{" "}
            {scene.rooms.map((room) => room.name).join(", ")}.
          </p>
        </div>
        <aside className="floorplan-inspector" aria-label="Floor annotations">
          <h3>Annotations ({annotations.length})</h3>
          {!annotations.length && (
            <p>
              Mark an exit, safety resource or area for review. No safety
              resources have been assumed.
            </p>
          )}
          <ol>
            {annotations.map((a, index) => (
              <li key={a.id}>
                <button
                  aria-pressed={selectedId === a.id}
                  onClick={() => setSelectedId(a.id)}
                >
                  {labelFor(a.type)} {index + 1}
                  {a.text ? ` · ${a.text}` : ""}
                </button>
              </li>
            ))}
          </ol>
          {selected && (
            <form
              key={
                selected.id +
                ":" +
                selected.nx +
                ":" +
                selected.ny +
                ":" +
                (selected.text ?? "")
              }
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget),
                  x = Number(data.get("x")) / 100,
                  y = Number(data.get("y")) / 100;
                commit(
                  annotations.map((a) =>
                    a.id === selected.id
                      ? {
                          ...a,
                          nx: x,
                          ny: y,
                          text: String(data.get("text") ?? "").trim(),
                        }
                      : a,
                  ),
                );
              }}
            >
              <h4>Edit {labelFor(selected.type).toLowerCase()}</h4>
              <label>
                Label / note
                <textarea
                  name="text"
                  maxLength={2000}
                  defaultValue={selected.text}
                />
              </label>
              <div className="floorplan-coordinates">
                <label>
                  X (%)
                  <input
                    name="x"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    defaultValue={+(selected.nx * 100).toFixed(2)}
                  />
                </label>
                <label>
                  Y (%)
                  <input
                    name="y"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    defaultValue={+(selected.ny * 100).toFixed(2)}
                  />
                </label>
              </div>
              <button type="submit">Save annotation</button>
              <button
                type="button"
                onClick={() => {
                  commit(annotations.filter((a) => a.id !== selected.id));
                  setSelectedId(null);
                }}
              >
                Delete annotation
              </button>
            </form>
          )}
        </aside>
      </div>
      <p role="status" className="floorplan-status">
        {notice}
      </p>
      {error && (
        <p role="alert" className="floorplan-error">
          {error}
        </p>
      )}
    </>
  );
}

export function FloorplanEditor({
  initialFloor,
  onClose,
  onRestoreFocus,
}: {
  initialFloor: SceneId;
  onClose: () => void;
  onRestoreFocus: () => void;
}) {
  const [floor, setFloor] = useState<SceneId>(
    initialFloor === "campus" ? "a1" : initialFloor,
  );
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="floorplan-overlay" />
        <Dialog.Content
          className="floorplan-dialog"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onRestoreFocus();
          }}
        >
          <header className="floorplan-heading">
            <div>
              <span className="floorplan-eyebrow">
                <PencilRuler size={16} /> PATHFINDER × RADAR
              </span>
              <Dialog.Title>Floorplan editor</Dialog.Title>
              <Dialog.Description>
                Annotate the school drawings. Notes are saved only on this
                device and do not change walking routes or establish verified
                evacuation guidance.
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="floorplan-close"
              aria-label="Close floorplan editor"
            >
              <X size={20} />
            </Dialog.Close>
          </header>
          <label className="floorplan-floor">
            Building and floor
            <select
              value={floor}
              onChange={(e) => setFloor(e.target.value as SceneId)}
            >
              {floorIds.map((id) => (
                <option key={id} value={id}>
                  {scenes[id].name}
                </option>
              ))}
            </select>
          </label>
          <FloorDrawing key={floor} id={floor} />
          <footer className="floorplan-license">
            Powered by Pathfinder's annotation engine ·{" "}
            <a href="/licenses/AGPL-3.0.txt" target="_blank" rel="noreferrer">
              AGPL-3.0-or-later
            </a>{" "}
            ·{" "}
            <a href="/source/radar-campus-explorer.tar.gz" download>
              Download application source
            </a>{" "}
            ·{" "}
            <a
              href="https://github.com/melonmelonz/pathfinder"
              target="_blank"
              rel="noreferrer"
            >
              Pathfinder project
            </a>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
