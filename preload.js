const { contextBridge, ipcRenderer} = require("electron");


contextBridge.exposeInMainWorld("gamehub", {
    detectGames: () => ipcRenderer.invoke("detect-games"),
    launchGame: game => ipcRenderer.invoke("launch-game", game),
    openGameFolder: game => ipcRenderer.invoke("open-game-folder", game),
    getGameSize: (game, forceRefresh = false) => ipcRenderer.invoke("get-game-size", game, forceRefresh),
    backupGameHubData: () => ipcRenderer.invoke("backup-gamehub-data"),
    restoreGameHubData: () => ipcRenderer.invoke("restore-gamehub-data"),
    getSettings: () => ipcRenderer.invoke("get-settings"),
    addManualGame: () => ipcRenderer.invoke("add-manual-game"),
    saveSettings: settings => ipcRenderer.invoke("save-settings", settings),
    minimizeWindow: () => ipcRenderer.send("window-minimize"),
    maximizeWindow: () => ipcRenderer.send("window-maximize"),
    closeWindow: () => ipcRenderer.send("window-close"),
    getGameIcon: game => ipcRenderer.invoke("get-game-icon", game),
    getGameStats: game => ipcRenderer.invoke("get-game-stats", game),
    scanCleaner: () => ipcRenderer.invoke("scan-cleaner"),
    addCleanerFolder: () => ipcRenderer.invoke("add-cleaner-folder"),
    cleanFolders: targetIds => ipcRenderer.invoke("clean-folders", targetIds),
    removeCleanerFolder: targetId => ipcRenderer.invoke("remove-cleaner-folder", targetId),
});