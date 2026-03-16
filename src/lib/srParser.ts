import { inflate } from "pako";

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface SrMapEntity {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  properties: Record<string, string>;
}

export interface SrMapLayer {
  name: string;
  width: number;
  height: number;
  tiles: Uint8Array; // values are 0-127, downcast from uint32
}

export interface SrMapFooter {
  stageType: string;
  author: string;
  mapName: string;
  workshopId: number;
}

export interface SrMapData {
  version: number;
  entities: SrMapEntity[];
  layers: SrMapLayer[];
  footer: SrMapFooter;
}

// ── Binary Reader ───────────────────────────────────────────────────────────

class BinaryReader {
  private view: DataView;
  private bytes: Uint8Array;
  public offset: number;

  constructor(data: Uint8Array) {
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    this.bytes = data;
    this.offset = 0;
  }

  readUint8(): number {
    const val = this.view.getUint8(this.offset);
    this.offset += 1;
    return val;
  }

  readUint32(): number {
    const val = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return val;
  }

  readFloat32(): number {
    const val = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return val;
  }

  readString(length: number): string {
    const slice = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;
    return new TextDecoder("utf-8").decode(slice);
  }

  /** Read a length-prefixed string (uint8 length prefix). */
  readPrefixedString(): string {
    const len = this.readUint8();
    return this.readString(len);
  }
}

// ── Parsing ─────────────────────────────────────────────────────────────────

function parseEntities(reader: BinaryReader, count: number): SrMapEntity[] {
  const entities: SrMapEntity[] = [];

  for (let i = 0; i < count; i++) {
    const x = reader.readFloat32();
    const y = reader.readFloat32();
    const width = reader.readFloat32();
    const height = reader.readFloat32();
    const name = reader.readPrefixedString();

    const propCount = reader.readUint32();
    const properties: Record<string, string> = {};

    for (let p = 0; p < propCount; p++) {
      const key = reader.readPrefixedString();
      const value = reader.readPrefixedString();
      properties[key] = value;
    }

    entities.push({ x, y, width, height, name, properties });
  }

  return entities;
}

function parseLayers(reader: BinaryReader, count: number): SrMapLayer[] {
  const layers: SrMapLayer[] = [];

  for (let i = 0; i < count; i++) {
    const name = reader.readPrefixedString();
    const width = reader.readUint32();
    const height = reader.readUint32();

    const tileCount = width * height;
    const tiles = new Uint8Array(tileCount);

    for (let t = 0; t < tileCount; t++) {
      tiles[t] = reader.readUint32() & 0x7f; // downcast uint32 → 0-127
    }

    layers.push({ name, width, height, tiles });
  }

  return layers;
}

function parseFooter(reader: BinaryReader): SrMapFooter {
  const stageType = reader.readPrefixedString();
  reader.readUint8(); // separator (0x00)
  const author = reader.readPrefixedString();
  const mapName = reader.readPrefixedString();
  reader.readUint8(); // separator (0x00)
  const workshopId = reader.readUint32();
  reader.readUint32(); // padding (0x00000000)

  return { stageType, author, mapName, workshopId };
}

// ── Public API ──────────────────────────────────────────────────────────────

export function parseSrFile(buffer: ArrayBuffer): SrMapData {
  const compressed = new Uint8Array(buffer);
  const decompressed = inflate(compressed);
  const reader = new BinaryReader(decompressed);

  // Header
  const version = reader.readUint32();
  const entityCount = reader.readUint32();

  // Entities
  const entities = parseEntities(reader, entityCount);

  // Layer count + layers
  const layerCount = reader.readUint32();
  const layers = parseLayers(reader, layerCount);

  // Footer
  const footer = parseFooter(reader);

  return { version, entities, layers, footer };
}

export function getCollisionLayer(data: SrMapData): SrMapLayer | undefined {
  return data.layers.find((layer) => layer.name === "Collision");
}
