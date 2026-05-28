import 'dotenv/config';
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

function createBasicAuthMiddleware(user?: string, pass?: string) {
  if (!user || !pass) {
    return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
  }

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Protected Area"');
      return res.status(401).send('Authentication required');
    }

    const [username, password] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
    if (username === user && password === pass) {
      return next();
    }

    res.setHeader('WWW-Authenticate', 'Basic realm="Protected Area"');
    return res.status(401).send('Authentication required');
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const authMiddleware = createBasicAuthMiddleware(process.env.LAN_AUTH_USER, process.env.LAN_AUTH_PASS);

  app.use(authMiddleware);

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
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on 0.0.0.0:${PORT} (accessible via http://localhost:${PORT})`);
  });

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Fatal: Port ${PORT} is already in use. Please free port ${PORT} and restart.`);
      process.exit(1);
    }
    console.error("Server error:", error);
    process.exit(1);
  });
}

startServer();
