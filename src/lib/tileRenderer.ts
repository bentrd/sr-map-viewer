const SPRITE_SIZE = 72;
const SPRITE_COUNT = 15;
// Maximum canvas dimension browsers reliably support
const MAX_CANVAS_DIM = 16384;

export function loadTilemap(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (_e) => reject(new Error("Failed to load TileMap.png"));
    img.src = `${import.meta.env.BASE_URL}TileMap.png`;
  });
}

/**
 * Compute the largest tile size that fits within browser canvas limits.
 * Ideally SPRITE_SIZE (72) for full resolution, but scaled down for large maps.
 */
function computeTileSize(width: number, height: number): number {
  const maxDim = Math.max(width, height);
  const ideal = SPRITE_SIZE;
  if (maxDim * ideal <= MAX_CANVAS_DIM) return ideal;
  return Math.floor(MAX_CANVAS_DIM / maxDim);
}

export function renderCollisionLayer(
  canvas: HTMLCanvasElement,
  tilemap: HTMLImageElement,
  tiles: Uint8Array,
  width: number,
  height: number,
): void {
  const tileSize = computeTileSize(width, height);
  canvas.width = width * tileSize;
  canvas.height = height * tileSize;

  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#d4c6e6";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const tileType = tiles[col * height + row];
      if (tileType === 0) continue;

      const spriteIndex = tileType - 1;
      if (spriteIndex < 0 || spriteIndex >= SPRITE_COUNT) continue;

      const sourceX = spriteIndex * SPRITE_SIZE;
      const destX = col * tileSize;
      const destY = row * tileSize;

      ctx.drawImage(
        tilemap,
        sourceX, 0, SPRITE_SIZE, SPRITE_SIZE,
        destX, destY, tileSize, tileSize,
      );
    }
  }
}

export function createMapCanvas(
  tilemap: HTMLImageElement,
  tiles: Uint8Array,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  renderCollisionLayer(canvas, tilemap, tiles, width, height);
  return canvas;
}
