import { createServer } from "http";
import { createApp, log } from "./app";
import { serveStatic } from "./static";
import { storage } from "./storage";

(async () => {
  const app = await createApp();
  const httpServer = createServer(app);

  const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
  const runCleanup = async () => {
    try {
      await storage.deleteExpiredInvitations();
      await storage.deleteExpiredPasswordResets();
      log("Expired invitations and password resets cleaned up", "cleanup");
    } catch (err) {
      console.error("[cleanup] Failed to clean up expired rows:", err);
    }
  };
  setInterval(runCleanup, CLEANUP_INTERVAL_MS);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Serves both the API and the client on the port specified by the PORT
  // environment variable, defaulting to 5000.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
