import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { IncomingMessage } from "http";
import { storage } from "./storage";
import { parse as parseCookie } from "cookie";
import { getSessionStore } from "./replitAuth";

// WebSocket message types
export interface WSMessage {
  type: string;
  sessionId: string;
  data?: any;
}

// Connected clients map: sessionId -> Set of WebSockets
const sessionClients = new Map<string, Set<WebSocket>>();

// Client to session map for cleanup
const clientSessions = new Map<WebSocket, string>();

// WebSocket to authenticated userId map
const authenticatedClients = new Map<WebSocket, string>();

export function setupCollabWebSocket(server: Server) {
  const wss = new WebSocketServer({ 
    server,
    path: "/collab-ws",
    verifyClient: async (info, callback) => {
      try {
        // Extract session cookie
        const cookies = parseCookie(info.req.headers.cookie || "");
        const sessionId = cookies["connect.sid"]?.split("s:")[1]?.split(".")[0];
        
        if (!sessionId) {
          callback(false, 401, "Unauthorized");
          return;
        }

        // Verify session
        const sessionStore = getSessionStore();
        sessionStore.get(sessionId, (err: any, session: any) => {
          if (err || !session || !session.passport?.user?.claims?.sub) {
            callback(false, 401, "Unauthorized");
            return;
          }
          
          // Session is valid
          callback(true);
        });
      } catch (error) {
        console.error("WebSocket auth error:", error);
        callback(false, 500, "Internal Server Error");
      }
    }
  });

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    console.log("New WebSocket connection established");

    // Authenticate user from session
    const cookies = parseCookie(req.headers.cookie || "");
    const sessionId = cookies["connect.sid"]?.split("s:")[1]?.split(".")[0];
    
    let authenticatedUserId: string | null = null;
    
    if (sessionId) {
      const sessionStore = getSessionStore();
      await new Promise((resolve) => {
        sessionStore.get(sessionId, (err: any, session: any) => {
          if (!err && session?.passport?.user?.claims?.sub) {
            authenticatedUserId = session.passport.user.claims.sub;
          }
          resolve(null);
        });
      });
    }

    if (!authenticatedUserId) {
      ws.close(1008, "Unauthorized");
      return;
    }

    // Store authenticated user
    authenticatedClients.set(ws, authenticatedUserId);

    ws.on("message", async (message: string) => {
      try {
        const msg: WSMessage = JSON.parse(message.toString());
        const userId = authenticatedClients.get(ws);
        
        if (!userId) {
          ws.close(1008, "Unauthorized");
          return;
        }
        
        switch (msg.type) {
          case "join":
            await handleJoin(ws, msg, userId);
            break;
          case "leave":
            await handleLeave(ws, msg, userId);
            break;
          case "tab_switch":
            await handleTabSwitch(ws, msg, userId);
            break;
          case "pause":
            await handlePause(ws, msg, userId);
            break;
          case "unpause":
            await handleUnpause(ws, msg, userId);
            break;
          case "break_start":
            await handleBreakStart(ws, msg, userId);
            break;
          case "break_end":
            await handleBreakEnd(ws, msg, userId);
            break;
          case "whiteboard_update":
            await handleWhiteboardUpdate(ws, msg, userId);
            break;
          case "mute_participant":
            await handleMuteParticipant(ws, msg, userId);
            break;
          case "kick_participant":
            await handleKickParticipant(ws, msg, userId);
            break;
          case "mute_all":
            await handleMuteAll(ws, msg, userId);
            break;
          case "concentration_toggle":
            await handleConcentrationToggle(ws, msg, userId);
            break;
          default:
            console.log("Unknown message type:", msg.type);
        }
      } catch (error) {
        console.error("Error handling WebSocket message:", error);
      }
    });

    ws.on("close", async () => {
      const userId = authenticatedClients.get(ws);
      const sessionId = clientSessions.get(ws);
      
      if (sessionId && userId) {
        // Mark participant as left
        const participant = await storage.getCollabParticipantByUserAndSession(userId, sessionId);
        if (participant) {
          await storage.removeCollabParticipant(participant.id);
        }
        
        // Clean up client maps
        const clients = sessionClients.get(sessionId);
        if (clients) {
          clients.delete(ws);
          if (clients.size === 0) {
            sessionClients.delete(sessionId);
          }
        }
        clientSessions.delete(ws);
        authenticatedClients.delete(ws);
        
        // Notify others
        broadcast(sessionId, {
          type: "participant_left",
          sessionId,
          data: { userId },
        });
      }
      console.log("WebSocket connection closed");
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
  });

  console.log("Collaboration WebSocket server initialized");
  return wss;
}

// Broadcast message to all clients in a session except sender
function broadcast(sessionId: string, message: WSMessage, sender?: WebSocket) {
  const clients = sessionClients.get(sessionId);
  if (!clients) return;

  const messageStr = JSON.stringify(message);
  clients.forEach((client) => {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

// Send message to specific client
function sendToClient(ws: WebSocket, message: WSMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

async function handleJoin(ws: WebSocket, msg: WSMessage, userId: string) {
  const { sessionId } = msg;
  
  // Verify session exists and is active
  const session = await storage.getCollabSession(sessionId);
  if (!session || !session.isActive) {
    ws.close(1008, "Session not found or inactive");
    return;
  }
  
  // Verify user is a participant in this session
  const participant = await storage.getCollabParticipantByUserAndSession(userId, sessionId);
  if (!participant) {
    ws.close(1008, "Not authorized to join this session");
    return;
  }
  
  // Add client to session
  if (!sessionClients.has(sessionId)) {
    sessionClients.set(sessionId, new Set());
  }
  sessionClients.get(sessionId)!.add(ws);
  clientSessions.set(ws, sessionId);

  // Get user info
  const user = await storage.getUser(userId);
  
  // Log join activity
  await storage.createCollabActivity({
    sessionId,
    userId,
    activityType: "join",
    metadata: { userName: user ? `${user.firstName} ${user.lastName}` : "Unknown" },
  });

  // Get all active participants
  const participants = await storage.getActiveCollabParticipantsBySession(sessionId);
  
  // Notify all other clients
  broadcast(sessionId, {
    type: "participant_joined",
    sessionId,
    data: { participant, allParticipants: participants, userId },
  }, ws);

  // Send current state to new participant
  sendToClient(ws, {
    type: "session_state",
    sessionId,
    data: { participants },
  });
}

async function handleLeave(ws: WebSocket, msg: WSMessage, userId: string) {
  const { sessionId } = msg;
  
  // Verify participant authorization (allow leave even if not found)
  const participant = await storage.getCollabParticipantByUserAndSession(userId, sessionId);
  if (participant) {
    await storage.removeCollabParticipant(participant.id);
  }

  // Log leave activity
  await storage.createCollabActivity({
    sessionId,
    userId,
    activityType: "leave",
  });

  // Remove client from session
  const clients = sessionClients.get(sessionId);
  if (clients) {
    clients.delete(ws);
    if (clients.size === 0) {
      sessionClients.delete(sessionId);
    }
  }
  clientSessions.delete(ws);

  // Notify others
  broadcast(sessionId, {
    type: "participant_left",
    sessionId,
    data: { userId },
  });
}

async function handleTabSwitch(ws: WebSocket, msg: WSMessage, userId: string) {
  const { sessionId } = msg;
  
  // Verify participant authorization
  const participant = await storage.getCollabParticipantByUserAndSession(userId, sessionId);
  if (!participant) {
    ws.close(1008, "Unauthorized");
    return;
  }
  
  if (participant) {
    await storage.updateCollabParticipant(participant.id, {
      tabSwitches: participant.tabSwitches + 1,
    });

    // Log activity
    await storage.createCollabActivity({
      sessionId,
      userId,
      activityType: "tab_switch",
      metadata: { count: participant.tabSwitches + 1 },
    });

    // Broadcast to all participants
    broadcast(sessionId, {
      type: "tab_switch",
      sessionId,
      data: { userId, count: participant.tabSwitches + 1 },
    });
  }
}

async function handlePause(ws: WebSocket, msg: WSMessage, userId: string) {
  const { sessionId } = msg;
  
  // Verify participant authorization
  const participant = await storage.getCollabParticipantByUserAndSession(userId, sessionId);
  if (!participant) {
    ws.close(1008, "Unauthorized");
    return;
  }
  
  if (participant) {
    await storage.updateCollabParticipant(participant.id, {
      pauseCount: participant.pauseCount + 1,
    });

    await storage.createCollabActivity({
      sessionId,
      userId,
      activityType: "pause",
    });

    broadcast(sessionId, {
      type: "participant_paused",
      sessionId,
      data: { userId },
    });
  }
}

async function handleUnpause(ws: WebSocket, msg: WSMessage, userId: string) {
  const { sessionId } = msg;
  
  // Verify participant authorization
  const participant = await storage.getCollabParticipantByUserAndSession(userId, sessionId);
  if (!participant) {
    ws.close(1008, "Unauthorized");
    return;
  }
  
  await storage.createCollabActivity({
    sessionId,
    userId,
    activityType: "unpause",
  });

  broadcast(sessionId, {
    type: "participant_unpaused",
    sessionId,
    data: { userId },
  });
}

async function handleBreakStart(ws: WebSocket, msg: WSMessage, userId: string) {
  const { sessionId, data } = msg;
  
  // Verify participant authorization
  const participant = await storage.getCollabParticipantByUserAndSession(userId, sessionId);
  if (!participant) {
    ws.close(1008, "Unauthorized");
    return;
  }
  
  if (participant) {
    await storage.updateCollabParticipant(participant.id, {
      isOnBreak: true,
      breakStartTime: new Date(),
    });

    await storage.createCollabActivity({
      sessionId,
      userId,
      activityType: "break_start",
      metadata: { duration: data?.duration || 0 },
    });

    // Broadcast break timer to all participants
    broadcast(sessionId, {
      type: "break_started",
      sessionId,
      data: { userId, duration: data?.duration },
    });
  }
}

async function handleBreakEnd(ws: WebSocket, msg: WSMessage, userId: string) {
  const { sessionId, data } = msg;
  
  // Verify participant authorization
  const participant = await storage.getCollabParticipantByUserAndSession(userId, sessionId);
  if (!participant) {
    ws.close(1008, "Unauthorized");
    return;
  }
  
  if (participant) {
    const breakDuration = data?.actualDuration || 0;
    await storage.updateCollabParticipant(participant.id, {
      isOnBreak: false,
      breakStartTime: null,
      breakDuration: participant.breakDuration + breakDuration,
    });

    await storage.createCollabActivity({
      sessionId,
      userId,
      activityType: "break_end",
      metadata: { duration: breakDuration },
    });

    // Notify all participants break is over
    broadcast(sessionId, {
      type: "break_ended",
      sessionId,
      data: { userId },
    });
  }
}

async function handleWhiteboardUpdate(ws: WebSocket, msg: WSMessage, userId: string) {
  const { sessionId, data } = msg;
  
  // Verify participant authorization
  const participant = await storage.getCollabParticipantByUserAndSession(userId, sessionId);
  if (!participant) {
    ws.close(1008, "Unauthorized");
    return;
  }
  
  // Broadcast whiteboard changes to all other participants
  broadcast(sessionId, {
    type: "whiteboard_update",
    sessionId,
    data: data,
  }, ws);
}

async function handleMuteParticipant(ws: WebSocket, msg: WSMessage, userId: string) {
  const { sessionId, data } = msg;
  const targetUserId = data?.targetUserId;
  
  if (!targetUserId) return;
  
  // Verify sender is participant and authorized
  const senderParticipant = await storage.getCollabParticipantByUserAndSession(userId, sessionId);
  if (!senderParticipant) {
    ws.close(1008, "Unauthorized");
    return;
  }

  const participant = await storage.getCollabParticipantByUserAndSession(targetUserId, sessionId);
  if (participant) {
    await storage.updateCollabParticipant(participant.id, {
      isMuted: !participant.isMuted,
    });

    broadcast(sessionId, {
      type: "participant_muted",
      sessionId,
      data: { targetUserId, isMuted: !participant.isMuted },
    });
  }
}

async function handleKickParticipant(ws: WebSocket, msg: WSMessage, userId: string) {
  const { sessionId, data } = msg;
  const targetUserId = data?.targetUserId;
  
  if (!targetUserId) return;
  
  // Verify sender is participant
  const senderParticipant = await storage.getCollabParticipantByUserAndSession(userId, sessionId);
  if (!senderParticipant) {
    ws.close(1008, "Unauthorized");
    return;
  }

  // Verify sender is host
  const session = await storage.getCollabSession(sessionId);
  if (session && session.hostUserId === userId) {
    const participant = await storage.getCollabParticipantByUserAndSession(targetUserId, sessionId);
    if (participant) {
      await storage.updateCollabParticipant(participant.id, {
        isBanned: true,
      });
      await storage.removeCollabParticipant(participant.id);

      broadcast(sessionId, {
        type: "participant_kicked",
        sessionId,
        data: { targetUserId },
      });
    }
  }
}

async function handleMuteAll(ws: WebSocket, msg: WSMessage, userId: string) {
  const { sessionId } = msg;
  
  // Verify sender is participant
  const senderParticipant = await storage.getCollabParticipantByUserAndSession(userId, sessionId);
  if (!senderParticipant) {
    ws.close(1008, "Unauthorized");
    return;
  }
  
  // Verify sender is host
  const session = await storage.getCollabSession(sessionId);
  if (session && session.hostUserId === userId) {
    const participants = await storage.getActiveCollabParticipantsBySession(sessionId);
    
    for (const participant of participants) {
      if (participant.userId !== userId) {
        await storage.updateCollabParticipant(participant.id, {
          isMuted: true,
        });
      }
    }

    broadcast(sessionId, {
      type: "all_muted",
      sessionId,
      data: {},
    });
  }
}

async function handleConcentrationToggle(ws: WebSocket, msg: WSMessage, userId: string) {
  const { sessionId, data } = msg;
  
  // Verify sender is participant
  const senderParticipant = await storage.getCollabParticipantByUserAndSession(userId, sessionId);
  if (!senderParticipant) {
    ws.close(1008, "Unauthorized");
    return;
  }
  
  // Verify sender is host
  const session = await storage.getCollabSession(sessionId);
  if (session && session.hostUserId === userId) {
    const newMode = data?.enabled ?? !session.concentrationMode;
    await storage.updateCollabSession(sessionId, {
      concentrationMode: newMode,
    });

    broadcast(sessionId, {
      type: "concentration_toggled",
      sessionId,
      data: { enabled: newMode },
    });
  }
}
