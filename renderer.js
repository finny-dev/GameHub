let games = [];

let currentPage = "home";
let selectedGame = null;
const iconOverrides = {
    "fivem": "assets/games/fivem.png"
};
/*
    PAGE CONFIG
*/

const pages = {
    home: {
        element: "homePage",
        title: "Home"
    },

    games: {
        element: "gamesPage",
        title: "My Games"
    },

    profiles: {
        element: "profilesPage",
        title: "Profiles"
    },

    performance: {
        element: "performancePage",
        title: "Performance"
    },

    cleaner: {
        element: "cleanerPage",
        title: "Cleaner"
    },

    settings: {
        element: "settingsPage",
        title: "Settings"
    },

    gameDetails: {
        element: "gameDetailsPage",
        title: "Game"
    }
};



/*
    CHANGE PAGE
*/

function changePage(pageName) {

    if (!pages[pageName]) {
        return;
    }

    currentPage = pageName;


    document
        .querySelectorAll(".page")
        .forEach(page => {

            page.classList.remove(
                "active-page"
            );

        });


    document
        .getElementById(
            pages[pageName].element
        )
        .classList.add(
            "active-page"
        );


    document
        .querySelectorAll(
            ".nav-item"
        )
        .forEach(button => {

            button.classList.remove(
                "active"
            );

        });


    const activeButton =
        document.querySelector(
            `.nav-item[data-page="${pageName}"]`
        );


    if (activeButton) {

        activeButton.classList.add(
            "active"
        );

    }


    document
        .getElementById(
            "pageTitle"
        )
        .textContent =
            pages[pageName].title;

}



/*
    NAVIGATION
*/

document
    .querySelectorAll(
        ".nav-item[data-page]"
    )
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                changePage(
                    button.dataset.page
                );

            }
        );

    });


document
    .querySelectorAll(
        "[data-open-page]"
    )
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                changePage(
                    button.dataset.openPage
                );

            }
        );

    });

async function openGameDetails(game) {
    selectedGame = game;

    const stats =
        await window
            .gamehub
            .getGameStats(
                game
            );

    document
        .getElementById(
            "detailsName"
        )
        .textContent =
            game.name;

    document
        .getElementById(
            "detailsSource"
        )
        .textContent =
            game.source.toUpperCase();

    document
        .getElementById(
            "detailsHero"
        )
        .style
        .backgroundImage =
            `url('assets/games/fallback.jpg')`;

    document
        .getElementById(
            "detailsPlaytime"
        )
        .textContent =
            formatPlaytime(
                stats.totalPlaytime || 0
            );

    document
        .getElementById(
            "detailsLastPlayed"
        )
        .textContent =
            stats.lastPlayed
                ? `Last played ${new Date(
                    stats.lastPlayed
                ).toLocaleString()}`
                : "Never played through GameHub";

    document
        .getElementById(
            "detailsGameSize"
        )
        .textContent =
            "Calculating...";


    // Open the page immediately
    changePage(
        "gameDetails"
    );

    document
        .getElementById(
            "pageTitle"
        )
        .textContent =
            game.name;


    // then calculate the size in the background - finny was being retarded
    const sizeResult =
        await window
            .gamehub
            .getGameSize(
                game
            );

    document
        .getElementById(
            "detailsGameSize"
        )
        .textContent =
            sizeResult?.success
                ? formatBytes(
                    sizeResult.size
                )
                : "Unknown";
}

document
    .getElementById(
        "backToGames"
    )
    .addEventListener(
        "click",
        () => {

            changePage(
                "games"
            );

        }
    );


document
    .getElementById(
        "detailsPlay"
    )
    .addEventListener(
        "click",
        async () => {

            if (!selectedGame) {
                return;
            }


            const button =
                document.getElementById(
                    "detailsPlay"
                );


            button.textContent =
                "LAUNCHING...";


            const result =
                await window
                    .gamehub
                    .launchGame(
                        selectedGame
                    );


            if (
                result?.success
            ) {

                showToast(
                    `Launching ${selectedGame.name}`
                );

            } else {

                showToast(
                    result?.error ||
                    "Could not launch game."
                );

            }


            setTimeout(
                () => {

                    button.textContent =
                        "▶ PLAY";

                },
                800
            );

        }
    );

document
    .getElementById(
        "detailsFolder"
    )
    .addEventListener(
        "click",
        async () => {

            if (!selectedGame) {
                return;
            }

            const result =
                await window
                    .gamehub
                    .openGameFolder(
                        selectedGame
                    );

            if (!result?.success) {

                showToast(
                    result?.error ||
                    "Could not open game folder."
                );

            }

        }
    );
/*
    VIEW LIBRARY BUTTONS
*/

document
    .getElementById(
        "viewGamesButton"
    )
    .addEventListener(
        "click",
        () => {

            changePage(
                "games"
            );

        }
    );


document
    .getElementById(
        "viewAllGames"
    )
    .addEventListener(
        "click",
        () => {

            changePage(
                "games"
            );

        }
    );



/*
    TOAST
*/

let toastTimeout;


function showToast(message) {

    const toast =
        document.getElementById(
            "toast"
        );


    toast.textContent =
        message;


    toast.classList.add(
        "visible"
    );


    clearTimeout(
        toastTimeout
    );


    toastTimeout =
        setTimeout(
            () => {

                toast.classList.remove(
                    "visible"
                );

            },
            2500
        );

}



/*
    SCAN FOR GAMES
*/

async function scanForGames() {

    const scanButton =
        document.getElementById(
            "scanButton"
        );


    scanButton.disabled =
        true;


    scanButton.innerHTML = `
        <span class="scan-icon">↻</span>
        Scanning...
    `;


    try {

        games =
            await window
                .gamehub
                .detectGames();


        renderGames();


        showToast(
            `${games.length} game${
                games.length === 1
                    ? ""
                    : "s"
            } detected`
        );


    } catch (error) {

        console.error(
            error
        );


        showToast(
            "Game scan failed."
        );

    }


    scanButton.disabled =
        false;


    scanButton.innerHTML = `
        <span class="scan-icon">↻</span>
        Scan Games
    `;

}



/*
    CREATE GAME CARD
*/

function createGameCard(
    game,
    stats = null
) {

    const card =
        document.createElement(
            "div"
        );


    card.className =
        "game-card";


    card.innerHTML = `

        <div class="game-art">

            <img
                class="game-background"
                src="assets/games/fallback.jpg"
            >

            <div class="game-art-shade"></div>


            <div class="game-logo-container">

                <div class="game-logo-placeholder">
                    ${escapeHTML(
                        game.name
                            .charAt(0)
                            .toUpperCase()
                    )}
                </div>

                <img
                    class="game-logo"
                    style="display: none;"
                >

            </div>

        </div>


        <div class="game-bottom">

            <div
                class="game-name"
                title="${escapeHTML(game.name)}"
            >
                ${escapeHTML(game.name)}
            </div>


            <div class="game-source">

                <span class="source-dot"></span>

                ${
                    stats?.lastPlayed
                        ? formatRelativeTime(
                            stats.lastPlayed
                        )
                        : escapeHTML(
                            game.source
                        )
                }

            </div>


            <div class="game-actions">

                <button class="play-button">
                    PLAY
                </button>


                <button
                    class="more-button"
                    title="Game options"
                >
                    •••
                </button>

            </div>

        </div>

    `;


    /*
        Load logo asynchronously
    */

    loadGameIcon(
        card,
        game
    );


    /*
        Card click
    */

    card.addEventListener(
        "click",
        event => {

            if (
                event.target.closest(
                    "button"
                )
            ) {

                return;

            }


            openGameDetails(
                game
            );

        }
    );


    /*
        Play
    */

    const playButton =
        card.querySelector(
            ".play-button"
        );


    playButton.addEventListener(
        "click",
        async () => {

            playButton.disabled =
                true;


            playButton.textContent =
                "LAUNCHING";


            const result =
                await window
                    .gamehub
                    .launchGame(
                        game
                    );


            if (
                result?.success
            ) {

                showToast(
                    `Launching ${game.name}`
                );

                setTimeout(
                    () => {
                        renderGames();
                    },
                    500
                );

            } else {

                showToast(
                    result?.error ||
                    "Could not launch game."
                );

            }


            setTimeout(
                () => {

                    playButton.disabled =
                        false;


                    playButton.textContent =
                        "PLAY";

                },
                800
            );

        }
    );


    /*
        More
    */

    card
        .querySelector(
            ".more-button"
        )
        .addEventListener(
            "click",
            () => {

                openGameDetails(
                    game
                );

            }
        );


    return card;

}

async function loadGameIcon(
    card,
    game
) {
    const override =
        iconOverrides[
            game.name.toLowerCase().trim()
        ];

    if (override) {

        const image =
            card.querySelector(
                ".game-logo"
            );

        const placeholder =
            card.querySelector(
                ".game-logo-placeholder"
            );

        image.src = override;

        image.style.display =
            "block";

        placeholder.style.display =
            "none";

        return;
    }
    try {

        const icon =
            await window
                .gamehub
                .getGameIcon(
                    game
                );


        if (!icon) {
            return;
        }


        const image =
            card.querySelector(
                ".game-logo"
            );


        const placeholder =
            card.querySelector(
                ".game-logo-placeholder"
            );


        image.src =
            icon;


        image.style.display =
            "block";


        placeholder.style.display =
            "none";


    } catch (error) {

        console.error(
            `Could not load icon for ${game.name}`,
            error
        );

    }

}

/*
    RENDER GAME LIBRARY
*/

async function renderGames() {

    const homeGrid =
        document.getElementById(
            "homeGames"
        );

    const libraryGrid =
        document.getElementById(
            "gamesGrid"
        );

    homeGrid.innerHTML = "";
    libraryGrid.innerHTML = "";

    updateCounts();


    if (games.length === 0) {

        homeGrid.innerHTML = `
            <div class="no-games">
                No supported games were detected.
            </div>
        `;

        libraryGrid.innerHTML = `
            <div class="no-games">
                No supported games were detected.
            </div>
        `;

        return;
    }


    /*
        Full library stays in
        normal detection order
    */

    games.forEach(game => {

        libraryGrid.appendChild(
            createGameCard(game)
        );

    });


    /*
        Get last played data
        for Home page
    */

    const gamesWithStats =
        await Promise.all(
            games.map(
                async game => {

                    const stats =
                        await window
                            .gamehub
                            .getGameStats(
                                game
                            );

                    return {
                        game,
                        stats
                    };

                }
            )
        );


    /*
        Most recently played first

        Games never played through
        GameHub go at the bottom.
    */

    gamesWithStats.sort(
        (a, b) => {

            const aTime =
                a.stats?.lastPlayed || 0;

            const bTime =
                b.stats?.lastPlayed || 0;

            return bTime - aTime;

        }
    );


    gamesWithStats
        .slice(0, 4)
        .forEach(item => {

            homeGrid.appendChild(
                createGameCard(
                    item.game,
                    item.stats
                )
            );

        });
}


/*
    UPDATE COUNTERS
*/

function updateCounts() {

    const count =
        games.length;


    document
        .getElementById(
            "sidebarGameCount"
        )
        .textContent =
            count;


    document
        .getElementById(
            "homeGameCount"
        )
        .textContent =
            count;


    document
        .getElementById(
            "libraryGameCount"
        )
        .textContent =
            count;

}



/*
    SEARCH LIBRARY
*/

document
    .getElementById(
        "gameSearch"
    )
    .addEventListener(
        "input",
        event => {

            const search =
                event
                    .target
                    .value
                    .trim()
                    .toLowerCase();


            const grid =
                document.getElementById(
                    "gamesGrid"
                );


            grid.innerHTML =
                "";


            const filtered =
                games.filter(
                    game => {

                        return (
                            game.name
                                .toLowerCase()
                                .includes(
                                    search
                                ) ||

                            game.source
                                .toLowerCase()
                                .includes(
                                    search
                                )
                        );

                    }
                );


            if (
                filtered.length === 0
            ) {

                grid.innerHTML = `
                    <div class="no-games">
                        No games match your search.
                    </div>
                `;

                return;

            }


            filtered.forEach(
                game => {

                    grid.appendChild(
                        createGameCard(
                            game
                        )
                    );

                }
            );

        }
    );



/*
    ESCAPE HTML
*/

function escapeHTML(value) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        value;


    return div.innerHTML;

}



/*
    BUTTONS
*/

document
    .getElementById(
        "scanButton"
    )
    .addEventListener(
        "click",
        scanForGames
    );


document
    .getElementById(
        "heroScanButton"
    )
    .addEventListener(
        "click",
        scanForGames
    );


/*
    WINDOW CONTROLS
*/

document
    .getElementById(
        "minimizeButton"
    )
    .addEventListener(
        "click",
        () => {

            window
                .gamehub
                .minimizeWindow();

        }
    );


document
    .getElementById(
        "maximizeButton"
    )
    .addEventListener(
        "click",
        () => {

            window
                .gamehub
                .maximizeWindow();

        }
    );


document
    .getElementById(
        "closeButton"
    )
    .addEventListener(
        "click",
        () => {

            window
                .gamehub
                .closeWindow();

        }
    );

document
    .getElementById(
        "startWithWindowsSetting"
    )
    .addEventListener(
        "change",
        saveCurrentSettings
    );

document
    .getElementById(
        "minimizeToTraySetting"
    )
    .addEventListener(
        "change",
        saveCurrentSettings
    );


function formatPlaytime(seconds) {

    const hours =
        Math.floor(
            seconds / 3600
        );

    const minutes =
        Math.floor(
            (seconds % 3600) / 60
        );

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
}

function formatRelativeTime(
    timestamp
) {

    if (!timestamp) {
        return "Never played";
    }

    const difference =
        Date.now() - timestamp;

    const seconds =
        Math.floor(
            difference / 1000
        );

    const minutes =
        Math.floor(
            seconds / 60
        );

    const hours =
        Math.floor(
            minutes / 60
        );

    const days =
        Math.floor(
            hours / 24
        );


    if (seconds < 60) {
        return "Played just now";
    }

    if (minutes < 60) {
        return `Played ${minutes}m ago`;
    }

    if (hours < 24) {
        return `Played ${hours}h ago`;
    }

    if (days === 1) {
        return "Played yesterday";
    }

    if (days < 7) {
        return `Played ${days}d ago`;
    }

    return `Played ${new Date(
        timestamp
    ).toLocaleDateString()}`;
}

function formatBytes(bytes) {

    if (!bytes) {
        return "0 MB";
    }

    const gb =
        bytes /
        1024 /
        1024 /
        1024;

    if (gb >= 1) {
        return `${gb.toFixed(2)} GB`;
    }

    const mb =
        bytes /
        1024 /
        1024;

    return `${mb.toFixed(0)} MB`;
}

async function loadSettings() {

    const settings =
        await window.gamehub.getSettings();

    document
        .getElementById(
            "startWithWindowsSetting"
        )
        .checked =
            settings.startWithWindows;

    document
        .getElementById(
            "minimizeToTraySetting"
        )
        .checked =
            settings.minimizeToTray;
}

async function saveCurrentSettings() {

    const settings = {
        startWithWindows:
            document
                .getElementById(
                    "startWithWindowsSetting"
                )
                .checked,

        minimizeToTray:
            document
                .getElementById(
                    "minimizeToTraySetting"
                )
                .checked
    };

    await window
        .gamehub
        .saveSettings(
            settings
        );

    showToast(
        "Settings saved"
    );
}

const addGameBtn =
    document.getElementById(
        "addGameBtn"
    );

if (addGameBtn) {

    addGameBtn.addEventListener(
        "click",
        async () => {


            const game =
                await window.gamehub.addManualGame();


            if (!game) {
                return;
            }

            await renderGames();
        }
    );
}

const refreshGameSizeBtn =
    document.getElementById(
        "refreshGameSizeBtn"
    );

if (refreshGameSizeBtn) {

    refreshGameSizeBtn.addEventListener(
        "click",
        async () => {

            refreshGameSizeBtn.disabled = true;
            refreshGameSizeBtn.textContent =
                "Calculating...";

            await window.gamehub.getGameSize(
                selectedGame,
                true
            );

            refreshGameSizeBtn.disabled = false;
            refreshGameSizeBtn.textContent =
                "Refresh Size";

            renderGameDetails(
                selectedGame
            );

        }
    );

}

/*
    Game Data Restore / Backup
*/

const backupDataBtn =
    document.getElementById(
        "backupDataBtn"
    );

const restoreDataBtn =
    document.getElementById(
        "restoreDataBtn"
    );


if (backupDataBtn) {

    backupDataBtn.addEventListener(
        "click",
        async () => {

            const result =
                await window.gamehub.backupGameHubData();

            if (
                result?.success
            ) {

                backupDataBtn.textContent =
                    "Backed Up ✓";

                setTimeout(
                    () => {
                        backupDataBtn.textContent =
                            "Backup";
                    },
                    1500
                );

            }

        }
    );

}


if (restoreDataBtn) {

    restoreDataBtn.addEventListener(
        "click",
        async () => {

            const confirmed =
                confirm(
                    "Restore this GameHub backup? Your current GameHub data will be replaced."
                );

            if (!confirmed) {
                return;
            }

            const result =
                await window.gamehub.restoreGameHubData();

            if (
                result?.success
            ) {

                alert(
                    "GameHub data restored successfully."
                );

                location.reload();

            }

        }
    );

}

const scanCleanerBtn =
    document.getElementById(
        "scanCleanerBtn"
    );

const addCleanerFolderBtn =
    document.getElementById(
        "addCleanerFolderBtn"
    );

const cleanSelectedBtn =
    document.getElementById(
        "cleanSelectedBtn"
    );

const cleanerResults =
    document.getElementById(
        "cleanerResults"
    );

function formatBytes(bytes) {

    if (!bytes) {
        return "0 MB";
    }

    const mb =
        bytes / 1024 / 1024;

    if (mb < 1024) {
        return `${mb.toFixed(1)} MB`;
    }

    return `${(
        mb / 1024
    ).toFixed(2)} GB`;
}

async function scanCleaner() {

    cleanerResults.innerHTML =
        `
            <div class="setting-row">
                Scanning...
            </div>
        `;

    const targets =
        await window.gamehub.scanCleaner();
    const totalBytes =
        targets.reduce(
            (total, target) =>
                total + (target.size || 0),
            0
        );

    if (cleanerTotalSize) {
        cleanerTotalSize.textContent =
            formatBytes(
                totalBytes
            );
    }

    if (
        !targets ||
        targets.length === 0
    ) {

        cleanerResults.innerHTML =
            `
                <div class="setting-row">
                    No cleaner targets found.
                </div>
            `;

        return;
    }


    cleanerResults.innerHTML =
        cleanerResults.innerHTML =
        targets.map(
            target => `
                <div class="setting-row cleaner-item">

                    <div>
                        <strong>
                            ${target.name}
                        </strong>

                        <span>
                            ${formatBytes(target.size)}
                        </span>
                    </div>


                    <div class="cleaner-item-actions">

                        ${
                            target.custom
                                ? `
                                    <button
                                        class="cleaner-remove-btn"
                                        data-cleaner-id="${target.id}"
                                        title="Remove cleaner path"
                                    >
                                        ×
                                    </button>
                                `
                                : ""
                        }


                        <label class="switch">
                            <input
                                type="checkbox"
                                class="cleaner-checkbox"
                                value="${target.id}"
                                ${target.size > 0 ? "checked" : ""}
                            >

                            <span class="slider"></span>
                        </label>

                    </div>

                </div>
            `
        ).join("");
    document
        .querySelectorAll(
            ".cleaner-remove-btn"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const targetId =
                            button.dataset.cleanerId;

                        const result =
                            await window.gamehub.removeCleanerFolder(
                                targetId
                            );

                        if (
                            result?.success
                        ) {
                            await scanCleaner();
                        }

                    }
                );

            }
        );
}

if (scanCleanerBtn) {

    scanCleanerBtn.addEventListener(
        "click",
        scanCleaner
    );
}
if (addCleanerFolderBtn) {

    addCleanerFolderBtn.addEventListener(
        "click",
        async () => {

            const result =
                await window.gamehub.addCleanerFolder();

            if (
                result?.success
            ) {
                await scanCleaner();
            }

        }
    );
}
if (cleanSelectedBtn) {

    cleanSelectedBtn.addEventListener(
        "click",
        async () => {

            const selected =
                [
                    ...document.querySelectorAll(
                        ".cleaner-checkbox:checked"
                    )
                ].map(
                    checkbox =>
                        checkbox.value
                );

            if (
                selected.length === 0
            ) {
                return;
            }

            cleanSelectedBtn.disabled =
                true;

            cleanSelectedBtn.textContent =
                "Cleaning...";

            const result =
                await window.gamehub.cleanFolders(
                    selected
                );

            cleanSelectedBtn.disabled =
                false;

            cleanSelectedBtn.textContent =
                "Clean Selected";

            if (
                result?.success
            ) {

                const cleanedAmount =
                    formatBytes(
                        result.cleanedBytes || 0
                    );

                cleanSelectedBtn.textContent =
                    `Cleaned ${cleanedAmount} ✓`;

                await scanCleaner();

                setTimeout(
                    () => {
                        cleanSelectedBtn.textContent =
                            "Clean Selected Files";
                    },
                    2000
                );

            }

        }
    );
}

const cleanerTotalSize =
    document.getElementById(
        "cleanerTotalSize"
    );

const updateModal =
    document.getElementById(
        "updateModal"
    );

const updateTitle =
    document.getElementById(
        "updateTitle"
    );

const updateMessage =
    document.getElementById(
        "updateMessage"
    );

const updateActionBtn =
    document.getElementById(
        "updateActionBtn"
    );

const updateLaterBtn =
    document.getElementById(
        "updateLaterBtn"
    );

const updateProgressContainer =
    document.getElementById(
        "updateProgressContainer"
    );

const updateProgressFill =
    document.getElementById(
        "updateProgressFill"
    );

const updateProgressText =
    document.getElementById(
        "updateProgressText"
    );

let updateReadyToInstall = false;


window.gamehub.onUpdateAvailable(
    data => {

        updateModal.classList.remove(
            "hidden"
        );

        updateTitle.textContent =
            "Update Available";

        updateMessage.textContent =
            `GameHub ${data.version} is available.`;

        updateActionBtn.textContent =
            "Download Update";

        updateReadyToInstall = false;
    }
);

updateActionBtn.addEventListener(
    "click",
    async () => {

        if (updateReadyToInstall) {

            window.gamehub.installUpdate();
            return;

        }

        updateActionBtn.disabled = true;

        updateActionBtn.textContent =
            "Downloading...";

        updateProgressContainer.classList.remove(
            "hidden"
        );

        await window.gamehub.downloadUpdate();

    }
);

window.gamehub.onUpdateProgress(
    data => {

        const percent =
            data.percent || 0;

        updateProgressFill.style.width =
            `${percent}%`;

        updateProgressText.textContent =
            `${percent}%`;
    }
);

window.gamehub.onUpdateDownloaded(
    data => {

        updateReadyToInstall = true;

        updateTitle.textContent =
            "Update Ready";

        updateMessage.textContent =
            `GameHub ${data.version} is ready to install.`;

        updateActionBtn.disabled =
            false;

        updateActionBtn.textContent =
            "Restart & Install";

        updateProgressFill.style.width =
            "100%";

        updateProgressText.textContent =
            "100%";
    }
);
updateLaterBtn.addEventListener(
    "click",
    () => {

        updateModal.classList.add(
            "hidden"
        );
    }
);
window.gamehub.onUpdateError(
    error => {

        updateActionBtn.disabled =
            false;

        updateTitle.textContent =
            "Update Failed";

        updateMessage.textContent =
            error;

        updateActionBtn.textContent =
            "Try Again";
    }
);
/*
    INITIAL SCAN
*/

scanForGames();
loadSettings();