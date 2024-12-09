const { app, BrowserWindow, ipcMain, dialog, Notification } = require('electron');
const path = require('path');

// Configuração do .env para desenvolvimento e produção
if (app.isPackaged) {
    require('dotenv').config({ path: path.join(process.resourcesPath, '.env') });
} else {
    require('dotenv').config();
}

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 700,
        minWidth: 600,
        minHeight: 500,
        resizable: true,
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        backgroundColor: '#1E1E2E',
        icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png')
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

// Handler para o diálogo de salvamento
ipcMain.handle('show-save-dialog', async (event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Translated Subtitle',
        defaultPath: options.defaultPath,
        filters: [
            { name: 'Subtitle Files', extensions: ['srt'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });
    
    return result.canceled ? null : result.filePath;
});

// Handler para notificações
ipcMain.on('show-notification', (event, options) => {
    new Notification({
        title: options.title,
        body: options.body,
        icon: path.join(__dirname, 'icon.png')
    }).show();
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
