import { decodeGIF } from './gifParser.js';

function rgbaToCss(color) {
  if (!color) {
    return 'rgba(0,0,0,0)';
  }
  const [r, g, b, a = 255] = color;
  const alpha = (a / 255).toFixed(3).replace(/\.0+$/, '');
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function convertArrayBuffer(arrayBuffer) {
  const gif = decodeGIF(arrayBuffer);
  const composed = composeFrames(gif);
  const totalDuration = composed.reduce((sum, frame) => sum + frame.delay, 0);
  return {
    gif,
    frames: composed,
    totalDuration,
  };
}

export function composeFrames(gif) {
  const canvas = document.createElement('canvas');
  canvas.width = gif.width;
  canvas.height = gif.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, gif.width, gif.height);

  const bgCss = rgbaToCss(gif.backgroundColor);
  const frames = [];
  let previous = {
    disposalMethod: 0,
    area: { left: 0, top: 0, width: gif.width, height: gif.height },
    savedImageData: null,
  };

  gif.frames.forEach((frame, index) => {
    if (previous.disposalMethod === 2) {
      ctx.clearRect(previous.area.left, previous.area.top, previous.area.width, previous.area.height);
      if (gif.backgroundColor && gif.backgroundColor[3]) {
        ctx.save();
        ctx.fillStyle = bgCss;
        ctx.fillRect(previous.area.left, previous.area.top, previous.area.width, previous.area.height);
        ctx.restore();
      }
    } else if (previous.disposalMethod === 3 && previous.savedImageData) {
      ctx.putImageData(previous.savedImageData, 0, 0);
    }

    let savedImageData = null;
    if (frame.disposalMethod === 3) {
      savedImageData = ctx.getImageData(0, 0, gif.width, gif.height);
    }

    const imageData = new ImageData(frame.rgba, frame.width, frame.height);
    ctx.putImageData(imageData, frame.left, frame.top);

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = gif.width;
    exportCanvas.height = gif.height;
    const exportCtx = exportCanvas.getContext('2d');
    exportCtx.drawImage(canvas, 0, 0);

    const frameResult = {
      index: index + 1,
      delay: frame.delay,
      disposalMethod: frame.disposalMethod,
      imageCanvas: exportCanvas,
      bounds: { left: frame.left, top: frame.top, width: frame.width, height: frame.height },
      dataUrlCache: null,
      async toBlob(type = 'image/png') {
        return new Promise((resolve) => {
          exportCanvas.toBlob((blob) => resolve(blob), type);
        });
      },
      toDataURL(type = 'image/png') {
        if (!this.dataUrlCache) {
          this.dataUrlCache = exportCanvas.toDataURL(type);
        }
        return this.dataUrlCache;
      },
    };
    frames.push(frameResult);

    previous = {
      disposalMethod: frame.disposalMethod,
      area: { left: frame.left, top: frame.top, width: frame.width, height: frame.height },
      savedImageData,
    };
  });

  return frames;
}

export function createSpriteSheet(frames, options = {}) {
  const {
    columns = frames.length,
    spacing = 0,
    background = 'transparent',
  } = options;

  if (!frames.length) {
    return null;
  }

  const frameWidth = frames[0].imageCanvas.width;
  const frameHeight = frames[0].imageCanvas.height;
  const total = frames.length;
  const cols = Math.max(1, Math.min(columns, total));
  const rows = Math.ceil(total / cols);

  const canvas = document.createElement('canvas');
  canvas.width = cols * frameWidth + spacing * (cols - 1);
  canvas.height = rows * frameHeight + spacing * (rows - 1);
  const ctx = canvas.getContext('2d');

  if (background !== 'transparent') {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  const metadataFrames = [];

  frames.forEach((frame, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = col * (frameWidth + spacing);
    const y = row * (frameHeight + spacing);
    ctx.drawImage(frame.imageCanvas, x, y);
    metadataFrames.push({
      index: frame.index,
      delay: frame.delay,
      x,
      y,
      width: frameWidth,
      height: frameHeight,
    });
  });

  const metadata = {
    frameWidth,
    frameHeight,
    columns: cols,
    rows,
    totalFrames: total,
    spacing,
    background,
    frames: metadataFrames,
  };

  return { canvas, metadata };
}

export function buildAnimationCSS(baseName, metadata) {
  const frameCount = metadata.totalFrames;
  const duration = metadata.frames.reduce((sum, frame) => sum + frame.delay, 0) / 1000 || 1;
  const percentages = metadata.frames.map((frame, index) => ({
    percentage: ((index + 1) / frameCount) * 100,
    position: `-${frame.x}px -${frame.y}px`,
    cumulative: metadata.frames.slice(0, index + 1).reduce((sum, f) => sum + f.delay, 0),
  }));

  const keyframes = percentages.map((frame, index) => {
    const start = index === 0 ? 0 : (percentages[index - 1].cumulative / (duration * 1000)) * 100;
    const end = (frame.cumulative / (duration * 1000)) * 100;
    const safeStart = Number.isFinite(start) ? start : 0;
    const safeEnd = Number.isFinite(end) ? end : safeStart;
    return `  ${safeStart.toFixed(2)}%, ${safeEnd.toFixed(2)}% { background-position: ${frame.position}; }`;
  }).join('\n');

  return `.${baseName} {\n  width: ${metadata.frameWidth}px;\n  height: ${metadata.frameHeight}px;\n  background-repeat: no-repeat;\n  animation: ${baseName}-animation ${duration.toFixed(2)}s steps(${frameCount}) infinite;\n}\n\n@keyframes ${baseName}-animation {\n${keyframes}\n}`;
}

export function buildMetadataJSON(gif, frames, spriteMetadata) {
  return {
    width: gif.width,
    height: gif.height,
    loopCount: gif.loopCount === Infinity ? 'infinite' : gif.loopCount,
    totalDuration: frames.reduce((sum, frame) => sum + frame.delay, 0),
    frames: frames.map((frame) => ({
      index: frame.index,
      delay: frame.delay,
      disposalMethod: frame.disposalMethod,
      bounds: frame.bounds,
    })),
    spriteSheet: spriteMetadata || null,
  };
}
