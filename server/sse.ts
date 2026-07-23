import type { Request, Response } from "express";

type SSEClient = {
  id: string;
  ip: string;
  res: Response;
  role: "admin" | "teacher" | "parent";
  // For parents: their email address. Used for live DB lookup on each broadcast.
  // For admin/teacher: null (they see all events).
  parentEmail: string | null;
};

const clients: SSEClient[] = [];
let clientIdCounter = 0;

const MAX_CONNECTIONS_GLOBAL = 100;
const MAX_CONNECTIONS_PER_IP = 5;

// Injected by routes.ts after storage is initialized.
let _getParentChildIds: ((email: string) => Promise<string[]>) | null = null;

export function configureSSE(getParentChildIds: (email: string) => Promise<string[]>) {
  _getParentChildIds = getParentChildIds;
}

export function handleSSEConnection(req: Request, res: Response) {
  const ip = req.ip ?? "unknown";

  if (clients.length >= MAX_CONNECTIONS_GLOBAL) {
    res.status(503).json({ error: "Too many SSE connections" });
    return;
  }

  const perIpCount = clients.filter((c) => c.ip === ip).length;
  if (perIpCount >= MAX_CONNECTIONS_PER_IP) {
    res.status(429).json({ error: "Too many SSE connections from this client" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  res.write(":\n\n");

  const session = req.session as {
    role?: "admin" | "teacher" | "parent";
    email?: string;
  };
  const role = session.role ?? "teacher";
  const parentEmail = role === "parent" && session.email ? session.email : null;

  const clientId = `sse-${++clientIdCounter}`;
  const client: SSEClient = { id: clientId, ip, res, role, parentEmail };
  clients.push(client);

  const heartbeat = setInterval(() => {
    res.write(":\n\n");
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    const idx = clients.indexOf(client);
    if (idx !== -1) clients.splice(idx, 1);
  });
}

/**
 * Send an event to all connected clients that are authorized to receive it.
 *
 * childId (optional): when provided, parent clients only receive the event if
 * they currently have access to that child (live DB lookup). Admin and teacher
 * clients always receive every event.
 */
export async function broadcast(event: string, data: Record<string, unknown>, childId?: string) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  // Build a map of parent email → authorized child IDs for parents in the
  // connected client list. Deduplicate emails so we only query each once.
  const parentEmails = new Set<string>();
  for (const client of clients) {
    if (client.role === "parent" && client.parentEmail) {
      parentEmails.add(client.parentEmail);
    }
  }

  const parentAccess = new Map<string, Set<string>>();
  if (childId && _getParentChildIds && parentEmails.size > 0) {
    await Promise.all(
      Array.from(parentEmails).map(async (email) => {
        try {
          const ids = await _getParentChildIds!(email);
          parentAccess.set(email, new Set(ids));
        } catch {
          // If lookup fails, deny access (safe default)
          parentAccess.set(email, new Set());
        }
      }),
    );
  }

  for (const client of clients) {
    if (client.role === "parent") {
      // Parents never receive admin/staff-only events that have no childId scope.
      // Examples: teachers created/updated/deleted, children deleted by admin.
      // These routes are gated requireAdmin on the API side, but we also suppress
      // them here so a parent SSE connection never leaks admin-domain metadata.
      if (!childId) continue;

      // For child-scoped events, check live access
      if (client.parentEmail !== null) {
        const allowed = parentAccess.get(client.parentEmail);
        if (!allowed || !allowed.has(childId)) continue;
      } else {
        // Parent with no email on record — deny all child events (safe default)
        continue;
      }
    }
    try {
      client.res.write(payload);
    } catch {
      // client disconnected, will be cleaned up on close event
    }
  }
}
