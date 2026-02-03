# Tech Decision Simulator

A lightweight multiplayer decision-making game for technical teams. The app is optimized for Render's free tier and supports up to 10 concurrent players per room.

## Local development

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`.

## Scenario updates

Edit `data/scenarios.json`. The server hot-reloads changes automatically.

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
