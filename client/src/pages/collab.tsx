import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Users, Plus, LogIn, Copy, Clock, Pause, Play, Bell, Volume2, VolumeX, UserX, Eye, EyeOff } from "lucide-react";
import type { CollabSession, CollabParticipant, User } from "@shared/schema";

interface ParticipantWithUser extends CollabParticipant {
  user?: User;
}

export default function Collab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionCode, setSessionCode] = useState("");
  const [activeSession, setActiveSession] = useState<CollabSession | null>(null);
  const [participants, setParticipants] = useState<ParticipantWithUser[]>([]);
  const [whiteboardContent, setWhiteboardContent] = useState<any>({ elements: [] });
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [breakTimeLeft, setBreakTimeLeft] = useState(0);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawColor, setDrawColor] = useState("#000000");
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch user's sessions
  const { data: mySessions } = useQuery<CollabSession[]>({
    queryKey: ["/api/collab/my-sessions"],
    enabled: !!user && !activeSession,
  });

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: async (title: string) => {
      const response = await fetch("/api/collab/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json();
    },
    onSuccess: (session: CollabSession) => {
      setActiveSession(session);
      setCreateDialogOpen(false);
      setSessionTitle("");
      connectWebSocket(session.id);
      queryClient.invalidateQueries({ queryKey: ["/api/collab/my-sessions"] });
      toast({
        title: "Session Created",
        description: `Session "${session.title}" created. Share code: ${session.sessionCode}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create session",
        variant: "destructive",
      });
    },
  });

  // Join session mutation
  const joinSessionMutation = useMutation({
    mutationFn: async (code: string) => {
      const sessionRes = await fetch(`/api/collab/sessions/code/${code}`, {
        credentials: "include",
      });
      if (!sessionRes.ok) {
        throw new Error(await sessionRes.text());
      }
      const session = await sessionRes.json();
      
      const joinRes = await fetch(`/api/collab/sessions/${session.id}/join`, {
        method: "POST",
        credentials: "include",
      });
      if (!joinRes.ok) {
        throw new Error(await joinRes.text());
      }
      
      return session;
    },
    onSuccess: (session: CollabSession) => {
      setActiveSession(session);
      setJoinDialogOpen(false);
      setSessionCode("");
      connectWebSocket(session.id);
      toast({
        title: "Joined Session",
        description: `You've joined "${session.title}"`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to join session",
        variant: "destructive",
      });
    },
  });

  // End session mutation
  const endSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(`/api/collab/sessions/${sessionId}/end`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json();
    },
    onSuccess: () => {
      disconnectWebSocket();
      setActiveSession(null);
      queryClient.invalidateQueries({ queryKey: ["/api/collab/my-sessions"] });
      toast({
        title: "Session Ended",
        description: "The session has been ended",
      });
    },
  });

  // WebSocket connection
  const connectWebSocket = (sessionId: string) => {
    if (wsRef.current) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/collab-ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", sessionId }));
      fetchParticipants(sessionId);
      fetchWhiteboard(sessionId);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      handleWebSocketMessage(msg);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
      wsRef.current = null;
    };
  };

  const disconnectWebSocket = () => {
    if (wsRef.current && activeSession) {
      wsRef.current.send(JSON.stringify({
        type: "leave",
        sessionId: activeSession.id,
      }));
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const handleWebSocketMessage = (msg: any) => {
    switch (msg.type) {
      case "participant_joined":
      case "participant_left":
      case "participant_muted":
      case "participant_kicked":
        if (activeSession) {
          fetchParticipants(activeSession.id);
        }
        break;
      case "tab_switch":
        if (msg.userId === user?.id) {
          setTabSwitchCount(msg.data.count);
        }
        break;
      case "break_started":
        setIsOnBreak(true);
        setBreakTimeLeft(msg.data.duration);
        break;
      case "break_ended":
        setIsOnBreak(false);
        setBreakTimeLeft(0);
        break;
      case "whiteboard_update":
        setWhiteboardContent(msg.data);
        renderCanvas(msg.data);
        break;
      case "concentration_toggled":
        if (activeSession) {
          setActiveSession({ ...activeSession, concentrationMode: msg.data.enabled });
        }
        break;
    }
  };

  const fetchParticipants = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/collab/sessions/${sessionId}/participants`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setParticipants(data);
      }
    } catch (error) {
      console.error("Failed to fetch participants:", error);
    }
  };

  const fetchWhiteboard = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/collab/sessions/${sessionId}/whiteboard`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setWhiteboardContent(data.content);
        renderCanvas(data.content);
      }
    } catch (error) {
      console.error("Failed to fetch whiteboard:", error);
    }
  };

  const saveWhiteboard = async (content: any) => {
    if (!activeSession) return;
    try {
      const wbRes = await fetch(`/api/collab/sessions/${activeSession.id}/whiteboard`, {
        credentials: "include",
      });
      if (wbRes.ok) {
        const whiteboard = await wbRes.json();
        await fetch(`/api/collab/whiteboards/${whiteboard.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ content }),
        });
      }
    } catch (error) {
      console.error("Failed to save whiteboard:", error);
    }
  };

  // Canvas drawing
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    setIsDrawing(true);
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const newContent = {
      ...whiteboardContent,
      elements: [...whiteboardContent.elements, { type: "path", color: drawColor, points: [{ x, y }] }],
    };
    setWhiteboardContent(newContent);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const newContent = { ...whiteboardContent };
    const lastElement = newContent.elements[newContent.elements.length - 1];
    if (lastElement && lastElement.type === "path") {
      lastElement.points.push({ x, y });
    }
    setWhiteboardContent(newContent);
    renderCanvas(newContent);
    
    // Broadcast to other participants
    if (wsRef.current && activeSession) {
      wsRef.current.send(JSON.stringify({
        type: "whiteboard_update",
        sessionId: activeSession.id,
        data: newContent,
      }));
    }
  };

  const stopDrawing = () => {
    if (isDrawing && activeSession) {
      setIsDrawing(false);
      
      // Schedule auto-save (10 seconds after drawing stops)
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveTimerRef.current = setTimeout(() => {
        saveWhiteboard(whiteboardContent);
      }, 10000);
    }
  };

  const renderCanvas = (content: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    content.elements?.forEach((element: any) => {
      if (element.type === "path" && element.points?.length > 0) {
        ctx.strokeStyle = element.color || "#000000";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(element.points[0].x, element.points[0].y);
        element.points.forEach((point: any) => {
          ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();
      }
    });
  };

  const clearCanvas = () => {
    const newContent = { elements: [] };
    setWhiteboardContent(newContent);
    renderCanvas(newContent);
    saveWhiteboard(newContent);
    
    if (wsRef.current && activeSession) {
      wsRef.current.send(JSON.stringify({
        type: "whiteboard_update",
        sessionId: activeSession.id,
        data: newContent,
      }));
    }
  };

  // Tab visibility detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && activeSession && wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: "tab_switch",
          sessionId: activeSession.id,
        }));
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [activeSession]);

  // Break timer countdown
  useEffect(() => {
    if (isOnBreak && breakTimeLeft > 0) {
      const interval = setInterval(() => {
        setBreakTimeLeft(prev => {
          if (prev <= 1) {
            setIsOnBreak(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isOnBreak, breakTimeLeft]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectWebSocket();
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const copySessionCode = () => {
    if (activeSession) {
      navigator.clipboard.writeText(activeSession.sessionCode);
      toast({
        title: "Copied!",
        description: "Session code copied to clipboard",
      });
    }
  };

  const startBreak = (minutes: number) => {
    if (wsRef.current && activeSession) {
      wsRef.current.send(JSON.stringify({
        type: "break_start",
        sessionId: activeSession.id,
        data: { duration: minutes * 60 },
      }));
    }
  };

  const toggleConcentrationMode = () => {
    if (wsRef.current && activeSession) {
      wsRef.current.send(JSON.stringify({
        type: "concentration_toggle",
        sessionId: activeSession.id,
        data: { enabled: !activeSession.concentrationMode },
      }));
    }
  };

  const kickParticipant = (targetUserId: string) => {
    if (wsRef.current && activeSession) {
      wsRef.current.send(JSON.stringify({
        type: "kick_participant",
        sessionId: activeSession.id,
        data: { targetUserId },
      }));
    }
  };

  const muteAll = () => {
    if (wsRef.current && activeSession) {
      wsRef.current.send(JSON.stringify({
        type: "mute_all",
        sessionId: activeSession.id,
      }));
    }
  };

  const isHost = activeSession && user && activeSession.hostUserId === user.id;

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-6">
          <p className="text-muted-foreground">Please log in to access collaboration features.</p>
        </Card>
      </div>
    );
  }

  if (activeSession) {
    return (
      <div className="h-full flex flex-col p-4 gap-4" data-testid="collab-active-session">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-session-title">{activeSession.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" data-testid="badge-session-code">
                Code: {activeSession.sessionCode}
              </Badge>
              <Button size="icon" variant="ghost" onClick={copySessionCode} data-testid="button-copy-code">
                <Copy className="h-4 w-4" />
              </Button>
              {isHost && (
                <Badge variant="outline" data-testid="badge-host">Host</Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {isHost && (
              <>
                <Button
                  variant="outline"
                  onClick={toggleConcentrationMode}
                  data-testid="button-toggle-concentration"
                >
                  {activeSession.concentrationMode ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                  {activeSession.concentrationMode ? "Disable" : "Enable"} Focus Mode
                </Button>
                <Button
                  variant="outline"
                  onClick={muteAll}
                  data-testid="button-mute-all"
                >
                  <VolumeX className="h-4 w-4 mr-2" />
                  Mute All
                </Button>
              </>
            )}
            <Button
              variant="destructive"
              onClick={() => endSessionMutation.mutate(activeSession.id)}
              data-testid="button-end-session"
            >
              End Session
            </Button>
          </div>
        </div>

        {/* Break Timer Alert */}
        {isOnBreak && (
          <Card className="p-4 bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              <div className="flex-1">
                <p className="font-semibold text-yellow-900 dark:text-yellow-100">Break Time</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Time remaining: {Math.floor(breakTimeLeft / 60)}:{(breakTimeLeft % 60).toString().padStart(2, '0')}
                </p>
              </div>
            </div>
          </Card>
        )}

        <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
          {/* Whiteboard */}
          <Card className="col-span-2 flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold">Collaborative Whiteboard</h2>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={drawColor}
                  onChange={(e) => setDrawColor(e.target.value)}
                  className="w-12 h-9"
                  data-testid="input-draw-color"
                />
                <Button size="sm" variant="outline" onClick={clearCanvas} data-testid="button-clear-canvas">
                  Clear
                </Button>
              </div>
            </div>
            <div className="flex-1 p-4">
              <canvas
                ref={canvasRef}
                width={800}
                height={500}
                className="border rounded-md w-full h-full cursor-crosshair bg-white dark:bg-gray-900"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                data-testid="canvas-whiteboard"
              />
            </div>
          </Card>

          {/* Participants & Controls */}
          <div className="flex flex-col gap-4">
            {/* Tab Switch Counter */}
            {activeSession.concentrationMode && (
              <Card className="p-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Your Tab Switches</p>
                  <p className="text-3xl font-bold text-primary" data-testid="text-tab-switches">{tabSwitchCount}</p>
                </div>
              </Card>
            )}

            {/* Break Timer Controls */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Break Timer</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" onClick={() => startBreak(5)} data-testid="button-break-5">
                  <Clock className="h-4 w-4 mr-1" />
                  5 min
                </Button>
                <Button size="sm" onClick={() => startBreak(10)} data-testid="button-break-10">
                  <Clock className="h-4 w-4 mr-1" />
                  10 min
                </Button>
                <Button size="sm" onClick={() => startBreak(15)} data-testid="button-break-15">
                  <Clock className="h-4 w-4 mr-1" />
                  15 min
                </Button>
                <Button size="sm" onClick={() => startBreak(20)} data-testid="button-break-20">
                  <Clock className="h-4 w-4 mr-1" />
                  20 min
                </Button>
              </div>
            </Card>

            {/* Participants List */}
            <Card className="flex-1 flex flex-col">
              <div className="p-4 border-b">
                <h3 className="font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Participants ({participants.length})
                </h3>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-2">
                  {participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between p-2 rounded-md hover-elevate"
                      data-testid={`participant-${participant.userId}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-semibold">
                            {participant.user?.firstName?.[0]}{participant.user?.lastName?.[0]}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {participant.user?.firstName} {participant.user?.lastName}
                          </p>
                          {participant.role === "host" && (
                            <Badge variant="secondary" className="text-xs">Host</Badge>
                          )}
                        </div>
                      </div>
                      {isHost && participant.userId !== user.id && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => kickParticipant(participant.userId)}
                          data-testid={`button-kick-${participant.userId}`}
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-8" data-testid="collab-lobby">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Study Collaboration</h1>
        <p className="text-muted-foreground">
          Create or join a study session with friends. Share a whiteboard, track focus, and take synchronized breaks.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Card className="p-6 cursor-pointer hover-elevate active-elevate-2" data-testid="card-create-session">
              <div className="text-center">
                <Plus className="h-12 w-12 mx-auto mb-3 text-primary" />
                <h3 className="font-semibold mb-2">Create Session</h3>
                <p className="text-sm text-muted-foreground">
                  Start a new collaboration session and invite friends
                </p>
              </div>
            </Card>
          </DialogTrigger>
          <DialogContent data-testid="dialog-create-session">
            <DialogHeader>
              <DialogTitle>Create Collaboration Session</DialogTitle>
              <DialogDescription>
                Enter a title for your study session. You'll get a code to share with friends.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="session-title">Session Title</Label>
                <Input
                  id="session-title"
                  placeholder="e.g., Math Study Group"
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  data-testid="input-session-title"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createSessionMutation.mutate(sessionTitle)}
                disabled={!sessionTitle.trim() || createSessionMutation.isPending}
                data-testid="button-create-confirm"
              >
                {createSessionMutation.isPending ? "Creating..." : "Create Session"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
          <DialogTrigger asChild>
            <Card className="p-6 cursor-pointer hover-elevate active-elevate-2" data-testid="card-join-session">
              <div className="text-center">
                <LogIn className="h-12 w-12 mx-auto mb-3 text-primary" />
                <h3 className="font-semibold mb-2">Join Session</h3>
                <p className="text-sm text-muted-foreground">
                  Enter a session code to join your friends
                </p>
              </div>
            </Card>
          </DialogTrigger>
          <DialogContent data-testid="dialog-join-session">
            <DialogHeader>
              <DialogTitle>Join Collaboration Session</DialogTitle>
              <DialogDescription>
                Enter the session code shared by your friend to join.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="session-code">Session Code</Label>
                <Input
                  id="session-code"
                  placeholder="e.g., ABC123XYZ"
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                  data-testid="input-session-code"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => joinSessionMutation.mutate(sessionCode)}
                disabled={!sessionCode.trim() || joinSessionMutation.isPending}
                data-testid="button-join-confirm"
              >
                {joinSessionMutation.isPending ? "Joining..." : "Join Session"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* My Sessions */}
      {mySessions && mySessions.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Your Recent Sessions</h2>
          <div className="space-y-2">
            {mySessions.slice(0, 5).map((session) => (
              <Card key={session.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium" data-testid={`text-session-${session.id}-title`}>{session.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {session.isActive ? (
                      <Badge variant="default">Active</Badge>
                    ) : (
                      <span>Ended {new Date(session.endedAt!).toLocaleString()}</span>
                    )}
                  </p>
                </div>
                {session.isActive && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setActiveSession(session);
                      connectWebSocket(session.id);
                    }}
                    data-testid={`button-rejoin-${session.id}`}
                  >
                    Rejoin
                  </Button>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
