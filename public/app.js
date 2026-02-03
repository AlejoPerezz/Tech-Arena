const socket = io();

const joinPanel = document.getElementById("join-panel");
const roomPanel = document.getElementById("room-panel");
const resultsPanel = document.getElementById("results-panel");
const joinBtn = document.getElementById("join-btn");
const joinError = document.getElementById("join-error");
const roomTitle = document.getElementById("room-title");
const roomStatus = document.getElementById("room-status");
const startBtn = document.getElementById("start-btn");
const nextBtn = document.getElementById("next-btn");
const scenarioTitle = document.getElementById("scenario-title");
const scenarioPrompt = document.getElementById("scenario-prompt");
const preRound = document.getElementById("pre-round");
const optionsEl = document.getElementById("options");
const submitBtn = document.getElementById("submit-btn");
const leaderboardEl = document.getElementById("leaderboard");
const answersEl = document.getElementById("answers");
const resultsEl = document.getElementById("results");
const timerBar = document.getElementById("timer-bar");
const timerText = document.getElementById("timer-text");
const langEn = document.getElementById("lang-en");
const langEs = document.getElementById("lang-es");

let currentRoom = null;
let currentUserId = null;
let roundEndsAt = null;
let lastScenario = null;
let selectedOption = null;

const state = {
  players: [],
  hostId: null,
  language: "en",
  inProgress: false,
  currentRound: -1,
  selectedOption: null,
};

const updateTimer = () => {
  if (!roundEndsAt) {
    timerBar.style.width = "0%";
    timerText.textContent = "--";
    return;
  }
  const remaining = Math.max(0, roundEndsAt - Date.now());
  const total = 75000;
  const percent = Math.max(0, Math.min(100, (remaining / total) * 100));
  timerBar.style.width = `${percent}%`;
  timerText.textContent = `${Math.ceil(remaining / 1000)}s`;
};

setInterval(updateTimer, 300);

const renderPlayers = () => {
  leaderboardEl.innerHTML = "";
  state.players
    .sort((a, b) => b.score - a.score)
    .forEach((player) => {
      const item = document.createElement("li");
      item.innerHTML = `<span>${player.name}</span><strong>${player.score}</strong>`;
      leaderboardEl.appendChild(item);
    });
};

const renderScenario = (scenario) => {
  lastScenario = scenario;
  optionsEl.innerHTML = "";
  answersEl.innerHTML = "";
  resultsPanel.classList.add("hidden");
  preRound.classList.add("hidden");
  submitBtn.classList.add("hidden");
  submitBtn.disabled = true;
  state.selectedOption = null;

  if (!scenario) {
    scenarioTitle.textContent = "Waiting for the next round...";
    scenarioPrompt.textContent = "";
    return;
  }

  scenarioTitle.textContent = scenario.title;
  scenarioPrompt.textContent = scenario.prompt;

  if (!state.inProgress) {
    preRound.classList.remove("hidden");
    submitBtn.classList.add("hidden");
  }

  scenario.options.forEach((option) => {
    const button = document.createElement("button");
    button.className = "option-btn";
    button.textContent = option.label;
    button.addEventListener("click", () => {
      if (!state.inProgress) return;
      if (!currentRoom) return;
      state.selectedOption = option.id;
      submitBtn.classList.remove("hidden");
      submitBtn.disabled = false;
      document.querySelectorAll(".option-btn").forEach((btn) => {
        btn.classList.toggle("selected", btn === button);
      });
    });
    optionsEl.appendChild(button);
  });
};

const renderAnswers = (answers) => {
  answersEl.innerHTML = "";
  answers.forEach((answer) => {
    const item = document.createElement("li");
    item.textContent = `${answer.playerName}: ${answer.optionId}`;
    answersEl.appendChild(item);
  });
};

const renderResults = (payload) => {
  resultsEl.innerHTML = "";
  payload.results.forEach((result) => {
    const player = state.players.find((p) => p.id === result.playerId);
    const item = document.createElement("div");
    item.className = "results-item";
    item.innerHTML = `<strong>${player?.name ?? "Player"}</strong><p>${result.outcome}</p><p>${result.explanation}</p><p><strong>${result.points} pts</strong></p>`;
    resultsEl.appendChild(item);
  });
  resultsPanel.classList.remove("hidden");
};

const setHostControls = () => {
  const isHost = currentUserId && currentUserId === state.hostId;
  const canStart = isHost && !state.inProgress && state.currentRound < 0;
  const canNext = isHost && !state.inProgress && state.currentRound >= 0;
  startBtn.disabled = !canStart;
  nextBtn.disabled = !canNext;
  startBtn.classList.toggle("hidden", !canStart);
  nextBtn.classList.toggle("hidden", !canNext);
};

joinBtn.addEventListener("click", () => {
  const roomCode = document.getElementById("room-code").value.trim();
  const name = document.getElementById("player-name").value.trim();
  if (!roomCode || !name) {
    joinError.textContent = "Please enter a room code and name.";
    return;
  }
  joinError.textContent = "";
  currentRoom = roomCode;
  socket.emit("room:join", { roomCode, name });
});

startBtn.addEventListener("click", () => {
  if (!currentRoom) return;
  socket.emit("room:start", { roomCode: currentRoom });
});

nextBtn.addEventListener("click", () => {
  if (!currentRoom) return;
  socket.emit("room:next", { roomCode: currentRoom });
});

submitBtn.addEventListener("click", () => {
  if (!currentRoom || !state.inProgress || !state.selectedOption) return;
  socket.emit("player:answer", {
    roomCode: currentRoom,
    optionId: state.selectedOption,
  });
  submitBtn.disabled = true;
  optionsEl.querySelectorAll(".option-btn").forEach((btn) => {
    btn.disabled = true;
  });
});

langEn.addEventListener("click", () => {
  if (!currentRoom) return;
  socket.emit("room:language", { roomCode: currentRoom, language: "en" });
});

langEs.addEventListener("click", () => {
  if (!currentRoom) return;
  socket.emit("room:language", { roomCode: currentRoom, language: "es" });
});

socket.on("connect", () => {
  currentUserId = socket.id;
  setHostControls();
});

socket.on("room:error", ({ message }) => {
  joinError.textContent = message;
});

socket.on("room:state", (payload) => {
  joinPanel.classList.add("hidden");
  roomPanel.classList.remove("hidden");
  roomTitle.textContent = `Room ${payload.roomCode}`;
  roomStatus.textContent = payload.inProgress
    ? "Round in progress"
    : "Waiting for next round";

  state.players = payload.players;
  state.hostId = payload.hostId;
  state.language = payload.language;
  state.inProgress = payload.inProgress;
  state.currentRound = payload.currentRound;
  roundEndsAt = payload.roundEndsAt;

  renderPlayers();
  renderScenario(payload.scenario);
  setHostControls();
});

socket.on("room:answer", (answer) => {
  if (!lastScenario) return;
  const player = state.players.find((p) => p.id === answer.playerId);
  const optionLabel =
    lastScenario.options.find((option) => option.id === answer.optionId)?.label ??
    answer.optionId;
  const answers = Array.from(answersEl.querySelectorAll("li")).map((li) => ({
    playerName: li.textContent.split(":")[0],
    optionId: li.textContent.split(":")[1],
  }));
  answers.push({ playerName: player?.name ?? "Player", optionId: optionLabel });
  renderAnswers(answers);
});

socket.on("room:results", (payload) => {
  state.players = payload.leaderboard;
  renderPlayers();
  renderResults(payload);
  state.selectedOption = null;
  submitBtn.classList.add("hidden");
  submitBtn.disabled = true;
  optionsEl.querySelectorAll(".option-btn").forEach((btn) => {
    btn.disabled = false;
    btn.classList.remove("selected");
  });
});
