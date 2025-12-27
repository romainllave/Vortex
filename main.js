const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let updateWindow;
let updateWindowReady = false;
let pendingUpdateStatus = 'Verification des mises a jour...';
let windowReady = false;
let updateCheckComplete = false;

function logUpdate(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  try {
    const logPath = path.join(app.getPath('userData'), 'updater.log');
    fs.appendFileSync(logPath, line);
  } catch (err) {
    console.warn('Failed to write updater log:', err);
  }
  console.log(message);
}

function maybeShowMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (windowReady && updateCheckComplete) {
    closeUpdateWindow();
    mainWindow.show();
  }
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

function setUpdateProgress(percent) {
  if (!updateWindow || updateWindow.isDestroyed() || !updateWindowReady) {
    return;
  }

  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  updateWindow.webContents.executeJavaScript(
    `document.getElementById('progress-fill').style.width = '${safePercent}%';`
  );
  updateWindow.webContents.executeJavaScript(
    `document.getElementById('progress-text').textContent = '${safePercent}%';`
  );
}

function setupAutoUpdates() {
  autoUpdater.autoDownload = true;

  const markUpdateCheckComplete = () => {
    updateCheckComplete = true;
    maybeShowMainWindow();
  };

  autoUpdater.on('error', (err) => {
    logUpdate(`Auto-update error: ${err}`);
    setUpdateStatus('Erreur de mise a jour. Demarrage en cours...');
    markUpdateCheckComplete();
  });

  autoUpdater.on('update-available', () => {
    logUpdate('Update available. Downloading...');
    setUpdateStatus('Mise a jour disponible. Telechargement...');
  });

  autoUpdater.on('update-not-available', () => {
    logUpdate('No updates available.');
    setUpdateStatus('Aucune mise a jour disponible.');
    setUpdateProgress(100);
    markUpdateCheckComplete();
  });

  autoUpdater.on('download-progress', (progress) => {
    const percent = progress.percent || 0;
    setUpdateProgress(percent);
    logUpdate(
      `Download progress: ${percent.toFixed(1)}% (${progress.transferred}/${progress.total})`
    );
  });

  autoUpdater.on('update-downloaded', () => {
    logUpdate('Update downloaded. Restarting to apply it.');
    setUpdateProgress(100);
    autoUpdater.quitAndInstall();
  });

  autoUpdater.checkForUpdates().catch((err) => {
    logUpdate(`Auto-update check failed: ${err}`);
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
    maybeShowMainWindow();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
