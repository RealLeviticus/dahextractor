/**
 * Preload Script
 * Safely exposes IPC methods to the renderer process
 * This runs in a privileged context and bridges main/renderer processes securely
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File selection
  selectDAHFile: () => ipcRenderer.invoke('select-dah-file'),

  // File conversion
  convertDAHFile: (filePath) => ipcRenderer.invoke('convert-dah-file', filePath),

  // PDF download
  downloadPDF: (url) => ipcRenderer.invoke('download-pdf', url),

  // Listen for download progress
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, progress) => callback(progress));
  },

  // Save JSON file
  saveJSONFile: (jsonData) => ipcRenderer.invoke('save-json-file', jsonData)
});
