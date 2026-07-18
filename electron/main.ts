import { app, BrowserWindow, ipcMain, Event, IpcMainEvent, BluetoothDevice, Session } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { updateElectronApp } from 'update-electron-app';
updateElectronApp();

import { autoUpdater } from 'electron-updater'
import {  dialog } from 'electron'
export default (mainWindow) => {
  const sendStatusToWindow = (text) => {
    mainWindow.webContents.executeJavaScript('console.log("'+`update msg:${text}`+'")');
  }
  autoUpdater.checkForUpdates()
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('checking-for-update', () => {
    sendStatusToWindow('Checking for update...')
  })

  autoUpdater.on('update-available', (info) => {
    // 当有新版本可用时，弹窗提示用户
    dialog
      .showMessageBox({
        type: 'info',
        title: '新版本可用',
        message: '有一个可用的新版本，要更新吗',
        buttons: ['是', '否']
      })
      .then((result) => {
        if (result.response === 0) {
          // 用户选择更新，触发下载和安装
          autoUpdater.downloadUpdate()
        }
      })
  })

  autoUpdater.on('update-not-available', (info) => {
    sendStatusToWindow('Update not available.')
  })

  autoUpdater.on('error', (err) => {
    sendStatusToWindow(err)
  })

  autoUpdater.on('update-downloaded', () => {
    // 处理下载完成的情况
    dialog
      .showMessageBox({
        type: 'info',
        title: '更新下载完成',
        message: '点击确定重启获取最新内容',
        buttons: ['确定']
      })
      .then(() => {
        // 调用 quitAndInstall 来安装更新
        autoUpdater.quitAndInstall()
      })
  })
  autoUpdater.on('download-progress', (progressObj) => {
    sendStatusToWindow(JSON.stringify(progressObj))
  })
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 类型声明
type BluetoothDeviceCallback = (deviceId: string) => void;

let selectBluetoothCallback: BluetoothDeviceCallback | null = null;

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      //nodeIntegration: true,
      //contextIsolation: true,
      preload: path.join(__dirname, "preload.mjs")
    }
  });

  // 蓝牙设备选择处理
  mainWindow.webContents.on('select-bluetooth-device', (event: Event, devices: BluetoothDevice[], callback: BluetoothDeviceCallback) => {
    event.preventDefault();
    selectBluetoothCallback = callback;
    
    const targetDevice = devices.find(device => 
      device.deviceName === 'Water35500'
    );
    
    if (targetDevice) {
      callback(targetDevice.deviceId);
    }
  });

  // IPC 通信处理


  ipcMain.on('bluez-click', (event: IpcMainEvent) => {
    event.sender.executeJavaScript(
      `document.getElementById("main-button").click();`,
      true
    );
  });



  // 加载页面
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // mainWindow.webContents.executeJavaScript(
  //   `document.getElementById("main-button").click();`,
  //   true
  // );

  // 窗口关闭处理
  const closeHandler = async (e: Event): Promise<void> => {
    e.preventDefault();
    
    try {
      await mainWindow.webContents.executeJavaScript(
        'window.mydisconnectDevice?.()'
      );
      
      mainWindow.removeListener('close', closeHandler);
      
      setTimeout(() => {
        mainWindow.destroy();
      }, 1000);
    } catch (error) {
      console.error('Cleanup error:', error);
      mainWindow.destroy();
    }
  };

  mainWindow.on('close', closeHandler);
}

// 应用生命周期管理
app.whenReady().then(() => {
  createWindow();

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

