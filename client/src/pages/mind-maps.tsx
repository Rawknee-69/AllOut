import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Network, Loader2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { MindMap, StudyMaterial } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface MindMapNode {
  id: string;
  label: string;
  children: MindMapNode[];
}

export default function MindMaps() {
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

  const { data: mindMaps } = useQuery<MindMap[]>({
    queryKey: ["/api/mind-maps", selectedMaterial],
    queryFn: async () => {
      const url = selectedMaterial
        ? `/api/mind-maps?materialId=${selectedMaterial}`
        : "/api/mind-maps";
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch mind maps");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMaterial) throw new Error("No material selected");
      const response = await apiRequest("POST", "/api/mind-maps/generate", {
        materialId: selectedMaterial,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mind-maps", selectedMaterial] });
      toast({
        title: "Success",
        description: "Mind map generated successfully!",
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
        description: error.message || "Failed to generate mind map",
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

  const renderMindMapNode = (node: MindMapNode, level: number = 0): JSX.Element => {
    const indent = level * 24;
    const bgColor = level === 0 ? "bg-primary/10" : level === 1 ? "bg-secondary" : "bg-muted";
    
    return (
      <div key={node.id} className="mb-2">
        <div
          className={`${bgColor} p-3 rounded-md border`}
          style={{ marginLeft: `${indent}px` }}
        >
          <p className="font-medium">{node.label}</p>
        </div>
        {node.children && node.children.length > 0 && (
          <div className="mt-2">
            {node.children.map((child) => renderMindMapNode(child, level + 1))}
          </div>
        )}
      </div>
    );
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
        <h1 className="font-heading font-bold text-3xl md:text-4xl mb-2" data-testid="text-mind-maps-title">
          Mind Maps
        </h1>
        <p className="text-muted-foreground" data-testid="text-mind-maps-subtitle">
          Generate visual concept maps from your study materials
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <Card data-testid="card-generate-mind-map">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Generate Mind Map
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="material">Select Study Material</Label>
              <Select value={selectedMaterial || ""} onValueChange={setSelectedMaterial}>
                <SelectTrigger data-testid="select-material">
                  <SelectValue placeholder="Choose a material" />
                </SelectTrigger>
                <SelectContent>
                  {materials?.map((material) => (
                    <SelectItem key={material.id} value={material.id}>
                      {material.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!selectedMaterial || generateMutation.isPending}
              className="w-full"
              data-testid="button-generate-mind-map"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Mind Map
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card data-testid="card-mind-maps-list">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5 text-primary" />
              Your Mind Maps
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mindMaps && mindMaps.length > 0 ? (
              <div className="space-y-2">
                {mindMaps.map((mindMap) => (
                  <Card key={mindMap.id} className="p-4" data-testid={`card-mind-map-${mindMap.id}`}>
                    <h3 className="font-semibold mb-2">{mindMap.title}</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      Created: {new Date(mindMap.createdAt).toLocaleDateString()}
                    </p>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Network className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No mind maps yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Select a material and click generate
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedMaterial && mindMaps && mindMaps.length > 0 && (
        <div className="mt-8">
          <h2 className="font-heading font-semibold text-2xl mb-4">Mind Map View</h2>
          {mindMaps
            .filter((m) => m.materialId === selectedMaterial)
            .map((mindMap) => (
              <Card key={mindMap.id} className="p-6 mb-4" data-testid={`card-mind-map-view-${mindMap.id}`}>
                <h3 className="font-heading font-semibold text-xl mb-4">{mindMap.title}</h3>
                <div className="space-y-2">
                  {renderMindMapNode(mindMap.content as MindMapNode)}
                </div>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
