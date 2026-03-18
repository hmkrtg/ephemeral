import express from "express";
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import http from "http";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  // In-memory state for rooms
  const rooms = new Map<string, { boxA: string; boxB: string }>();

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", (roomId: string) => {
      socket.join(roomId);
      if (!rooms.has(roomId)) {
        rooms.set(roomId, { boxA: "", boxB: "" });
      }
      // Send current state to the user who just joined
      socket.emit("sync-state", rooms.get(roomId));
    });

    socket.on("update-box", ({ roomId, box, content }: { roomId: string, box: 'A' | 'B', content: string }) => {
      const roomState = rooms.get(roomId);
      if (roomState) {
        if (box === 'A') roomState.boxA = content;
        if (box === 'B') roomState.boxB = content;
        // Broadcast to others in the room
        socket.to(roomId).emit("update-box", { box, content });
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
