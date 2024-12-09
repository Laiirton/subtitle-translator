const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
require('dotenv').config();

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        minWidth: 800,
        minHeight: 600,
        resizable: true,
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        backgroundColor: '#1E1E2E'
    });

    mainWindow.loadFile('index.html');
    mainWindow.removeMenu();
}

// Controles da janela
ipcMain.on('minimize-window', () => {
    mainWindow.minimize();
});

ipcMain.on('maximize-window', () => {
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});

ipcMain.on('close-window', () => {
    mainWindow.close();
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
