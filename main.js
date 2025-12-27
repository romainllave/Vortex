const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let updateWindow;
let loginWindow;
let updateWindowReady = false;
let pendingUpdateStatus = 'Verification des mises a jour...';
let windowReady = false;
let updateCheckComplete = false;
let loginComplete = false;

function maybeShowMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (windowReady && updateCheckComplete && loginComplete) {
    closeUpdateWindow();
    mainWindow.show();
  }
}

function maybeShowLoginWindow() {
  if (loginComplete || !updateCheckComplete) {
    return;
  }

  if (!loginWindow || loginWindow.isDestroyed()) {
    createLoginWindow();
  }

  loginWindow.show();
  loginWindow.focus();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.ico'),
    show: false,
    webPreferences: {
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    windowReady = true;
    maybeShowMainWindow();
  });
}

function createLoginWindow() {
  if (loginWindow && !loginWindow.isDestroyed()) {
    return;
  }

  loginWindow = new BrowserWindow({
    width: 520,
    height: 640,
    resizable: false,
    show: false,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload-login.js')
    }
  });

  loginWindow.loadFile(path.join(__dirname, 'login.html'));

  loginWindow.on('closed', () => {
    loginWindow = null;
    if (!loginComplete) {
      app.quit();
    }
  });
}

function createUpdateWindow() {
  if (updateWindow && !updateWindow.isDestroyed()) {
    return;
  }

  updateWindowReady = false;
  updateWindow = new BrowserWindow({
    width: 520,
    height: 360,
    resizable: false,
    movable: true,
    frame: false,
    show: true,
    backgroundColor: '#0b0b0f',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      contextIsolation: true
    }
  });

  updateWindow.loadFile(path.join(__dirname, 'update.html'));

  updateWindow.webContents.on('did-finish-load', () => {
    updateWindowReady = true;
    setUpdateStatus(pendingUpdateStatus);
  });

  updateWindow.on('closed', () => {
    updateWindow = null;
    updateWindowReady = false;
  });
}

function closeUpdateWindow() {
  if (updateWindow && !updateWindow.isDestroyed()) {
    updateWindow.close();
  }
}

function setUpdateStatus(message) {
  pendingUpdateStatus = message;
  if (!updateWindow || updateWindow.isDestroyed()) {
    return;
  }

  if (!updateWindowReady) {
    return;
  }

  updateWindow.webContents.executeJavaScript(
    `document.getElementById('status').textContent = ${JSON.stringify(message)};`
  );
}

function setupAutoUpdates() {
  autoUpdater.autoDownload = true;

  const markUpdateCheckComplete = () => {
    updateCheckComplete = true;
    maybeShowMainWindow();
    maybeShowLoginWindow();
  };

  autoUpdater.on('error', (err) => {
    console.error('Auto-update error:', err);
    setUpdateStatus('Erreur de mise a jour. Demarrage en cours...');
    markUpdateCheckComplete();
  });

  autoUpdater.on('update-available', () => {
    console.log('Update available. Downloading...');
    setUpdateStatus('Mise a jour disponible. Telechargement...');
  });

  autoUpdater.on('update-not-available', () => {
    console.log('No updates available.');
    setUpdateStatus('Aucune mise a jour disponible.');
    markUpdateCheckComplete();
  });

  autoUpdater.on('update-downloaded', () => {
    console.log('Update downloaded. Restarting to apply it.');
    autoUpdater.quitAndInstall();
  });

  autoUpdater.checkForUpdates().catch((err) => {
    console.error('Auto-update check failed:', err);
    markUpdateCheckComplete();
  });
}

app.whenReady().then(() => {
  createWindow();

  if (app.isPackaged) {
    createUpdateWindow();
    setupAutoUpdates();
  } else {
    updateCheckComplete = true;
    maybeShowLoginWindow();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

ipcMain.on('login-success', () => {
  loginComplete = true;
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.close();
  }
  maybeShowMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
