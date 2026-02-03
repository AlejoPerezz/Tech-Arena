const socket = io();

const joinPanel = document.getElementById("join-panel");
const roomPanel = document.getElementById("room-panel");
const resultsPanel = document.getElementById("results-panel");
const finalPanel = document.getElementById("final-panel");
const joinBtn = document.getElementById("join-btn");
const joinError = document.getElementById("join-error");
const joinTitle = document.querySelector("#join-panel h2");
const joinSubtitle = document.querySelector("#join-panel p");
const roomTitle = document.getElementById("room-title");
const roomStatus = document.getElementById("room-status");
const playerNameDisplay = document.getElementById("player-name-display");
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
const viewScoreboardBtn = document.getElementById("view-scoreboard-btn");
const finalSummary = document.getElementById("final-summary");
const finalLeaderboardEl = document.getElementById("final-leaderboard");
const finalRecommendationsEl = document.getElementById("final-recommendations");
const restartBtn = document.getElementById("restart-btn");
const finalTitle = document.querySelector("#final-panel h2");
const finalRecommendationsTitle = document.querySelector("#final-panel h3");
const timerBar = document.getElementById("timer-bar");
const timerText = document.getElementById("timer-text");
const langEn = document.getElementById("lang-en");
const langEs = document.getElementById("lang-es");
const scenarioLabel = document.getElementById("scenario-title");
const promptLabel = document.getElementById("scenario-prompt");
const resultsTitle = document.querySelector("#results-panel h2");
const leaderboardTitle = document.querySelector("#room-panel .card h3");
const decisionsTitle = document.querySelector(".answers h4");

let currentRoom = null;
let currentUserId = null;
let roundEndsAt = null;
let lastScenario = null;
let selectedOption = null;
let pendingGameover = null;
let currentPlayerName = null;
let roundAnswers = new Map();

const translations = {
  en: {
    joinTitle: "Join a room",
    joinSubtitle: "Enter a room code and your name to start. The first player creates the room.",
    joinButton: "Join room",
    startRound: "Start round",
    nextRound: "Next round",
    submitDecision: "Submit decision",
    waitingHost: "Waiting for the host to start the round...",
    waitingNext: "Waiting for next round",
    roundInProgress: "Round in progress",
    scenarioWaiting: "Waiting for the next round...",
    leaderboard: "Leaderboard",
    decisions: "Decisions",
    roundResults: "Round results",
    finalScoreboard: "Final scoreboard",
    finalRecommendations: "Personal recommendations",
    newSession: "New session",
    viewScoreboard: "View final scoreboard",
    connecting: "Connecting to server...",
    missingJoin: "Please enter a room code and name.",
    correct: "Correct",
    incorrect: "Incorrect",
    recommended: "Recommended",
    lessEffective: "Less effective",
    correctAnswer: "Correct answer",
    chosenAnswer: "Chosen answer",
    explanation: "Explanation",
    whyCorrect: "Why it was correct",
    whyIncorrect: "Why it was incorrect",
    noAnswer: "No answer",
    roundsPlayed: (played, total) => `Rounds played: ${played} / ${total}`,
  },
  es: {
    joinTitle: "Unirse a una sala",
    joinSubtitle: "Ingresa un código de sala y tu nombre. El primer jugador crea la sala.",
    joinButton: "Unirse",
    startRound: "Iniciar ronda",
    nextRound: "Siguiente ronda",
    submitDecision: "Enviar decisión",
    waitingHost: "Esperando a que el host inicie la ronda...",
    waitingNext: "Esperando la siguiente ronda",
    roundInProgress: "Ronda en progreso",
    scenarioWaiting: "Esperando la próxima ronda...",
    leaderboard: "Clasificación",
    decisions: "Decisiones",
    roundResults: "Resumen de ronda",
    finalScoreboard: "Marcador final",
    finalRecommendations: "Recomendaciones personales",
    newSession: "Nueva sesión",
    viewScoreboard: "Ver marcador final",
    connecting: "Conectando al servidor...",
    missingJoin: "Ingresa un código de sala y tu nombre.",
    correct: "Correcta",
    incorrect: "Incorrecta",
    recommended: "Recomendada",
    lessEffective: "Menos efectiva",
    correctAnswer: "Respuesta correcta",
    chosenAnswer: "Respuesta elegida",
    explanation: "Explicación",
    whyCorrect: "Por qué fue correcta",
    whyIncorrect: "Por qué fue incorrecta",
    noAnswer: "Sin respuesta",
    roundsPlayed: (played, total) => `Rondas jugadas: ${played} / ${total}`,
  },
};

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

const t = (key, ...args) => {
  const value = translations[state.language]?.[key] ?? translations.en[key];
  return typeof value === "function" ? value(...args) : value;
};

const applyTranslations = () => {
  joinTitle.textContent = t("joinTitle");
  joinSubtitle.textContent = t("joinSubtitle");
  joinBtn.textContent = t("joinButton");
  startBtn.textContent = t("startRound");
  nextBtn.textContent = t("nextRound");
  submitBtn.textContent = t("submitDecision");
  preRound.querySelector("p").textContent = t("waitingHost");
  resultsTitle.textContent = t("roundResults");
  finalTitle.textContent = t("finalScoreboard");
  finalRecommendationsTitle.textContent = t("finalRecommendations");
  restartBtn.textContent = t("newSession");
  viewScoreboardBtn.textContent = t("viewScoreboard");
  leaderboardTitle.textContent = t("leaderboard");
  decisionsTitle.textContent = t("decisions");
};

const updateTimer = () => {
  if (!roundEndsAt || !state.inProgress) {
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

const renderScenario = (scenario, roundChanged = false) => {
  lastScenario = scenario;
  optionsEl.innerHTML = "";
  if (roundChanged) {
    answersEl.innerHTML = "";
  }
  if (state.inProgress) {
    resultsPanel.classList.add("hidden");
  }
  finalPanel.classList.add("hidden");
  preRound.classList.add("hidden");
  submitBtn.classList.add("hidden");
  submitBtn.disabled = true;
  state.selectedOption = null;

  if (!scenario) {
    scenarioLabel.textContent = t("scenarioWaiting");
    promptLabel.textContent = "";
    return;
  }

  scenarioLabel.textContent = scenario.title;
  promptLabel.textContent = scenario.prompt;

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

const getFriendlyExplanation = (text) => {
  if (!text) return "";
  return text
    .replace(/CVE/gi, "security issue")
    .replace(/latency/gi, "slow response time")
    .replace(/throughput/gi, "capacity")
    .replace(/contention/gi, "resource conflicts")
    .replace(/eviction/gi, "cache clearing")
    .replace(/observability/gi, "visibility")
    .replace(/deploy/gi, "release")
    .replace(/rollback/gi, "revert")
    .replace(/dependencies/gi, "libraries");
};

const renderResults = (payload) => {
  resultsEl.innerHTML = "";
  const correctOptionIds = payload.correctOptionIds ?? [];
  const correctOptions = payload.correctOptions ?? [];
  const currentResult = payload.results.find(
    (result) => result.playerId === currentUserId
  );
  if (!currentResult) {
    resultsPanel.classList.remove("hidden");
    return;
  }
  answersEl.innerHTML = "";
  payload.results.forEach((result) => {
    const player = state.players.find((p) => p.id === result.playerId);
    const answerItem = document.createElement("li");
    answerItem.textContent = `${player?.name ?? "Player"}: ${result.optionLabel ?? t("noAnswer")}`;
    answersEl.appendChild(answerItem);
  });
  const resultsToShow = [currentResult];
  resultsToShow.forEach((result) => {
    const player = state.players.find((p) => p.id === result.playerId);
    const isCorrect = correctOptionIds.includes(result.optionId);
    const selectedLabel = result.optionLabel ?? result.optionId ?? t("noAnswer");
    const item = document.createElement("div");
    item.className = "results-item";
    const verdict = isCorrect ? t("recommended") : t("lessEffective");
    const verdictClass = isCorrect ? "correct" : "incorrect";
    const correctAnswerText = correctOptions
      .map((option) => option.label)
      .join(", ");
    const correctExplanation = getFriendlyExplanation(correctOptions[0]?.explanation ?? "");
    const chosenExplanation = getFriendlyExplanation(result.explanation);
    const whyChosenLabel = isCorrect ? t("whyCorrect") : t("whyIncorrect");
    item.innerHTML = `<strong>${player?.name ?? "Player"}</strong><span class="badge ${verdictClass}">${verdict}</span><p><strong>${t(
      "chosenAnswer"
    )}:</strong> ${selectedLabel}</p><p><strong>${whyChosenLabel}:</strong> ${chosenExplanation}</p><p><strong>${t(
      "correctAnswer"
    )}:</strong> ${correctAnswerText}</p><p><strong>${t(
      "whyCorrect"
    )}:</strong> ${correctExplanation}</p><p>${result.outcome}</p><p><strong>${result.points} pts</strong></p>`;
    resultsEl.appendChild(item);
  });
  resultsPanel.classList.remove("hidden");
};

const getRecommendationsForScore = (
  score,
  roundsPlayed,
  rank,
  totalPlayers,
  strengths,
  weaknesses
) => {
  const average = roundsPlayed ? score / roundsPlayed : 0;
  const percentile = totalPlayers ? (totalPlayers - rank) / totalPlayers : 0;
  const extraTopics = [];
  const strengthHint =
    state.language === "es"
      ? `Fortalezas: ${strengths.join(", ") || "Por determinar"}`
      : `Strengths: ${strengths.join(", ") || "TBD"}`;
  const weaknessHint =
    state.language === "es"
      ? `Enfoque: ${weaknesses.join(", ") || "Por determinar"}`
      : `Focus: ${weaknesses.join(", ") || "TBD"}`;
  extraTopics.push(strengthHint, weaknessHint);
  if (average >= 6) {
    return state.language === "es"
      ? [
          "Liderazgo en incidentes y postmortems",
          "Patrones de escalabilidad y planificación de capacidad",
          "Ingeniería de confiabilidad avanzada (SLOs, presupuestos de error)",
          percentile > 0.66 ? "Mentoría técnica y coaching de equipos" : "Diseño de sistemas distribuidos",
          ...extraTopics,
        ]
      : [
          "Incident management leadership and postmortems",
          "Scalability design patterns and capacity planning",
          "Advanced reliability engineering (SLOs, error budgets)",
          percentile > 0.66 ? "Technical mentoring and team coaching" : "Distributed systems design",
          ...extraTopics,
        ];
  }
  if (average >= 3) {
    return state.language === "es"
      ? [
          "Profiling y optimización de rendimiento",
          "Indexación de base de datos y planes de consulta",
          "Buenas prácticas de CI/CD y despliegues seguros",
          percentile > 0.5 ? "Diseño de APIs resilientes" : "Fundamentos de observabilidad",
          ...extraTopics,
        ]
      : [
          "Performance profiling and optimization basics",
          "Database indexing and query planning",
          "CI/CD best practices and safe deployments",
          percentile > 0.5 ? "Resilient API design" : "Observability fundamentals",
          ...extraTopics,
        ];
  }
  return state.language === "es"
    ? [
        "Fundamentos de respuesta a incidentes en producción",
        "Observabilidad básica (logs, métricas, tracing)",
        "Parches de seguridad y gestión de dependencias",
        percentile > 0.33 ? "Bases de testing automatizado" : "Buenas prácticas de debugging",
        ...extraTopics,
      ]
    : [
        "Production incident response fundamentals",
        "Observability basics (logs, metrics, tracing)",
        "Security patching and dependency management",
        percentile > 0.33 ? "Automated testing basics" : "Debugging best practices",
        ...extraTopics,
      ];
};

const renderFinal = (payload) => {
  joinPanel.classList.add("hidden");
  roomPanel.classList.add("hidden");
  resultsPanel.classList.add("hidden");
  finalLeaderboardEl.innerHTML = "";
  finalRecommendationsEl.innerHTML = "";
  const sorted = [...payload.leaderboard].sort((a, b) => b.score - a.score);
  const topicStats = new Map();
  if (payload.results) {
    payload.results.forEach((result) => {
      if (!result.optionTopics) return;
      const playerStats = topicStats.get(result.playerId) ?? {};
      result.optionTopics.forEach((topic) => {
        playerStats[topic] = playerStats[topic] ?? { correct: 0, total: 0 };
        playerStats[topic].total += 1;
        if (payload.correctOptionIds?.includes(result.optionId)) {
          playerStats[topic].correct += 1;
        }
      });
      topicStats.set(result.playerId, playerStats);
    });
  }
  sorted.forEach((player, index) => {
      const item = document.createElement("li");
      item.innerHTML = `<span>${player.name}</span><strong>${player.score}</strong>`;
      finalLeaderboardEl.appendChild(item);

      const recommendation = document.createElement("div");
      recommendation.className = "recommendation-item";
      const stats = topicStats.get(player.id) ?? {};
      const topicsSorted = Object.entries(stats).sort(
        (a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total
      );
      const weaknesses = topicsSorted.slice(0, 2).map(([topic]) => topic);
      const strengths = topicsSorted.slice(-2).map(([topic]) => topic);
      const topics = getRecommendationsForScore(
        player.score,
        payload.roundsPlayed,
        index + 1,
        sorted.length,
        strengths,
        weaknesses
      );
      recommendation.innerHTML = `<strong>${player.name}</strong><ul>${topics
        .map((topic) => `<li>${topic}</li>`)
        .join("")}</ul>`;
      finalRecommendationsEl.appendChild(recommendation);
    });
  finalSummary.textContent = t("roundsPlayed", payload.roundsPlayed, payload.maxRounds);
  finalPanel.classList.remove("hidden");
};

const setHostControls = () => {
  const isHost = currentUserId && currentUserId === state.hostId;
  const canStart = isHost && !state.inProgress && state.currentRound < 0;
  const canNext =
    isHost &&
    !state.inProgress &&
    state.currentRound >= 0 &&
    state.currentRound + 1 < state.maxRounds;
  startBtn.disabled = !canStart;
  nextBtn.disabled = !canNext;
  startBtn.classList.toggle("hidden", !canStart);
  nextBtn.classList.toggle("hidden", !canNext);
  restartBtn.classList.toggle("hidden", !isHost);
  restartBtn.disabled = !isHost;
};

const attemptJoin = () => {
  const roomCode = document.getElementById("room-code").value.trim();
  const name = document.getElementById("player-name").value.trim();
  if (!roomCode || !name) {
    joinError.textContent = t("missingJoin");
    return;
  }
  joinError.textContent = "";
  currentRoom = roomCode;
  currentPlayerName = name;
  playerNameDisplay.textContent = name ? `${name}` : "";
  if (!socket.connected) {
    joinError.textContent = t("connecting");
    socket.once("connect", () => {
      joinError.textContent = "";
      socket.emit("room:join", { roomCode, name });
    });
    return;
  }
  socket.emit("room:join", { roomCode, name });
};

joinBtn.addEventListener("click", attemptJoin);

["room-code", "player-name"].forEach((id) => {
  const input = document.getElementById(id);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      attemptJoin();
    }
  });
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
  finalPanel.classList.add("hidden");
  joinPanel.classList.add("hidden");
  roomPanel.classList.remove("hidden");
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
  applyTranslations();
  setHostControls();
});

socket.on("room:error", ({ message }) => {
  joinError.textContent = message;
});

socket.on("room:state", (payload) => {
  if (finalPanel.classList.contains("hidden")) {
    joinPanel.classList.add("hidden");
    roomPanel.classList.remove("hidden");
  } else {
    return;
  }
  roomTitle.textContent = `Room ${payload.roomCode}`;
  roomStatus.textContent = payload.inProgress ? t("roundInProgress") : t("waitingNext");

  const previousRound = state.currentRound;
  state.players = payload.players;
  state.hostId = payload.hostId;
  state.language = payload.language;
  state.inProgress = payload.inProgress;
  state.currentRound = payload.currentRound;
  state.gameOver = payload.gameOver;
  state.maxRounds = payload.maxRounds;
  roundEndsAt = payload.roundEndsAt;
  const roundChanged = payload.currentRound !== previousRound;
  if (roundChanged) {
    roundAnswers = new Map();
  }

  renderPlayers();
  renderScenario(payload.scenario, roundChanged);
  applyTranslations();
  setHostControls();
  if (payload.gameOver && !pendingGameover) {
    pendingGameover = {
      leaderboard: payload.players,
      roundsPlayed: payload.currentRound + 1,
      maxRounds: payload.maxRounds,
      results: [],
      correctOptionIds: [],
    };
  }
});

socket.on("room:answer", (answer) => {
  const player = state.players.find((p) => p.id === answer.playerId);
  const optionLabel =
    lastScenario?.options.find((option) => option.id === answer.optionId)?.label ??
    answer.optionId;
  roundAnswers.set(answer.playerId, {
    playerName: player?.name ?? "Player",
    optionLabel,
  });
  answersEl.innerHTML = "";
  Array.from(roundAnswers.values()).forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = `${entry.playerName}: ${entry.optionLabel}`;
    answersEl.appendChild(item);
  });
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
    btn.disabled = false;
    btn.classList.remove("correct", "incorrect");
    const optionId = btn.dataset.optionId;
    if (optionId && correctOptionIds.includes(optionId)) {
      btn.classList.add("correct");
    }
    if (selectedOptionId && optionId === selectedOptionId && !correctOptionIds.includes(optionId)) {
      btn.classList.add("incorrect");
    }
  });
  const isLastRound = payload.roundsPlayed === payload.maxRounds;
  if (isLastRound && currentUserId === state.hostId) {
    viewScoreboardBtn.classList.remove("hidden");
    viewScoreboardBtn.disabled = false;
  } else {
    viewScoreboardBtn.classList.add("hidden");
    viewScoreboardBtn.disabled = true;
  }
  if (isLastRound) {
    pendingGameover = {
      leaderboard: payload.leaderboard,
      roundsPlayed: payload.roundsPlayed,
      maxRounds: payload.maxRounds,
      results: payload.results ?? [],
      correctOptionIds: payload.correctOptionIds ?? [],
    };
  }
  state.selectedOption = null;
});

socket.on("room:gameover", (payload) => {
  pendingGameover = {
    leaderboard: payload.leaderboard,
    roundsPlayed: payload.roundsPlayed,
    maxRounds: payload.maxRounds,
    results: payload.results ?? [],
    correctOptionIds: payload.correctOptionIds ?? [],
  };
});

socket.on("room:showScoreboard", (payload) => {
  renderFinal(payload);
});

socket.on("room:reset", () => {
  finalPanel.classList.add("hidden");
  joinPanel.classList.add("hidden");
  roomPanel.classList.remove("hidden");
});

viewScoreboardBtn.addEventListener("click", () => {
  if (!pendingGameover) return;
  socket.emit("room:showScoreboard", {
    roomCode: currentRoom,
    payload: pendingGameover,
  });
  pendingGameover = null;
});
