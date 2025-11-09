import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Play, Pause, Square, Focus, AlertTriangle, Clock, Coffee, Target, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";

type StudySession = {
  id: string;
  userId: string;
  startTime: string;
  endTime: string | null;
  duration: number;
  tabSwitches: number;
  timeWasted: number;
  isConcentrationMode: boolean;
  pauseCount: number;
  pauseDuration: number;
  pauseReasons: Array<{ reason: string; duration: number; timestamp: string }>;
};

const PAUSE_REASONS = [
  "Bathroom break",
  "Quick snack/water",
  "Emergency call",
  "Stretching/rest",
  "Technical issue",
];

function FocusCircle({ percentage, size = 200 }: { percentage: number; size?: number }) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const gradientId = `focusGradient-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.10" />
        </linearGradient>
      </defs>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="currentColor"
        strokeWidth="10"
        fill="none"
        className="text-muted opacity-20"
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="currentColor"
        strokeWidth="10"
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className={percentage >= 70 ? "text-green-500" : percentage >= 40 ? "text-primary" : "text-destructive"}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius - 15}
        fill={`url(#${gradientId})`}
      />
    </svg>
  );
}

export default function Concentration() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [timeWasted, setTimeWasted] = useState(0);
  const [pauseDuration, setPauseDuration] = useState(0);
  const [pauseCount, setPauseCount] = useState(0);
  const [pauseReasons, setPauseReasons] = useState<Array<{ reason: string; duration: number; timestamp: string }>>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [selectedPauseReason, setSelectedPauseReason] = useState("");
  const [customPauseReason, setCustomPauseReason] = useState("");
  const [pauseStartTime, setPauseStartTime] = useState<number | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const beepIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const tabLeftTimeRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const elapsedTimeRef = useRef(0);
  const tabSwitchesRef = useRef(0);
  const timeWastedRef = useRef(0);
  const isPausedRef = useRef(false);
  const visibilityHandlerRef = useRef<(() => void) | null>(null);

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
        pauseCount: 0,
        pauseDuration: 0,
        pauseReasons: [],
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
    mutationFn: async (data: { 
      sessionId: string; 
      duration: number; 
      tabSwitches: number; 
      timeWasted: number;
      pauseCount: number;
      pauseDuration: number;
      pauseReasons: Array<{ reason: string; duration: number; timestamp: string }>;
    }) => {
      return await apiRequest("PATCH", `/api/study-sessions/${data.sessionId}`, {
        duration: data.duration,
        tabSwitches: data.tabSwitches,
        timeWasted: data.timeWasted,
        pauseCount: data.pauseCount,
        pauseDuration: data.pauseDuration,
        pauseReasons: data.pauseReasons,
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
        pauseCount,
        pauseDuration, // Send in seconds as per schema
        pauseReasons,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/study-sessions"] });
      const focusedTime = Math.floor((elapsedTime - timeWasted) / 60);
      toast({
        title: "Session Complete!",
        description: `Focused for ${focusedTime} minutes with ${tabSwitches} interruptions and ${pauseCount} breaks.`,
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
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (beepIntervalRef.current) clearInterval(beepIntervalRef.current);
      if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current);
      if (visibilityHandlerRef.current) {
        document.removeEventListener("visibilitychange", visibilityHandlerRef.current);
      }
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
        pauseCount,
        pauseDuration, // Send in seconds as per schema
        pauseReasons,
      });
    }, 30 * 1000);

    // Only track tab switches when timer is RUNNING (not paused)
    const handleVisibilityChange = () => {
      // Only track if session is active AND not paused (using ref to get current value)
      if (!isPausedRef.current) {
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
      }
    };

    visibilityHandlerRef.current = handleVisibilityChange;
    document.addEventListener("visibilitychange", handleVisibilityChange);
  };

  const stopTimers = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (beepIntervalRef.current) clearInterval(beepIntervalRef.current);
    if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current);
    if (visibilityHandlerRef.current) {
      document.removeEventListener("visibilitychange", visibilityHandlerRef.current);
      visibilityHandlerRef.current = null;
    }
  };

  const pauseTimers = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (beepIntervalRef.current) clearInterval(beepIntervalRef.current);
    if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current);
  };

  const resumeTimers = (sessionId: string) => {
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
        pauseCount,
        pauseDuration, // Send in seconds as per schema
        pauseReasons,
      });
    }, 30 * 1000);
  };

  const handleStart = async () => {
    setElapsedTime(0);
    setTabSwitches(0);
    setTimeWasted(0);
    setPauseDuration(0);
    setPauseCount(0);
    setPauseReasons([]);
    
    try {
      const data: any = await startSessionMutation.mutateAsync();
      setCurrentSessionId(data.id);
      setIsActive(true);
      setIsPaused(false);
      
      startTimers(data.id);
      
      toast({
        title: "Concentration Mode Started",
        description: "Stay focused! Beeps will sound every 5 minutes.",
      });
    } catch (error) {
      console.error("Failed to start session:", error);
    }
  };

  const handlePause = () => {
    setShowPauseDialog(true);
    setPauseStartTime(Date.now());
    setIsPaused(true);
    pauseTimers();
  };

  const handleResume = () => {
    if (pauseStartTime && currentSessionId) {
      const breakSeconds = Math.floor((Date.now() - pauseStartTime) / 1000);
      const reason = selectedPauseReason === "Other" ? customPauseReason : selectedPauseReason;
      
      const newPauseEntry = {
        reason: reason || "No reason specified",
        duration: breakSeconds,
        timestamp: new Date().toISOString(),
      };
      
      setPauseDuration((prev) => prev + breakSeconds);
      setPauseCount((prev) => prev + 1);
      setPauseReasons((prev) => [...prev, newPauseEntry]);
      
      setIsPaused(false);
      setShowPauseDialog(false);
      setSelectedPauseReason("");
      setCustomPauseReason("");
      setPauseStartTime(null);
      
      resumeTimers(currentSessionId);
      
      toast({
        title: "Break Ended",
        description: `Break duration: ${Math.floor(breakSeconds / 60)}m ${breakSeconds % 60}s`,
      });
    }
  };

  const handleStop = () => {
    stopTimers();
    setIsActive(false);
    setIsPaused(false);
    
    if (currentSessionId) {
      endSessionMutation.mutate(currentSessionId);
    }
    
    setCurrentSessionId(null);
    setElapsedTime(0);
    setTabSwitches(0);
    setTimeWasted(0);
    setPauseDuration(0);
    setPauseCount(0);
    setPauseReasons([]);
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

  const totalPauses = sessions
    ?.filter((s) => s.isConcentrationMode)
    .reduce((total, session) => total + (session.pauseCount || 0), 0) || 0;

  const focusedTime = elapsedTime - timeWasted - pauseDuration;
  const focusPercentage = elapsedTime > 0 ? Math.floor((focusedTime / elapsedTime) * 100) : 100;

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-6xl">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-6 md:mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 backdrop-blur-sm">
            <Target className="h-6 w-6 md:h-7 md:w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold" data-testid="text-page-title">
              Concentration Mode
            </h1>
            <p className="text-muted-foreground text-sm md:text-base" data-testid="text-page-description">
              Track your focus with tab-switch detection
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="lg:col-span-2"
        >
          <Card className="p-6 md:p-8 border-2">
            <div className="text-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={isPaused ? "paused" : isActive ? "active" : "idle"}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="inline-flex mb-6"
                >
                  {isPaused ? (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-br from-muted/50 to-muted/30 border border-muted">
                      <Coffee className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">☕ On Break</span>
                    </div>
                  ) : isActive ? (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                      <Focus className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">🎯 Concentrating</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-br from-muted/50 to-muted/30 border border-muted">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">⏳ Not Started</span>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
              
              <div className="relative flex justify-center mb-8">
                <FocusCircle percentage={focusPercentage} size={240} />
                <motion.div
                  key={elapsedTime}
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  className="absolute inset-0 flex flex-col items-center justify-center"
                >
                  <div className="text-5xl md:text-6xl font-bold font-mono mb-2" data-testid="text-timer-display">
                    {formatTime(elapsedTime)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Focus Score: <span className={`font-bold ${focusPercentage >= 70 ? "text-green-500" : focusPercentage >= 40 ? "text-primary" : "text-destructive"}`}>{focusPercentage}%</span>
                  </div>
                </motion.div>
              </div>

              <div className="flex flex-wrap justify-center gap-3 mb-6">
                <AnimatePresence mode="wait">
                  {!isActive ? (
                    <motion.div
                      key="start"
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                    >
                      <Button
                        size="lg"
                        onClick={handleStart}
                        data-testid="button-start-session"
                        className="shadow-lg min-w-[180px]"
                      >
                        <Play className="h-5 w-5 mr-2" />
                        Start Concentrating
                      </Button>
                    </motion.div>
                  ) : (
                    <>
                      {!isPaused ? (
                        <motion.div
                          key="pause"
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.9, opacity: 0 }}
                        >
                          <Button
                            size="lg"
                            onClick={handlePause}
                            variant="secondary"
                            data-testid="button-pause-session"
                            className="shadow-lg min-w-[140px]"
                          >
                            <Pause className="h-5 w-5 mr-2" />
                            Pause
                          </Button>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="resume"
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.9, opacity: 0 }}
                        >
                          <Button
                            size="lg"
                            onClick={handleResume}
                            data-testid="button-resume-session"
                            className="shadow-lg min-w-[140px]"
                          >
                            <Play className="h-5 w-5 mr-2" />
                            Resume
                          </Button>
                        </motion.div>
                      )}
                      <Button
                        size="lg"
                        onClick={handleStop}
                        variant="destructive"
                        data-testid="button-stop-session"
                        className="shadow-lg"
                      >
                        <Square className="h-5 w-5 mr-2" />
                        Stop
                      </Button>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4 border-t pt-6">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-center p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20"
              >
                <div className="text-xl md:text-2xl font-bold mb-1 text-primary" data-testid="text-tab-switches">
                  {tabSwitches}
                </div>
                <div className="text-xs md:text-sm text-muted-foreground">Tab Switches</div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-center p-4 rounded-xl bg-gradient-to-br from-destructive/5 to-destructive/10 border border-destructive/20"
              >
                <div className="text-xl md:text-2xl font-bold mb-1 text-destructive" data-testid="text-time-wasted">
                  {Math.floor(timeWasted / 60)}m {timeWasted % 60}s
                </div>
                <div className="text-xs md:text-sm text-muted-foreground">Time Wasted</div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-center p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20"
              >
                <div className="text-xl md:text-2xl font-bold mb-1 text-primary" data-testid="text-pause-count">
                  {pauseCount}
                </div>
                <div className="text-xs md:text-sm text-muted-foreground">Breaks Taken</div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-center p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20"
              >
                <div className="text-xl md:text-2xl font-bold mb-1 text-primary" data-testid="text-pause-duration">
                  {Math.floor(pauseDuration / 60)}m {pauseDuration % 60}s
                </div>
                <div className="text-xs md:text-sm text-muted-foreground">Break Time</div>
              </motion.div>
            </div>

            {pauseReasons.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="mt-6 border-t pt-6"
              >
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Coffee className="h-4 w-4 text-primary" />
                  Break History
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {pauseReasons.map((pause, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex justify-between items-center text-sm p-3 rounded-lg bg-gradient-to-br from-muted/50 to-muted/30 border border-muted"
                    >
                      <span className="text-muted-foreground">{pause.reason}</span>
                      <span className="font-medium text-primary">
                        {Math.floor(pause.duration / 60)}m {pause.duration % 60}s
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="space-y-6"
        >
          <Card className="p-6 border-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-semibold">Your Stats</h3>
            </div>
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
                <div className="text-xs text-muted-foreground mb-2">Total Focus Time</div>
                <div className="text-2xl md:text-3xl font-bold text-primary" data-testid="text-total-focus-time">
                  {Math.floor(totalFocusTime / 60)}h {totalFocusTime % 60}m
                </div>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
                <div className="text-xs text-muted-foreground mb-2">Total Sessions</div>
                <div className="text-2xl md:text-3xl font-bold text-primary" data-testid="text-total-sessions">
                  {sessions?.filter((s) => s.isConcentrationMode).length || 0}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-destructive/5 to-destructive/10 border border-destructive/20">
                <div className="text-xs text-muted-foreground mb-2">Total Interruptions</div>
                <div className="text-2xl md:text-3xl font-bold text-destructive" data-testid="text-total-tab-switches">
                  {totalTabSwitches}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
                <div className="text-xs text-muted-foreground mb-2">Total Breaks</div>
                <div className="text-2xl md:text-3xl font-bold text-primary" data-testid="text-total-pauses">
                  {totalPauses}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 border-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                <AlertTriangle className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-semibold">How It Works</h3>
            </div>
            <ol className="text-sm text-muted-foreground space-y-3">
              {[
                "Beep alert every 5 minutes",
                "Tab switches tracked when running",
                "Pause anytime for breaks",
                "Track all break reasons",
                "Build streaks with 30+ min focus"
              ].map((step, index) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-xs font-semibold text-primary mt-0.5">
                    {index + 1}
                  </div>
                  <span className="leading-relaxed">{step}</span>
                </motion.li>
              ))}
            </ol>
          </Card>
        </motion.div>
      </div>

      <Dialog open={showPauseDialog} onOpenChange={setShowPauseDialog}>
        <DialogContent data-testid="dialog-pause-reason">
          <DialogHeader>
            <DialogTitle>Break Time</DialogTitle>
            <DialogDescription>
              Why are you taking a break? This helps track your study patterns.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <RadioGroup value={selectedPauseReason} onValueChange={setSelectedPauseReason}>
              {PAUSE_REASONS.map((reason) => (
                <div key={reason} className="flex items-center space-x-2">
                  <RadioGroupItem value={reason} id={reason} data-testid={`radio-${reason.toLowerCase().replace(/\s+/g, '-')}`} />
                  <Label htmlFor={reason} className="cursor-pointer">{reason}</Label>
                </div>
              ))}
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Other" id="Other" data-testid="radio-other" />
                <Label htmlFor="Other" className="cursor-pointer">Other (specify below)</Label>
              </div>
            </RadioGroup>

            {selectedPauseReason === "Other" && (
              <Input
                placeholder="Enter custom reason..."
                value={customPauseReason}
                onChange={(e) => setCustomPauseReason(e.target.value)}
                data-testid="input-custom-reason"
              />
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowPauseDialog(false);
                setIsPaused(false);
                if (currentSessionId) {
                  resumeTimers(currentSessionId);
                }
              }}
              data-testid="button-cancel-pause"
            >
              Cancel
            </Button>
            <Button
              onClick={handleResume}
              disabled={!selectedPauseReason || (selectedPauseReason === "Other" && !customPauseReason)}
              data-testid="button-confirm-pause"
            >
              End Break
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
