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
  language: "en",
  scenarioOrder: [],
  scenarioIndex: -1,
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

const serializePlayers = (roomState) =>
  Array.from(roomState.players.values()).map((player) => ({
    id: player.id,
    name: player.name,
    score: roomState.scores.get(player.id) ?? 0,
  }));

const sendRoomState = (roomState) => {
  const scenario = getScenarioForRoom(roomState);
  io.to(roomState.roomCode).emit("room:state", {
    roomCode: roomState.roomCode,
    inProgress: roomState.inProgress,
    hostId: roomState.hostId,
    players: serializePlayers(roomState),
    currentRound: roomState.currentRound,
    roundEndsAt: roomState.roundEndsAt,
    scenario: scenario
      ? {
          id: scenario.id,
          title: scenario.locale[roomState.language].title,
          prompt: scenario.locale[roomState.language].prompt,
          options: scenario.locale[roomState.language].options.map((option) => ({
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
  const scenario = getScenarioForRoom(roomState);
  if (!scenario) {
    roomState.answers.clear();
    roomState.roundEndsAt = null;
    roomState.inProgress = false;
    return;
  }

  const results = [];

  for (const [playerId, answerId] of roomState.answers.entries()) {
    const option = scenario.locale[roomState.language].options.find(
      (opt) => opt.id === answerId
    );
    const points = option?.points ?? 0;
    const currentScore = roomState.scores.get(playerId) ?? 0;
    roomState.scores.set(playerId, currentScore + points);
    results.push({
      playerId,
      optionId: answerId,
      points,
      outcome: option?.outcome ?? "",
      explanation: option?.explanation ?? "",
    });
  }

  io.to(roomState.roomCode).emit("room:results", {
    results,
    leaderboard: serializePlayers(roomState),
  });

  roomState.answers.clear();
  roomState.roundEndsAt = null;
  roomState.inProgress = false;
};

const startRound = (roomState) => {
  roomState.currentRound += 1;
  roomState.inProgress = true;
  roomState.roundEndsAt = Date.now() + ROUND_SECONDS * 1000;
  roomState.answers.clear();
  if (!ensureScenarioOrder(roomState)) {
    roomState.inProgress = false;
    roomState.roundEndsAt = null;
    return;
  }
  roomState.scenarioIndex += 1;
  if (roomState.scenarioIndex >= roomState.scenarioOrder.length) {
    roomState.scenarioOrder = shuffleArray(
      scenarios.map((_, index) => index)
    );
    roomState.scenarioIndex = 0;
  }
  sendRoomState(roomState);

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

  socket.on("room:start", ({ roomCode }) => {
    const roomState = rooms.get(roomCode);
    if (!roomState || roomState.hostId !== socket.id) return;
    startRound(roomState);
  });

  socket.on("room:next", ({ roomCode }) => {
    const roomState = rooms.get(roomCode);
    if (!roomState || roomState.hostId !== socket.id) return;
    startRound(roomState);
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

  socket.on("room:language", ({ roomCode, language }) => {
    const roomState = rooms.get(roomCode);
    if (!roomState) return;
    if (!language || !["en", "es"].includes(language)) return;
    roomState.language = language;
    sendRoomState(roomState);
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
