import fs from "fs";
import path from "path";
import http from "http";
import express from "express";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 10;
const ROUND_SECONDS = 75;
const MAX_ROUNDS = 5;
const HINT_PENALTY = 3;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
const OPENROUTER_SITE_URL = process.env.OPENROUTER_SITE_URL;
const OPENROUTER_APP_NAME = process.env.OPENROUTER_APP_NAME || "tech-decision-simulator";

const rootDir = path.resolve();
const publicDir = path.join(rootDir, "public");
const dataDir = path.join(rootDir, "data");
const scenariosPath = path.join(dataDir, "scenarios.json");

let scenarios = [];

const loadScenarios = () => {
  const raw = fs.readFileSync(scenariosPath, "utf-8");
  const parsed = JSON.parse(raw);
  scenarios = parsed.scenarios ?? [];
};

loadScenarios();
fs.watchFile(scenariosPath, { interval: 1000 }, () => {
  try {
    loadScenarios();
    console.log("Scenarios reloaded.");
  } catch (error) {
    console.error("Failed to reload scenarios:", error.message);
  }
});

app.use(express.static(publicDir));
app.get("/api/scenarios", (req, res) => {
  res.json({ scenarios });
});

const rooms = new Map();

const shuffleArray = (items) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const createRoomState = (roomCode) => ({
  roomCode,
  players: new Map(),
  hostId: null,
  currentRound: -1,
  answers: new Map(),
  scores: new Map(),
  roundEndsAt: null,
  inProgress: false,
  language: "es",
  hints: new Set(),
  scenarioOrder: [],
  scenarioIndex: -1,
  gameOver: false,
  maxRounds: MAX_ROUNDS,
  currentScenario: null,
  finalResults: null,
  finalRecommendations: null,
});

const ensureScenarioOrder = (roomState) => {
  if (!scenarios.length) return false;
  if (roomState.scenarioOrder.length !== scenarios.length) {
    roomState.scenarioOrder = shuffleArray(
      scenarios.map((_, index) => index)
    );
    roomState.scenarioIndex = Math.min(roomState.scenarioIndex, scenarios.length - 1);
  }
  if (!roomState.scenarioOrder.length) {
    roomState.scenarioOrder = scenarios.map((_, index) => index);
  }
  return true;
};

const getScenarioForRoom = (roomState) => {
  if (!scenarios.length) return null;
  if (!ensureScenarioOrder(roomState)) return null;
  const orderIndex =
    roomState.scenarioIndex < 0 ? 0 : roomState.scenarioIndex;
  const index = roomState.scenarioOrder[orderIndex] ?? 0;
  return scenarios[index] ?? null;
};

const buildScenarioForRoom = (scenario, language) => {
  if (!scenario) return null;
  const locale = scenario.locale?.[language] ?? scenario.locale?.en;
  if (!locale) return null;
  return {
    id: scenario.id,
    title: locale.title,
    prompt: locale.prompt,
    hint: locale.hint ?? "",
    options: locale.options.map((option) => ({
      id: option.id,
      label: option.label,
      points: option.points,
      outcome: option.outcome,
      explanation: option.explanation,
      topics: option.topics ?? [],
    })),
  };
};

const parseOpenRouterJson = (text) => {
  if (!text) return null;
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch (innerError) {
        console.warn("Failed to parse OpenRouter JSON:", innerError.message);
        return null;
      }
    }
    console.warn("Failed to parse OpenRouter JSON:", error.message);
    return null;
  }
};

const callOpenRouter = async (prompt) => {
  if (!OPENROUTER_API_KEY) return null;
  const headers = {
    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    "X-Title": OPENROUTER_APP_NAME,
  };
  if (OPENROUTER_SITE_URL) {
    headers["HTTP-Referer"] = OPENROUTER_SITE_URL;
  }
  const requestBody = JSON.stringify({
    model: OPENROUTER_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.6,
    response_format: { type: "json_object" },
  });
  const attemptRequest = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers,
        body: requestBody,
        signal: controller.signal,
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.warn("OpenRouter API error:", response.status, errorText);
        return null;
      }
      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content;
      return parseOpenRouterJson(text);
    } finally {
      clearTimeout(timeoutId);
    }
  };
  try {
    return await attemptRequest();
  } catch (error) {
    if (error.name === "AbortError") {
      console.warn("OpenRouter request timed out, retrying once.");
      try {
        return await attemptRequest();
      } catch (retryError) {
        console.warn("OpenRouter request failed:", retryError.message);
        return null;
      }
    }
    console.warn("OpenRouter request failed:", error.message);
    return null;
  }
};

const generateScenarioFromOpenRouter = async (language) => {
  const prompt =
    language === "es"
      ? "Genera un escenario único y variado para un juego de decisiones técnicas, de nivel básico pero interesante, enfocado en: respuesta a incidentes, nuevos proyectos, decisiones de estructura/arquitectura, selección de frameworks o stacks, y buenas prácticas de mantenimiento. Evita preguntas consecutivas sobre el mismo tema y no hagas continuidad de una ronda a otra. Devuelve SOLO JSON con las claves: id (slug corto), title, prompt, hint (una pista breve y específica, no genérica), options (3 elementos). Cada opción debe tener id, label, points (entero entre -5 y 10), outcome (frase corta), explanation (una oración) y topics (2-3 temas). Responde en español."
      : "Generate one unique, varied scenario for a tech decision game, beginner-friendly but interesting, focused on: incident response, new projects, structure/architecture decisions, framework/stack selection, and maintenance best practices. Avoid consecutive questions on the same topic and do not build continuity across rounds. Return ONLY JSON with keys: id (short slug), title, prompt, hint (brief and specific, not generic), options (3 items). Each option must include id, label, points (integer -5 to 10), outcome (short phrase), explanation (one sentence), and topics (2-3 topics). Respond in English.";
  const data = await callOpenRouter(prompt);
  if (!data || !data.title || !data.prompt || !Array.isArray(data.options)) return null;
  const options = data.options
    .filter((option) => option && option.id && option.label)
    .slice(0, 3)
    .map((option) => ({
      id: String(option.id),
      label: String(option.label),
      points: Number.isFinite(option.points) ? option.points : 0,
      outcome: option.outcome ? String(option.outcome) : "",
      explanation: option.explanation ? String(option.explanation) : "",
      topics: Array.isArray(option.topics)
        ? option.topics.map((topic) => String(topic))
        : [],
    }));
  if (options.length < 3) return null;
  return {
    id: data.id ? String(data.id) : `scenario-${Date.now()}`,
    title: String(data.title),
    prompt: String(data.prompt),
    hint: data.hint ? String(data.hint) : "",
    options,
  };
};

const computeTopicStats = (results, correctOptionIds) => {
  const topicStats = new Map();
  results.forEach((result) => {
    if (!result.optionTopics) return;
    const playerStats = topicStats.get(result.playerId) ?? {};
    result.optionTopics.forEach((topic) => {
      playerStats[topic] = playerStats[topic] ?? { correct: 0, total: 0 };
      playerStats[topic].total += 1;
      if (correctOptionIds?.includes(result.optionId)) {
        playerStats[topic].correct += 1;
      }
    });
    topicStats.set(result.playerId, playerStats);
  });
  return topicStats;
};

const generateRecommendationsFromOpenRouter = async (
  leaderboard,
  results,
  correctOptionIds,
  roundsPlayed,
  language
) => {
  if (!OPENROUTER_API_KEY) return null;
  const topicStats = computeTopicStats(results, correctOptionIds);
  const players = leaderboard
    .sort((a, b) => b.score - a.score)
    .map((player, index) => {
      const stats = topicStats.get(player.id) ?? {};
      const topicsSorted = Object.entries(stats).sort(
        (a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total
      );
      const weaknesses = topicsSorted.slice(0, 2).map(([topic]) => topic);
      const strengths = topicsSorted.slice(-2).map(([topic]) => topic);
      return {
        playerId: player.id,
        name: player.name,
        score: player.score,
        rank: index + 1,
        totalPlayers: leaderboard.length,
        roundsPlayed,
        strengths,
        weaknesses,
      };
    });
  const prompt =
    language === "es"
      ? `Genera recomendaciones personalizadas (4 a 6 puntos) para cada jugador en un juego de decisiones técnicas. Devuelve SOLO JSON con la clave recommendations: un arreglo con { playerId, items }. Usa español. Jugadores: ${JSON.stringify(players)}.`
      : `Generate personalized recommendations (4 to 6 bullet items) for each player in a tech decision game. Return ONLY JSON with key recommendations: an array of { playerId, items }. Use English. Players: ${JSON.stringify(players)}.`;
  const data = await callOpenRouter(prompt);
  if (!data || !Array.isArray(data.recommendations)) return null;
  return data.recommendations
    .filter((rec) => rec && rec.playerId && Array.isArray(rec.items))
    .map((rec) => ({
      playerId: String(rec.playerId),
      items: rec.items.map((item) => String(item)).slice(0, 6),
    }));
};

const serializePlayers = (roomState) =>
  Array.from(roomState.players.values()).map((player) => ({
    id: player.id,
    name: player.name,
    score: roomState.scores.get(player.id) ?? 0,
  }));

const sendRoomState = (roomState) => {
  const shouldRevealScenario = roomState.inProgress || roomState.currentRound >= 0;
  const scenario = shouldRevealScenario ? roomState.currentScenario : null;
  io.to(roomState.roomCode).emit("room:state", {
    roomCode: roomState.roomCode,
    inProgress: roomState.inProgress,
    hostId: roomState.hostId,
    players: serializePlayers(roomState),
    currentRound: roomState.currentRound,
    maxRounds: roomState.maxRounds,
    gameOver: roomState.gameOver,
    roundEndsAt: roomState.roundEndsAt,
    scenario: scenario
      ? {
          id: scenario.id,
          title: scenario.title,
          prompt: scenario.prompt,
          options: scenario.options.map((option) => ({
            id: option.id,
            label: option.label,
          })),
        }
      : null,
    language: roomState.language,
  });
};

const endRound = (roomState) => {
  if (!roomState.inProgress) return;
  const scenario = roomState.currentScenario;
  if (!scenario) {
    roomState.answers.clear();
    roomState.roundEndsAt = null;
    roomState.inProgress = false;
    return;
  }

  const results = [];
  const noAnswerLabel =
    roomState.language === "es" ? "Sin respuesta" : "No answer";
  const noAnswerExplanation =
    roomState.language === "es"
      ? "No se seleccionó ninguna opción antes de que terminara el tiempo."
      : "No option was selected before time ran out.";
  const noAnswerOutcome =
    roomState.language === "es"
      ? "No se otorgaron puntos."
      : "No points were awarded.";

  for (const [playerId, answerId] of roomState.answers.entries()) {
    const option = scenario.options.find((opt) => opt.id === answerId);
    const basePoints = option?.points ?? 0;
    const hintUsed = roomState.hints.has(playerId);
    const hintPenalty = hintUsed ? HINT_PENALTY : 0;
    const points = basePoints - hintPenalty;
    const currentScore = roomState.scores.get(playerId) ?? 0;
    roomState.scores.set(playerId, currentScore + points);
    results.push({
      playerId,
      optionId: answerId,
      optionLabel: option?.label ?? answerId,
      optionTopics: option?.topics ?? [],
      points,
      hintUsed,
      hintPenalty,
      outcome: option?.outcome ?? "",
      explanation: option?.explanation ?? "",
    });
  }

  const optionDetails = scenario.options.map((option) => ({
    id: option.id,
    label: option.label,
    points: option.points,
    outcome: option.outcome,
    explanation: option.explanation,
  }));
  const minPoints = Math.min(...optionDetails.map((option) => option.points));
  const noAnswerPenalty = minPoints < 0 ? Math.abs(minPoints) : 0;
  for (const playerId of roomState.players.keys()) {
    if (roomState.answers.has(playerId)) continue;
    const hintUsed = roomState.hints.has(playerId);
    const hintPenalty = hintUsed ? HINT_PENALTY : 0;
    const points = -(noAnswerPenalty + hintPenalty);
    const currentScore = roomState.scores.get(playerId) ?? 0;
    roomState.scores.set(playerId, currentScore + points);
    results.push({
      playerId,
      optionId: null,
      optionLabel: noAnswerLabel,
      optionTopics: [],
      points,
      hintUsed,
      hintPenalty,
      outcome: noAnswerOutcome,
      explanation: noAnswerExplanation,
    });
  }
  const maxPoints = Math.max(...optionDetails.map((option) => option.points));
  const correctOptions = optionDetails.filter((option) => option.points === maxPoints);
  const correctOptionIds = correctOptions.map((option) => option.id);

  io.to(roomState.roomCode).emit("room:results", {
    results,
    leaderboard: serializePlayers(roomState),
    correctOptionIds,
    correctOptions,
    minPoints,
    maxPoints,
    roundsPlayed: roomState.currentRound + 1,
    maxRounds: roomState.maxRounds,
  });

  roomState.finalResults = {
    leaderboard: serializePlayers(roomState),
    roundsPlayed: roomState.currentRound + 1,
    maxRounds: roomState.maxRounds,
    results,
    correctOptionIds,
  };
  roomState.finalRecommendations = null;

  roomState.answers.clear();
  roomState.roundEndsAt = null;
  roomState.inProgress = false;

  if (roomState.currentRound + 1 >= roomState.maxRounds) {
    roomState.gameOver = true;
    io.to(roomState.roomCode).emit("room:gameover", {
      leaderboard: serializePlayers(roomState),
      roundsPlayed: roomState.currentRound + 1,
      maxRounds: roomState.maxRounds,
      results,
      correctOptionIds,
    });
  }
};

const startRound = async (roomState) => {
  if (roomState.gameOver) return;
  if (roomState.currentRound + 1 >= roomState.maxRounds) {
    roomState.gameOver = true;
    sendRoomState(roomState);
    return;
  }
  io.to(roomState.roomCode).emit("room:loading", { loading: true });
  roomState.currentRound += 1;
  roomState.inProgress = true;
  roomState.roundEndsAt = Date.now() + ROUND_SECONDS * 1000;
  roomState.answers.clear();
  roomState.hints.clear();
  if (!OPENROUTER_API_KEY) {
    roomState.inProgress = false;
    roomState.roundEndsAt = null;
    io.to(roomState.roomCode).emit("room:loading", { loading: false });
    io.to(roomState.roomCode).emit("room:error", {
      message: "Missing OPENROUTER_API_KEY. Configure the server to generate scenarios.",
    });
    return;
  }
  const scenario = await generateScenarioFromOpenRouter(roomState.language);
  if (!scenario) {
    roomState.inProgress = false;
    roomState.roundEndsAt = null;
    io.to(roomState.roomCode).emit("room:loading", { loading: false });
    io.to(roomState.roomCode).emit("room:error", {
      message: "Failed to generate a scenario. Please try again.",
    });
    return;
  }
  roomState.currentScenario = scenario;
  sendRoomState(roomState);
  io.to(roomState.roomCode).emit("room:loading", { loading: false });

  setTimeout(() => {
    if (Date.now() >= roomState.roundEndsAt) {
      endRound(roomState);
      sendRoomState(roomState);
    }
  }, ROUND_SECONDS * 1000 + 200);
};

io.on("connection", (socket) => {
  socket.on("room:join", ({ roomCode, name }) => {
    if (!roomCode || !name) return;
    const trimmedName = name.trim().slice(0, 24);
    if (!trimmedName) return;

    let roomState = rooms.get(roomCode);
    if (!roomState) {
      roomState = createRoomState(roomCode);
      rooms.set(roomCode, roomState);
    }

    if (roomState.players.size >= MAX_PLAYERS) {
      socket.emit("room:error", { message: "Room is full." });
      return;
    }

    roomState.players.set(socket.id, { id: socket.id, name: trimmedName });
    roomState.scores.set(socket.id, roomState.scores.get(socket.id) ?? 0);

    if (!roomState.hostId) {
      roomState.hostId = socket.id;
    }

    socket.join(roomCode);
    sendRoomState(roomState);
  });

  socket.on("room:start", async ({ roomCode }) => {
    const roomState = rooms.get(roomCode);
    if (!roomState || roomState.hostId !== socket.id) return;
    await startRound(roomState);
  });

  socket.on("room:next", async ({ roomCode }) => {
    const roomState = rooms.get(roomCode);
    if (!roomState || roomState.hostId !== socket.id) return;
    await startRound(roomState);
  });

  socket.on("player:hint", ({ roomCode }) => {
    const roomState = rooms.get(roomCode);
    if (!roomState || !roomState.inProgress) return;
    if (!roomState.currentScenario?.hint) return;
    if (roomState.hints.has(socket.id)) return;
    roomState.hints.add(socket.id);
    socket.emit("player:hint", {
      hint: roomState.currentScenario.hint,
      penalty: HINT_PENALTY,
    });
  });

  socket.on("player:answer", ({ roomCode, optionId }) => {
    const roomState = rooms.get(roomCode);
    if (!roomState || !roomState.inProgress) return;
    if (roomState.answers.has(socket.id)) return;
    if (Date.now() > roomState.roundEndsAt) return;

    roomState.answers.set(socket.id, optionId);

    io.to(roomCode).emit("room:answer", {
      playerId: socket.id,
      optionId,
    });

    if (roomState.answers.size === roomState.players.size) {
      endRound(roomState);
      sendRoomState(roomState);
    }
  });

  socket.on("room:reset", ({ roomCode }) => {
    const roomState = rooms.get(roomCode);
    if (!roomState || roomState.hostId !== socket.id) return;
    roomState.currentRound = -1;
    roomState.inProgress = false;
    roomState.roundEndsAt = null;
    roomState.answers.clear();
    roomState.hints.clear();
    roomState.gameOver = false;
    roomState.currentScenario = null;
    roomState.finalResults = null;
    roomState.finalRecommendations = null;
    roomState.scenarioOrder = shuffleArray(
      scenarios.map((_, index) => index)
    );
    roomState.scenarioIndex = -1;
    for (const playerId of roomState.scores.keys()) {
      roomState.scores.set(playerId, 0);
    }
    sendRoomState(roomState);
    io.to(roomState.roomCode).emit("room:reset", {
      roomCode: roomState.roomCode,
      message: "reset",
    });
  });

  socket.on("room:showScoreboard", async ({ roomCode }) => {
    const roomState = rooms.get(roomCode);
    if (!roomState || roomState.hostId !== socket.id) return;
    if (!roomState.finalResults) return;
    io.to(roomState.roomCode).emit("room:recommendationsLoading", { loading: true });
    if (!OPENROUTER_API_KEY) {
      io.to(roomState.roomCode).emit("room:recommendationsLoading", { loading: false });
      io.to(roomState.roomCode).emit("room:error", {
        message: "Missing OPENROUTER_API_KEY. Configure the server to generate recommendations.",
      });
      return;
    }
    if (!roomState.finalRecommendations) {
      roomState.finalRecommendations = await generateRecommendationsFromOpenRouter(
        roomState.finalResults.leaderboard,
        roomState.finalResults.results,
        roomState.finalResults.correctOptionIds,
        roomState.finalResults.roundsPlayed,
        roomState.language
      );
    }
    if (!roomState.finalRecommendations) {
      io.to(roomState.roomCode).emit("room:recommendationsLoading", { loading: false });
      io.to(roomState.roomCode).emit("room:error", {
        message: "Failed to generate recommendations. Please try again.",
      });
      return;
    }
    io.to(roomState.roomCode).emit("room:showScoreboard", {
      ...roomState.finalResults,
      recommendations: roomState.finalRecommendations,
    });
    io.to(roomState.roomCode).emit("room:recommendationsLoading", { loading: false });
  });

  socket.on("disconnect", () => {
    for (const [roomCode, roomState] of rooms.entries()) {
      if (!roomState.players.has(socket.id)) continue;
      roomState.players.delete(socket.id);
      roomState.scores.delete(socket.id);
      roomState.answers.delete(socket.id);

      if (roomState.hostId === socket.id) {
        const remainingPlayers = Array.from(roomState.players.keys());
        roomState.hostId = remainingPlayers[0] ?? null;
        if (roomState.hostId) {
          io.to(roomState.roomCode).emit("room:hostChanged", {
            hostId: roomState.hostId,
          });
        }
      }

      if (roomState.players.size === 0) {
        rooms.delete(roomCode);
      } else {
        sendRoomState(roomState);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
