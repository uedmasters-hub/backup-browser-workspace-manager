/**
 * Minimal, dependency-free ZIP support (STORE method, no compression).
 * Enough to bundle a few small text files into one archive and read them
 * back. Avoids pulling an external library into the extension bundle.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function strToU8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function strFromU8(data: Uint8Array): string {
  return new TextDecoder().decode(data);
}

function pushU16(out: number[], value: number) {
  out.push(value & 0xff, (value >>> 8) & 0xff);
}

function pushU32(out: number[], value: number) {
  out.push(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff
  );
}

function pushBytes(out: number[], bytes: Uint8Array) {
  for (let i = 0; i < bytes.length; i += 1) {
    out.push(bytes[i]);
  }
}

const UTF8_FLAG = 0x0800;

/** Build a ZIP archive (STORE) from name -> bytes. */
export function zipStore(files: Record<string, Uint8Array>): Uint8Array {
  const local: number[] = [];
  const central: number[] = [];
  const entries = Object.entries(files);

  for (const [name, data] of entries) {
    const nameBytes = strToU8(name);
    const crc = crc32(data);
    const offset = local.length;

    // Local file header.
    pushU32(local, 0x04034b50);
    pushU16(local, 20); // version needed
    pushU16(local, UTF8_FLAG);
    pushU16(local, 0); // method: store
    pushU16(local, 0); // mod time
    pushU16(local, 0x21); // mod date (1980-01-01)
    pushU32(local, crc);
    pushU32(local, data.length); // compressed size
    pushU32(local, data.length); // uncompressed size
    pushU16(local, nameBytes.length);
    pushU16(local, 0); // extra length
    pushBytes(local, nameBytes);
    pushBytes(local, data);

    // Central directory record.
    pushU32(central, 0x02014b50);
    pushU16(central, 20); // version made by
    pushU16(central, 20); // version needed
    pushU16(central, UTF8_FLAG);
    pushU16(central, 0); // method
    pushU16(central, 0); // mod time
    pushU16(central, 0x21); // mod date
    pushU32(central, crc);
    pushU32(central, data.length);
    pushU32(central, data.length);
    pushU16(central, nameBytes.length);
    pushU16(central, 0); // extra
    pushU16(central, 0); // comment
    pushU16(central, 0); // disk number start
    pushU16(central, 0); // internal attrs
    pushU32(central, 0); // external attrs
    pushU32(central, offset); // local header offset
    pushBytes(central, nameBytes);
  }

  const eocd: number[] = [];
  pushU32(eocd, 0x06054b50);
  pushU16(eocd, 0); // disk number
  pushU16(eocd, 0); // disk with central dir
  pushU16(eocd, entries.length);
  pushU16(eocd, entries.length);
  pushU32(eocd, central.length);
  pushU32(eocd, local.length);
  pushU16(eocd, 0); // comment length

  return Uint8Array.from([...local, ...central, ...eocd]);
}

function readU16(data: Uint8Array, at: number): number {
  return data[at] | (data[at + 1] << 8);
}

function readU32(data: Uint8Array, at: number): number {
  return (
    (data[at] |
      (data[at + 1] << 8) |
      (data[at + 2] << 16) |
      (data[at + 3] << 24)) >>>
    0
  );
}

/** Read a ZIP archive's STORE entries into name -> bytes. */
export function unzipStore(data: Uint8Array): Record<string, Uint8Array> {
  // Find End Of Central Directory by scanning backwards for its signature.
  let eocd = -1;
  for (let i = data.length - 22; i >= 0; i -= 1) {
    if (readU32(data, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    throw new Error("Not a valid ZIP archive.");
  }

  const count = readU16(data, eocd + 10);
  let ptr = readU32(data, eocd + 16); // central directory offset
  const out: Record<string, Uint8Array> = {};

  for (let i = 0; i < count; i += 1) {
    if (readU32(data, ptr) !== 0x02014b50) {
      break;
    }
    const method = readU16(data, ptr + 10);
    const compSize = readU32(data, ptr + 20);
    const nameLen = readU16(data, ptr + 28);
    const extraLen = readU16(data, ptr + 30);
    const commentLen = readU16(data, ptr + 32);
    const localOffset = readU32(data, ptr + 42);
    const name = strFromU8(data.subarray(ptr + 46, ptr + 46 + nameLen));

    // Jump to the local header to locate the file data.
    const lNameLen = readU16(data, localOffset + 26);
    const lExtraLen = readU16(data, localOffset + 28);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;

    if (method !== 0) {
      throw new Error(
        "This ZIP uses compression; import backup.json directly instead."
      );
    }

    out[name] = data.subarray(dataStart, dataStart + compSize);
    ptr += 46 + nameLen + extraLen + commentLen;
  }

  return out;
}
