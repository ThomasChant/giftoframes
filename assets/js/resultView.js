import { createSpriteSheet, buildAnimationCSS, buildMetadataJSON } from './frameTools.js';
import { createTarArchive } from './tar.js';

function formatMs(ms) {
  if (!Number.isFinite(ms)) {
    return 'Unknown';
  }
  const seconds = ms / 1000;
  if (seconds < 1) {
    return `${ms.toFixed(0)} ms`;
  }
  if (seconds < 60) {
    return `${seconds.toFixed(2)} s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds - minutes * 60;
  return `${minutes} min ${remaining.toFixed(1)} s`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function blobFromFrame(frame) {
  const blob = await frame.toBlob('image/png');
  const arrayBuffer = await blob.arrayBuffer();
  return {
    blob,
    arrayBuffer,
    uint8: new Uint8Array(arrayBuffer),
  };
}

function createFrameCard(frame, baseName) {
  const figure = document.createElement('figure');
  figure.className = 'frame-card';

  const img = document.createElement('img');
  img.src = frame.toDataURL();
  img.alt = `${baseName} frame ${frame.index}`;
  figure.appendChild(img);

  const caption = document.createElement('figcaption');
  caption.innerHTML = `
    <div class="frame-title">Frame ${frame.index}</div>
    <div class="frame-meta">Delay: ${formatMs(frame.delay)}</div>
    <div class="frame-meta">Disposal: ${frame.disposalMethod}</div>
  `;
  figure.appendChild(caption);

  const actions = document.createElement('div');
  actions.className = 'frame-actions';
  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.textContent = 'Download PNG';
  downloadBtn.addEventListener('click', async () => {
    const blob = await frame.toBlob('image/png');
    downloadBlob(blob, `${baseName}-frame-${String(frame.index).padStart(3, '0')}.png`);
  });
  actions.appendChild(downloadBtn);
  figure.appendChild(actions);

  return figure;
}

export class ConversionView {
  constructor(rootElement) {
    this.root = rootElement;
    this.summaryEl = rootElement.querySelector('[data-role="summary"]');
    this.framesGrid = rootElement.querySelector('[data-role="frames-grid"]');
    this.spriteForm = rootElement.querySelector('[data-role="sprite-form"]');
    this.spriteOutput = rootElement.querySelector('[data-role="sprite-output"]');
    this.spriteCanvas = this.spriteOutput ? this.spriteOutput.querySelector('canvas') : null;
    this.spriteCssArea = this.spriteOutput ? this.spriteOutput.querySelector('textarea') : null;
    this.downloadTarBtn = rootElement.querySelector('[data-action="download-tar"]');
    this.downloadMetaBtn = rootElement.querySelector('[data-action="download-meta"]');
    this.downloadSpriteBtn = this.spriteOutput ? this.spriteOutput.querySelector('[data-action="download-sprite"]') : null;
    this.copyCssBtn = this.spriteOutput ? this.spriteOutput.querySelector('[data-action="copy-css"]') : null;

    this.context = null;
    this.spriteMetadata = null;

    if (this.spriteForm) {
      this.spriteForm.addEventListener('submit', (event) => {
        event.preventDefault();
        this.generateSpriteSheet();
      });
    }

    if (this.downloadTarBtn) {
      this.downloadTarBtn.addEventListener('click', () => {
        this.downloadAllFrames();
      });
    }

    if (this.downloadMetaBtn) {
      this.downloadMetaBtn.addEventListener('click', () => {
        this.downloadMetadata();
      });
    }

    if (this.downloadSpriteBtn) {
      this.downloadSpriteBtn.addEventListener('click', () => {
        this.downloadSprite();
      });
    }

    if (this.copyCssBtn) {
      this.copyCssBtn.addEventListener('click', () => {
        this.copyCSS();
      });
    }
  }

  setContext(context) {
    this.context = context;
    this.render();
  }

  render() {
    if (!this.context) {
      return;
    }
    const { gif, frames, totalDuration, baseName = 'gif-frames', originalName } = this.context;

    this.root.removeAttribute('hidden');

    if (this.summaryEl) {
      const loopText = gif.loopCount === Infinity ? 'Infinite' : `${gif.loopCount} time(s)`;
      this.summaryEl.innerHTML = `
        <h2>Conversion results</h2>
        <p><strong>Source file:</strong> ${originalName || 'Untitled'}</p>
        <p><strong>Dimensions:</strong> ${gif.width} × ${gif.height}</p>
        <p><strong>Frame count:</strong> ${frames.length}</p>
        <p><strong>Total duration:</strong> ${formatMs(totalDuration)}</p>
        <p><strong>Loop count:</strong> ${loopText}</p>
      `;
    }

    if (this.framesGrid) {
      this.framesGrid.innerHTML = '';
      frames.forEach((frame) => {
        const card = createFrameCard(frame, baseName);
        this.framesGrid.appendChild(card);
      });
    }

    if (this.spriteCanvas) {
      this.generateSpriteSheet();
    }
  }

  async generateSpriteSheet() {
    if (!this.context || !this.spriteForm || !this.spriteCanvas) {
      return;
    }
    const { frames, baseName = 'gif-frames' } = this.context;
    const formData = new FormData(this.spriteForm);
    const columns = Number.parseInt(formData.get('columns'), 10) || frames.length;
    const spacing = Number.parseInt(formData.get('spacing'), 10) || 0;
    const transparent = formData.get('transparent') === 'on';
    const background = transparent ? 'transparent' : formData.get('background') || '#00000000';

    const sprite = createSpriteSheet(frames, { columns, spacing, background });
    if (!sprite) {
      return;
    }
    this.spriteMetadata = sprite.metadata;
    this.spriteCanvas.width = sprite.canvas.width;
    this.spriteCanvas.height = sprite.canvas.height;
    const ctx = this.spriteCanvas.getContext('2d');
    ctx.clearRect(0, 0, this.spriteCanvas.width, this.spriteCanvas.height);
    ctx.drawImage(sprite.canvas, 0, 0);

    if (this.spriteCssArea) {
      const css = buildAnimationCSS(baseName, sprite.metadata);
      this.spriteCssArea.value = css;
    }
  }

  async downloadAllFrames() {
    if (!this.context) {
      return;
    }
    const { frames, baseName = 'gif-frames' } = this.context;
    const files = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const frame of frames) {
      // eslint-disable-next-line no-await-in-loop
      const { uint8 } = await blobFromFrame(frame);
      files.push({
        name: `${baseName}-frame-${String(frame.index).padStart(3, '0')}.png`,
        data: uint8,
      });
    }
    const tarBlob = createTarArchive(files);
    downloadBlob(tarBlob, `${baseName}-frames.tar`);
  }

  downloadMetadata() {
    if (!this.context) {
      return;
    }
    const { gif, frames, baseName = 'gif-frames' } = this.context;
    const metadata = buildMetadataJSON(gif, frames, this.spriteMetadata);
    const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `${baseName}-frames.json`);
  }

  async downloadSprite() {
    if (!this.spriteCanvas) {
      return;
    }
    const blob = await new Promise((resolve) => this.spriteCanvas.toBlob(resolve, 'image/png'));
    downloadBlob(blob, `${this.context?.baseName || 'gif-frames'}-spritesheet.png`);
  }

  async copyCSS() {
    if (!this.spriteCssArea) {
      return;
    }
    this.spriteCssArea.select();
    try {
      await navigator.clipboard.writeText(this.spriteCssArea.value);
      this.copyCssBtn.textContent = 'Copied!';
      setTimeout(() => {
        this.copyCssBtn.textContent = 'Copy CSS animation';
      }, 2000);
    } catch (error) {
      console.warn('Unable to copy to clipboard', error);
    }
  }
}
