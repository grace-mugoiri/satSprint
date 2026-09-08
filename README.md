# ⚡ SAT SPRINT

A fast-paced Bitcoin-themed arcade runner where you dodge obstacles, collect sats, charge your Lightning power, and test your Bitcoin knowledge.

## 🎮 Play

**Live game: 
- https://sprint.onrender.com

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

### Backend stub
A minimal backend is available in `backend/` for live high-score and saved-run sync.

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
