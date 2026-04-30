const { app, BrowserWindow, screen } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const { spawn } = require("child_process");
const os = require("os");

let mainWindow;
let pbProcess;

function startDatabase() {
  // 1. Detect if we are on Windows or Ubuntu
  const pbExecutable =
    os.platform() === "win32" ? "pocketbase.exe" : "pocketbase";

  // 2. Lock the Root Directory
  const rootFolder = app.isPackaged ? process.resourcesPath : __dirname;
  const pbPath = path.join(rootFolder, "bin", pbExecutable);

  // 3. Map the exact paths
  const pbDataDir = path.join(app.getPath("userData"), "pb_data");

  console.log("=======================================");
  console.log("--> RUNNING EXECUTABLE FROM:", pbPath);
  console.log("--> SAVING/READING DATA AT:", pbDataDir);
  console.log("=======================================");

  // 4. Force PocketBase to use the root directory for EVERYTHING
  pbProcess = spawn(pbPath, ["serve", "--dir", pbDataDir], {
    cwd: rootFolder, // <-- THIS IS THE MAGIC LINE
    detached: false,
    stdio: "ignore",
  });

  pbProcess.on("error", (err) => {
    console.error("Failed to start PocketBase database:", err);
  });
}

function createWindow() {
  // 2. Get the exact dimensions of whatever monitor the user has
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: width, // Auto-set width
    height: height, // Auto-set height
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // 3. Force the window to maximize completely
  mainWindow.maximize();

  mainWindow.loadFile("src/index.html");
}

// 2. Start DB first, then open the window
app.whenReady().then(() => {
  startDatabase();
  // Give the database 500ms to boot up before showing the UI
  setTimeout(createWindow, 500);
  // Check for updates silently in the background
  autoUpdater.checkForUpdatesAndNotify();
});

// 3. Kill the database when the app closes
app.on("window-all-closed", () => {
  if (pbProcess) {
    pbProcess.kill();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  if (pbProcess) {
    pbProcess.kill();
  }
});
