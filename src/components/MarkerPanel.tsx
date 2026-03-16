import { useState, useRef, useEffect } from "react";
import type { Marker } from "./MapViewer";

interface MarkerPanelProps {
  markers: Marker[];
  mapWidth: number;
  mapHeight: number;
  mapName: string;
  onDeleteMarker: (id: string) => void;
  onRenameMarker: (id: string, name: string) => void;
  onHoverMarker: (id: string | null) => void;
  hoveredMarkerId: string | null;
}

export default function MarkerPanel({
  markers,
  mapWidth,
  mapHeight,
  mapName,
  onDeleteMarker,
  onRenameMarker,
  onHoverMarker,
  hoveredMarkerId,
}: MarkerPanelProps) {
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleExport = () => {
    const data = {
      mapName,
      mapWidth,
      mapHeight,
      exportedAt: new Date().toISOString(),
      markers: markers.map((m) => ({
        id: m.id,
        name: m.name,
        normX: m.normX,
        normY: m.normY,
        tileX: Math.round(m.normX * mapWidth),
        tileY: Math.round(m.normY * mapHeight),
        worldX: Math.round(m.normX * mapWidth) * 16,
        worldY: Math.round(m.normY * mapHeight) * 16,
        color: m.color,
      })),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = mapName.replace(/[^a-zA-Z0-9_-]/g, "_") || "markers";
    a.download = `${safeName}_markers.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span>Markers</span>
        <span style={badgeStyle}>{markers.length}</span>
      </div>

      <div style={listStyle}>
        {markers.length === 0 ? (
          <div style={emptyHintStyle}>Click on the map to place markers</div>
        ) : (
          markers.map((marker) => {
            const isHovered =
              hoveredMarkerId === marker.id || hoveredRowId === marker.id;
            const tileX = Math.round(marker.normX * mapWidth);
            const tileY = Math.round(marker.normY * mapHeight);
            const isEditing = editingId === marker.id;

            return (
              <div
                key={marker.id}
                style={{
                  ...rowStyle,
                  background: isHovered
                    ? "rgba(255, 255, 255, 0.1)"
                    : "transparent",
                }}
                onMouseEnter={() => {
                  setHoveredRowId(marker.id);
                  onHoverMarker(marker.id);
                }}
                onMouseLeave={() => {
                  setHoveredRowId(null);
                  onHoverMarker(null);
                }}
              >
                <div style={rowLeftStyle}>
                  <div
                    style={{
                      ...colorDotStyle,
                      backgroundColor: marker.color,
                    }}
                  />
                  <div style={rowInfoStyle}>
                    {isEditing ? (
                      <InlineRenameInput
                        value={marker.name}
                        onCommit={(newName) => {
                          const trimmed = newName.trim();
                          if (trimmed) {
                            onRenameMarker(marker.id, trimmed);
                          }
                          setEditingId(null);
                        }}
                      />
                    ) : (
                      <div
                        style={labelStyle}
                        onDoubleClick={() => setEditingId(marker.id)}
                        title="Double-click to rename"
                      >
                        {marker.name}
                      </div>
                    )}
                    <div style={coordLineStyle}>
                      <span style={coordStyle}>
                        norm ({marker.normX.toFixed(4)}, {marker.normY.toFixed(4)})
                      </span>
                    </div>
                    <div style={coordLineStyle}>
                      <span style={coordStyle}>
                        tile ({tileX}, {tileY})
                      </span>
                    </div>
                    <div style={coordLineStyle}>
                      <span style={coordStyle}>
                        world ({tileX * 16}, {tileY * 16})
                      </span>
                    </div>
                  </div>
                </div>

                {isHovered && !isEditing && (
                  <button
                    style={deleteButtonStyle}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteMarker(marker.id);
                    }}
                    title="Delete marker"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {markers.length > 0 && (
        <div style={footerStyle}>
          <button style={exportButtonStyle} onClick={handleExport}>
            Export to JSON
          </button>
        </div>
      )}
    </div>
  );
}

// --- Inline rename input ---

function InlineRenameInput({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (newValue: string) => void;
}) {
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onCommit(text)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          onCommit(text);
        } else if (e.key === "Escape") {
          onCommit(value); // revert
        }
      }}
      style={renameInputStyle}
      autoFocus
    />
  );
}

// --- Styles ---

const panelStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  right: 0,
  bottom: 0,
  width: 280,
  background: "rgba(0, 0, 0, 0.75)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  color: "#fff",
  display: "flex",
  flexDirection: "column",
  zIndex: 10,
  fontFamily: "'Inter', sans-serif",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "14px 16px 10px",
  fontSize: 14,
  fontWeight: 600,
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
};

const badgeStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  background: "rgba(255, 255, 255, 0.12)",
  borderRadius: 10,
  padding: "1px 7px",
  color: "#aaa",
};

const listStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "6px 0",
};

const emptyHintStyle: React.CSSProperties = {
  padding: "24px 16px",
  fontSize: 12,
  color: "#666",
  textAlign: "center",
  lineHeight: 1.5,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 16px",
  borderRadius: 0,
  transition: "background 0.1s",
};

const rowLeftStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
  flex: 1,
};

const colorDotStyle: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  flexShrink: 0,
};

const rowInfoStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 0,
  flex: 1,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: "#ddd",
  cursor: "text",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const coordLineStyle: React.CSSProperties = {
  lineHeight: 1.3,
};

const coordStyle: React.CSSProperties = {
  fontSize: 11,
  fontFamily: "'JetBrains Mono', monospace",
  color: "#888",
};

const deleteButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#888",
  fontSize: 16,
  cursor: "pointer",
  padding: "2px 6px",
  borderRadius: 4,
  lineHeight: 1,
  flexShrink: 0,
};

const renameInputStyle: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.1)",
  border: "1px solid rgba(255, 255, 255, 0.25)",
  borderRadius: 4,
  color: "#fff",
  fontSize: 12,
  fontFamily: "'Inter', sans-serif",
  fontWeight: 500,
  padding: "2px 6px",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const footerStyle: React.CSSProperties = {
  padding: "10px 16px 14px",
  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
};

const exportButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 0",
  borderRadius: 6,
  border: "1px solid rgba(255, 255, 255, 0.15)",
  background: "rgba(255, 255, 255, 0.08)",
  color: "#ccc",
  fontSize: 12,
  fontFamily: "'Inter', sans-serif",
  fontWeight: 500,
  cursor: "pointer",
  transition: "background 0.15s, color 0.15s",
};
