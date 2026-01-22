const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { parseDAHFile } = require('./parser');
const { convertToVATGlasses } = require('./converter');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, 'assets/icon.png')
  });

  mainWindow.loadFile('index.html');

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle file selection
ipcMain.handle('select-dah-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'DAH Files', extensions: ['pdf', 'txt', 'dat', 'dah'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Handle file conversion
ipcMain.handle('convert-dah-file', async (event, filePath) => {
  try {
    // Read the file
    const fileContent = await fs.readFile(filePath, 'utf-8');

    // Parse the DAH file
    const parsedData = parseDAHFile(fileContent);

    // Convert to VATGlasses format
    const vatglassesData = convertToVATGlasses(parsedData);

    return {
      success: true,
      data: vatglassesData
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Handle saving converted file
ipcMain.handle('save-json-file', async (event, jsonData) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: 'vatglasses-output.json',
    filters: [
      { name: 'JSON Files', extensions: ['json'] }
    ]
  });

  if (!result.canceled && result.filePath) {
    try {
      await fs.writeFile(result.filePath, JSON.stringify(jsonData, null, 2), 'utf-8');
      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: 'Save cancelled' };
});
