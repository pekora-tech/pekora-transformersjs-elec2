import { app, BrowserWindow, Tray, Menu, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';
import treeKill from 'tree-kill';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow = null;
let tray = null;
let viteProcess = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('control.html');
};

const sendServerStatus = (status) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('server-status', status);
  }
};

const startViteServer = (modelType = 'llama') => {
  if (viteProcess) return;
  
  // Pass model type as environment variable
  viteProcess = spawn('npm', ['run', 'dev'], {
    shell: true,
    stdio: 'ignore',
    windowsHide: true,
    env: {
      ...process.env,
      VITE_MODEL_TYPE: modelType
    }
  });
  
  // 等待vite服務器啟動
  return new Promise((resolve) => {
    setTimeout(() => {
      sendServerStatus(true);
      resolve();
    }, 5178);
  });
};

const killViteServer = () => {
  if (viteProcess && viteProcess.pid) {
    treeKill(viteProcess.pid);
    viteProcess = null;
    sendServerStatus(false);
  }
};

const createTray = () => {
  const modelType = process.env.VITE_MODEL_TYPE || 'llama';
  const logoPath = modelType === 'phi' ? '../public/logo-phi.png' : 
                   modelType === 'deepseek' ? '../public/logo-deepseek.png' : 
                   '../public/logo.png';
  tray = new Tray(join(__dirname, logoPath));
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '開啟控制介面',
      click: async () => {
        if (mainWindow === null) {
          createWindow();
        } else {
          mainWindow.show();
        }
      }
    },
    {
      label: '退出',
      click: () => {
        killViteServer();
        app.quit();
      }
    }
  ]);
  const tooltipText = modelType === 'phi' ? 'Phi-3.5 WebGPU Service' :
                     modelType === 'deepseek' ? 'DeepSeek R1 WebGPU Service' :
                     'Llama 3.2 WebGPU Service';
  tray.setToolTip(tooltipText);
  tray.setContextMenu(contextMenu);
};

// IPC Handlers
ipcMain.handle('start-server', async (event, modelType) => {
  await startViteServer(modelType);
});

ipcMain.handle('stop-server', () => {
  killViteServer();
});

app.whenReady().then(async () => {
  await startViteServer('llama'); // Default to llama model
  createTray();
  createWindow();
});

app.on('window-all-closed', () => {
  killViteServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  killViteServer();
});
