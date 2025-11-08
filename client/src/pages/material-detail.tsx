import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Download, FileText, Volume2, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface StudyMaterial {
  id: string;
  userId: string;
  title: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  uploadedAt: string;
}

interface Summary {
  id: string;
  userId: string;
  materialId: string;
  content: string;
  audioUrl: string | null;
  createdAt: string;
}

export default function MaterialDetail() {
  const { id } = useParams();
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

  const { data: material, isLoading } = useQuery<StudyMaterial>({
    queryKey: ["/api/study-materials", id],
    enabled: isAuthenticated && !!id,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<Summary>({
    queryKey: ["/api/summaries", "material", id],
    queryFn: async () => {
      const response = await fetch(`/api/summaries?materialId=${id}`, {
        credentials: "include",
      });
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error("Failed to fetch summary");
      }
      return response.json();
    },
    enabled: isAuthenticated && !!id,
  });

  const generateAudioMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/summaries/generate", {
        materialId: id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/summaries", "material", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/summaries"] });
      toast({
        title: "Success",
        description: "Audio summary generated successfully! You can now listen to it below.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate audio summary",
        variant: "destructive",
      });
    },
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  const handleDownload = () => {
    if (material?.fileUrl) {
      window.open(material.fileUrl, "_blank");
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="mt-4 text-muted-foreground" data-testid="text-loading">Loading...</p>
        </div>
      </div>
    );
  }

  if (!material) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-12 text-center">
          <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-heading font-semibold text-xl mb-2" data-testid="text-not-found">Material Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The study material you're looking for doesn't exist or has been deleted.
          </p>
          <Button asChild data-testid="button-back-to-materials">
            <Link href="/materials">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Materials
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button variant="ghost" asChild data-testid="button-back">
          <Link href="/materials">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Materials
          </Link>
        </Button>
      </div>

      <Card className="p-6 mb-6" data-testid="card-material-info">
        <div className="flex items-start gap-4 mb-4">
          <FileText className="h-12 w-12 text-primary flex-shrink-0" />
          <div className="flex-1">
            <h1 className="font-heading font-bold text-2xl md:text-3xl mb-2" data-testid="text-material-title">
              {material.title}
            </h1>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span data-testid="text-filename">{material.fileName}</span>
              <span data-testid="text-filesize">{formatFileSize(material.fileSize)}</span>
              <span data-testid="text-uploaded-date">
                Uploaded {new Date(material.uploadedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleDownload} data-testid="button-download">
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </Card>

      {summary?.audioUrl && (
        <Card className="p-6 mb-6" data-testid="card-audio-summary">
          <div className="flex items-center gap-3 mb-4">
            <Volume2 className="h-6 w-6 text-primary" />
            <h2 className="font-heading font-semibold text-xl">Audio Summary</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Listen to an AI-generated audio explanation of this study material
          </p>
          <div className="bg-muted/50 p-4 rounded-lg" data-testid="audio-player-container">
            <audio
              controls
              className="w-full"
              data-testid="audio-player"
              src={summary.audioUrl}
            >
              Your browser does not support the audio element.
            </audio>
          </div>
        </Card>
      )}

      <Card className="p-6" data-testid="card-pdf-viewer">
        <h2 className="font-heading font-semibold text-xl mb-4">PDF Preview</h2>
        <div className="w-full" style={{ height: "600px" }}>
          <iframe
            src={material.fileUrl}
            className="w-full h-full border-0 rounded-lg"
            title={material.title}
            data-testid="iframe-pdf"
          />
        </div>
      </Card>

      <div className="mt-6 grid md:grid-cols-2 gap-4">
        <Card className="p-6">
          <h3 className="font-heading font-semibold text-lg mb-3">AI Tools</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Generate AI-powered study aids from this material
          </p>
          <div className="space-y-2">
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              onClick={() => generateAudioMutation.mutate()}
              disabled={generateAudioMutation.isPending || summaryLoading}
              data-testid="button-generate-audio"
            >
              {generateAudioMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Audio...
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4 mr-2" />
                  Generate Audio Summarization
                </>
              )}
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild data-testid="button-generate-flashcards">
              <Link href={`/flashcards?materialId=${material.id}`}>
                Generate Flashcards
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild data-testid="button-generate-quiz">
              <Link href={`/quizzes?materialId=${material.id}`}>
                Generate Quiz
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild data-testid="button-generate-summary">
              <Link href={`/summaries?materialId=${material.id}`}>
                Generate Summary
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild data-testid="button-chat">
              <Link href={`/chat?materialId=${material.id}`}>
                Chat with AI
              </Link>
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-heading font-semibold text-lg mb-3">Study Statistics</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Track your progress with this material
          </p>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Flashcards Created</span>
              <span className="font-semibold" data-testid="text-stat-flashcards">0</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Quizzes Taken</span>
              <span className="font-semibold" data-testid="text-stat-quizzes">0</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Study Sessions</span>
              <span className="font-semibold" data-testid="text-stat-sessions">0</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
