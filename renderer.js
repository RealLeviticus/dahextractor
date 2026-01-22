/**
 * Renderer Process
 * Handles UI interactions and communicates with main process
 */

const { ipcRenderer } = require('electron');

// DOM elements
const selectFileBtn = document.getElementById('selectFileBtn');
const selectedFileDiv = document.getElementById('selectedFile');
const convertBtn = document.getElementById('convertBtn');
const statusDiv = document.getElementById('status');
const previewSection = document.getElementById('previewSection');
const jsonPreview = document.getElementById('jsonPreview');
const saveBtn = document.getElementById('saveBtn');
const copyBtn = document.getElementById('copyBtn');

// State
let currentFilePath = null;
let convertedData = null;

// Event listeners
selectFileBtn.addEventListener('click', handleSelectFile);
convertBtn.addEventListener('click', handleConvert);
saveBtn.addEventListener('click', handleSave);
copyBtn.addEventListener('click', handleCopy);

/**
 * Handle file selection
 */
async function handleSelectFile() {
  try {
    const filePath = await ipcRenderer.invoke('select-dah-file');

    if (filePath) {
      currentFilePath = filePath;
      const fileName = filePath.split(/[\\/]/).pop();

      selectedFileDiv.textContent = `Selected: ${fileName}`;
      selectedFileDiv.classList.add('has-file');
      convertBtn.disabled = false;

      showStatus('File selected successfully', 'success');
      hidePreview();
    }
  } catch (error) {
    showStatus(`Error selecting file: ${error.message}`, 'error');
  }
}

/**
 * Handle file conversion
 */
async function handleConvert() {
  if (!currentFilePath) {
    showStatus('Please select a file first', 'error');
    return;
  }

  try {
    // Disable button and show loading state
    convertBtn.disabled = true;
    convertBtn.textContent = 'Converting...';
    showStatus('Converting DAH file to VATGlasses format...', 'info');

    // Call main process to convert
    const result = await ipcRenderer.invoke('convert-dah-file', currentFilePath);

    // Re-enable button
    convertBtn.disabled = false;
    convertBtn.textContent = 'Convert to VATGlasses JSON';

    if (result.success) {
      convertedData = result.data;

      // Display preview
      displayPreview(result.data);

      // Show success message
      const airspaceCount = result.data.airspace?.length || 0;
      const positionCount = result.data.positions?.length || 0;
      const airportCount = result.data.airports?.length || 0;

      showStatus(
        `Conversion successful! Found ${airspaceCount} airspaces, ${positionCount} positions, ${airportCount} airports`,
        'success'
      );
    } else {
      showStatus(`Conversion failed: ${result.error}`, 'error');
      hidePreview();
    }
  } catch (error) {
    convertBtn.disabled = false;
    convertBtn.textContent = 'Convert to VATGlasses JSON';
    showStatus(`Error during conversion: ${error.message}`, 'error');
    hidePreview();
  }
}

/**
 * Handle saving JSON file
 */
async function handleSave() {
  if (!convertedData) {
    showStatus('No data to save', 'error');
    return;
  }

  try {
    const result = await ipcRenderer.invoke('save-json-file', convertedData);

    if (result.success) {
      showStatus(`File saved successfully to: ${result.path}`, 'success');
    } else {
      showStatus(`Error saving file: ${result.error}`, 'error');
    }
  } catch (error) {
    showStatus(`Error saving file: ${error.message}`, 'error');
  }
}

/**
 * Handle copying JSON to clipboard
 */
function handleCopy() {
  if (!convertedData) {
    showStatus('No data to copy', 'error');
    return;
  }

  try {
    const jsonString = JSON.stringify(convertedData, null, 2);
    navigator.clipboard.writeText(jsonString);
    showStatus('JSON copied to clipboard!', 'success');

    // Visual feedback
    copyBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyBtn.textContent = 'Copy to Clipboard';
    }, 2000);
  } catch (error) {
    showStatus(`Error copying to clipboard: ${error.message}`, 'error');
  }
}

/**
 * Display JSON preview
 */
function displayPreview(data) {
  const jsonString = JSON.stringify(data, null, 2);
  jsonPreview.textContent = jsonString;
  previewSection.style.display = 'block';

  // Scroll to preview
  previewSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Hide preview section
 */
function hidePreview() {
  previewSection.style.display = 'none';
  convertedData = null;
}

/**
 * Show status message
 */
function showStatus(message, type = 'info') {
  statusDiv.textContent = message;
  statusDiv.className = `status show ${type}`;

  // Auto-hide success messages after 5 seconds
  if (type === 'success') {
    setTimeout(() => {
      statusDiv.classList.remove('show');
    }, 5000);
  }
}

/**
 * Initialize drag and drop functionality
 */
function initDragAndDrop() {
  const container = document.querySelector('.container');

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    container.style.opacity = '0.7';
  });

  container.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    container.style.opacity = '1';
  });

  container.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    container.style.opacity = '1';

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const filePath = files[0].path;
      currentFilePath = filePath;
      const fileName = filePath.split(/[\\/]/).pop();

      selectedFileDiv.textContent = `Selected: ${fileName}`;
      selectedFileDiv.classList.add('has-file');
      convertBtn.disabled = false;

      showStatus('File dropped successfully', 'success');
      hidePreview();
    }
  });
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  initDragAndDrop();
  selectedFileDiv.textContent = 'No file selected';
});

// Handle keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + O to open file
  if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
    e.preventDefault();
    handleSelectFile();
  }

  // Ctrl/Cmd + S to save (if data exists)
  if ((e.ctrlKey || e.metaKey) && e.key === 's' && convertedData) {
    e.preventDefault();
    handleSave();
  }

  // Ctrl/Cmd + Enter to convert (if file selected)
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && currentFilePath) {
    e.preventDefault();
    handleConvert();
  }
});
