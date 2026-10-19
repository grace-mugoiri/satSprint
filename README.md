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

### Shared scores and saved runs with Supabase

The browser game uses a small Node API for shared high scores, saved runs, live player progress, and leaderboard broadcasts. The API runs as a free Render web service, and Supabase provides the persistent PostgreSQL database. The Node backend creates its required tables on first start.

Create a Supabase project, then open **Connect** and select **Session pooler**. Copy its PostgreSQL connection string and replace `[YOUR-PASSWORD]` with the database password you set for the project. Use the session pooler connection because it supports IPv4 connections from Render's network. Keep the connection string private.

To provision the backend:

1. Push the repository, including `render.yaml`, to GitHub.
2. In Render, create a Blueprint from the repository. It creates only the free `satsprint-api` web service.
3. In the new service's **Environment** settings, set `DATABASE_URL` to the Supabase session pooler string. The Blueprint sets `PGSSLMODE=require` for the encrypted connection.
4. After the API deploys, set `window.SAT_SPRINT_API_BASE_URL` in `js/config.js` to the public URL Render assigns to `satsprint-api` (for example, `https://satsprint-api.onrender.com`).
5. Push that config change and wait for the existing static site to redeploy. The API allows requests from `https://satsprint.onrender.com`.

Supabase's free plan currently includes a hosted Postgres database, but free projects may pause after a period of inactivity and have plan limits. Check Supabase's [current plan details](https://supabase.com/pricing) for the latest limits.

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
