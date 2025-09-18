import { convertArrayBuffer } from './frameTools.js';
import { ConversionView } from './resultView.js';

const fileInput = document.querySelector('#gif-input');
const dropZone = document.querySelector('[data-role="dropzone"]');
const messageEl = document.querySelector('[data-role="status"]');
const resultsSection = document.querySelector('#results');
const conversionView = new ConversionView(resultsSection);

function setStatus(text, type = 'info') {
  if (!messageEl) {
    return;
  }
  messageEl.textContent = text;
  messageEl.dataset.type = type;
}

function resetStatus() {
  if (!messageEl) {
    return;
  }
  messageEl.textContent = 'Drag or choose a GIF file to start converting';
  delete messageEl.dataset.type;
}

async function handleFile(file) {
  if (!file) {
    return;
  }
  if (!file.type || file.type !== 'image/gif') {
    setStatus('Please choose a GIF animation file', 'error');
    return;
  }
  try {
    setStatus('Parsing GIF, please wait…', 'progress');
    const buffer = await file.arrayBuffer();
    const result = convertArrayBuffer(buffer);
    conversionView.setContext({
      gif: result.gif,
      frames: result.frames,
      totalDuration: result.totalDuration,
      baseName: file.name.replace(/\.gif$/i, ''),
      originalName: file.name,
    });
    setStatus('Conversion complete—preview and download every frame', 'success');
  } catch (error) {
    console.error(error);
    setStatus(`Conversion failed: ${error.message}`, 'error');
  }
}

if (fileInput) {
  fileInput.addEventListener('change', (event) => {
    const [file] = event.target.files;
    handleFile(file);
  });
}

if (dropZone) {
  ['dragenter', 'dragover'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add('is-hovered');
    });
  });
  ['dragleave', 'drop'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove('is-hovered');
    });
  });
  dropZone.addEventListener('drop', (event) => {
    const file = event.dataTransfer.files[0];
    handleFile(file);
  });
  dropZone.addEventListener('click', () => {
    if (fileInput) {
      fileInput.click();
    }
  });
}

resetStatus();
