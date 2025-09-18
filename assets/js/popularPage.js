import { convertArrayBuffer } from './frameTools.js';
import { ConversionView } from './resultView.js';
import { POPULAR_GIF_SOURCES } from './popularSources.js';

function resolveSource(config) {
  if (config.src) {
    return config.src;
  }
  if (config.sourceKey && POPULAR_GIF_SOURCES[config.sourceKey]) {
    return POPULAR_GIF_SOURCES[config.sourceKey];
  }
  if (config.slug && POPULAR_GIF_SOURCES[config.slug]) {
    return POPULAR_GIF_SOURCES[config.slug];
  }
  return null;
}

async function loadGifSource(src) {
  if (!src) {
    throw new Error('Missing GIF data source');
  }
  if (src.startsWith('data:')) {
    const commaIndex = src.indexOf(',');
    const base64 = src.slice(commaIndex + 1);
    const binary = atob(base64);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      buffer[i] = binary.charCodeAt(i);
    }
    return buffer.buffer;
  }

  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`Failed to load GIF: ${response.status}`);
  }
  return response.arrayBuffer();
}

async function bootstrap() {
  const config = window.POPULAR_GIF;
  if (!config) {
    return;
  }
  const heroTitle = document.querySelector('[data-role="hero-title"]');
  const heroDescription = document.querySelector('[data-role="hero-description"]');
  const originalImage = document.querySelector('[data-role="original-gif"]');
  const resultsSection = document.querySelector('#results');
  const view = new ConversionView(resultsSection);

  if (heroTitle) {
    heroTitle.textContent = config.title;
  }
  if (heroDescription) {
    heroDescription.textContent = config.description;
  }
  const source = resolveSource(config);

  if (originalImage && source) {
    originalImage.src = source;
    originalImage.alt = config.title;
  }

  try {
    const buffer = await loadGifSource(source);
    const result = convertArrayBuffer(buffer);
    view.setContext({
      gif: result.gif,
      frames: result.frames,
      totalDuration: result.totalDuration,
      baseName: config.slug,
      originalName: config.title,
    });
  } catch (error) {
    const message = document.querySelector('[data-role="status"]');
    if (message) {
      message.textContent = `Automatic conversion failed: ${error.message}`;
      message.dataset.type = 'error';
    }
  }
}

bootstrap();
