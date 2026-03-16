import { useState, useCallback } from "react";
import { parseSrFile, getCollisionLayer } from "./lib/srParser";
import { loadTilemap, createMapCanvas } from "./lib/tileRenderer";
import type { SrMapData, SrMapLayer } from "./lib/srParser";
import type { Marker } from "./components/MapViewer";
import MapViewer from "./components/MapViewer";
import MarkerPanel from "./components/MarkerPanel";
import FileUpload from "./components/FileUpload";
import "./App.css";

const MARKER_COLORS = [
  "#ff4444", "#44bb44", "#4488ff", "#ffaa00", "#ff44ff",
  "#44ffff", "#ff8844", "#88ff44", "#8844ff", "#ff4488",
];

function App() {
  const [mapData, setMapData] = useState<SrMapData | null>(null);
  const [mapCanvas, setMapCanvas] = useState<HTMLCanvasElement | null>(null);
  const [collisionLayer, setCollisionLayer] = useState<SrMapLayer | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddMarker = useCallback(
    (normX: number, normY: number) => {
      setMarkers((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          name: `Marker ${prev.length + 1}`,
          normX,
          normY,
          color: MARKER_COLORS[prev.length % MARKER_COLORS.length],
        },
      ]);
    },
    [],
  );

  const handleMoveMarker = useCallback(
    (id: string, normX: number, normY: number) => {
      setMarkers((prev) =>
        prev.map((m) => (m.id === id ? { ...m, normX, normY } : m)),
      );
    },
    [],
  );

  const handleRenameMarker = useCallback(
    (id: string, name: string) => {
      setMarkers((prev) =>
        prev.map((m) => (m.id === id ? { ...m, name } : m)),
      );
    },
    [],
  );

  const handleDeleteMarker = useCallback((id: string) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
    setHoveredMarkerId(null);
  }, []);

  const handleHoverMarker = useCallback((id: string | null) => {
    setHoveredMarkerId(id);
  }, []);

  const handleFileLoaded = useCallback(async (buffer: ArrayBuffer) => {
    setLoading(true);
    setError(null);

    try {
      const data = parseSrFile(buffer);
      const layer = getCollisionLayer(data);
      if (!layer) {
        throw new Error("No collision layer found in map file.");
      }

      const tilemap = await loadTilemap();
      const canvas = createMapCanvas(tilemap, layer.tiles, layer.width, layer.height);

      setMapData(data);
      setCollisionLayer(layer);
      setMapCanvas(canvas);
      setMarkers([]);
      setHoveredMarkerId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse map file.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setMapData(null);
    setMapCanvas(null);
    setCollisionLayer(null);
    setMarkers([]);
    setHoveredMarkerId(null);
    setError(null);
  }, []);

  if (!mapData || !mapCanvas || !collisionLayer) {
    return (
      <>
        <FileUpload onFileLoaded={handleFileLoaded} disabled={loading} />
        {loading && <div style={loadingStyle}>Loading map...</div>}
        {error && <div style={errorStyle}>{error}</div>}
      </>
    );
  }

  return (
    <>
      <MapViewer
        mapCanvas={mapCanvas}
        markers={markers}
        hoveredMarkerId={hoveredMarkerId}
        onAddMarker={handleAddMarker}
        onMoveMarker={handleMoveMarker}
        onHoverMarker={handleHoverMarker}
      />

      <MarkerPanel
        markers={markers}
        mapWidth={collisionLayer.width}
        mapHeight={collisionLayer.height}
        mapName={mapData.footer.mapName}
        onDeleteMarker={handleDeleteMarker}
        onRenameMarker={handleRenameMarker}
        onHoverMarker={handleHoverMarker}
        hoveredMarkerId={hoveredMarkerId}
      />

      {/* Map info panel — top left */}
      <div style={infoPanelStyle}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
          {mapData.footer.mapName}
        </div>
        <div style={{ fontSize: 12, color: "#aaa" }}>
          by {mapData.footer.author}
        </div>
        <div style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>
          {mapData.footer.stageType}
        </div>
        <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
          {collisionLayer.width} &times; {collisionLayer.height} tiles
        </div>
      </div>

      {/* Load another map — top right */}
      <button style={resetButtonStyle} onClick={handleReset}>
        Load another map
      </button>

      {/* Hint — bottom left */}
      <div style={hintStyle}>
        Click to place markers | Hold Space to pan
      </div>
    </>
  );
}

const panelBase: React.CSSProperties = {
  position: "fixed",
  background: "rgba(0, 0, 0, 0.75)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  color: "#fff",
  padding: "10px 14px",
  borderRadius: 8,
  pointerEvents: "auto",
  zIndex: 10,
  fontFamily: "'Inter', sans-serif",
};

const infoPanelStyle: React.CSSProperties = {
  ...panelBase,
  top: 12,
  left: 12,
};

const resetButtonStyle: React.CSSProperties = {
  position: "fixed",
  top: 12,
  right: 292,
  zIndex: 10,
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  background: "rgba(0, 0, 0, 0.75)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  color: "#fff",
  fontSize: 13,
  fontFamily: "'Inter', sans-serif",
  fontWeight: 500,
  cursor: "pointer",
};

const hintStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 12,
  left: 12,
  zIndex: 10,
  fontSize: 11,
  color: "#666",
  fontFamily: "'Inter', sans-serif",
  pointerEvents: "none",
};

const loadingStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 24,
  left: "50%",
  transform: "translateX(-50%)",
  color: "#999",
  fontSize: 14,
};

const errorStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 24,
  left: "50%",
  transform: "translateX(-50%)",
  color: "#e55",
  fontSize: 14,
};

export default App;
