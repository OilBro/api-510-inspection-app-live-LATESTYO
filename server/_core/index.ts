import "dotenv/config";
import { validateEnvironment } from "./env";
validateEnvironment();
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getStorageInfo } from "../storage";
import { getDb } from "../db";

// ============================================================================
// SIMPLE IN-MEMORY RATE LIMITER (no npm dependency needed)
// ============================================================================
const RATE_WINDOW_MS = 60_000; // 1 minute window
const RATE_MAX_REQUESTS = 120;  // max requests per window per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60_000);

function rateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return next();
  }

  entry.count++;
  if (entry.count > RATE_MAX_REQUESTS) {
    res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
    return res.status(429).json({ error: 'Too many requests. Please slow down.' });
  }

  return next();
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Health check endpoint (for monitoring / load balancers)
  app.get('/health', async (_req, res) => {
    try {
      const db = await getDb();
      const dbOk = !!db;
      const storage = getStorageInfo();
      res.json({
        status: 'ok',
        uptime: process.uptime(),
        database: dbOk ? 'connected' : 'disconnected',
        storage: storage.provider,
        storageConfigured: storage.configured,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(503).json({ status: 'error', message: 'Health check failed' });
    }
  });

  // tRPC API (with rate limiting)
  app.use(
    "/api/trpc",
    rateLimiter,
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // Serve manifest.json explicitly with CORS headers to prevent OAuth proxy redirect
  app.get('/manifest.json', (_req, res) => {
    const manifestPath = process.env.NODE_ENV === 'development'
      ? path.resolve(import.meta.dirname, '../../client/public/manifest.json')
      : path.resolve(import.meta.dirname, 'public/manifest.json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/manifest+json');
    res.sendFile(manifestPath);
  });

  // Serve local storage files (for offline/local development without cloud storage)
  const localStorageDir = path.resolve(process.cwd(), 'local-storage');
  app.use('/local-storage', express.static(localStorageDir));

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
