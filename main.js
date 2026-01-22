const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const https = require('https');
const http = require('http');
const { parseDAHFile } = require('./src/js/parser');
const { convertToVATGlasses } = require('./src/js/converter');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');

  // Maximize window on start
  mainWindow.maximize();

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

// Handle PDF download from URL
ipcMain.handle('download-pdf', async (event, url) => {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const tempPath = path.join(app.getPath('temp'), `dah-download-${Date.now()}.pdf`);
    const file = require('fs').createWriteStream(tempPath);

    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        require('fs').unlinkSync(tempPath);
        return resolve(ipcMain.handle('download-pdf', event, response.headers.location));
      }

      if (response.statusCode !== 200) {
        file.close();
        require('fs').unlinkSync(tempPath);
        return reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
      }

      const totalBytes = parseInt(response.headers['content-length'], 10);
      let downloadedBytes = 0;

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        const progress = totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
        mainWindow.webContents.send('download-progress', progress);
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve({ success: true, filePath: tempPath });
      });

      file.on('error', (err) => {
        file.close();
        require('fs').unlinkSync(tempPath);
        reject(err);
      });
    });

    request.on('error', (err) => {
      file.close();
      require('fs').unlinkSync(tempPath);
      reject(err);
    });
  });
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
