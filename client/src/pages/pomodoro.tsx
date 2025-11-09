import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Play, Pause, RotateCcw, Settings, Clock, Timer, TrendingUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";

type PomodoroSession = {
  id: string;
  userId: string;
  workDuration: number;
  breakDuration: number;
  completedCycles: number;
  createdAt: string;
};

type TimerState = "idle" | "work" | "break";

// Circular Progress Component
function CircularProgress({ 
  progress, 
  size = 280, 
  strokeWidth = 12,
  state 
}: { 
  progress: number; 
  size?: number; 
  strokeWidth?: number;
  state: TimerState;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  const getStateColors = () => {
    switch (state) {
      case "work":
        return {
          bg: "stroke-primary/10",
          fg: "stroke-primary",
          gradient: "from-primary/20 to-primary/5"
        };
      case "break":
        return {
          bg: "stroke-green-500/10",
          fg: "stroke-green-500",
          gradient: "from-green-500/20 to-green-500/5"
        };
      default:
        return {
          bg: "stroke-muted",
          fg: "stroke-primary/50",
          gradient: "from-primary/10 to-primary/5"
        };
    }
  };

  const colors = getStateColors();

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={colors.bg}
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={colors.fg}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />
      </svg>
      <div className={`absolute inset-0 flex items-center justify-center rounded-full bg-gradient-to-br ${colors.gradient} m-4`} />
    </div>
  );
}

export default function Pomodoro() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  
  const [workDuration, setWorkDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [timerState, setTimerState] = useState<TimerState>("idle");
  const [timeLeft, setTimeLeft] = useState(workDuration * 60);
  const [completedCycles, setCompletedCycles] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const notificationPermissionRef = useRef<NotificationPermission | null>(null);

  const { data: sessions } = useQuery<PomodoroSession[]>({
    queryKey: ["/api/pomodoro-sessions"],
    enabled: isAuthenticated,
  });

  const createSessionMutation = useMutation({
    mutationFn: async (data: { workDuration: number; breakDuration: number; completedCycles: number }) => {
      return await apiRequest("POST", "/api/pomodoro-sessions", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pomodoro-sessions"] });
      toast({
        title: "Session Saved",
        description: `Completed ${completedCycles} cycle${completedCycles !== 1 ? 's' : ''}!`,
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

  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission().then((permission) => {
        notificationPermissionRef.current = permission;
      });
    }
  }, []);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning, timerState]);

  const showNotification = (title: string, body: string) => {
    if (notificationPermissionRef.current === "granted") {
      new Notification(title, { body, icon: "/favicon.ico" });
    }
  };

  const handleTimerComplete = () => {
    setIsRunning(false);
    
    if (timerState === "work") {
      const newCycles = completedCycles + 1;
      setCompletedCycles(newCycles);
      
      createSessionMutation.mutate({
        workDuration,
        breakDuration,
        completedCycles: 1,
      });
      
      setTimerState("break");
      setTimeLeft(breakDuration * 60);
      showNotification("Work Session Complete!", "Great job! Time for a break.");
      toast({
        title: "Work Session Complete!",
        description: "Time for a break",
      });
    } else if (timerState === "break") {
      setTimerState("work");
      setTimeLeft(workDuration * 60);
      showNotification("Break Complete!", "Ready to focus again?");
      toast({
        title: "Break Complete!",
        description: "Ready for another work session?",
      });
    }
  };

  const handleStart = () => {
    if (timerState === "idle") {
      setTimerState("work");
      setTimeLeft(workDuration * 60);
    }
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimerState("idle");
    setTimeLeft(workDuration * 60);
    setCompletedCycles(0);
  };

  const handleSettingsSave = (newWork: number, newBreak: number) => {
    setWorkDuration(newWork);
    setBreakDuration(newBreak);
    
    if (timerState === "idle" || !isRunning) {
      setTimeLeft(newWork * 60);
    }
    
    setSettingsOpen(false);
    toast({
      title: "Settings Updated",
      description: `Work: ${newWork}min, Break: ${newBreak}min`,
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const totalStudyTime = sessions?.reduce((total, session) => {
    return total + (session.workDuration * session.completedCycles);
  }, 0) || 0;

  if (!user) {
    return null;
  }

  const getTotalDuration = () => {
    return timerState === "work" ? workDuration * 60 : timerState === "break" ? breakDuration * 60 : workDuration * 60;
  };

  const progress = ((getTotalDuration() - timeLeft) / getTotalDuration()) * 100;

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
            <Timer className="h-6 w-6 md:h-7 md:w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold" data-testid="text-page-title">
              Pomodoro Timer
            </h1>
            <p className="text-muted-foreground text-sm md:text-base" data-testid="text-page-description">
              Stay focused with the Pomodoro Technique
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
                  key={timerState}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-br border mb-6 ${
                    timerState === "work" 
                      ? "from-primary/10 to-primary/5 border-primary/20" 
                      : timerState === "break" 
                      ? "from-green-500/10 to-green-500/5 border-green-500/20" 
                      : "from-muted/50 to-muted/30 border-muted"
                  }`}
                >
                  <Clock className={`h-4 w-4 ${
                    timerState === "work" 
                      ? "text-primary" 
                      : timerState === "break" 
                      ? "text-green-500" 
                      : "text-muted-foreground"
                  }`} />
                  <span className="text-sm font-semibold" data-testid="text-timer-state">
                    {timerState === "idle" && "⏳ Ready to Start"}
                    {timerState === "work" && "🎯 Focus Time"}
                    {timerState === "break" && "☕ Break Time"}
                  </span>
                </motion.div>
              </AnimatePresence>
              
              <div className="relative flex justify-center mb-8">
                <CircularProgress progress={progress} size={280} strokeWidth={12} state={timerState} />
                <motion.div
                  key={timeLeft}
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  className="absolute inset-0 flex flex-col items-center justify-center"
                >
                  <div className="text-6xl md:text-7xl font-bold font-mono" data-testid="text-timer-display">
                    {formatTime(timeLeft)}
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">
                    {timerState === "work" ? "minutes of focus" : timerState === "break" ? "minutes of rest" : "ready when you are"}
                  </div>
                </motion.div>
              </div>

              <div className="flex flex-wrap justify-center gap-3 mb-6">
                <AnimatePresence mode="wait">
                  {!isRunning ? (
                    <motion.div
                      key="start"
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                    >
                      <Button
                        size="lg"
                        onClick={handleStart}
                        data-testid="button-start"
                        className="shadow-lg min-w-[140px]"
                      >
                        <Play className="h-5 w-5 mr-2" />
                        Start
                      </Button>
                    </motion.div>
                  ) : (
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
                        data-testid="button-pause"
                        className="shadow-lg min-w-[140px]"
                      >
                        <Pause className="h-5 w-5 mr-2" />
                        Pause
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <Button
                  size="lg"
                  onClick={handleReset}
                  variant="outline"
                  data-testid="button-reset"
                  className="shadow-sm"
                >
                  <RotateCcw className="h-5 w-5 mr-2" />
                  Reset
                </Button>

                <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                  <DialogTrigger asChild>
                    <Button
                      size="lg"
                      variant="ghost"
                      data-testid="button-settings"
                    >
                      <Settings className="h-5 w-5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Timer Settings</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="work-duration">Work Duration (minutes)</Label>
                        <Input
                          id="work-duration"
                          type="number"
                          min="1"
                          max="60"
                          defaultValue={workDuration}
                          data-testid="input-work-duration"
                          className="border-2"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="break-duration">Break Duration (minutes)</Label>
                        <Input
                          id="break-duration"
                          type="number"
                          min="1"
                          max="30"
                          defaultValue={breakDuration}
                          data-testid="input-break-duration"
                          className="border-2"
                        />
                      </div>
                      <Button
                        onClick={() => {
                          const workInput = document.getElementById("work-duration") as HTMLInputElement;
                          const breakInput = document.getElementById("break-duration") as HTMLInputElement;
                          handleSettingsSave(
                            parseInt(workInput.value),
                            parseInt(breakInput.value)
                          );
                        }}
                        className="w-full shadow-sm"
                        data-testid="button-save-settings"
                      >
                        Save Settings
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="border-t pt-6">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Completed Cycles Today</span>
                  <motion.span
                    key={completedCycles}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                    className="font-bold text-3xl text-primary"
                    data-testid="text-completed-cycles"
                  >
                    {completedCycles}
                  </motion.span>
                </div>
              </div>
            </div>
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
              <h3 className="font-semibold">Session Stats</h3>
            </div>
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
                <div className="text-xs text-muted-foreground mb-2">Total Study Time</div>
                <div className="text-2xl md:text-3xl font-bold text-primary" data-testid="text-total-study-time">
                  {Math.floor(totalStudyTime / 60)}h {totalStudyTime % 60}m
                </div>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
                <div className="text-xs text-muted-foreground mb-2">Total Sessions</div>
                <div className="text-2xl md:text-3xl font-bold text-primary" data-testid="text-total-sessions">
                  {sessions?.length || 0}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 border-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-semibold">How it Works</h3>
            </div>
            <ol className="text-sm text-muted-foreground space-y-3">
              {[
                "Set your work and break durations",
                "Focus during work intervals",
                "Take breaks between cycles",
                "Track your productivity over time"
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
    </div>
  );
}
