import { useRef, useEffect, useState } from 'react';

export interface Marker {
  id: string;
  name: string;
  normX: number; // 0-1
  normY: number; // 0-1
  color: string;
}

interface MapViewerProps {
  mapCanvas: HTMLCanvasElement;
  markers: Marker[];
  onAddMarker: (normX: number, normY: number) => void;
  onMoveMarker: (id: string, normX: number, normY: number) => void;
  hoveredMarkerId: string | null;
  onHoverMarker: (id: string | null) => void;
}

const ZOOM_FACTOR = 1.1;
const MARKER_RADIUS = 6;        // screen pixels
const MARKER_HOVERED_RADIUS = 9; // screen pixels
const MARKER_HIT_RADIUS = 14;   // screen pixels (for click detection)
const CURSOR_CIRCLE_RADIUS = 12; // screen pixels

export default function MapViewer({
  mapCanvas,
  markers,
  onAddMarker,
  onMoveMarker,
  hoveredMarkerId,
  onHoverMarker,
}: MapViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cursor, setCursor] = useState<string>('crosshair');

  // All mutable state in refs to avoid re-renders during interaction
  const transformRef = useRef({ scale: 1, offsetX: 0, offsetY: 0 });
  const fitScaleRef = useRef(1);
  const rafRef = useRef<number>(0);

  // Drag state
  const dragRef = useRef<{
    type: 'none' | 'pan' | 'marker';
    markerId: string | null;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
  }>({ type: 'none', markerId: null, startX: 0, startY: 0, lastX: 0, lastY: 0 });

  // Mode flags
  const spaceHeldRef = useRef(false);
  const nearMarkerRef = useRef<string | null>(null);
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);

  // Sync props into refs for rAF loop access
  const markersRef = useRef<Marker[]>(markers);
  const hoveredMarkerIdRef = useRef<string | null>(hoveredMarkerId);
  const onAddMarkerRef = useRef(onAddMarker);
  const onMoveMarkerRef = useRef(onMoveMarker);
  const onHoverMarkerRef = useRef(onHoverMarker);

  useEffect(() => { markersRef.current = markers; }, [markers]);
  useEffect(() => { hoveredMarkerIdRef.current = hoveredMarkerId; }, [hoveredMarkerId]);
  useEffect(() => { onAddMarkerRef.current = onAddMarker; }, [onAddMarker]);
  useEffect(() => { onMoveMarkerRef.current = onMoveMarker; }, [onMoveMarker]);
  useEffect(() => { onHoverMarkerRef.current = onHoverMarker; }, [onHoverMarker]);

  // --- Helpers ---

  function screenToNorm(clientX: number, clientY: number): { normX: number; normY: number } | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    const { scale, offsetX, offsetY } = transformRef.current;
    const mapX = (screenX - offsetX) / scale;
    const mapY = (screenY - offsetY) / scale;
    const normX = mapX / mapCanvas.width;
    const normY = mapY / mapCanvas.height;
    return { normX, normY };
  }

  function findMarkerAtScreen(clientX: number, clientY: number): Marker | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    const { scale, offsetX, offsetY } = transformRef.current;

    let closest: Marker | null = null;
    let closestDist = Infinity;

    for (const marker of markersRef.current) {
      const mx = marker.normX * mapCanvas.width * scale + offsetX;
      const my = marker.normY * mapCanvas.height * scale + offsetY;
      const dx = screenX - mx;
      const dy = screenY - my;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MARKER_HIT_RADIUS && dist < closestDist) {
        closest = marker;
        closestDist = dist;
      }
    }

    return closest;
  }

  // --- Draw loop ---

  useEffect(() => {
    const loop = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const { scale, offsetX, offsetY } = transformRef.current;

      // 1. Reset transform and clear
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 2. Fill background
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 3. Apply DPR + scale + offset transform
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY);

      // 4. Draw map
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(mapCanvas, 0, 0);

      // 5. Draw markers in screen space (constant size regardless of zoom)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const currentHoveredId = hoveredMarkerIdRef.current;
      for (const marker of markersRef.current) {
        // Convert normalized coords to screen coords
        const sx = marker.normX * mapCanvas.width * scale + offsetX;
        const sy = marker.normY * mapCanvas.height * scale + offsetY;
        const isHovered = marker.id === currentHoveredId;
        const radius = isHovered ? MARKER_HOVERED_RADIUS : MARKER_RADIUS;

        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);

        if (isHovered) {
          ctx.shadowColor = marker.color;
          ctx.shadowBlur = 10;
        }

        ctx.fillStyle = marker.color;
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // 6. Draw cursor circle
      const mousePos = mousePosRef.current;
      if (mousePos && !spaceHeldRef.current && dragRef.current.type !== 'pan') {
        ctx.beginPath();
        ctx.arc(mousePos.x, mousePos.y, CURSOR_CIRCLE_RADIUS, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [mapCanvas]);

  // --- Resize ---

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const viewW = canvas.clientWidth;
      const viewH = canvas.clientHeight;

      canvas.width = viewW * dpr;
      canvas.height = viewH * dpr;

      // Fit to view
      const scaleX = viewW / mapCanvas.width;
      const scaleY = viewH / mapCanvas.height;
      const fitScale = Math.min(scaleX, scaleY);

      fitScaleRef.current = fitScale;

      const oX = (viewW - mapCanvas.width * fitScale) / 2;
      const oY = (viewH - mapCanvas.height * fitScale) / 2;

      transformRef.current = { scale: fitScale, offsetX: oX, offsetY: oY };
    };

    resize();

    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [mapCanvas]);

  // --- Wheel zoom ---

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      const { scale, offsetX, offsetY } = transformRef.current;
      const fitScale = fitScaleRef.current;
      const minZoom = fitScale * 0.1;
      const maxZoom = fitScale * 30;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const direction = e.deltaY < 0 ? 1 : -1;
      const factor = direction > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
      const newScale = Math.min(maxZoom, Math.max(minZoom, scale * factor));

      const ratio = newScale / scale;
      const newOffsetX = mouseX - (mouseX - offsetX) * ratio;
      const newOffsetY = mouseY - (mouseY - offsetY) * ratio;

      transformRef.current = { scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY };
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  // --- Space key for pan mode ---

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        spaceHeldRef.current = true;
        if (dragRef.current.type === 'none') {
          setCursor('grab');
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        spaceHeldRef.current = false;
        if (dragRef.current.type === 'none') {
          // Restore cursor based on whether near a marker
          if (nearMarkerRef.current) {
            setCursor('grab');
          } else {
            setCursor('crosshair');
          }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // --- Mouse interactions ---

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseDown = (e: MouseEvent) => {
      if (spaceHeldRef.current) {
        // Pan mode
        dragRef.current = {
          type: 'pan',
          markerId: null,
          startX: e.clientX,
          startY: e.clientY,
          lastX: e.clientX,
          lastY: e.clientY,
        };
        setCursor('grabbing');
        return;
      }

      const hitMarker = findMarkerAtScreen(e.clientX, e.clientY);
      if (hitMarker) {
        // Marker drag mode
        dragRef.current = {
          type: 'marker',
          markerId: hitMarker.id,
          startX: e.clientX,
          startY: e.clientY,
          lastX: e.clientX,
          lastY: e.clientY,
        };
        setCursor('grabbing');
        return;
      }

      // Click will be handled on mouseup (add marker)
      dragRef.current = {
        type: 'none',
        markerId: null,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
      };
    };

    const onMouseMove = (e: MouseEvent) => {
      // Track mouse position for cursor circle
      const rect = canvas.getBoundingClientRect();
      mousePosRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      const drag = dragRef.current;

      if (drag.type === 'pan') {
        const dx = e.clientX - drag.lastX;
        const dy = e.clientY - drag.lastY;
        transformRef.current.offsetX += dx;
        transformRef.current.offsetY += dy;
        drag.lastX = e.clientX;
        drag.lastY = e.clientY;
        return;
      }

      if (drag.type === 'marker' && drag.markerId) {
        const norm = screenToNorm(e.clientX, e.clientY);
        if (norm) {
          onMoveMarkerRef.current(drag.markerId, norm.normX, norm.normY);
        }
        drag.lastX = e.clientX;
        drag.lastY = e.clientY;
        return;
      }

      // No active drag — update hover state
      if (spaceHeldRef.current) return; // In space-pan mode, don't change hover

      const hitMarker = findMarkerAtScreen(e.clientX, e.clientY);
      const hitId = hitMarker ? hitMarker.id : null;

      if (hitId !== nearMarkerRef.current) {
        nearMarkerRef.current = hitId;
        onHoverMarkerRef.current(hitId);
        setCursor(hitId ? 'grab' : 'crosshair');
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      const drag = dragRef.current;

      if (drag.type === 'pan') {
        dragRef.current = { type: 'none', markerId: null, startX: 0, startY: 0, lastX: 0, lastY: 0 };
        setCursor(spaceHeldRef.current ? 'grab' : 'crosshair');
        return;
      }

      if (drag.type === 'marker') {
        dragRef.current = { type: 'none', markerId: null, startX: 0, startY: 0, lastX: 0, lastY: 0 };
        const hitMarker = findMarkerAtScreen(e.clientX, e.clientY);
        setCursor(hitMarker ? 'grab' : 'crosshair');
        return;
      }

      // type === 'none': this was a click (no drag started)
      // Only place marker if we didn't move much
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= 3) {
        const norm = screenToNorm(e.clientX, e.clientY);
        if (norm && norm.normX >= 0 && norm.normX <= 1 && norm.normY >= 0 && norm.normY <= 1) {
          onAddMarkerRef.current(norm.normX, norm.normY);
        }
      }

      dragRef.current = { type: 'none', markerId: null, startX: 0, startY: 0, lastX: 0, lastY: 0 };
    };

    const onMouseLeave = () => {
      mousePosRef.current = null;
      if (nearMarkerRef.current) {
        nearMarkerRef.current = null;
        onHoverMarkerRef.current(null);
      }
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseleave', onMouseLeave);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [mapCanvas]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%', cursor }}
    />
  );
}
