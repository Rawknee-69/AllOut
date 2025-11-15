import "dotenv/config";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import express from "express";
import { createServer } from "http";
import { registerRoutes } from "../server/routes";
import { serveStatic } from "../server/vite";

// Create Express app
const app = express();

// Middleware
app.use(express.json({
  verify: (req, _res, buf) => {
    (req as any).rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      console.log(logLine);
    }
  });

  next();
});

// Initialize app (singleton pattern for serverless)
let appInitialized = false;

async function initializeApp() {
  if (appInitialized) {
    return app;
  }

  // Create HTTP server (needed for registerRoutes, but WebSocket won't work on Vercel)
  const httpServer = createServer(app);
  
  // Register routes (WebSocket setup will fail gracefully on Vercel)
  try {
    await registerRoutes(app);
  } catch (error: any) {
    // WebSocket setup might fail on Vercel, that's okay
    if (!error.message?.includes("WebSocket")) {
      console.error("Error initializing routes:", error);
    }
  }
  
  // Serve static files in production
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  }
  
  // Error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });
  
  appInitialized = true;
  return app;
}

// Vercel serverless function handler
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const expressApp = await initializeApp();
  
  // Use @vercel/node's helper to convert Express app to Vercel handler
  // For now, we'll handle it manually
  return new Promise<void>((resolve) => {
    // Convert Vercel request to Express-compatible format
    const expressReq = {
      ...req,
      method: req.method || "GET",
      url: req.url || "/",
      originalUrl: req.url || "/",
      path: req.url?.split("?")[0] || "/",
      query: req.query || {},
      body: req.body,
      headers: req.headers,
      get: (name: string) => req.headers[name.toLowerCase()],
    } as any;
    
    // Convert Vercel response to Express-compatible format
    const expressRes = {
      ...res,
      status: (code: number) => {
        res.status(code);
        return expressRes;
      },
      json: (body: any) => {
        res.json(body);
        resolve();
        return expressRes;
      },
      send: (body: any) => {
        res.send(body);
        resolve();
        return expressRes;
      },
      setHeader: (name: string, value: string) => {
        res.setHeader(name, value);
        return expressRes;
      },
      headersSent: res.headersSent || false,
      on: (event: string, callback: () => void) => {
        if (event === "finish") {
          // Response will be finished when we call resolve
        }
        return expressRes;
      },
    } as any;
    
    // Handle the request with Express
    expressApp(expressReq, expressRes, () => {
      if (!expressRes.headersSent) {
        expressRes.status(404).json({ message: "Not found" });
      }
      resolve();
    });
  });
}

