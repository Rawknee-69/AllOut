import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  FileText,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Flashcard, StudyMaterial } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";

export default function Flashcards() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [generateCount, setGenerateCount] = useState("10");

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

  const { data: flashcards, isLoading: flashcardsLoading } = useQuery<Flashcard[]>({
    queryKey: ["/api/flashcards", selectedMaterial],
    queryFn: async () => {
      const url = selectedMaterial 
        ? `/api/flashcards?materialId=${selectedMaterial}`
        : "/api/flashcards";
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch flashcards");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMaterial) throw new Error("No material selected");
      return await apiRequest("POST", "/api/flashcards/generate", {
        materialId: selectedMaterial,
        count: parseInt(generateCount),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flashcards", selectedMaterial] });
      toast({
        title: "Success",
        description: "Flashcards generated successfully!",
      });
      setCurrentCardIndex(0);
      setIsFlipped(false);
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
        description: error.message || "Failed to generate flashcards",
        variant: "destructive",
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/flashcards", {
        materialId: selectedMaterial,
        question: newQuestion,
        answer: newAnswer,
        isAIGenerated: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flashcards", selectedMaterial] });
      toast({
        title: "Success",
        description: "Flashcard created successfully!",
      });
      setIsCreateDialogOpen(false);
      setNewQuestion("");
      setNewAnswer("");
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
        description: error.message || "Failed to create flashcard",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/flashcards/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flashcards", selectedMaterial] });
      toast({
        title: "Deleted",
        description: "Flashcard deleted successfully",
      });
      if (currentCardIndex >= (flashcards?.length || 0) - 1) {
        setCurrentCardIndex(Math.max(0, (flashcards?.length || 0) - 2));
      }
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
        description: error.message || "Failed to delete flashcard",
        variant: "destructive",
      });
    },
  });

  const handleFlip = () => setIsFlipped(!isFlipped);
  
  const handleNext = () => {
    if (flashcards && currentCardIndex < flashcards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setIsFlipped(false);
    }
  };
  
  const handlePrevious = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
      setIsFlipped(false);
    }
  };

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

  const handleCreate = () => {
    if (!newQuestion.trim() || !newAnswer.trim()) {
      toast({
        title: "Incomplete Flashcard",
        description: "Please fill in both question and answer",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate();
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

  const currentCard = flashcards?.[currentCardIndex];

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-6xl">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-6 md:mb-8"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 backdrop-blur-sm">
            <FileText className="h-6 w-6 md:h-7 md:w-7 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="font-heading font-bold text-2xl md:text-3xl" data-testid="text-flashcards-title">
              Flashcards
            </h1>
            <p className="text-muted-foreground text-sm md:text-base" data-testid="text-flashcards-subtitle">
              AI-generated or create your own flashcards for effective studying
            </p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid md:grid-cols-3 gap-4 mb-6"
        >
          <div className="md:col-span-2">
            <Label className="mb-2 block text-sm font-medium">Study Material</Label>
            <Select value={selectedMaterial || ""} onValueChange={(val) => setSelectedMaterial(val || null)}>
              <SelectTrigger data-testid="select-material" className="border-2">
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
          <div>
            <Label className="mb-2 block text-sm font-medium">Number of Cards</Label>
            <Input
              type="number"
              min="5"
              max="20"
              value={generateCount}
              onChange={(e) => setGenerateCount(e.target.value)}
              data-testid="input-count"
              className="border-2"
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="flex gap-2 mb-8 flex-wrap"
        >
          <Button
            onClick={handleGenerate}
            disabled={!selectedMaterial || generateMutation.isPending}
            data-testid="button-generate"
            className="shadow-sm"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {generateMutation.isPending ? "Generating..." : "Generate with AI"}
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-create" className="shadow-sm">
                <Plus className="h-4 w-4 mr-2" />
                Create Manually
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Flashcard</DialogTitle>
                <DialogDescription>Add a new flashcard manually</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="question">Question</Label>
                  <Textarea
                    id="question"
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    placeholder="Enter question..."
                    data-testid="input-question"
                  />
                </div>
                <div>
                  <Label htmlFor="answer">Answer</Label>
                  <Textarea
                    id="answer"
                    value={newAnswer}
                    onChange={(e) => setNewAnswer(e.target.value)}
                    placeholder="Enter answer..."
                    data-testid="input-answer"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-save">
                  {createMutation.isPending ? "Creating..." : "Create Flashcard"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>
      </motion.div>

      <AnimatePresence mode="wait">
        {flashcardsLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-12"
          >
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p className="mt-4 text-muted-foreground font-medium">Loading flashcards...</p>
          </motion.div>
        ) : flashcards && flashcards.length > 0 ? (
          <motion.div
            key="flashcards"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="max-w-4xl mx-auto"
          >
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-6 text-center"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 backdrop-blur-sm border-2">
                <span className="text-sm font-medium">
                  Card {currentCardIndex + 1} of {flashcards.length}
                </span>
              </div>
            </motion.div>
            
            <div className="perspective-1000 mb-8" style={{ perspective: "1200px" }}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${currentCard?.id}-${isFlipped}`}
                  initial={{ rotateY: isFlipped ? -180 : 0, opacity: 0, scale: 0.9 }}
                  animate={{ rotateY: 0, opacity: 1, scale: 1 }}
                  exit={{ rotateY: isFlipped ? 180 : -180, opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.7, ease: [0.43, 0.13, 0.23, 0.96] }}
                  style={{ transformStyle: "preserve-3d" }}
                  onClick={handleFlip}
                  className="cursor-pointer"
                  data-testid={`card-flashcard-${currentCard?.id}`}
                >
                  <Card className="relative p-8 md:p-12 min-h-[24rem] md:min-h-[30rem] flex items-center justify-center border-2 shadow-2xl hover-elevate bg-gradient-to-br from-card via-card to-primary/5 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/5 opacity-50"></div>
                    <div className="text-center max-w-2xl relative z-10">
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                      >
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-br border mb-6 ${
                          isFlipped 
                            ? "from-green-500/10 to-green-500/5 border-green-500/20" 
                            : "from-primary/10 to-primary/5 border-primary/20"
                        }`}>
                          <div className={`h-2 w-2 rounded-full animate-pulse ${
                            isFlipped ? "bg-green-500" : "bg-primary"
                          }`}></div>
                          <span className="text-xs font-bold uppercase tracking-wide">
                            {isFlipped ? "✓ Answer" : "? Question"}
                          </span>
                        </div>
                      </motion.div>
                      
                      <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="font-heading font-bold text-xl md:text-3xl lg:text-4xl leading-relaxed mb-6 bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text"
                      >
                        {isFlipped ? currentCard?.answer : currentCard?.question}
                      </motion.h2>
                      
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="text-sm text-muted-foreground flex items-center gap-2 justify-center"
                      >
                        <RotateCw className="h-4 w-4 animate-spin-slow" style={{ animationDuration: "3s" }} />
                        Click to flip
                      </motion.p>
                    </div>
                    
                    <div className="absolute top-4 right-4">
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        currentCard?.isAIGenerated 
                          ? "bg-gradient-to-br from-primary/20 to-primary/10 text-primary border border-primary/20" 
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {currentCard?.isAIGenerated ? "🤖 AI Generated" : "📝 Manual"}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              </AnimatePresence>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="flex flex-col sm:flex-row justify-between items-center gap-4"
            >
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentCardIndex === 0}
                data-testid="button-previous"
                className="w-full sm:w-auto shadow-sm"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleFlip}
                  data-testid="button-flip"
                  className="shadow-sm"
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => currentCard && deleteMutation.mutate(currentCard.id)}
                  disabled={deleteMutation.isPending}
                  data-testid="button-delete-current"
                  className="shadow-sm"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <Button
                variant="outline"
                onClick={handleNext}
                disabled={currentCardIndex === flashcards.length - 1}
                data-testid="button-next"
                className="w-full sm:w-auto shadow-sm"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="p-8 md:p-12 text-center border-2 border-dashed max-w-2xl mx-auto" data-testid="card-empty-state">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="inline-block p-4 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 mb-4"
              >
                <FileText className="h-12 w-12 md:h-16 md:w-16 text-primary" />
              </motion.div>
              <motion.h3
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="font-heading font-semibold text-lg md:text-xl mb-2"
              >
                No Flashcards Yet
              </motion.h3>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-muted-foreground mb-4 text-sm md:text-base"
              >
                {selectedMaterial
                  ? "Generate flashcards with AI or create them manually to get started"
                  : "Select a study material above to begin creating flashcards"}
              </motion.p>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-1 justify-center text-xs text-muted-foreground"
              >
                <div className="h-2 w-2 bg-primary rounded-full animate-pulse"></div>
                <span>Powered by AI</span>
              </motion.div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
