import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, FileText, Loader2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Summary, StudyMaterial } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function Summaries() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);

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

  const { data: materials } = useQuery<StudyMaterial[]>({
    queryKey: ["/api/study-materials"],
    enabled: isAuthenticated,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<Summary | null>({
    queryKey: ["/api/summaries", selectedMaterial],
    queryFn: async () => {
      if (!selectedMaterial) return null;
      const response = await fetch(`/api/summaries?materialId=${selectedMaterial}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch summary");
      return response.json();
    },
    enabled: isAuthenticated && !!selectedMaterial,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMaterial) throw new Error("No material selected");
      return await apiRequest("POST", "/api/summaries/generate", {
        materialId: selectedMaterial,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/summaries", selectedMaterial] });
      toast({
        title: "Success",
        description: "Summary generated successfully!",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: error.message || "Failed to generate summary",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    if (!selectedMaterial) {
      toast({
        title: "No Material Selected",
        description: "Please select a study material first",
        variant: "destructive",
      });
      return;
    }
    generateMutation.mutate();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-heading font-bold text-3xl md:text-4xl mb-2" data-testid="text-summaries-title">
          AI Summaries
        </h1>
        <p className="text-muted-foreground" data-testid="text-summaries-subtitle">
          Get comprehensive AI-generated summaries of your study materials
        </p>
      </div>

      <div className="mb-8">
        <Label className="mb-2 block">Study Material</Label>
        <Select value={selectedMaterial || ""} onValueChange={(val) => setSelectedMaterial(val || null)}>
          <SelectTrigger data-testid="select-material">
            <SelectValue placeholder="Select study material" />
          </SelectTrigger>
          <SelectContent>
            {materials?.map((material) => (
              <SelectItem key={material.id} value={material.id} data-testid={`option-material-${material.id}`}>
                {material.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedMaterial && !summary && !summaryLoading && (
        <div className="mb-8">
          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            data-testid="button-generate"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {generateMutation.isPending ? "Generating..." : "Generate Summary"}
          </Button>
        </div>
      )}

      {summaryLoading ? (
        <Card className="p-12 text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading summary...</p>
        </Card>
      ) : generateMutation.isPending ? (
        <Card className="p-12 text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Generating summary with AI...</p>
          <p className="text-xs text-muted-foreground mt-2">This may take a moment</p>
        </Card>
      ) : summary ? (
        <Card className="p-8" data-testid="card-summary">
          <div className="prose prose-sm md:prose max-w-none dark:prose-invert">
            <div className="whitespace-pre-wrap">{summary.content}</div>
          </div>
          <div className="mt-6 pt-6 border-t">
            <p className="text-xs text-muted-foreground">
              Generated on {new Date(summary.createdAt).toLocaleDateString()}
            </p>
            <Button
              onClick={handleGenerate}
              variant="outline"
              className="mt-4"
              disabled={generateMutation.isPending}
              data-testid="button-regenerate"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Regenerate Summary
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-12 text-center" data-testid="card-empty-state">
          <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-heading font-semibold text-lg mb-2">No Summary Yet</h3>
          <p className="text-muted-foreground">
            {selectedMaterial
              ? "Generate a summary with AI to get started"
              : "Select a study material to create a summary"}
          </p>
        </Card>
      )}
    </div>
  );
}
