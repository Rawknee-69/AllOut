import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Volume2, FileText, Calendar } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import { Link } from "wouter";

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
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="mt-4 text-muted-foreground" data-testid="text-loading">
            Loading audio library...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Volume2 className="h-8 w-8 text-primary" />
          <h1 className="font-heading font-bold text-3xl md:text-4xl" data-testid="text-audio-library-title">
            Audio Library
          </h1>
        </div>
        <p className="text-muted-foreground">
          Listen to all your AI-generated audio summaries in one place
        </p>
      </div>

      {audioSummaries.length === 0 ? (
        <Card className="p-12 text-center">
          <Volume2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-heading font-semibold text-xl mb-2" data-testid="text-no-audio">
            No Audio Summaries Yet
          </h2>
          <p className="text-muted-foreground mb-4">
            Generate audio summaries from your study materials to listen to them here.
          </p>
          <Link
            href="/materials"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover-elevate active-elevate-2 bg-primary text-primary-foreground h-9 px-4 py-2"
            data-testid="link-go-to-materials"
          >
            Go to Study Materials
          </Link>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {audioSummaries.map((summary) => (
            <Card key={summary.id} className="p-6 hover-elevate" data-testid={`card-audio-${summary.id}`}>
              <div className="flex items-start gap-3 mb-4">
                <FileText className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/materials/detail/${summary.materialId}`}
                    className="font-semibold hover:text-primary transition-colors block truncate"
                    data-testid={`link-material-${summary.id}`}
                  >
                    {getMaterialTitle(summary.materialId)}
                  </Link>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <Calendar className="h-3 w-3" />
                    <span data-testid={`text-date-${summary.id}`}>
                      {formatDate(summary.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg mb-4" data-testid={`audio-container-${summary.id}`}>
                <audio
                  controls
                  className="w-full"
                  data-testid={`audio-player-${summary.id}`}
                  src={summary.audioUrl || ""}
                  preload="metadata"
                >
                  Your browser does not support the audio element.
                </audio>
              </div>

              <div className="text-sm text-muted-foreground line-clamp-3">
                {summary.content.substring(0, 150)}...
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
