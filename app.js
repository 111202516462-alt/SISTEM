const placementPoints = {
    1: 12,
    2: 9,
    3: 8,
    4: 7,
    5: 6,
    6: 5,
    7: 4,
    8: 3,
    9: 2,
    10: 1,
    11: 0,
    12: 0
};

const storageKey = "arpa_udinus_6_match";

let teams = [];
let serverAvailable = false;
let saveTimer;

const matchBodies = Array.from({ length: 6 }, (_, i) =>
    document.getElementById("match" + (i + 1) + "Body")
);

const totalBody = document.getElementById("totalBody");
const leaderboardBody = document.getElementById("leaderboardBody");
const saveStatus = document.getElementById("saveStatus");

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function createTeam(name) {
    return {
        id: Date.now() + Math.random(),
        name,
        matches: Array.from({ length: 6 }, () => ({
            placement: 12,
            kills: 0
        }))
    };
}

function normalizeTeams(data) {
    return data.map((team, index) => ({
        id: team.id || Date.now() + Math.random() + index,
        name: String(team.name || "TEAM " + (index + 1)),
        matches: Array.from({ length: 6 }, (_, i) => ({
            placement: Math.min(
                12,
                Math.max(1, Number(team.matches?.[i]?.placement) || 12)
            ),
            kills: Math.max(0, Number(team.matches?.[i]?.kills) || 0)
        }))
    }));
}

function score(match) {
    const placement = Math.min(
        12,
        Math.max(1, Number(match.placement) || 12)
    );

    const kills = Math.max(0, Number(match.kills) || 0);
    const placementPoint = placementPoints[placement];
    const killPoint = kills;

    return {
        placement,
        kills,
        placementPoint,
        killPoint,
        total: placementPoint + killPoint
    };
}

function calculatedTeams() {
    return teams.map(team => {
        const matches = team.matches.map(score);

        const totalPlacement = matches.reduce(
            (sum, match) => sum + match.placementPoint,
            0
        );

        const totalKills = matches.reduce(
            (sum, match) => sum + match.kills,
            0
        );

        const totalPoint = matches.reduce(
            (sum, match) => sum + match.total,
            0
        );

        return {
            ...team,
            calculatedMatches: matches,
            totalPlacement,
            totalKills,
            totalPoint
        };
    }).sort((a, b) =>
        b.totalPoint - a.totalPoint || b.totalKills - a.totalKills
    );
}

async function loadTeams() {
    try {
        const response = await fetch("/api/teams");

        if (!response.ok) {
            throw new Error("Server error");
        }

        const data = await response.json();

        teams = Array.isArray(data) ? normalizeTeams(data) : [];

        if (!teams.length) {
            teams = Array.from({ length: 12 }, (_, i) =>
                createTeam("TEAM " + (i + 1))
            );
        }

        serverAvailable = true;

        if (saveStatus) {
            saveStatus.textContent = "Terhubung ke server.";
        }

        render(false);

        if (!Array.isArray(data) || !data.length) {
            await saveTeams();
        }
    } catch (error) {
        serverAvailable = false;

        try {
            const saved = localStorage.getItem(storageKey);
            teams = saved ? normalizeTeams(JSON.parse(saved)) : [];
        } catch (error) {
            teams = [];
        }

        if (!teams.length) {
            teams = Array.from({ length: 12 }, (_, i) =>
                createTeam("TEAM " + (i + 1))
            );
        }

        if (saveStatus) {
            saveStatus.textContent =
                "Server tidak tersambung. Menggunakan penyimpanan browser.";
        }

        render(false);
    }
}

async function saveTeams() {
    try {
        localStorage.setItem(storageKey, JSON.stringify(teams));
    } catch (error) {
    }

    if (!serverAvailable) return;

    if (saveStatus) {
        saveStatus.textContent = "Menyimpan data...";
    }

    try {
        const response = await fetch("/api/teams", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(teams)
        });

        if (!response.ok) {
            throw new Error("Gagal menyimpan");
        }

        if (saveStatus) {
            saveStatus.textContent = "Data berhasil disimpan di server.";
        }
    } catch (error) {
        serverAvailable = false;

        if (saveStatus) {
            saveStatus.textContent =
                "Server terputus. Data sementara tersimpan di browser.";
        }
    }
}

function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveTeams, 300);
}

function render(save = true) {
    renderMatches();
    renderTotal();

    if (save) {
        scheduleSave();
    }
}

function renderMatches() {
    matchBodies.forEach((body, matchIndex) => {
        if (!body) return;

        body.innerHTML = "";

        teams.forEach((team, teamIndex) => {
            const result = score(team.matches[matchIndex]);
            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${teamIndex + 1}</td>
                <td>
                    <input
                        class="team-name"
                        value="${escapeHtml(team.name)}"
                        data-team="${team.id}"
                    >
                </td>
                <td>
                    <input
                        class="number-input placement-input"
                        type="number"
                        min="1"
                        max="12"
                        value="${result.placement}"
                        data-team="${team.id}"
                        data-match="${matchIndex}"
                    >
                </td>
                <td>
                    <input
                        class="number-input kill-input"
                        type="number"
                        min="0"
                        value="${result.kills}"
                        data-team="${team.id}"
                        data-match="${matchIndex}"
                    >
                </td>
                <td class="point-value">${result.placementPoint}</td>
                <td class="point-value">${result.killPoint}</td>
                <td class="total-value">${result.total}</td>
                <td>
                    <button
                        class="remove-team"
                        data-remove="${team.id}"
                    >×</button>
                </td>
            `;

            body.appendChild(row);
        });
    });

    attachEvents();
}

function renderTotal() {
    if (!totalBody) return;

    totalBody.innerHTML = "";

    calculatedTeams().forEach((team, index) => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td class="rank-number">${index + 1}</td>
            <td>${escapeHtml(team.name)}</td>
            ${team.calculatedMatches.map(match =>
                `<td>${match.total}</td>`
            ).join("")}
            <td>${team.totalPlacement}</td>
            <td>${team.totalKills}</td>
            <td class="grand-total">${team.totalPoint}</td>
        `;

        totalBody.appendChild(row);
    });
}

function attachEvents() {
    document.querySelectorAll(".team-name").forEach(input => {
        input.addEventListener("input", () => {
            const team = teams.find(
                item => String(item.id) === input.dataset.team
            );

            if (!team) return;

            team.name = input.value;

            renderTotal();
            scheduleSave();
        });
    });

    document.querySelectorAll(".placement-input").forEach(input => {
        input.addEventListener("change", () => {
            const team = teams.find(
                item => String(item.id) === input.dataset.team
            );

            if (!team) return;

            let value = Number(input.value);

            if (!value || value < 1) value = 1;
            if (value > 12) value = 12;

            team.matches[Number(input.dataset.match)].placement = value;

            render();
        });
    });

    document.querySelectorAll(".kill-input").forEach(input => {
        input.addEventListener("change", () => {
            const team = teams.find(
                item => String(item.id) === input.dataset.team
            );

            if (!team) return;

            team.matches[Number(input.dataset.match)].kills =
                Math.max(0, Number(input.value) || 0);

            render();
        });
    });

    document.querySelectorAll(".remove-team").forEach(button => {
        button.addEventListener("click", () => {
            teams = teams.filter(
                team => String(team.id) !== button.dataset.remove
            );

            render();
        });
    });
}

function renderLeaderboard(result) {
    if (!leaderboardBody) return;

    leaderboardBody.innerHTML = "";

    if (!result.length) {
        leaderboardBody.innerHTML =
            '<div class="empty">Belum ada data tim.</div>';
        return;
    }

    result.forEach((team, index) => {
        const row = document.createElement("div");

        row.className = "leaderboard-row";

        row.innerHTML = `
            <div class="leaderboard-rank">${index + 1}</div>
            <div class="leaderboard-team">${escapeHtml(team.name)}</div>
            <div class="leaderboard-kills">${team.totalKills} KILLS</div>
            <div class="leaderboard-points">${team.totalPoint} PTS</div>
        `;

        leaderboardBody.appendChild(row);
    });
}

function switchTab(id) {
    document.querySelectorAll(".tab").forEach(tab => {
        tab.classList.toggle("active", tab.dataset.tab === id);
    });

    document.querySelectorAll(".match-panel").forEach(panel => {
        panel.classList.toggle("active", panel.id === id);
    });
}

document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
        switchTab(tab.dataset.tab);
    });
});

document.getElementById("addTeamBtn")?.addEventListener("click", () => {
    teams.push(createTeam("TEAM " + (teams.length + 1)));
    render();
});

document.getElementById("calculateBtn")?.addEventListener("click", () => {
    renderTotal();
    renderLeaderboard(calculatedTeams());
    switchTab("total");
});

document.getElementById("resetBtn")?.addEventListener("click", async () => {
    if (!confirm("Reset semua hasil dan kembalikan 12 tim awal?")) {
        return;
    }

    teams = Array.from({ length: 12 }, (_, i) =>
        createTeam("TEAM " + (i + 1))
    );

    render();
    renderLeaderboard([]);
    switchTab("match1");

    await saveTeams();
});

document.getElementById("exportBtn")?.addEventListener("click", () => {
    if (typeof XLSX === "undefined") {
        alert(
            "Library Excel belum dimuat. Tambahkan xlsx-js-style di index.html sebelum app.js."
        );
        return;
    }

    const headers = [
        "RANK",
        "NAMA TIM",
        "MATCH 1",
        "MATCH 2",
        "MATCH 3",
        "MATCH 4",
        "MATCH 5",
        "MATCH 6",
        "TOTAL PLACEMENT POINT",
        "TOTAL KILL",
        "TOTAL POINT"
    ];

    const rows = [headers];

    calculatedTeams().forEach((team, index) => {
        rows.push([
            index + 1,
            team.name,
            ...team.calculatedMatches.map(match => match.total),
            team.totalPlacement,
            team.totalKills,
            team.totalPoint
        ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);

    worksheet["!cols"] = [
        { wch: 8 },
        { wch: 24 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 24 },
        { wch: 14 },
        { wch: 16 }
    ];

    worksheet["!autofilter"] = {
        ref: XLSX.utils.encode_range({
            s: { r: 0, c: 0 },
            e: {
                r: rows.length - 1,
                c: headers.length - 1
            }
        })
    };

    const border = {
        top: {
            style: "thin",
            color: { rgb: "D5DEEA" }
        },
        bottom: {
            style: "thin",
            color: { rgb: "D5DEEA" }
        },
        left: {
            style: "thin",
            color: { rgb: "D5DEEA" }
        },
        right: {
            style: "thin",
            color: { rgb: "D5DEEA" }
        }
    };

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        for (let colIndex = 0; colIndex < headers.length; colIndex++) {
            const cellAddress = XLSX.utils.encode_cell({
                r: rowIndex,
                c: colIndex
            });

            const cell = worksheet[cellAddress];

            if (!cell) continue;

            let fillColor = rowIndex === 0
                ? "172554"
                : rowIndex % 2 === 0
                    ? "EAF0F8"
                    : "FFFFFF";

            let fontColor = rowIndex === 0
                ? "FFFFFF"
                : "172033";

            if (rowIndex > 0 && colIndex === 0) {
                fillColor = rowIndex === 1
                    ? "FDE68A"
                    : rowIndex === 2
                        ? "DDE5EF"
                        : rowIndex === 3
                            ? "F5D0B5"
                            : fillColor;
            }

            if (rowIndex > 0 && colIndex === 10) {
                fillColor = "D1FAE5";
                fontColor = "065F46";
            }

            cell.s = {
                font: {
                    name: "Aptos",
                    sz: rowIndex === 0 ? 11 : 10,
                    bold:
                        rowIndex === 0 ||
                        colIndex === 0 ||
                        colIndex === 10,
                    color: { rgb: fontColor }
                },
                fill: {
                    patternType: "solid",
                    fgColor: { rgb: fillColor }
                },
                alignment: {
                    vertical: "center",
                    horizontal: colIndex === 1 ? "left" : "center"
                },
                border
            };
        }
    }

    worksheet["!rows"] = rows.map((row, index) => ({
        hpt: index === 0 ? 26 : 21
    }));

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Klasemen ARPA"
    );

    XLSX.writeFile(
        workbook,
        "arpa-udinus-6-match.xlsx"
    );
});

loadTeams();