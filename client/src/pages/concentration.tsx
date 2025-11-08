import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Play, Square, Focus, AlertTriangle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type StudySession = {
  id: string;
  userId: string;
  startTime: string;
  endTime: string | null;
  duration: number;
  tabSwitches: number;
  timeWasted: number;
  isConcentrationMode: boolean;
};

export default function Concentration() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  
  const [isActive, setIsActive] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [timeWasted, setTimeWasted] = useState(0);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const beepIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const tabLeftTimeRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const elapsedTimeRef = useRef(0);
  const tabSwitchesRef = useRef(0);
  const timeWastedRef = useRef(0);

  const { data: sessions } = useQuery<StudySession[]>({
    queryKey: ["/api/study-sessions"],
    enabled: isAuthenticated,
  });

  const startSessionMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/study-sessions", {
        duration: 0,
        tabSwitches: 0,
        timeWasted: 0,
        isConcentrationMode: true,
      });
    },
    onSuccess: (data: any) => {
      setCurrentSessionId(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/study-sessions"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setIsActive(false);
    },
  });

  const updateSessionMutation = useMutation({
    mutationFn: async (data: { sessionId: string; duration: number; tabSwitches: number; timeWasted: number }) => {
      return await apiRequest("PATCH", `/api/study-sessions/${data.sessionId}`, {
        duration: data.duration,
        tabSwitches: data.tabSwitches,
        timeWasted: data.timeWasted,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/study-sessions"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const endSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return await apiRequest("PATCH", `/api/study-sessions/${sessionId}`, {
        duration: Math.floor(elapsedTime / 60),
        tabSwitches,
        timeWasted: Math.floor(timeWasted / 60),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/study-sessions"] });
      const focusedTime = Math.floor((elapsedTime - timeWasted) / 60);
      toast({
        title: "Session Complete!",
        description: `Focused for ${focusedTime} minutes with ${tabSwitches} interruptions.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const playBeep = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    const context = audioContextRef.current;
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = "sine";
    
    gainNode.gain.setValueAtTime(0.3, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);
    
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.5);
  };

  useEffect(() => {
    elapsedTimeRef.current = elapsedTime;
    tabSwitchesRef.current = tabSwitches;
    timeWastedRef.current = timeWasted;
  }, [elapsedTime, tabSwitches, timeWasted]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (beepIntervalRef.current) clearInterval(beepIntervalRef.current);
      if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current);
    };
  }, []);

  const startTimers = (sessionId: string) => {
    timerRef.current = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    beepIntervalRef.current = setInterval(() => {
      playBeep();
      toast({
        title: "5 Minutes Passed",
        description: "Keep focusing!",
      });
    }, 5 * 60 * 1000);

    autoSaveIntervalRef.current = setInterval(() => {
      updateSessionMutation.mutate({
        sessionId,
        duration: Math.floor(elapsedTimeRef.current / 60),
        tabSwitches: tabSwitchesRef.current,
        timeWasted: Math.floor(timeWastedRef.current / 60),
      });
    }, 30 * 1000);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabLeftTimeRef.current = Date.now();
      } else {
        if (tabLeftTimeRef.current) {
          const wastedSeconds = Math.floor((Date.now() - tabLeftTimeRef.current) / 1000);
          setTimeWasted((prev) => prev + wastedSeconds);
          setTabSwitches((prev) => prev + 1);
          
          toast({
            title: "Tab Switch Detected",
            description: `Lost focus for ${wastedSeconds} seconds. Stay concentrated!`,
            variant: "destructive",
          });
          
          tabLeftTimeRef.current = null;
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
  };

  const stopTimers = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (beepIntervalRef.current) clearInterval(beepIntervalRef.current);
    if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current);
    document.removeEventListener("visibilitychange", () => {});
  };

  const handleStart = async () => {
    setElapsedTime(0);
    setTabSwitches(0);
    setTimeWasted(0);
    
    try {
      const data: any = await startSessionMutation.mutateAsync();
      setCurrentSessionId(data.id);
      setIsActive(true);
      
      startTimers(data.id);
      
      toast({
        title: "Concentration Mode Started",
        description: "Stay focused! Beeps will sound every 5 minutes.",
      });
    } catch (error) {
      console.error("Failed to start session:", error);
    }
  };

  const handleStop = () => {
    stopTimers();
    setIsActive(false);
    
    if (currentSessionId) {
      endSessionMutation.mutate(currentSessionId);
    }
    
    setCurrentSessionId(null);
    setElapsedTime(0);
    setTabSwitches(0);
    setTimeWasted(0);
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const totalFocusTime = sessions
    ?.filter((s) => s.isConcentrationMode)
    .reduce((total, session) => total + session.duration, 0) || 0;

  const totalTabSwitches = sessions
    ?.filter((s) => s.isConcentrationMode)
    .reduce((total, session) => total + session.tabSwitches, 0) || 0;

  const focusedTime = elapsedTime - timeWasted;
  const focusPercentage = elapsedTime > 0 ? Math.floor((focusedTime / elapsedTime) * 100) : 100;

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-heading font-bold mb-2" data-testid="text-page-title">
          Concentration Mode
        </h1>
        <p className="text-muted-foreground" data-testid="text-page-description">
          Track your focus with tab-switch detection and regular beep reminders every 5 minutes.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card className="p-8">
            <div className="text-center mb-8">
              {isActive ? (
                <Badge variant="default" className="mb-4">
                  <Focus className="h-4 w-4 mr-2" />
                  Concentrating
                </Badge>
              ) : (
                <Badge variant="secondary" className="mb-4">
                  <Clock className="h-4 w-4 mr-2" />
                  Not Started
                </Badge>
              )}
              
              <div className="text-8xl font-bold font-mono mb-2" data-testid="text-timer-display">
                {formatTime(elapsedTime)}
              </div>
              
              <div className="text-sm text-muted-foreground mb-8">
                Focus Score: {focusPercentage}%
              </div>

              <div className="flex justify-center gap-4">
                {!isActive ? (
                  <Button
                    size="lg"
                    onClick={handleStart}
                    data-testid="button-start-session"
                  >
                    <Play className="h-5 w-5 mr-2" />
                    Start Concentrating
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    onClick={handleStop}
                    variant="destructive"
                    data-testid="button-end-session"
                  >
                    <Square className="h-5 w-5 mr-2" />
                    End Session
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t pt-6">
              <div className="text-center p-4 bg-muted rounded-md">
                <div className="text-2xl font-bold mb-1" data-testid="text-tab-switches">
                  {tabSwitches}
                </div>
                <div className="text-sm text-muted-foreground">Tab Switches</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-md">
                <div className="text-2xl font-bold mb-1" data-testid="text-time-wasted">
                  {Math.floor(timeWasted / 60)}m {timeWasted % 60}s
                </div>
                <div className="text-sm text-muted-foreground">Time Wasted</div>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Your Stats</h3>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Total Focus Time</div>
                <div className="text-2xl font-bold" data-testid="text-total-focus-time">
                  {Math.floor(totalFocusTime / 60)}h {totalFocusTime % 60}m
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Total Sessions</div>
                <div className="text-2xl font-bold" data-testid="text-total-sessions">
                  {sessions?.filter((s) => s.isConcentrationMode).length || 0}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Total Interruptions</div>
                <div className="text-2xl font-bold" data-testid="text-total-tab-switches">
                  {totalTabSwitches}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-warning/10 border-warning">
            <div className="flex gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <h3 className="font-semibold">How It Works</h3>
            </div>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
              <li>Beep alert every 5 minutes</li>
              <li>Tab switches are tracked</li>
              <li>Time away is recorded as wasted</li>
              <li>Build streaks with 30+ min focus</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
