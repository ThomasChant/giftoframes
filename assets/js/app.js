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
  messageEl.textContent = '拖拽或选择 GIF 文件开始转换';
  delete messageEl.dataset.type;
}

async function handleFile(file) {
  if (!file) {
    return;
  }
  if (!file.type || file.type !== 'image/gif') {
    setStatus('请选择 GIF 动图文件', 'error');
    return;
  }
  try {
    setStatus('正在解析 GIF，请稍候…', 'progress');
    const buffer = await file.arrayBuffer();
    const result = convertArrayBuffer(buffer);
    conversionView.setContext({
      gif: result.gif,
      frames: result.frames,
      totalDuration: result.totalDuration,
      baseName: file.name.replace(/\.gif$/i, ''),
      originalName: file.name,
    });
    setStatus('转换完成，可以查看和下载所有帧', 'success');
  } catch (error) {
    console.error(error);
    setStatus(`转换失败：${error.message}`, 'error');
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
