const encoder = new TextEncoder();

function writeString(target, offset, length, value) {
  const bytes = encoder.encode(value);
  const size = Math.min(bytes.length, length);
  target.set(bytes.subarray(0, size), offset);
}

function writeOctal(target, offset, length, value, includeSpace = false) {
  const digits = value.toString(8);
  const limit = includeSpace ? length - 2 : length - 1;
  const padded = digits.padStart(limit, '0');
  for (let i = 0; i < limit; i += 1) {
    target[offset + i] = padded.charCodeAt(i);
  }
  target[offset + limit] = 0;
  if (includeSpace) {
    target[offset + limit + 1] = 0x20;
  }
}

function createHeader(name, size) {
  const header = new Uint8Array(512);
  writeString(header, 0, 100, name);
  writeOctal(header, 100, 8, 0o644);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, size);
  writeOctal(header, 136, 12, Math.floor(Date.now() / 1000));
  for (let i = 148; i < 156; i += 1) {
    header[i] = 0x20;
  }
  header[156] = '0'.charCodeAt(0);
  writeString(header, 257, 6, 'ustar');
  header[262] = '0'.charCodeAt(0);
  header[263] = '0'.charCodeAt(0);
  writeString(header, 265, 32, 'giftoframes');
  writeString(header, 297, 32, 'giftoframes');
  writeOctal(header, 329, 8, 0);
  writeOctal(header, 337, 8, 0);

  let checksum = 0;
  for (let i = 0; i < 512; i += 1) {
    checksum += header[i];
  }
  writeOctal(header, 148, 8, checksum, true);

  return header;
}

export function createTarArchive(files) {
  const chunks = [];
  files.forEach((file) => {
    const header = createHeader(file.name, file.data.length);
    chunks.push(header);
    chunks.push(file.data);
    const remainder = file.data.length % 512;
    if (remainder !== 0) {
      chunks.push(new Uint8Array(512 - remainder));
    }
  });
  chunks.push(new Uint8Array(512));
  chunks.push(new Uint8Array(512));
  return new Blob(chunks, { type: 'application/x-tar' });
}
