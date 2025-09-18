const GIF_HEADER = ['GIF87a', 'GIF89a'];

class Stream {
  constructor(buffer) {
    this.view = new DataView(buffer);
    this.buffer = buffer;
    this.offset = 0;
  }

  readUint8() {
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  readUint16() {
    const value = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return value;
  }

  readBytes(length) {
    const bytes = new Uint8Array(this.buffer, this.offset, length);
    this.offset += length;
    return new Uint8Array(bytes);
  }

  skip(length) {
    this.offset += length;
  }
}

function readColorTable(stream, size) {
  const table = [];
  for (let i = 0; i < size; i += 1) {
    const r = stream.readUint8();
    const g = stream.readUint8();
    const b = stream.readUint8();
    table.push([r, g, b, 255]);
  }
  return table;
}

function readSubBlocks(stream) {
  const chunks = [];
  let size = stream.readUint8();
  while (size !== 0) {
    chunks.push(stream.readBytes(size));
    size = stream.readUint8();
  }
  let totalLength = 0;
  chunks.forEach((chunk) => {
    totalLength += chunk.length;
  });
  const data = new Uint8Array(totalLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    data.set(chunk, offset);
    offset += chunk.length;
  });
  return data;
}

function lzwDecode(minCodeSize, data, expectedSize) {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  const dictionary = [];
  const output = new Uint8Array(expectedSize);
  let outPos = 0;

  const dataLength = data.length;
  let dataIndex = 0;
  let current = 0;
  let bits = 0;

  const resetDictionary = () => {
    dictionary.length = 0;
    for (let i = 0; i < clearCode; i += 1) {
      dictionary[i] = [i];
    }
    dictionary[clearCode] = [];
    dictionary[endCode] = null;
    codeSize = minCodeSize + 1;
  };

  const readCode = () => {
    while (bits < codeSize) {
      if (dataIndex >= dataLength) {
        return null;
      }
      current |= data[dataIndex] << bits;
      dataIndex += 1;
      bits += 8;
    }
    const mask = (1 << codeSize) - 1;
    const code = current & mask;
    current >>= codeSize;
    bits -= codeSize;
    return code;
  };

  resetDictionary();
  let prev = null;
  let code = readCode();

  while (code !== null && code !== endCode) {
    if (code === clearCode) {
      resetDictionary();
      prev = null;
      code = readCode();
      continue;
    }

    let entry;
    if (code < dictionary.length) {
      entry = dictionary[code].slice();
    } else if (code === dictionary.length && prev) {
      entry = prev.concat(prev[0]);
    } else {
      break;
    }

    for (let i = 0; i < entry.length && outPos < expectedSize; i += 1) {
      output[outPos] = entry[i];
      outPos += 1;
    }

    if (prev) {
      const newEntry = prev.concat(entry[0]);
      dictionary.push(newEntry);
      if (dictionary.length === (1 << codeSize) && codeSize < 12) {
        codeSize += 1;
      }
    }

    prev = entry;
    code = readCode();
  }

  if (outPos < expectedSize) {
    return output.slice(0, outPos);
  }

  return output;
}

function deinterlace(pixels, width, height) {
  const result = new Uint8Array(pixels.length);
  const passes = [
    { start: 0, step: 8 },
    { start: 4, step: 8 },
    { start: 2, step: 4 },
    { start: 1, step: 2 },
  ];
  let fromRow = 0;
  passes.forEach((pass) => {
    for (let toRow = pass.start; toRow < height; toRow += pass.step) {
      const sourceOffset = fromRow * width;
      const targetOffset = toRow * width;
      result.set(pixels.subarray(sourceOffset, sourceOffset + width), targetOffset);
      fromRow += 1;
    }
  });
  return result;
}

function applyColorTable(indices, colorTable, transparentIndex) {
  const output = new Uint8ClampedArray(indices.length * 4);
  for (let i = 0; i < indices.length; i += 1) {
    const colorIndex = indices[i];
    const offset = i * 4;
    if (transparentIndex !== null && colorIndex === transparentIndex) {
      output[offset] = 0;
      output[offset + 1] = 0;
      output[offset + 2] = 0;
      output[offset + 3] = 0;
      continue;
    }
    const color = colorTable[colorIndex] || [0, 0, 0, 0];
    output[offset] = color[0];
    output[offset + 1] = color[1];
    output[offset + 2] = color[2];
    output[offset + 3] = color[3] ?? 255;
  }
  return output;
}

export function decodeGIF(arrayBuffer) {
  const stream = new Stream(arrayBuffer);
  const headerChars = String.fromCharCode(
    stream.readUint8(),
    stream.readUint8(),
    stream.readUint8(),
    stream.readUint8(),
    stream.readUint8(),
    stream.readUint8(),
  );

  if (!GIF_HEADER.includes(headerChars)) {
    throw new Error('Unsupported GIF header');
  }

  const width = stream.readUint16();
  const height = stream.readUint16();
  const packed = stream.readUint8();
  const hasGlobalColorTable = (packed & 0x80) !== 0;
  const colorResolution = ((packed & 0x70) >> 4) + 1;
  const globalColorTableSize = hasGlobalColorTable ? 1 << ((packed & 0x07) + 1) : 0;
  const backgroundColorIndex = stream.readUint8();
  stream.readUint8(); // pixel aspect ratio, ignored

  let globalColorTable = null;
  if (hasGlobalColorTable) {
    globalColorTable = readColorTable(stream, globalColorTableSize);
  }

  let loopCount = Infinity;
  const frames = [];
  let graphicControl = {
    disposalMethod: 0,
    delay: 10,
    transparentIndex: null,
  };

  let finished = false;
  while (!finished) {
    const blockId = stream.readUint8();
    switch (blockId) {
      case 0x21: { // extension
        const label = stream.readUint8();
        if (label === 0xF9) {
          stream.readUint8(); // block size (should be 4)
          const packedFields = stream.readUint8();
          const delay = stream.readUint16();
          const transparent = stream.readUint8();
          stream.readUint8(); // block terminator
          graphicControl = {
            disposalMethod: (packedFields >> 2) & 0x07,
            delay: delay * 10,
            transparentIndex: (packedFields & 0x01) ? transparent : null,
          };
        } else if (label === 0xFF) {
          const blockSize = stream.readUint8();
          const appIdBytes = stream.readBytes(blockSize);
          const identifier = String.fromCharCode(...appIdBytes);
          const subBlock = readSubBlocks(stream);
          if (identifier.startsWith('NETSCAPE')) {
            if (subBlock.length >= 3) {
              loopCount = subBlock[1] | (subBlock[2] << 8);
              if (loopCount === 0) {
                loopCount = Infinity;
              }
            }
          }
        } else {
          // skip other extensions
          readSubBlocks(stream);
        }
        break;
      }
      case 0x2C: { // image descriptor
        const left = stream.readUint16();
        const top = stream.readUint16();
        const frameWidth = stream.readUint16();
        const frameHeight = stream.readUint16();
        const framePacked = stream.readUint8();
        const localColorTableFlag = (framePacked & 0x80) !== 0;
        const interlaced = (framePacked & 0x40) !== 0;
        const localColorTableSize = localColorTableFlag ? 1 << ((framePacked & 0x07) + 1) : 0;
        let localColorTable = null;
        if (localColorTableFlag) {
          localColorTable = readColorTable(stream, localColorTableSize);
        }
        const lzwMinCodeSize = stream.readUint8();
        const imageData = readSubBlocks(stream);
        const colorTable = localColorTable || globalColorTable;
        if (!colorTable) {
          throw new Error('GIF is missing a color table');
        }
        const pixelCount = frameWidth * frameHeight;
        const decodedIndices = lzwDecode(lzwMinCodeSize, imageData, pixelCount);
        const indices = interlaced ? deinterlace(decodedIndices, frameWidth, frameHeight) : decodedIndices;
        const rgba = applyColorTable(indices, colorTable, graphicControl.transparentIndex);
        frames.push({
          left,
          top,
          width: frameWidth,
          height: frameHeight,
          rgba,
          delay: graphicControl.delay || 10,
          disposalMethod: graphicControl.disposalMethod || 0,
          transparentIndex: graphicControl.transparentIndex,
        });
        graphicControl = {
          disposalMethod: 0,
          delay: 10,
          transparentIndex: null,
        };
        break;
      }
      case 0x3B: // trailer
        finished = true;
        break;
      default:
        throw new Error('Encountered unknown GIF block: 0x' + blockId.toString(16));
    }
  }

  const backgroundColor = globalColorTable && globalColorTable[backgroundColorIndex]
    ? globalColorTable[backgroundColorIndex]
    : [0, 0, 0, 0];

  return {
    width,
    height,
    frames,
    loopCount,
    backgroundColor,
  };
}
