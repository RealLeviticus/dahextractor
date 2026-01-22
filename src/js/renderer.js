/**
 * Renderer Process
 * Handles UI interactions, screen navigation, and workflow
 */

// State
let convertedData = null;
let currentFilePath = null;

// Screen elements (will be initialized after DOM loads)
let screens = {};
let uploadOption, linkOption, downloadBtn, cancelLinkBtn, saveLocationBtn, startOverBtn;
let pdfUrlInput, progressFill, progressText, processingStatus, conversionSummary;

/**
 * Screen navigation
 */
function showScreen(screenName) {
  Object.values(screens).forEach(screen => screen.classList.remove('active'));
  screens[screenName].classList.add('active');
}

/**
 * Handle upload option
 */
async function handleUploadOption() {
  try {
    const filePath = await window.electronAPI.selectDAHFile();

    if (filePath) {
      currentFilePath = filePath;
      await processFile(filePath);
    }
  } catch (error) {
    showError(`Error selecting file: ${error.message}`);
  }
}

/**
 * Handle link option
 */
function handleLinkOption() {
  showScreen('link');
  pdfUrlInput.value = '';
  pdfUrlInput.focus();
}

/**
 * Handle download and convert
 */
async function handleDownloadAndConvert() {
  const url = pdfUrlInput.value.trim();

  if (!url) {
    alert('Please enter a valid URL');
    return;
  }

  try {
    showScreen('processing');
    updateProgress(0, 'Starting download...');

    const result = await window.electronAPI.downloadPDF(url);

    if (result.success) {
      currentFilePath = result.filePath;
      updateProgress(100, 'Download complete!');
      await processFile(result.filePath);
    } else {
      showError('Failed to download file');
    }
  } catch (error) {
    showError(`Download error: ${error.message}`);
  }
}

/**
 * Process and convert file
 */
async function processFile(filePath) {
  try {
    showScreen('processing');
    updateProgress(25, 'Reading file...');

    await delay(500);
    updateProgress(50, 'Parsing DAH data...');

    const result = await window.electronAPI.convertDAHFile(filePath);

    if (result.success) {
      convertedData = result.data;
      updateProgress(100, 'Conversion complete!');

      await delay(500);
      showConversionComplete(result.data);
    } else {
      showError(`Conversion failed: ${result.error}`);
    }
  } catch (error) {
    showError(`Processing error: ${error.message}`);
  }
}

/**
 * Show conversion complete screen
 */
function showConversionComplete(data) {
  const airspaceCount = data.airspace?.length || 0;
  const positionCount = data.positions?.length || 0;
  const airportCount = data.airports?.length || 0;

  let summary = 'Successfully converted DAH file to VATGlasses JSON format.\n\n';
  summary += `Found:\n`;
  summary += `• ${airspaceCount} airspace${airspaceCount !== 1 ? 's' : ''}\n`;

  if (positionCount > 0) {
    summary += `• ${positionCount} position${positionCount !== 1 ? 's' : ''}\n`;
  }

  if (airportCount > 0) {
    summary += `• ${airportCount} airport${airportCount !== 1 ? 's' : ''}`;
  }

  conversionSummary.textContent = summary;
  showScreen('complete');
}

/**
 * Handle save location
 */
async function handleSaveLocation() {
  if (!convertedData) {
    alert('No data to save');
    return;
  }

  try {
    const result = await window.electronAPI.saveJSONFile(convertedData);

    if (result.success) {
      alert(`File saved successfully to:\n${result.path}`);
    } else if (result.error !== 'Save cancelled') {
      alert(`Error saving file: ${result.error}`);
    }
  } catch (error) {
    alert(`Error saving file: ${error.message}`);
  }
}

/**
 * Handle start over
 */
function handleStartOver() {
  convertedData = null;
  currentFilePath = null;
  pdfUrlInput.value = '';
  resetProgress();
  showScreen('home');
}

/**
 * Update progress bar
 */
function updateProgress(percent, text) {
  progressFill.style.width = `${percent}%`;
  progressText.textContent = text;

  if (processingStatus) {
    processingStatus.className = 'status-message info';
    processingStatus.textContent = text;
  }
}

/**
 * Reset progress bar
 */
function resetProgress() {
  progressFill.style.width = '0%';
  progressText.textContent = 'Initializing...';

  if (processingStatus) {
    processingStatus.className = 'status-message';
    processingStatus.textContent = '';
  }
}

/**
 * Show error message
 */
function showError(message) {
  if (processingStatus) {
    processingStatus.className = 'status-message error';
    processingStatus.textContent = message;
  }

  alert(message);
  showScreen('home');
}

/**
 * Utility delay function
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Update logo based on background color
 */
function updateLogo() {
  const logo = document.getElementById('vatpacLogo');
  const main = document.querySelector('main');

  if (!logo || !main) return;

  // Get the computed background color of main
  const bgColor = window.getComputedStyle(main).backgroundColor;

  // Parse RGB values
  const rgb = bgColor.match(/\d+/g);
  if (!rgb) return;

  // Calculate relative luminance
  const r = parseInt(rgb[0]) / 255;
  const g = parseInt(rgb[1]) / 255;
  const b = parseInt(rgb[2]) / 255;

  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  // If background is dark (luminance < 0.5), use white logo
  // Otherwise use regular logo
  if (luminance < 0.5) {
    logo.src = 'assets/vatpac-logo-white.svg';
  } else {
    logo.src = 'assets/vatpac-logo.svg';
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Initialize screen elements
  screens = {
    home: document.getElementById('homeScreen'),
    link: document.getElementById('linkScreen'),
    processing: document.getElementById('processingScreen'),
    complete: document.getElementById('completeScreen')
  };

  // Initialize button elements
  uploadOption = document.getElementById('uploadOption');
  linkOption = document.getElementById('linkOption');
  downloadBtn = document.getElementById('downloadBtn');
  cancelLinkBtn = document.getElementById('cancelLinkBtn');
  saveLocationBtn = document.getElementById('saveLocationBtn');
  startOverBtn = document.getElementById('startOverBtn');

  // Initialize input elements
  pdfUrlInput = document.getElementById('pdfUrlInput');

  // Initialize progress elements
  progressFill = document.getElementById('progressFill');
  progressText = document.getElementById('progressText');
  processingStatus = document.getElementById('processingStatus');

  // Initialize result elements
  conversionSummary = document.getElementById('conversionSummary');

  // Set up event listeners
  uploadOption.addEventListener('click', handleUploadOption);
  linkOption.addEventListener('click', handleLinkOption);

  downloadBtn.addEventListener('click', handleDownloadAndConvert);
  cancelLinkBtn.addEventListener('click', () => showScreen('home'));
  saveLocationBtn.addEventListener('click', handleSaveLocation);
  startOverBtn.addEventListener('click', handleStartOver);

  // Listen for download progress
  window.electronAPI.onDownloadProgress((progress) => {
    updateProgress(progress, `Downloading file... ${progress}%`);
  });

  // Initialize UI
  showScreen('home');
  updateLogo();
});
