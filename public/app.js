const socket = io();

const joinPanel = document.getElementById("join-panel");
const roomPanel = document.getElementById("room-panel");
const resultsPanel = document.getElementById("results-panel");
const finalPanel = document.getElementById("final-panel");
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
const finalSummary = document.getElementById("final-summary");
const finalLeaderboardEl = document.getElementById("final-leaderboard");
<<<<<<< codex/design-tech-architecture-for-tech-decision-simulator-ia3qmq
const finalRecommendationsEl = document.getElementById("final-recommendations");
=======
>>>>>>> main
const restartBtn = document.getElementById("restart-btn");
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
  gameOver: false,
  maxRounds: 5,
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
  finalPanel.classList.add("hidden");
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
    button.dataset.optionId = option.id;
    button.addEventListener("click", () => {
      if (!state.inProgress) return;
      if (!currentRoom) return;
      state.selectedOption = option.id;
      submitBtn.classList.remove("hidden");
      submitBtn.disabled = false;
      document.querySelectorAll(".option-btn").forEach((btn) => {
        btn.classList.remove("correct", "incorrect");
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
<<<<<<< codex/design-tech-architecture-for-tech-decision-simulator-ia3qmq
  const correctOptionIds = payload.correctOptionIds ?? [];
  payload.results.forEach((result) => {
    const player = state.players.find((p) => p.id === result.playerId);
    const isCorrect = correctOptionIds.includes(result.optionId);
    const item = document.createElement("div");
    item.className = "results-item";
    const verdict = isCorrect ? "Correct" : "Incorrect";
    const verdictClass = isCorrect ? "correct" : "incorrect";
    item.innerHTML = `<strong>${player?.name ?? "Player"}</strong><span class="badge ${verdictClass}">${verdict}</span><p>${result.outcome}</p><p>${result.explanation}</p><p><strong>${result.points} pts</strong></p>`;
=======
  payload.results.forEach((result) => {
    const player = state.players.find((p) => p.id === result.playerId);
    const item = document.createElement("div");
    item.className = "results-item";
    item.innerHTML = `<strong>${player?.name ?? "Player"}</strong><p>${result.outcome}</p><p>${result.explanation}</p><p><strong>${result.points} pts</strong></p>`;
>>>>>>> main
    resultsEl.appendChild(item);
  });
  resultsPanel.classList.remove("hidden");
};

<<<<<<< codex/design-tech-architecture-for-tech-decision-simulator-ia3qmq
const getRecommendationsForScore = (score, roundsPlayed) => {
  const average = roundsPlayed ? score / roundsPlayed : 0;
  if (average >= 6) {
    return [
      "Incident management leadership and postmortems",
      "Scalability design patterns and capacity planning",
      "Advanced reliability engineering (SLOs, error budgets)",
    ];
  }
  if (average >= 3) {
    return [
      "Performance profiling and optimization basics",
      "Database indexing and query planning",
      "CI/CD best practices and safe deployments",
    ];
  }
  return [
    "Production incident response fundamentals",
    "Observability basics (logs, metrics, tracing)",
    "Security patching and dependency management",
  ];
};

const renderFinal = (payload) => {
  finalLeaderboardEl.innerHTML = "";
  finalRecommendationsEl.innerHTML = "";
=======
const renderFinal = (payload) => {
  finalLeaderboardEl.innerHTML = "";
>>>>>>> main
  payload.leaderboard
    .sort((a, b) => b.score - a.score)
    .forEach((player) => {
      const item = document.createElement("li");
      item.innerHTML = `<span>${player.name}</span><strong>${player.score}</strong>`;
      finalLeaderboardEl.appendChild(item);
<<<<<<< codex/design-tech-architecture-for-tech-decision-simulator-ia3qmq

      const recommendation = document.createElement("div");
      recommendation.className = "recommendation-item";
      const topics = getRecommendationsForScore(player.score, payload.roundsPlayed);
      recommendation.innerHTML = `<strong>${player.name}</strong><ul>${topics
        .map((topic) => `<li>${topic}</li>`)
        .join("")}</ul>`;
      finalRecommendationsEl.appendChild(recommendation);
=======
>>>>>>> main
    });
  finalSummary.textContent = `Rounds played: ${payload.roundsPlayed} / ${payload.maxRounds}`;
  finalPanel.classList.remove("hidden");
};

const setHostControls = () => {
  const isHost = currentUserId && currentUserId === state.hostId;
  const canStart = isHost && !state.inProgress && state.currentRound < 0;
  const canNext = isHost && !state.inProgress && state.currentRound >= 0;
  startBtn.disabled = !canStart;
  nextBtn.disabled = !canNext;
  startBtn.classList.toggle("hidden", !canStart);
  nextBtn.classList.toggle("hidden", !canNext);
  restartBtn.classList.toggle("hidden", !isHost);
  restartBtn.disabled = !isHost;
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

restartBtn.addEventListener("click", () => {
  if (!currentRoom) return;
  socket.emit("room:reset", { roomCode: currentRoom });
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
  state.gameOver = payload.gameOver;
  state.maxRounds = payload.maxRounds;
  roundEndsAt = payload.roundEndsAt;

  renderPlayers();
  renderScenario(payload.scenario);
  setHostControls();
  if (payload.gameOver) {
    renderFinal({
      leaderboard: payload.players,
      roundsPlayed: payload.currentRound + 1,
      maxRounds: payload.maxRounds,
    });
  }
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
  const correctOptionIds = payload.correctOptionIds ?? [];
  const selectedOptionId = state.selectedOption;
  submitBtn.classList.add("hidden");
  submitBtn.disabled = true;
  optionsEl.querySelectorAll(".option-btn").forEach((btn) => {
    btn.disabled = true;
    btn.classList.remove("selected", "correct", "incorrect");
    const optionId = btn.dataset.optionId;
    if (optionId && correctOptionIds.includes(optionId)) {
      btn.classList.add("correct");
    }
    if (selectedOptionId && optionId === selectedOptionId && !correctOptionIds.includes(optionId)) {
      btn.classList.add("incorrect");
    }
  });
  state.selectedOption = null;
});

socket.on("room:gameover", (payload) => {
  renderFinal(payload);
});
