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
let pendingGameover = null;

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

const translations = {
  en: {
    correct: "Correct",
    incorrect: "Incorrect",
    correctAnswer: "Correct answer",
    chosenAnswer: "Chosen answer",
    explanation: "Explanation",
    whyCorrect: "Why it was correct",
    whyIncorrect: "Why it was incorrect",
    noAnswer: "No answer",
    roundsPlayed: (played, total) => `Rounds played: ${played} / ${total}`,
  },
  es: {
    correct: "Correcta",
    incorrect: "Incorrecta",
    correctAnswer: "Respuesta correcta",
    chosenAnswer: "Respuesta elegida",
    explanation: "Explicación",
    whyCorrect: "Por qué fue correcta",
    whyIncorrect: "Por qué fue incorrecta",
    noAnswer: "Sin respuesta",
    roundsPlayed: (played, total) => `Rondas jugadas: ${played} / ${total}`,
  },
};

const t = (key, ...args) => {
  const value = translations[state.language]?.[key] ?? translations.en[key];
  return typeof value === "function" ? value(...args) : value;
};

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

/* ========================================
   🔥 FUNCIÓN CORREGIDA renderResults
======================================== */

const renderResults = (payload) => {
  resultsEl.innerHTML = "";

  const correctOptionIds = payload.correctOptionIds ?? [];
  const correctOptions = payload.correctOptions ?? [];

  payload.results.forEach((result) => {
    const player = state.players.find((p) => p.id === result.playerId);
    const isCorrect = correctOptionIds.includes(result.optionId);

    const selectedLabel =
      result.optionLabel ?? result.optionId ?? t("noAnswer");

    const correctAnswerText = correctOptions
      .map((option) => option.label)
      .join(", ");

    const correctExplanation = getFriendlyExplanation(
      correctOptions[0]?.explanation ?? ""
    );

    const chosenExplanation = getFriendlyExplanation(
      result.explanation ?? ""
    );

    const verdict = isCorrect ? t("correct") : t("incorrect");
    const verdictClass = isCorrect ? "correct" : "incorrect";
    const whyChosenLabel = isCorrect
      ? t("whyCorrect")
      : t("whyIncorrect");

    const item = document.createElement("div");
    item.className = "results-item";

    item.innerHTML = `
      <strong>${player?.name ?? "Player"}</strong>
      <span class="badge ${verdictClass}">${verdict}</span>
      <p><strong>${t("chosenAnswer")}:</strong> ${selectedLabel}</p>
      <p><strong>${whyChosenLabel}:</strong> ${chosenExplanation}</p>
      <p><strong>${t("correctAnswer")}:</strong> ${correctAnswerText}</p>
      <p><strong>${t("whyCorrect")}:</strong> ${correctExplanation}</p>
      <p>${result.outcome ?? ""}</p>
      <p><strong>${result.points ?? 0} pts</strong></p>
    `;

    resultsEl.appendChild(item);
  });

  resultsPanel.classList.remove("hidden");
};
