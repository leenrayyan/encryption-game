import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@signal-lock/shared";
import { registerSocketHandlers } from "./sockets.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3001);

const app = express();
app.use(cors());
app.get("/health", (_req, res) => res.json({ ok: true }));

// Serve the built client in production (single-service deploy). In dev, the
// client runs on its own Vite server, so this is skipped to avoid ENOENT noise.
if (process.env.NODE_ENV === "production") {
  const clientDist = path.resolve(__dirname, "../../client/dist");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: "*" },
});

registerSocketHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`Signal Lock server listening on :${PORT}`);
});
