import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Trash2, Download, BookOpen, Sparkles } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { StudyMaterial } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";

export default function Materials() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

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

  const { data: materials, isLoading } = useQuery<StudyMaterial[]>({
    queryKey: ["/api/study-materials"],
    enabled: isAuthenticated,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch("/api/study-materials/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to upload file");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/study-materials"] });
      toast({
        title: "Success",
        description: "PDF uploaded successfully!",
      });
      setSelectedFile(null);
      setIsUploading(false);
    },
    onError: (error: Error) => {
      setIsUploading(false);
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
        title: "Upload Failed",
        description: error.message || "Failed to upload PDF",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/study-materials/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/study-materials"] });
      toast({
        title: "Deleted",
        description: "Study material deleted successfully",
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
        description: error.message || "Failed to delete material",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast({
          title: "Invalid File",
          description: "Please select a PDF file",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a PDF file to upload",
        variant: "destructive",
      });
      return;
    }
    setIsUploading(true);
    uploadMutation.mutate(selectedFile);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
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
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-7xl">
      <motion.div 
        className="mb-8 md:mb-12"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <BookOpen className="h-6 w-6 md:h-8 md:w-8 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="font-heading font-bold text-2xl md:text-4xl" data-testid="text-materials-title">
              Study Materials
            </h1>
          </div>
        </div>
        <p className="text-muted-foreground text-sm md:text-base ml-14" data-testid="text-materials-subtitle">
          Upload your PDF study materials to unlock AI-powered features
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card className="p-4 md:p-8 mb-8 md:mb-12 border-2" data-testid="card-upload">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="font-heading font-semibold text-lg md:text-xl">Upload New Material</h2>
          </div>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <label
                htmlFor="pdf-upload"
                className="group relative flex flex-col items-center justify-center w-full h-40 md:h-48 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 hover:border-primary hover:bg-primary/5 overflow-visible"
                data-testid="label-upload"
              >
                <motion.div 
                  className="flex flex-col items-center justify-center"
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div className="p-3 rounded-full bg-primary/10 mb-3 group-hover:bg-primary/20 transition-colors">
                    <Upload className="h-8 w-8 md:h-10 md:w-10 text-primary" />
                  </div>
                  <p className="text-sm md:text-base font-medium text-foreground mb-1">
                    {selectedFile ? (
                      <span className="text-primary">{selectedFile.name}</span>
                    ) : (
                      "Click to upload or drag and drop"
                    )}
                  </p>
                  <p className="text-xs md:text-sm text-muted-foreground">PDF files only (max 50MB)</p>
                </motion.div>
                <input
                  id="pdf-upload"
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                  data-testid="input-file"
                />
              </label>
            </div>
            <div className="flex lg:items-end">
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                size="lg"
                className="w-full lg:w-auto"
                data-testid="button-upload"
              >
                {isUploading ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="mt-4 text-muted-foreground font-medium">Loading materials...</p>
        </div>
      ) : materials && materials.length > 0 ? (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {materials.length} {materials.length === 1 ? 'material' : 'materials'} uploaded
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            <AnimatePresence mode="popLayout">
              {materials.map((material, index) => (
                <motion.div
                  key={material.id}
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -20 }}
                  transition={{
                    duration: 0.3,
                    delay: index * 0.05,
                    ease: "easeOut"
                  }}
                  layout
                >
                  <Card
                    className="group p-5 md:p-6 hover-elevate transition-all duration-300 h-full flex flex-col border-2"
                    data-testid={`card-material-${material.id}`}
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <div className="p-2.5 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors flex-shrink-0">
                        <FileText className="h-6 w-6 md:h-7 md:w-7 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3
                          className="font-semibold text-base md:text-lg mb-1.5 truncate group-hover:text-primary transition-colors"
                          data-testid={`text-material-title-${material.id}`}
                          title={material.title}
                        >
                          {material.title}
                        </h3>
                        <div className="flex items-center gap-3 text-xs md:text-sm text-muted-foreground">
                          <span className="font-medium">{formatFileSize(material.fileSize)}</span>
                          <span>•</span>
                          <span>{new Date(material.uploadedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-auto">
                      <Button
                        size="sm"
                        variant="default"
                        className="flex-1"
                        asChild
                        data-testid={`button-view-${material.id}`}
                      >
                        <a href={`/materials/${material.id}`}>
                          <BookOpen className="h-4 w-4 mr-1.5" />
                          Open
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteMutation.mutate(material.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${material.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="p-8 md:p-12 text-center border-2 border-dashed" data-testid="card-empty-state">
            <div className="p-4 rounded-full bg-muted inline-block mb-4">
              <FileText className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground" />
            </div>
            <h3 className="font-heading font-semibold text-lg md:text-xl mb-2">No Study Materials Yet</h3>
            <p className="text-muted-foreground text-sm md:text-base mb-6 max-w-md mx-auto">
              Upload your first PDF to get started with AI-powered learning tools like flashcards, quizzes, and summaries
            </p>
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></div>
              <span>Ready to transform your study experience</span>
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
