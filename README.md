# ⚡ SAT SPRINT

A fast-paced Bitcoin-themed arcade runner where you dodge obstacles, collect sats, charge your Lightning power, and test your Bitcoin knowledge.

## 🎮 Play

**Live game:** https://satsprint.onrender.com

SAT SPRINT is designed as a browser game first, with plans to expand to mobile platforms.

## ✨ Features

- ₿ Bitcoin-themed endless runner
- 🟠 Collect sats while playing
- ⚡ Lightning charge mechanic
- 🧠 Bitcoin knowledge quizzes
- ❤️ Limited lives
- ⏱️ Life revival system
- 💾 Save and resume your run
- ⏸️ Pause your game when leaving the run
- 🏆 Score tracking
- ⚡ Developer support through Lightning
- 📱 Mobile-friendly interface
- 🌐 Play directly from a web link

## ⚡ Support the Developer

Enjoying SAT SPRINT?

You can support development using Lightning:

**Lightning Address:** `mugoiri@blink.sv`

Every sat helps support continued development of the game. 🧡

## 🕹️ How to Play

1. Start a run.
2. Move your character to avoid obstacles.
3. Collect Bitcoin and satoshi rewards.
4. Build your Lightning charge.
5. Answer Bitcoin quiz questions.
6. Keep your run going and beat your high score.

### ❤️ Lives

Players have a limited number of lives.

When you run out of lives, you can wait for a revival before continuing.

## 💾 Save & Resume

SAT SPRINT saves your active run when you pause or open the developer-support screen.

Your progress can be resumed instead of losing the current run.

## 🛠️ Built With

- HTML5
- CSS3
- JavaScript
- Lightning Network
- Git & GitHub
- Render

## 🚀 Running Locally
Purely for educational purposes.

### Frontend
Open `index.html` in a browser or serve the project folder from a simple static server.

### Shared scores and saved runs on Render

The browser game can use a shared backend for high scores, saved runs, live player progress, and leaderboard broadcasts. The Render setup is described in `render.yaml`: it creates a small Node web service and a PostgreSQL database. PostgreSQL is required for scores to survive service restarts; Render's free Postgres expires after 30 days, so the Blueprint selects a paid database plan.

After the API service is created, set `window.SAT_SPRINT_API_BASE_URL` in `js/config.js` to the public URL Render assigns to the `satsprint-api` service. The API allows requests from the existing game site at `https://satsprint.onrender.com`.

To provision the backend:

1. Push the repository, including `render.yaml`, to GitHub.
2. Open the Render Blueprint page for this repository and review the listed services and database price.
3. Add billing information to the Render workspace if prompted, then apply the Blueprint to create the API and database.
4. Set `js/config.js` to the API URL Render shows, commit and push that change, and wait for the existing static site to redeploy.

The Node backend still supports local JSON-file persistence when `DATABASE_URL` is not set. To run it locally:

1. Change to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Open `http://localhost:3000` in a browser.

The backend serves `index.html` and the `js/` assets automatically, while exposing:
- `GET /api/high-scores`
- `POST /api/high-scores`
- `GET /api/run-snapshots`
- `POST /api/run-snapshot`

Additional helpful endpoints for real-time testing:
- `GET /api/active-players` — returns currently connected players (for diagnostics).

Testing across devices (LAN or internet):

- LAN: start the backend bound to all interfaces and use your machine IP. Example:
   ```bash
   cd backend
   BIND_ADDR=0.0.0.0 npm start
   ```
   Then in another device's browser set the WS URL before loading the game:
   ```js
   window.SAT_SPRINT_WS_URL = 'ws://<SERVER_IP>:3000/ws'
   location.reload();
   ```

- Quick internet tunnel: use `ngrok` to expose your local port (good for remote testing):
   ```bash
   ngrok http 3000
   ```
   Then use the provided HTTPS host and set `window.SAT_SPRINT_WS_URL` to `wss://<NGROK_HOST>/ws` and reload the page on each device.

Security note: these are development convenience steps. For production, host the backend on a secure public host with TLS and proper authentication.

Admin cleanup (remove test data)

You can remove test entries remotely using the admin cleanup endpoint. First set an admin token in the environment on the server:

```bash
export ADMIN_TOKEN="your-secret-token"
BIND_ADDR=0.0.0.0 npm start
```

Then call the cleanup endpoint from a trusted machine:

```bash
curl -X POST https://<SERVER>/api/high-scores/cleanup -H "Content-Type: application/json" -d '{"mode":"remove-test"}' -H "x-admin-token: your-secret-token"
```

Use `mode: clear-all` to wipe the leaderboard (be careful).
