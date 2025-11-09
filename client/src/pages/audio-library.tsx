import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Volume2, FileText, Calendar, Play, Pause, RotateCcw, VolumeX, Headphones } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState, useRef } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface Summary {
  id: string;
  userId: string;
  materialId: string;
  content: string;
  audioUrl: string | null;
  createdAt: string;
}

interface StudyMaterial {
  id: string;
  title: string;
  fileName: string;
}

// Compact Custom Audio Player for Library Cards
function CompactAudioPlayer({ audioUrl, audioId }: { audioUrl: string; audioId: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const handleRestart = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setCurrentTime(0);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-3" data-testid={`audio-container-${audioId}`}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground min-w-[38px]">
          {formatTime(currentTime)}
        </span>
        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={0.1}
          onValueChange={handleSeek}
          className="flex-1"
          data-testid={`audio-slider-${audioId}`}
        />
        <span className="text-xs font-medium text-muted-foreground min-w-[38px]">
          {formatTime(duration)}
        </span>
      </div>

      <div className="flex items-center justify-center gap-1.5">
        <Button
          size="icon"
          variant="outline"
          onClick={handleRestart}
          className="h-8 w-8"
          data-testid={`button-restart-${audioId}`}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          onClick={togglePlay}
          className="h-10 w-10"
          data-testid={`button-play-pause-${audioId}`}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 ml-0.5" />
          )}
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={toggleMute}
          className="h-8 w-8"
          data-testid={`button-mute-${audioId}`}
        >
          {isMuted ? (
            <VolumeX className="h-3.5 w-3.5" />
          ) : (
            <Volume2 className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

export default function AudioLibrary() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: summaries = [], isLoading: summariesLoading } = useQuery<Summary[]>({
    queryKey: ["/api/summaries"],
    enabled: isAuthenticated,
  });

  const { data: materials = [], isLoading: materialsLoading } = useQuery<StudyMaterial[]>({
    queryKey: ["/api/study-materials"],
    enabled: isAuthenticated,
  });

  const audioSummaries = summaries.filter((summary) => summary.audioUrl);

  const getMaterialTitle = (materialId: string) => {
    const material = materials.find((m) => m.id === materialId);
    return material?.title || "Unknown Material";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (authLoading || summariesLoading || materialsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <div className="inline-block h-12 w-12 rounded-full border-4 border-primary border-t-transparent"></div>
          </motion.div>
          <p className="mt-4 text-muted-foreground font-medium" data-testid="text-loading">
            Loading audio library...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-7xl">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-6 md:mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 backdrop-blur-sm">
            <Headphones className="h-6 w-6 md:h-7 md:w-7 text-primary" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-2xl md:text-3xl" data-testid="text-audio-library-title">
              Audio Library
            </h1>
            <p className="text-muted-foreground text-sm md:text-base">
              Listen to all your AI-generated audio summaries in one place
            </p>
          </div>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {audioSummaries.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="p-8 md:p-12 text-center border-2 border-dashed max-w-2xl mx-auto">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="inline-block p-4 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 mb-4"
              >
                <Headphones className="h-12 w-12 md:h-16 md:w-16 text-primary" />
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="font-heading font-semibold text-lg md:text-xl mb-2"
                data-testid="text-no-audio"
              >
                No Audio Summaries Yet
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-muted-foreground mb-6 text-sm md:text-base"
              >
                Generate audio summaries from your study materials to listen to them here.
              </motion.p>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <Link href="/materials">
                  <Button className="w-full sm:w-auto shadow-sm" data-testid="link-go-to-materials">
                    Go to Study Materials
                  </Button>
                </Link>
              </motion.div>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="grid gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {audioSummaries.map((summary, index) => (
              <motion.div
                key={summary.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <Card className="p-5 md:p-6 border-2 hover-elevate h-full flex flex-col" data-testid={`card-audio-${summary.id}`}>
                  <div className="flex items-start gap-3 mb-4">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex-shrink-0">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/materials/${summary.materialId}`}
                        className="font-semibold text-sm hover:text-primary transition-colors block truncate"
                        data-testid={`link-material-${summary.id}`}
                      >
                        {getMaterialTitle(summary.materialId)}
                      </Link>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                        <Calendar className="h-3 w-3" />
                        <span data-testid={`text-date-${summary.id}`}>
                          {formatDate(summary.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4 p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
                    <CompactAudioPlayer audioUrl={summary.audioUrl || ""} audioId={summary.id} />
                  </div>

                  <div className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mt-auto">
                    {summary.content.substring(0, 120)}...
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
