# Backend - quick start

This small README explains how to run the backend and common troubleshooting steps when the frontend shows "Network error: Failed to fetch".

Prereqs
- Node.js (v16+ recommended)
- npm

Install

1. Open a terminal in the `backend` folder.
2. Run `npm install` to install dependencies.

Run

- Start the server: `npm start` (or `npm run dev` if you have nodemon).
- The server listens on port 5000 by default (configurable with the `PORT` env var).

Environment
- You can set `MONGO_URI` in a `.env` file at the `backend` folder root. If `MONGO_URI` is not set, the server will continue running but database features won't work.
- Set `JWT_SECRET` in `.env` for login token signing.

Troubleshooting "Failed to fetch"
- Ensure the backend is running: open http://localhost:5000/ in your browser — you should see `Backend Running Successfully`.
- If the frontend is served from the filesystem (opening `Frontend/signup.html` directly), fetch to `http://localhost:5000` should still work, but ensure the browser isn't blocking mixed content or extensions.
- If you see CORS errors in the browser console, the server already uses `cors()` in `server.js` — ensure the server started after you changed code.

Serving the frontend from the backend
- The backend now serves the `Frontend` folder as static files. You can open the app at `http://localhost:5000/signup.html` which avoids cross-origin requests and common file:// restrictions.

If all else fails, check the server logs in the terminal for errors and paste them when asking for help.