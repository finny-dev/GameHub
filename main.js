const {
    app,
    BrowserWindow,
    ipcMain,
    Menu,
    shell,
    Tray,
    dialog
} = require("electron");
const path = require("path");
const fs = require("fs");
const {
    spawn,
    execFile
} = require("child_process");
const defaultSettings = {
    startWithWindows: false,
    minimizeToTray: false
};
const {
    autoUpdater
} = require(
    "electron-updater"
);
let mainWindow = null;
let tray = null;
let isQuitting = false;
let windowSaveTimeout = null;

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

function getSavedWindowBounds() {

    const data =
        loadGameData();

    return data.windowBounds || {
        width: 1200,
        height: 750
    };
}


function saveWindowBounds() {

    if (!mainWindow) {
        return;
    }

    if (
        mainWindow.isMinimized() ||
        mainWindow.isMaximized()
    ) {
        return;
    }

    const bounds =
        mainWindow.getBounds();

    const data =
        loadGameData();

    data.windowBounds = bounds;

    saveGameData(data);
}

function applyStartupSetting(enabled) {

    try {

        app.setLoginItemSettings({
            openAtLogin: enabled,
            path: process.execPath
        });

    } catch (error) {

        console.error(
            "Failed to update startup setting:",
            error
        );

    }
}

function getSettings() {
    const data = loadGameData();

    return {
        ...defaultSettings,
        ...(data.settings || {})
    };
}

function saveSettings(settings) {
    const data = loadGameData();

    data.settings = {
        ...getSettings(),
        ...settings
    };

    saveGameData(data);

    applyStartupSetting(
        data.settings.startWithWindows
    );

    return data.settings;
}

function createWindow() {
    const savedBounds = getSavedWindowBounds();
    mainWindow = new BrowserWindow({
        width:
            savedBounds.width || 1200,

        height:
            savedBounds.height || 750,

        x:
            savedBounds.x,

        y:
            savedBounds.y,

        icon: path.join(
            __dirname,
            "assets",
            "branding",
            "gamehub.ico"
        ),

        frame: false,

        minWidth: 1000,
        minHeight: 650,

        backgroundColor: "#090b10",

        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    const queueWindowSave = () => {

        clearTimeout(
            windowSaveTimeout
        );

        windowSaveTimeout =
            setTimeout(
                saveWindowBounds,
                300
            );
    };


    mainWindow.on(
        "resize",
        queueWindowSave
    );

    mainWindow.on(
        "move",
        queueWindowSave
    );

    mainWindow.loadFile("index.html");
    mainWindow.on(
        "close",
        event => {

            if (isQuitting) {
                return;
            }

            const settings =
                getSettings();

            if (settings.minimizeToTray) {

                event.preventDefault();

                mainWindow.hide();

                return;
            }

            isQuitting = true;
        }
    );
    mainWindow.on(
        "closed",
        () => {
            mainWindow = null;
        }
    );
}
function createTray() {

    if (tray) {
        return;
    }


    tray = new Tray(
        path.join(
            __dirname,
            "assets",
            "branding",
            "gamehub.ico"
        )
    );


    tray.setToolTip(
        "GameHub"
    );


    const trayMenu =
        Menu.buildFromTemplate([
            {
                label: "Open GameHub",

                click: () => {

                    if (!mainWindow) {
                        createWindow();
                    }

                    mainWindow.show();
                    mainWindow.focus();

                }
            },

            {
                type: "separator"
            },

            {
                label: "Quit GameHub",

                click: () => {

                    isQuitting = true;

                    app.quit();

                }
            }
        ]);


    tray.setContextMenu(
        trayMenu
    );


    tray.on(
        "double-click",
        () => {

            if (!mainWindow) {
                createWindow();
            }

            mainWindow.show();
            mainWindow.focus();

        }
    );

    tray.on(
        "click",
        () => {

            if (!mainWindow) {
                return;
            }

            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        }
    );
}

const dataPath = path.join(
    app.getPath("userData"),
    "gamehub-data.json"
);

function loadGameData() {
    try {
        if (!fs.existsSync(dataPath)) {
            return {};
        }

        return JSON.parse(
            fs.readFileSync(
                dataPath,
                "utf8"
            )
        );
    } catch {
        return {};
    }
}

function saveGameData(data) {
    fs.writeFileSync(
        dataPath,
        JSON.stringify(
            data,
            null,
            2
        ),
        "utf8"
    );
}

function getFiveMCacheTargets() {

    const localAppData =
        process.env.LOCALAPPDATA;

    if (!localAppData) {
        return [];
    }

    const base =
        path.join(
            localAppData,
            "FiveM",
            "FiveM.app",
            "data"
        );

    return [
        {
            id: "fivem-cache",
            name: "FiveM Cache",
            path: path.join(
                base,
                "cache"
            )
        },

        {
            id: "fivem-server-cache",
            name: "FiveM Server Cache",
            path: path.join(
                base,
                "server-cache"
            )
        },

        {
            id: "fivem-server-cache-priv",
            name: "FiveM Private Server Cache",
            path: path.join(
                base,
                "server-cache-priv"
            )
        }
    ];
}
function getCleanerFolderSize(folderPath) {

    if (
        !folderPath ||
        !fs.existsSync(folderPath)
    ) {
        return 0;
    }

    let total = 0;

    let entries;

    try {

        entries =
            fs.readdirSync(
                folderPath,
                {
                    withFileTypes: true
                }
            );

    } catch {
        return 0;
    }

    for (const entry of entries) {

        const fullPath =
            path.join(
                folderPath,
                entry.name
            );

        try {

            if (entry.isDirectory()) {

                total +=
                    getCleanerFolderSize(
                        fullPath
                    );

            } else if (
                entry.isFile()
            ) {

                total +=
                    fs.statSync(
                        fullPath
                    ).size;

            }

        } catch {}

    }

    return total;
}
function isDangerousCleanerPath(
    folderPath
) {

    if (!folderPath) {
        return true;
    }

    const resolved =
        path.resolve(
            folderPath
        ).toLowerCase();

    const dangerousPaths = [
        path.parse(resolved).root,
        process.env.USERPROFILE,
        process.env.APPDATA,
        process.env.LOCALAPPDATA,
        process.env.ProgramFiles,
        process.env["ProgramFiles(x86)"],
        process.env.SystemRoot
    ]
        .filter(Boolean)
        .map(
            value =>
                path.resolve(
                    value
                ).toLowerCase()
        );

    return dangerousPaths.includes(
        resolved
    );
}
function detectRockstarGames() {

    const games = [];

    const possibleRoots = [
        path.join(
            process.env.ProgramFiles || "",
            "Rockstar Games"
        ),

        path.join(
            process.env["ProgramFiles(x86)"] || "",
            "Rockstar Games"
        ),

        "C:\\Games\\Rockstar Games",
        "D:\\Games\\Rockstar Games",
        "E:\\Games\\Rockstar Games",

        "C:\\Rockstar Games",
        "D:\\Rockstar Games",
        "E:\\Rockstar Games"
    ];


    const knownGames = [
        {
            names: [
                "Grand Theft Auto V",
                "Grand Theft Auto V Enhanced",
                "Grand Theft Auto V Legacy",
                "GTA V"
            ],

            exeNames: [
                "GTA5.exe",
                "GTA5_Enhanced.exe"
            ]
        },

        {
            names: [
                "Red Dead Redemption 2",
                "RDR2"
            ],

            exeNames: [
                "RDR2.exe"
            ]
        },

        {
            names: [
                "Red Dead Redemption"
            ],

            exeNames: [
                "RDR.exe"
            ]
        }
    ];


    function scanFolder(
        folder,
        depth = 0
    ) {

        if (
            depth > 3 ||
            !fs.existsSync(folder)
        ) {
            return;
        }


        let entries;

        try {

            entries =
                fs.readdirSync(
                    folder,
                    {
                        withFileTypes: true
                    }
                );

        } catch {
            return;
        }


        for (
            const game
            of knownGames
        ) {

            for (
                const exeName
                of game.exeNames
            ) {

                const match =
                    entries.find(
                        entry =>
                            entry.isFile() &&
                            entry.name.toLowerCase() ===
                            exeName.toLowerCase()
                    );


                if (!match) {
                    continue;
                }


                let displayName =
                    game.names[0];


                if (
                    exeName.toLowerCase() ===
                    "gta5_enhanced.exe"
                ) {

                    displayName =
                        "Grand Theft Auto V Enhanced";

                }


                games.push({
                    name:
                        displayName,

                    path:
                        folder,

                    source:
                        "Rockstar Games",

                    executable:
                        path.join(
                            folder,
                            match.name
                        )
                });

            }

        }


        for (
            const entry
            of entries
        ) {

            if (
                !entry.isDirectory()
            ) {
                continue;
            }


            const lower =
                entry.name.toLowerCase();


            if (
                [
                    "launcher",
                    "social club",
                    "redistributables",
                    "redist",
                    "update"
                ].includes(lower)
            ) {
                continue;
            }


            scanFolder(
                path.join(
                    folder,
                    entry.name
                ),
                depth + 1
            );

        }

    }


    for (
        const root
        of possibleRoots
    ) {

        scanFolder(root);

    }


    return removeDuplicates(
        games
    );
}

function detectManualGames() {

    const data =
        loadGameData();

    if (
        !Array.isArray(
            data.manualGames
        )
    ) {
        return [];
    }


    return data.manualGames.filter(
        game =>
            game.executable &&
            fs.existsSync(
                game.executable
            )
    );
}

/*
    STEAM
*/

function detectSteamGames() {
    const games = [];

    const steamLocations = [
        "C:\\Program Files (x86)\\Steam",
        "C:\\Program Files\\Steam"
    ];

    for (const steamPath of steamLocations) {
        const libraryFile = path.join(
            steamPath,
            "steamapps",
            "libraryfolders.vdf"
        );

        if (!fs.existsSync(libraryFile)) {
            continue;
        }

        const content = fs.readFileSync(
            libraryFile,
            "utf8"
        );

        const libraries = [];

        const matches = content.matchAll(
            /"path"\s+"([^"]+)"/g
        );

        for (const match of matches) {
            libraries.push(
                match[1].replace(/\\\\/g, "\\")
            );
        }

        libraries.push(steamPath);

        for (const library of libraries) {

            const steamApps = path.join(
                library,
                "steamapps"
            );

            if (!fs.existsSync(steamApps)) {
                continue;
            }

            const files = fs.readdirSync(steamApps);

            for (const file of files) {

                const match = file.match(
                    /^appmanifest_(\d+)\.acf$/
                );

                if (!match) {
                    continue;
                }

                const manifestPath = path.join(
                    steamApps,
                    file
                );

                const manifest = fs.readFileSync(
                    manifestPath,
                    "utf8"
                );

                const nameMatch = manifest.match(
                    /"name"\s+"([^"]+)"/
                );

                const installMatch = manifest.match(
                    /"installdir"\s+"([^"]+)"/
                );

                if (!nameMatch || !installMatch) {
                    continue;
                }

                const name = nameMatch[1];
                const ignoredSteamApps = [
                    "steamworks common redistributables"
                ];


                if (
                    ignoredSteamApps.includes(
                        name.toLowerCase()
                    )
                ) {

                    continue;

                }
                const installDirectory =
                    installMatch[1];

                const gamePath = path.join(
                    steamApps,
                    "common",
                    installDirectory
                );

                games.push({
                    name,
                    path: gamePath,
                    source: "Steam",
                    appId: match[1]
                });
            }
        }
    }

    return games;
}


/*
    EPIC
*/

function detectEpicGames() {

    const games = [];

    const programData =
        process.env.ProgramData;

    if (!programData) {
        return games;
    }


    /*
        METHOD 1:
        LauncherInstalled.dat
    */

    const launcherFile =
        path.join(
            programData,
            "Epic",
            "UnrealEngineLauncher",
            "LauncherInstalled.dat"
        );


    if (
        fs.existsSync(
            launcherFile
        )
    ) {

        try {

            const data =
                JSON.parse(
                    fs.readFileSync(
                        launcherFile,
                        "utf8"
                    )
                );


            for (
                const item
                of data.InstallationList || []
            ) {

                if (
                    !item.AppName ||
                    !item.InstallLocation
                ) {
                    continue;
                }


                games.push({
                    name:
                        item.DisplayName ||
                        item.AppName,

                    path:
                        item.InstallLocation,

                    source:
                        "Epic Games",

                    appId:
                        item.ArtifactId ||
                        item.AppName,

                    catalogItemId:
                        item.ItemId || null,

                    namespace:
                        item.NamespaceId || null
                });

            }

        } catch (error) {

            console.log(
                "Epic LauncherInstalled detection error:",
                error.message
            );

        }

    }


    /*
        METHOD 2:
        Epic .item manifests
    */

    const manifestFolder =
        path.join(
            programData,
            "Epic",
            "EpicGamesLauncher",
            "Data",
            "Manifests"
        );


    if (
        fs.existsSync(
            manifestFolder
        )
    ) {

        try {

            const manifestFiles =
                fs.readdirSync(
                    manifestFolder
                );


            for (
                const file
                of manifestFiles
            ) {

                if (
                    !file
                        .toLowerCase()
                        .endsWith(".item")
                ) {
                    continue;
                }


                try {

                    const manifest =
                        JSON.parse(
                            fs.readFileSync(
                                path.join(
                                    manifestFolder,
                                    file
                                ),
                                "utf8"
                            )
                        );


                    if (
                        !manifest.AppName ||
                        !manifest.InstallLocation
                    ) {
                        continue;
                    }


                    games.push({
                        name:
                            manifest.DisplayName ||
                            manifest.AppName,

                        path:
                            manifest.InstallLocation,

                        source:
                            "Epic Games",

                        appId:
                            manifest.AppName,

                        catalogItemId:
                            manifest.CatalogItemId || null,

                        namespace:
                            manifest.CatalogNamespace || null
                    });


                } catch (error) {

                    console.log(
                        `Could not read Epic manifest ${file}:`,
                        error.message
                    );

                }

            }

        } catch (error) {

            console.log(
                "Epic manifest detection error:",
                error.message
            );

        }

    }


    return removeDuplicates(
        games
    );
}

function detectRiotGames() {

    const games = [];

    const possibleRoots = [
        "C:\\Riot Games",
        "D:\\Riot Games",
        "E:\\Riot Games",
        "F:\\Riot Games"
    ];

    const knownGames = [
        {
            folderNames: [
                "valorant"
            ],

            name:
                "VALORANT",

            exeNames: [
                "VALORANT-Win64-Shipping.exe"
            ]
        },

        {
            folderNames: [
                "league of legends",
                "league"
            ],

            name:
                "League of Legends",

            exeNames: [
                "LeagueClient.exe"
            ]
        }
    ];


    for (
        const root
        of possibleRoots
    ) {

        if (
            !fs.existsSync(root)
        ) {
            continue;
        }


        let folders;

        try {

            folders =
                fs.readdirSync(
                    root,
                    {
                        withFileTypes: true
                    }
                );

        } catch {
            continue;
        }


        for (
            const folder
            of folders
        ) {

            if (
                !folder.isDirectory()
            ) {
                continue;
            }


            const lower =
                folder.name.toLowerCase();


            if (
                lower === "riot client"
            ) {
                continue;
            }


            const game =
                knownGames.find(
                    known =>
                        known.folderNames.some(
                            folderName =>
                                lower.includes(
                                    folderName
                                )
                        )
                );


            if (!game) {
                continue;
            }


            const gamePath =
                path.join(
                    root,
                    folder.name
                );


            const exeFiles =
                findExecutablesRecursive(
                    gamePath,
                    5
                );


            let executable =
                null;


            for (
                const exeName
                of game.exeNames
            ) {

                executable =
                    exeFiles.find(
                        exePath =>
                            path.basename(
                                exePath
                            ).toLowerCase() ===
                            exeName.toLowerCase()
                    );

                if (executable) {
                    break;
                }

            }


            games.push({
                name:
                    game.name,

                path:
                    gamePath,

                source:
                    "Riot Games",

                executable:
                    executable || null
            });

        }

    }


    return removeDuplicates(
        games
    );
}

function detectBattleNetGames() {

    const games = [];

    const possibleRoots = [
        "C:\\Program Files (x86)",
        "C:\\Program Files",
        "D:\\Games",
        "E:\\Games",
        "F:\\Games"
    ];

    const knownGames = [
        {
            names: [
                "Call of Duty",
                "Call of Duty HQ"
            ],
            displayName: "Call of Duty",
            exeNames: [
                "cod.exe",
                "cod22-cod.exe",
                "cod23-cod.exe"
            ]
        },
        {
            names: [
                "Overwatch"
            ],
            displayName: "Overwatch 2",
            exeNames: [
                "Overwatch.exe"
            ]
        },
        {
            names: [
                "Diablo IV",
                "Diablo 4"
            ],
            displayName: "Diablo IV",
            exeNames: [
                "Diablo IV.exe"
            ]
        },
        {
            names: [
                "World of Warcraft"
            ],
            displayName: "World of Warcraft",
            exeNames: [
                "Wow.exe",
                "WowClassic.exe",
                "WowClassicT.exe"
            ]
        },
        {
            names: [
                "Hearthstone"
            ],
            displayName: "Hearthstone",
            exeNames: [
                "Hearthstone.exe"
            ]
        },
        {
            names: [
                "StarCraft II"
            ],
            displayName: "StarCraft II",
            exeNames: [
                "SC2_x64.exe"
            ]
        }
    ];

    for (const root of possibleRoots) {

        if (!fs.existsSync(root)) {
            continue;
        }

        let folders;

        try {

            folders = fs.readdirSync(
                root,
                {
                    withFileTypes: true
                }
            );

        } catch {
            continue;
        }

        for (const folder of folders) {

            if (!folder.isDirectory()) {
                continue;
            }

            const lower =
                folder.name.toLowerCase();

            if (
                lower === "battle.net" ||
                lower.includes("battle.net launcher")
            ) {
                continue;
            }

            const knownGame =
                knownGames.find(
                    game =>
                        game.names.some(
                            name =>
                                lower.includes(
                                    name.toLowerCase()
                                )
                        )
                );

            if (!knownGame) {
                continue;
            }

            const gamePath =
                path.join(
                    root,
                    folder.name
                );

            const exeFiles =
                findExecutablesRecursive(
                    gamePath,
                    5
                );

            let executable = null;

            for (const exeName of knownGame.exeNames) {

                executable =
                    exeFiles.find(
                        exePath =>
                            path.basename(
                                exePath
                            ).toLowerCase() ===
                            exeName.toLowerCase()
                    );

                if (executable) {
                    break;
                }

            }

            games.push({
                name:
                    knownGame.displayName,

                path:
                    gamePath,

                source:
                    "Battle.net",

                executable:
                    executable || null
            });

        }

    }

    return removeDuplicates(
        games
    );
}

function detectXboxGames() {

    const games = [];

    const possibleRoots = [
        "C:\\XboxGames",
        "D:\\XboxGames",
        "E:\\XboxGames",
        "F:\\XboxGames"
    ];

    for (const root of possibleRoots) {

        if (!fs.existsSync(root)) {
            continue;
        }

        let folders;

        try {

            folders = fs.readdirSync(
                root,
                {
                    withFileTypes: true
                }
            );

        } catch {
            continue;
        }


        for (const folder of folders) {

            if (!folder.isDirectory()) {
                continue;
            }

            const gamePath =
                path.join(
                    root,
                    folder.name
                );

            const possibleContentPaths = [
                gamePath,
                path.join(
                    gamePath,
                    "Content"
                )
            ];


            let contentPath = null;
            let configPath = null;


            for (
                const possiblePath
                of possibleContentPaths
            ) {

                const possibleConfig =
                    path.join(
                        possiblePath,
                        "MicrosoftGame.config"
                    );

                if (
                    fs.existsSync(
                        possibleConfig
                    )
                ) {

                    contentPath =
                        possiblePath;

                    configPath =
                        possibleConfig;

                    break;
                }

            }


            if (!contentPath) {
                continue;
            }


            let executable = null;

            const exeFiles =
                findExecutablesRecursive(
                    contentPath,
                    5
                );


            if (
                exeFiles.length > 0
            ) {

                executable =
                    exeFiles[0];

            }


            games.push({
                name:
                    folder.name,

                path:
                    contentPath,

                source:
                    "Xbox",

                executable:
                    executable,

                configPath:
                    configPath
            });

        }

    }


    return removeDuplicates(
        games
    );
}


/*
    FIVEM
*/

function detectFiveM() {

    const games = [];

    const localAppData =
        process.env.LOCALAPPDATA;

    if (!localAppData) {
        return games;
    }

    const fivemPath = path.join(
        localAppData,
        "FiveM"
    );

    if (
        fs.existsSync(fivemPath)
    ) {

        games.push({
            name: "FiveM",
            path: fivemPath,
            source: "FiveM"
        });

    }

    return games;
}

function cleanFolderContents(
    folderPath
) {

    if (
        !folderPath ||
        !fs.existsSync(folderPath) ||
        isDangerousCleanerPath(
            folderPath
        )
    ) {
        return;
    }

    const entries =
        fs.readdirSync(
            folderPath
        );

    for (
        const entry
        of entries
    ) {

        const fullPath =
            path.join(
                folderPath,
                entry
            );

        try {

            fs.rmSync(
                fullPath,
                {
                    recursive: true,
                    force: true
                }
            );

        } catch (
            error
        ) {

            console.error(
                "Cleaner could not remove:",
                fullPath,
                error.message
            );

        }

    }
}


/*
    REMOVE DUPLICATES
*/

function removeDuplicates(games) {

    const unique = new Map();

    for (const game of games) {

        const key =
            game.name.toLowerCase();

        if (!unique.has(key)) {

            unique.set(
                key,
                game
            );

        }
    }

    return [...unique.values()];
}

function findExecutablesRecursive(
    folderPath,
    maxDepth = 4,
    currentDepth = 0
) {
    const executables = [];

    if (currentDepth > maxDepth) {
        return executables;
    }

    let entries;

    try {
        entries = fs.readdirSync(
            folderPath,
            {
                withFileTypes: true
            }
        );
    } catch {
        return executables;
    }

    for (const entry of entries) {

        const fullPath =
            path.join(
                folderPath,
                entry.name
            );

        if (entry.isFile()) {

            if (
                entry.name
                    .toLowerCase()
                    .endsWith(".exe")
            ) {
                executables.push(
                    fullPath
                );
            }

        } else if (
            entry.isDirectory()
        ) {

            const lower =
                entry.name.toLowerCase();

            const ignoredFolders = [
                "engine",
                "redist",
                "redistributables",
                "installer"
            ];

            if (
                ignoredFolders.includes(
                    lower
                )
            ) {
                continue;
            }

            executables.push(
                ...findExecutablesRecursive(
                    fullPath,
                    maxDepth,
                    currentDepth + 1
                )
            );
        }
    }

    return executables;
}

function getPreferredExecutable(game, exeFiles) {

    const name =
        game.name.toLowerCase();

    const preferred = [];

    if (
        name.includes("grand theft auto v") ||
        name.includes("gta v")
    ) {
        preferred.push(
            "gta5.exe"
        );
    }

    if (
        name.includes("fortnite")
    ) {
        preferred.push(
            "fortniteclient-win64-shipping.exe"
        );
    }

    for (
        const preferredExe
        of preferred
    ) {

        const match =
            exeFiles.find(
                exePath =>
                    path.basename(
                        exePath
                    ).toLowerCase() ===
                    preferredExe
            );

        if (match) {
            return match;
        }
    }

    return null;
}

function findGameExecutable(game) {

    if (!game || !game.path) {
        return null;
    }


    /*
        FiveM
    */

    if (
        game.name
            .toLowerCase()
            === "fivem"
    ) {

        const fivemExe =
            path.join(
                game.path,
                "FiveM.exe"
            );


        if (
            fs.existsSync(
                fivemExe
            )
        ) {

            return fivemExe;

        }

    }


    /*
        Search root folder
    */

    try {

        const files =
            fs.readdirSync(
                game.path
            );


        const exeFiles =
            findExecutablesRecursive(
                game.path,
                4
            );

        if (
            exeFiles.length === 0
        ) {
            return null;
        }
        const preferredExe =
            getPreferredExecutable(
                game,
                exeFiles
            );

        if (preferredExe) {
            return preferredExe;
        }


        /*
            Try finding an EXE whose
            name resembles the game
        */

        const gameWords =
            game.name
                .toLowerCase()
                .replace(
                    /[^a-z0-9]/g,
                    ""
                );


        const bestMatch =
            exeFiles.find(
                exePath => {

                    const file =
                        path.basename(
                            exePath
                        );

                    const exeName =
                        file
                            .toLowerCase()
                            .replace(
                                /[^a-z0-9]/g,
                                ""
                            );

                    return (
                        gameWords.includes(
                            exeName.replace(
                                "exe",
                                ""
                            )
                        ) ||
                        exeName.includes(
                            gameWords
                        )
                    );
                }
            );
        return bestMatch || exeFiles[0];


    } catch {

        return null;

    }

}

async function getFolderSize(folderPath) {

    let totalSize = 0;

    async function scanDirectory(directory) {

        let entries;

        try {
            entries = await fs.promises.readdir(
                directory,
                {
                    withFileTypes: true
                }
            );
        } catch {
            return;
        }

        for (const entry of entries) {

            const fullPath =
                path.join(
                    directory,
                    entry.name
                );

            try {

                if (entry.isDirectory()) {

                    await scanDirectory(
                        fullPath
                    );

                } else if (entry.isFile()) {

                    const stats =
                        await fs.promises.stat(
                            fullPath
                        );

                    totalSize +=
                        stats.size;

                }

            } catch {
                // Ignore files GameHub can't access
            }
        }
    }

    await scanDirectory(
        folderPath
    );

    return totalSize;
}
/*
    UPDATE HANDLER
*/
ipcMain.handle(
    "download-update",
    async () => {

        try {

            await autoUpdater.downloadUpdate();

            return {
                success: true
            };

        } catch (error) {

            return {
                success: false,
                error:
                    error.message
            };

        }

    }
);
ipcMain.on(
    "install-update",
    () => {

        isQuitting = true;

        autoUpdater.quitAndInstall(
            false,
            true
        );

    }
);
/*
    DETECT ALL GAMES
*/



ipcMain.handle(
    "detect-games",
    async () => {

        const games = [

            ...detectSteamGames(),

            ...detectEpicGames(),

            ...detectRiotGames(),

            ...detectRockstarGames(),

            ...detectBattleNetGames(),

            ...detectXboxGames(),

            ...detectManualGames(),

            ...detectFiveM()

        ];

        return removeDuplicates(games);
    }
);

ipcMain.handle(
    "add-cleaner-folder",
    async () => {

        const result =
            await dialog.showOpenDialog(
                mainWindow,
                {
                    title:
                        "Select Cache Folder",

                    properties: [
                        "openDirectory"
                    ]
                }
            );

        if (
            result.canceled ||
            result.filePaths.length === 0
        ) {
            return null;
        }

        const folderPath =
            result.filePaths[0];

        if (
            isDangerousCleanerPath(
                folderPath
            )
        ) {

            return {
                success: false,
                error:
                    "This folder cannot be used as a cleaner path."
            };

        }

        const data =
            loadGameData();

        if (
            !Array.isArray(
                data.cleanerFolders
            )
        ) {
            data.cleanerFolders = [];
        }

        const exists =
            data.cleanerFolders.some(
                item =>
                    item.path
                        .toLowerCase() ===
                    folderPath
                        .toLowerCase()
            );

        if (!exists) {

            data.cleanerFolders.push({
                id:
                    `custom-${Date.now()}`,

                name:
                    path.basename(
                        folderPath
                    ),

                path:
                    folderPath,

                custom:
                    true
            });

            saveGameData(
                data
            );

        }

        return {
            success: true
        };
    }
);

ipcMain.handle(
    "clean-folders",
    async (
        event,
        targetIds
    ) => {

        try {

            const data =
                loadGameData();

            const customFolders =
                Array.isArray(
                    data.cleanerFolders
                )
                    ? data.cleanerFolders
                    : [];

            const targets = [
                ...getFiveMCacheTargets(),
                ...customFolders
            ];

            const selected =
                targets.filter(
                    target =>
                        targetIds.includes(
                            target.id
                        )
                );

            let cleanedBytes = 0;

            for (
                const target
                of selected
            ) {

                if (
                    !fs.existsSync(
                        target.path
                    )
                ) {
                    continue;
                }

                cleanedBytes +=
                    getCleanerFolderSize(
                        target.path
                    );

                cleanFolderContents(
                    target.path
                );

            }

            return {
                success: true,
                cleanedBytes
            };

        } catch (error) {

            return {
                success: false,
                error:
                    error.message
            };

        }

    }
);

ipcMain.handle(
    "remove-cleaner-folder",
    async (
        event,
        targetId
    ) => {

        try {

            const data =
                loadGameData();

            if (
                !Array.isArray(
                    data.cleanerFolders
                )
            ) {
                return {
                    success: false
                };
            }

            data.cleanerFolders =
                data.cleanerFolders.filter(
                    folder =>
                        folder.id !== targetId
                );

            saveGameData(
                data
            );

            return {
                success: true
            };

        } catch (error) {

            return {
                success: false,
                error:
                    error.message
            };

        }

    }
);

ipcMain.handle(
    "scan-cleaner",
    async () => {

        const data =
            loadGameData();

        const customFolders =
            Array.isArray(
                data.cleanerFolders
            )
                ? data.cleanerFolders
                : [];

        const targets = [
            ...getFiveMCacheTargets(),
            ...customFolders
        ];

        const results = [];

        for (
            const target
            of targets
        ) {

            const exists =
                fs.existsSync(
                    target.path
                );

            results.push({
                ...target,

                exists,

                size:
                    exists
                        ? getCleanerFolderSize(
                            target.path
                        )
                        : 0
            });

        }

        return results;
    }
);

ipcMain.handle(
    "add-manual-game",
    async () => {

        const result =
            await dialog.showOpenDialog(
                mainWindow,
                {
                    title:
                        "Add Game",

                    properties: [
                        "openFile"
                    ],

                    filters: [
                        {
                            name:
                                "Games",

                            extensions: [
                                "exe"
                            ]
                        }
                    ]
                }
            );


        if (
            result.canceled ||
            result.filePaths.length === 0
        ) {
            return null;
        }


        const executable =
            result.filePaths[0];

        const gamePath =
            path.dirname(
                executable
            );

        const fileName =
            path.basename(
                executable,
                ".exe"
            );


        const game = {
            name:
                fileName,

            path:
                gamePath,

            source:
                "Manual",

            executable:
                executable,

            manual:
                true
        };


        const data =
            loadGameData();


        if (
            !Array.isArray(
                data.manualGames
            )
        ) {
            data.manualGames = [];
        }


        const alreadyExists =
            data.manualGames.some(
                existing =>
                    existing.executable?.toLowerCase() ===
                    executable.toLowerCase()
            );


        if (!alreadyExists) {

            data.manualGames.push(
                game
            );

            saveGameData(
                data
            );

        }


        return game;
    }
);

ipcMain.handle(
    "get-game-stats",
    (_, game) => {
        const data = loadGameData();

        const key =
            game.name
                .toLowerCase()
                .trim();

        return data[key] || {
            totalPlaytime: 0,
            lastPlayed: null
        };
    }
);

/* 
    Backup Game Data - finny is sick
*/ 

ipcMain.handle(
    "backup-gamehub-data",
    async () => {

        try {

            const result =
                await dialog.showSaveDialog(
                    mainWindow,
                    {
                        title:
                            "Backup GameHub Data",

                        defaultPath:
                            "GameHub-Backup.json",

                        filters: [
                            {
                                name:
                                    "GameHub Backup",

                                extensions: [
                                    "json"
                                ]
                            }
                        ]
                    }
                );

            if (
                result.canceled ||
                !result.filePath
            ) {
                return {
                    success: false,
                    canceled: true
                };
            }

            if (
                !fs.existsSync(
                    dataPath
                )
            ) {
                saveGameData({});
            }

            fs.copyFileSync(
                dataPath,
                result.filePath
            );

            return {
                success: true
            };

        } catch (error) {

            console.error(
                "Backup failed:",
                error
            );

            return {
                success: false,
                error:
                    error.message
            };

        }

    }
);

ipcMain.handle(
    "restore-gamehub-data",
    async () => {

        try {

            const result =
                await dialog.showOpenDialog(
                    mainWindow,
                    {
                        title:
                            "Restore GameHub Backup",

                        properties: [
                            "openFile"
                        ],

                        filters: [
                            {
                                name:
                                    "GameHub Backup",

                                extensions: [
                                    "json"
                                ]
                            }
                        ]
                    }
                );

            if (
                result.canceled ||
                result.filePaths.length === 0
            ) {
                return {
                    success: false,
                    canceled: true
                };
            }

            const backupPath =
                result.filePaths[0];

            const backupData =
                JSON.parse(
                    fs.readFileSync(
                        backupPath,
                        "utf8"
                    )
                );

            if (
                fs.existsSync(
                    dataPath
                )
            ) {

                fs.copyFileSync(
                    dataPath,
                    `${dataPath}.before-restore`
                );

            }

            saveGameData(
                backupData
            );

            return {
                success: true
            };

        } catch (error) {

            console.error(
                "Restore failed:",
                error
            );

            return {
                success: false,
                error:
                    error.message
            };

        }

    }
);

//  game folders
ipcMain.handle(
    "open-game-folder",
    async (_, game) => {

        try {

            if (
                !game ||
                !game.path ||
                !fs.existsSync(game.path)
            ) {

                return {
                    success: false,
                    error: "Game folder could not be found."
                };

            }

            const error =
                await shell.openPath(
                    game.path
                );


            if (error) {

                return {
                    success: false,
                    error
                };

            }


            return {
                success: true
            };


        } catch (error) {

            return {
                success: false,
                error: error.message
            };

        }

    }
);

ipcMain.handle(
    "get-game-size",
    async (event, game, forceRefresh = false) => {

        try {

            if (
                !game ||
                !game.path ||
                !fs.existsSync(game.path)
            ) {

                return {
                    success: false,
                    size: 0
                };

            }


            const data =
                loadGameData();


            const key =
                game.name
                    .toLowerCase()
                    .trim();


            if (!data[key]) {

                data[key] = {
                    totalPlaytime: 0,
                    lastPlayed: null
                };

            }


            const cachedSize =
                data[key].installSize;


            const cachedAt =
                data[key].installSizeCachedAt;


            /*
                Cache lasts 6 hours
            */

            const cacheLifetime =
                6 * 60 * 60 * 1000;


            const cacheIsValid =
                cachedSize !== undefined &&
                cachedAt &&
                (
                    Date.now() -
                    cachedAt
                ) < cacheLifetime;


            if (
                !forceRefresh &&
                cacheIsValid
            ) {

                return {
                    success: true,
                    size: cachedSize,
                    cached: true
                };

            }


            /*
                No valid cache,
                scan the folder
            */

            const size =
                await getFolderSize(
                    game.path
                );


            data[key].installSize =
                size;


            data[key].installSizeCachedAt =
                Date.now();


            saveGameData(
                data
            );


            return {
                success: true,
                size,
                cached: false
            };


        } catch (error) {

            return {
                success: false,
                size: 0,
                error: error.message
            };

        }

    }
);

function savePlaySession(game, startedAt) {

    const endedAt =
        Date.now();

    const sessionLength =
        Math.floor(
            (endedAt - startedAt) / 1000
        );

    const data =
        loadGameData();

    const key =
        game.name
            .toLowerCase()
            .trim();

    if (!data[key]) {

        data[key] = {
            totalPlaytime: 0,
            lastPlayed: null
        };

    }

    data[key].totalPlaytime +=
        sessionLength;

    data[key].lastPlayed =
        endedAt;

    saveGameData(
        data
    );
}


function markGameLaunched(game) {

    const data =
        loadGameData();

    const key =
        game.name
            .toLowerCase()
            .trim();

    if (!data[key]) {

        data[key] = {
            totalPlaytime: 0,
            lastPlayed: null
        };

    }

    /*
        Set this immediately so
        "Last Played" works even
        if tracking later fails.
    */

    data[key].lastPlayed = Date.now();

    saveGameData(
        data
    );
}


function getRunningProcesses() {

    return new Promise(
        resolve => {

            execFile(
                "tasklist",
                [
                    "/FO",
                    "CSV",
                    "/NH"
                ],
                {
                    windowsHide: true
                },
                (error, stdout) => {

                    if (error) {
                        resolve([]);
                        return;
                    }

                    const processes =
                        stdout
                            .split(/\r?\n/)
                            .map(line => {

                                const match =
                                    line.match(
                                        /^"([^"]+)"/
                                    );

                                return match
                                    ? match[1].toLowerCase()
                                    : null;

                            })
                            .filter(Boolean);

                    resolve(
                        processes
                    );

                }
            );

        }
    );
}


async function isProcessRunning(
    processName
) {

    const processes =
        await getRunningProcesses();

    return processes.includes(
        processName.toLowerCase()
    );
}


async function isFiveMRunning() {

    const processes =
        await getRunningProcesses();

    return processes.some(
        processName =>
            processName.includes(
                "fivem"
            )
    );
}

async function trackFiveMSession(game, startedAt) {

    let detected = false;

    for (let attempt = 0; attempt < 15; attempt++) {

        await new Promise(
            resolve => setTimeout(resolve, 2000)
        );

        if (await isFiveMRunning()) {
            detected = true;
            break;
        }
    }

    if (!detected) {
        return;
    }


    let consecutiveClosedChecks = 0;

    while (consecutiveClosedChecks < 2) {

        await new Promise(
            resolve => setTimeout(resolve, 5000)
        );

        if (await isFiveMRunning()) {
            consecutiveClosedChecks = 0;
        } else {
            consecutiveClosedChecks++;
        }
    }


    savePlaySession(
        game,
        startedAt
    );
}
function getGameProcessNames(
    game
) {

    const name =
        game.name
            .toLowerCase();


    /*
        Known games
    */

    if (
        name.includes(
            "fortnite"
        )
    ) {

        return [
            "FortniteClient-Win64-Shipping.exe"
        ];

    }


    if (
        name.includes(
            "grand theft auto v"
        ) ||
        name.includes(
            "gta v"
        )
    ) {

        return [
            "GTA5.exe",
            "GTA5_Enhanced.exe"
        ];

    }


    if (
        name.includes(
            "kovaak"
        )
    ) {

        return [
            "FPSAimTrainer-Win64-Shipping.exe",
            "FPSAimTrainer.exe"
        ];

    }


    /*
        Automatic fallback
    */

    const executable =
        findGameExecutable(
            game
        );

    if (!executable) {
        return [];
    }


    return [
        path.basename(
            executable
        )
    ];
}

async function trackGameSession(
    game,
    startedAt,
    processNames
) {

    const waitUntil =
        Date.now() + 120000;

    let detected = false;

    while (
        Date.now() <
        waitUntil
    ) {

        for (
            const processName
            of processNames
        ) {

            if (
                await isProcessRunning(
                    processName
                )
            ) {

                detected = true;
                break;
            }
        }

        if (detected) {
            break;
        }

        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    2000
                )
        );
    }


    if (!detected) {

        console.log(
            `Game process not detected for ${game.name}`
        );

        return;
    }


    console.log(
        `Tracking playtime for ${game.name}`
    );


    while (true) {

        let running = false;

        for (
            const processName
            of processNames
        ) {

            if (
                await isProcessRunning(
                    processName
                )
            ) {

                running = true;
                break;
            }
        }

        if (!running) {
            break;
        }

        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    5000
                )
        );
    }


    const endedAt =
        Date.now();

    savePlaySession(
        game,
        startedAt,
        endedAt
    );

    console.log(
        `Saved playtime for ${game.name}`
    );
}

function launchSteamGame(game) {

    if (!game.appId) {
        return false;
    }

    try {

        spawn(
            "cmd.exe",
            [
                "/c",
                "start",
                "",
                `steam://rungameid/${game.appId}`
            ],
            {
                detached: true,
                stdio: "ignore",
                windowsHide: true
            }
        ).unref();

        return true;

    } catch {
        return false;
    }
}

function launchEpicGame(game) {

    if (
        !game.namespace ||
        !game.catalogItemId ||
        !game.appId
    ) {
        return false;
    }

    try {

        const epicId =
            `${game.namespace}:${game.catalogItemId}:${game.appId}`;

        const uri =
            `com.epicgames.launcher://apps/${encodeURIComponent(epicId)}?action=launch&silent=true`;

        spawn(
            "cmd.exe",
            [
                "/c",
                "start",
                "",
                uri
            ],
            {
                detached: true,
                stdio: "ignore",
                windowsHide: true
            }
        ).unref();

        return true;

    } catch (error) {

        console.error(
            "Epic launch failed:",
            error
        );

        return false;
    }
}

/*
    LAUNCH GAME
*/

ipcMain.handle(
    "launch-game",
    async (_, game) => {

        try {

            if (
                !game ||
                !game.path
            ) {

                return {
                    success: false,
                    error:
                        "Game path is missing."
                };

            }


            const startedAt =
                Date.now();


            /*
                FIVEM
            */

            if (
                game.name
                    .toLowerCase()
                    === "fivem"
            ) {

                const fivemExe =
                    path.join(
                        game.path,
                        "FiveM.exe"
                    );


                if (
                    !fs.existsSync(
                        fivemExe
                    )
                ) {

                    return {
                        success: false,
                        error:
                            "FiveM.exe could not be found."
                    };

                }


                spawn(
                    fivemExe,
                    [],
                    {
                        detached: true,
                        stdio: "ignore"
                    }
                ).unref();


                markGameLaunched(
                    game
                );


                /*
                    FiveM may take a few
                    seconds to properly start.

                    Give it up to 30 seconds.
                */

                trackFiveMSession(
                    game,
                    startedAt
                );

                return {
                    success: true
                };

            }

            /*
                MANUAL GAME
            */

            if (
                game.source === "Manual" &&
                game.executable
            ) {

                if (
                    !fs.existsSync(
                        game.executable
                    )
                ) {

                    return {
                        success: false,
                        error:
                            "The selected game executable no longer exists."
                    };

                }


                try {

                    const startedAt =
                        Date.now();


                    const child =
                        spawn(
                            game.executable,
                            [],
                            {
                                cwd:
                                    path.dirname(
                                        game.executable
                                    ),

                                detached:
                                    true,

                                stdio:
                                    "ignore"
                            }
                        );


                    child.unref();


                    markGameLaunched(
                        game
                    );


                    const processNames = [
                        path.basename(
                            game.executable
                        )
                    ];


                    trackGameSession(
                        game,
                        startedAt,
                        processNames
                    );


                    return {
                        success: true
                    };


                } catch (error) {

                    return {
                        success: false,
                        error:
                            error.message
                    };

                }

            }

            /*
                STEAM
            */

            if (
                game.source === "Steam" &&
                game.appId
            ) {

                const launched =
                    launchSteamGame(
                        game
                    );

                if (!launched) {

                    return {
                        success: false,
                        error:
                            "Steam could not launch this game."
                    };

                }


                const startedAt =
                    Date.now();

                markGameLaunched(
                    game
                );


                const processNames =
                    getGameProcessNames(
                        game
                    );


                if (
                    processNames.length > 0
                ) {

                    trackGameSession(
                        game,
                        startedAt,
                        processNames
                    );

                }


                return {
                    success: true
                };
            }

            /*
                EPIC GAMES
            */

            if (
                game.source === "Epic Games"
            ) {

                const launched =
                    launchEpicGame(
                        game
                    );

                if (!launched) {

                    return {
                        success: false,
                        error:
                            "Epic Games could not launch this game."
                    };

                }


                const startedAt =
                    Date.now();

                markGameLaunched(
                    game
                );


                const processNames =
                    getGameProcessNames(
                        game
                    );


                if (
                    processNames.length > 0
                ) {

                    trackGameSession(
                        game,
                        startedAt,
                        processNames
                    );

                }


                return {
                    success: true
                };
            }


            /*
                NORMAL GAME
            */

            const files =
                fs.readdirSync(
                    game.path
                );


            const executable =
                files.find(
                    file =>
                        file
                            .toLowerCase()
                            .endsWith(
                                ".exe"
                            )
                );


            if (!executable) {

                return {
                    success: false,
                    error:
                        "Could not find the game's executable."
                };

            }


            const executablePath =
                path.join(
                    game.path,
                    executable
                );


            spawn(
                executablePath,
                [],
                {
                    cwd:
                        game.path,

                    detached:
                        true,

                    stdio:
                        "ignore"
                }
            ).unref();


            markGameLaunched(
                game
            );


            /*
                Wait for game process
                to appear.
            */

            let detected =
                false;


            for (
                let attempt = 0;
                attempt < 15;
                attempt++
            ) {

                await new Promise(
                    resolve =>
                        setTimeout(
                            resolve,
                            2000
                        )
                );


                if (
                    await isProcessRunning(
                        executable
                    )
                ) {

                    detected =
                        true;

                    break;

                }

            }


            /*
                Track until game closes.
            */

            if (detected) {

                let consecutiveClosedChecks =
                    0;


                while (
                    consecutiveClosedChecks
                    < 2
                ) {

                    await new Promise(
                        resolve =>
                            setTimeout(
                                resolve,
                                5000
                            )
                    );


                    if (
                        await isProcessRunning(
                            executable
                        )
                    ) {

                        consecutiveClosedChecks =
                            0;

                    } else {

                        consecutiveClosedChecks++;

                    }

                }


                savePlaySession(
                    game,
                    startedAt
                );

            }


            return {
                success: true
            };


        } catch (error) {

            return {
                success: false,
                error:
                    error.message
            };

        }

    }
);

/*
    Get Logo
*/

ipcMain.handle(
    "get-game-icon",
    async (_, game) => {

        try {

            const executable =
                findGameExecutable(
                    game
                );


            if (
                !executable ||
                !fs.existsSync(
                    executable
                )
            ) {

                return null;

            }


            const icon =
                await app.getFileIcon(
                    executable,
                    {
                        size: "large"
                    }
                );


            if (
                icon.isEmpty()
            ) {

                return null;

            }


            return icon.toDataURL();


        } catch (error) {

            console.log(
                `Icon error for ${game?.name}:`,
                error.message
            );


            return null;

        }

    }
);

ipcMain.on("window-minimize", event => {
    BrowserWindow
        .fromWebContents(event.sender)
        ?.minimize();
});


ipcMain.on("window-maximize", event => {

    const window =
        BrowserWindow.fromWebContents(
            event.sender
        );

    if (!window) {
        return;
    }

    if (window.isMaximized()) {
        window.unmaximize();
    } else {
        window.maximize();
    }

});


ipcMain.on(
    "window-close",
    event => {

        const win =
            BrowserWindow.fromWebContents(
                event.sender
            );

        if (!win) {
            return;
        }

        win.close();
    }
);
ipcMain.handle(
    "get-settings",
    () => {
        return getSettings();
    }
);

ipcMain.handle(
    "save-settings",
    (_, settings) => {
        return saveSettings(settings);
    }
);

function setupUpdater() {

    if (!app.isPackaged) {
        console.log(
            "Updater disabled in development mode."
        );

        return;
    }


    autoUpdater.on(
        "checking-for-update",
        () => {
            console.log(
                "Checking for GameHub updates..."
            );
        }
    );


    autoUpdater.on(
        "update-available",
        info => {

            console.log(
                "Update available:",
                info.version
            );

            mainWindow?.webContents.send(
                "update-available",
                {
                    version:
                        info.version
                }
            );

        }
    );


    autoUpdater.on(
        "update-not-available",
        () => {

            console.log(
                "GameHub is up to date."
            );

        }
    );


    autoUpdater.on(
        "download-progress",
        progress => {

            mainWindow?.webContents.send(
                "update-progress",
                {
                    percent:
                        Math.round(
                            progress.percent
                        )
                }
            );

        }
    );


    autoUpdater.on(
        "update-downloaded",
        info => {

            mainWindow?.webContents.send(
                "update-downloaded",
                {
                    version:
                        info.version
                }
            );

        }
    );


    autoUpdater.on(
        "error",
        error => {

            console.error(
                "Updater error:",
                error
            );

            mainWindow?.webContents.send(
                "update-error",
                error.message
            );

        }
    );


    autoUpdater.checkForUpdates();

}

app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    const settings =
    getSettings();
    applyStartupSetting(
        settings.startWithWindows
    );

    createWindow();
    createTray();
    setupUpdater();

    app.on(
        "activate",
        () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        }
    );
});


app.on(
    "window-all-closed",
    () => {

        if (
            process.platform !== "darwin" &&
            isQuitting
        ) {
            app.quit();
        }

    }
);