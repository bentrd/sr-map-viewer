import React, { useCallback, useRef, useState } from "react";

interface FileUploadProps {
  onFileLoaded: (buffer: ArrayBuffer) => void;
  disabled?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileLoaded, disabled = false }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const readFile = useCallback(
    (file: File) => {
      setIsLoading(true);
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          onFileLoaded(reader.result);
        }
        setIsLoading(false);
      };
      reader.onerror = () => {
        console.error("Failed to read file");
        setIsLoading(false);
      };
      reader.readAsArrayBuffer(file);
    },
    [onFileLoaded],
  );

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".sr")) {
        alert("Please select a .sr map file.");
        return;
      }
      readFile(file);
    },
    [readFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (disabled || isLoading) return;

      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [disabled, isLoading, handleFile],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && !isLoading) setIsDragOver(true);
    },
    [disabled, isLoading],
  );

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleClick = () => {
    if (!disabled && !isLoading) inputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const containerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100vw",
    height: "100vh",
    position: "fixed",
    top: 0,
    left: 0,
  };

  const dropZoneStyle: React.CSSProperties = {
    width: 400,
    height: 300,
    borderRadius: 12,
    border: `2px dashed ${isDragOver ? "#4a90d9" : "#555"}`,
    backgroundColor: isDragOver ? "rgba(74, 144, 217, 0.08)" : "rgba(255, 255, 255, 0.03)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    cursor: disabled || isLoading ? "default" : "pointer",
    opacity: disabled ? 0.5 : 1,
    transition: "border-color 0.2s, background-color 0.2s",
    userSelect: "none",
  };

  const textStyle: React.CSSProperties = {
    fontSize: 14,
    color: isDragOver ? "#4a90d9" : "#999",
    textAlign: "center",
    padding: "0 24px",
    transition: "color 0.2s",
    fontFamily: "'Inter', sans-serif",
  };

  const hintStyle: React.CSSProperties = {
    fontSize: 12,
    color: "#666",
    fontFamily: "'Inter', sans-serif",
  };

  return (
    <div style={containerStyle}>
      <div
        style={dropZoneStyle}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        {isLoading ? (
          <span style={{ fontSize: 16, color: "#999" }}>Loading...</span>
        ) : (
          <>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={isDragOver ? "#4a90d9" : "#666"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "stroke 0.2s" }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span style={textStyle}>
              Drop a <strong>.sr</strong> map file here or click to browse
            </span>
            <span style={hintStyle}>SpeedRunners map files only</span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".sr"
          style={{ display: "none" }}
          onChange={handleInputChange}
        />
      </div>
    </div>
  );
};

export default FileUpload;
