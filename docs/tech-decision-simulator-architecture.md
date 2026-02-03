# Tech Decision Simulator architecture plan

## Tech stack recommendation (Render free tier)
- **Frontend:** Vite + React + TypeScript with Tailwind CSS for a visually attractive, lightweight UI and fast development. Host as static assets served by the Node server to reduce services and keep deployment simple.
- **Backend:** Node.js (Express) for minimal overhead and wide WebSocket support.
- **Realtime:** `socket.io` for easy room management, reconnection handling, and low configuration friction on Render. Polling fallback is built-in for brief disconnects during free-tier spin down.
- **Data storage:** JSON files on disk for scenario data + in-memory game state for active sessions. Use a lightweight file watcher to reload questions on change without restart. No external DB.
- **Internationalization:** `i18next` with language bundles stored in JSON. Frontend language toggle (English/Spanish) persisted in localStorage.

## Core game mechanics
- **Lobby flow:** Players join a room (max 10). Host starts game.
- **Round structure:**
  - Round timer: 60–90 seconds per scenario.
  - All players select one decision option.
  - Server locks choices when timer ends or all have answered.
  - Server calculates scores and broadcasts results.
- **Scoring:**
  - Each option has a base point value.
  - Optional streak bonus (+2) for consecutive “best practice” choices.
  - Optional penalty (-1) for late answers to encourage quick decisions.
- **Outcome mapping:**
  - Each option includes outcome text + technical explanation.
  - Server sends a resolved outcome payload: `{ optionId, pointsAwarded, rationale }`.
- **Engagement:**
  - Show a leaderboard after each round.
  - Display a short “best practice” summary and invite discussion.

## Scenario data structure (JSON)
```json
{
  "version": 1,
  "scenarios": [
    {
      "id": "api-slow-prod",
      "locale": {
        "en": {
          "title": "Your API is slow in production",
          "prompt": "Latency spikes after a new release. What do you do first?",
          "options": [
            {
              "id": "rollback",
              "label": "Rollback the release and investigate",
              "points": 8,
              "outcome": "Latency returns to normal quickly.",
              "explanation": "Rollback reduces blast radius while you inspect regressions safely."
            },
            {
              "id": "scale",
              "label": "Add more servers immediately",
              "points": 2,
              "outcome": "Costs rise and latency improves only slightly.",
              "explanation": "Scaling might mask the problem and wastes budget if the issue is code-related."
            },
            {
              "id": "ignore",
              "label": "Wait to see if it stabilizes",
              "points": -5,
              "outcome": "Users continue to experience timeouts.",
              "explanation": "Production incidents need immediate response to protect user experience."
            }
          ]
        },
        "es": {
          "title": "Tu API es lenta en producción",
          "prompt": "La latencia se dispara tras un nuevo release. ¿Qué haces primero?",
          "options": [
            {
              "id": "rollback",
              "label": "Revertir el release e investigar",
              "points": 8,
              "outcome": "La latencia vuelve a la normalidad rápidamente.",
              "explanation": "Revertir reduce el impacto mientras investigas la regresión con seguridad."
            },
            {
              "id": "scale",
              "label": "Agregar más servidores de inmediato",
              "points": 2,
              "outcome": "Suben los costos y la latencia mejora poco.",
              "explanation": "Escalar puede ocultar el problema y desperdicia presupuesto si es un bug."
            },
            {
              "id": "ignore",
              "label": "Esperar a ver si se estabiliza",
              "points": -5,
              "outcome": "Los usuarios siguen experimentando timeouts.",
              "explanation": "Los incidentes en producción requieren respuesta inmediata."
            }
          ]
        }
      }
    },
    {
      "id": "db-locks",
      "locale": {
        "en": {
          "title": "Database writes are locking up",
          "prompt": "Write queries block reads during peak usage. What do you do?",
          "options": [
            {
              "id": "index",
              "label": "Add the missing index and test the query plan",
              "points": 7,
              "outcome": "Lock time drops and throughput improves.",
              "explanation": "Indexes reduce scan time and hold locks for a shorter window."
            },
            {
              "id": "retry",
              "label": "Add automatic retries in the app",
              "points": 1,
              "outcome": "Load increases and contention worsens.",
              "explanation": "Retries can amplify contention and should not be the first fix."
            },
            {
              "id": "maintenance",
              "label": "Take the system down for maintenance",
              "points": -3,
              "outcome": "Downtime frustrates users and delays resolution.",
              "explanation": "Maintenance should be a last resort after lightweight fixes."
            }
          ]
        },
        "es": {
          "title": "Bloqueos en escrituras de base de datos",
          "prompt": "Las escrituras bloquean las lecturas en horas pico. ¿Qué haces?",
          "options": [
            {
              "id": "index",
              "label": "Agregar el índice faltante y revisar el plan",
              "points": 7,
              "outcome": "Bajan los bloqueos y mejora el rendimiento.",
              "explanation": "Los índices reducen el tiempo de escaneo y la duración de bloqueos."
            },
            {
              "id": "retry",
              "label": "Agregar reintentos automáticos en la app",
              "points": 1,
              "outcome": "La carga sube y el bloqueo empeora.",
              "explanation": "Los reintentos pueden amplificar la contención."
            },
            {
              "id": "maintenance",
              "label": "Bajar el sistema por mantenimiento",
              "points": -3,
              "outcome": "El downtime frustra a los usuarios.",
              "explanation": "El mantenimiento es la última opción."
            }
          ]
        }
      }
    },
    {
      "id": "security-vuln",
      "locale": {
        "en": {
          "title": "Critical security vulnerability discovered",
          "prompt": "A dependency reports a critical vulnerability. What is the best move?",
          "options": [
            {
              "id": "patch",
              "label": "Patch and redeploy immediately",
              "points": 9,
              "outcome": "Risk is reduced quickly and stakeholders are informed.",
              "explanation": "Rapid patching is best practice for critical CVEs."
            },
            {
              "id": "wait",
              "label": "Wait for the next scheduled release",
              "points": -6,
              "outcome": "Exposure continues and risk remains high.",
              "explanation": "Delaying fixes for critical vulnerabilities is risky."
            },
            {
              "id": "mitigate",
              "label": "Apply a config mitigation while planning a patch",
              "points": 5,
              "outcome": "Risk is lowered while the patch is prepared.",
              "explanation": "Temporary mitigation is acceptable when a patch is in flight."
            }
          ]
        },
        "es": {
          "title": "Vulnerabilidad crítica de seguridad",
          "prompt": "Una dependencia reporta una vulnerabilidad crítica. ¿Cuál es la mejor acción?",
          "options": [
            {
              "id": "patch",
              "label": "Parchear y desplegar de inmediato",
              "points": 9,
              "outcome": "El riesgo se reduce rápido y se informa a stakeholders.",
              "explanation": "Parchear rápidamente es la mejor práctica para CVEs críticos."
            },
            {
              "id": "wait",
              "label": "Esperar al siguiente release programado",
              "points": -6,
              "outcome": "La exposición continúa y el riesgo sigue alto.",
              "explanation": "Retrasar parches críticos es peligroso."
            },
            {
              "id": "mitigate",
              "label": "Aplicar mitigación y planear el parche",
              "points": 5,
              "outcome": "El riesgo baja mientras se prepara el parche.",
              "explanation": "La mitigación temporal es válida si el parche está en camino."
            }
          ]
        }
      }
    }
  ]
}
```

## Realtime multiplayer architecture
- **Rooms and state:**
  - Each room has an in-memory state object: players, current scenario index, answers, timer, scores.
  - State is kept only for active games to minimize memory usage.
- **Sync flow:**
  - Server emits `room:state` on join/reconnect with current timer and scenario.
  - Clients submit `player:answer` events. Server validates, locks answer, and broadcasts `room:answer`.
  - On round end, server calculates scores and emits `room:results` and `room:leaderboard`.
- **Conflict resolution:**
  - First answer per player per round is accepted; later submissions rejected.
  - Late answers after lock are discarded with a client notification.
- **Latency handling:**
  - Client renders a local countdown synced to server timestamps.
  - Server uses authoritative timestamps and resends a `room:state` heartbeat every 5–10 seconds.
  - If socket drops, `socket.io` fallback polling keeps the client in sync.

## Deployment checklist (Render free tier)
1. **Repo setup**: ensure `package.json` has `build` and `start` scripts.
2. **Runtime**: Node 18+.
3. **Install**: `npm install`.
4. **Build**: `npm run build` (frontend bundled into `/dist`).
5. **Start**: `node server.js` or `npm start` (Express serves `dist` and API).
6. **Environment**: set `PORT` from Render, and `NODE_ENV=production`.
7. **WebSockets**: enable in Render settings (default for web services).
8. **Resource limits**: cap rooms to 1–3 on free tier; max 10 players per room.
9. **Spin-down handling**: display “server waking up” screen and reconnect on 503; keep reconnect logic in client.
10. **Monitoring**: log basic metrics to stdout; avoid heavy logging.

## Visual design notes
- Use a dark-themed card layout, large typography, and option buttons with hover/active states.
- Add a timer ring/progress bar and animated transitions between rounds.
- Show bilingual toggle (EN/ES) in the header with immediate refresh of text.
