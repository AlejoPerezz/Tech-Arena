# Tech Decision Simulator

A lightweight multiplayer decision-making game for technical teams. The app is optimized for Render's free tier and supports up to 10 concurrent players per room.

## Local development

```bash
npm install
export GEMINI_API_KEY=your_key_here
npm run dev
```

Visit `http://localhost:3000`. Enter any room code; the first player creates the room.

## Scenario updates

Edit `data/scenarios.json`. The server hot-reloads changes automatically.

## Gemini integration

Set `GEMINI_API_KEY` to enable Gemini-powered scenarios and final recommendations. You can also override the default model with `GEMINI_MODEL` (defaults to `gemini-1.5-flash`). If the key is not set, the server falls back to `data/scenarios.json` and the built-in recommendation logic.

## Tests

```bash
npm run test
```

## Deploy to Render

- Connect the repo to Render.
- Select **Free** plan.
- Use the included `render.yaml` or set:
  - Build command: `npm install`
  - Start command: `npm start`

The app will run on the port provided by Render.
