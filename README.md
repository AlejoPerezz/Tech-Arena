# Tech Decision Simulator

A lightweight multiplayer decision-making game for technical teams. The app is optimized for Render's free tier and supports up to 10 concurrent players per room.

## Local development

```bash
npm install
export OPENROUTER_API_KEY=your_key_here
npm run dev
```

Visit `http://localhost:3000`. Enter any room code; the first player creates the room.

## Scenario updates

Edit `data/scenarios.json`. The server hot-reloads changes automatically.

## OpenRouter integration

Set `OPENROUTER_API_KEY` to enable OpenRouter-powered scenarios and final recommendations. You can also override the default model with `OPENROUTER_MODEL` (defaults to `openai/gpt-4o-mini`). Optionally provide `OPENROUTER_SITE_URL` and `OPENROUTER_APP_NAME` for OpenRouter analytics. The server requires the API key to generate questions and recommendations.

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
