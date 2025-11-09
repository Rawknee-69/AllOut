import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Play, FileText, Trophy, AlertTriangle, Target } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Quiz, QuizWithQuestions, QuizAttempt, StudyMaterial } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";

export default function Quizzes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState("10");
  const [activeQuiz, setActiveQuiz] = useState<QuizWithQuestions | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [isQuizCancelled, setIsQuizCancelled] = useState(false);
  const startTimeRef = useRef<number>(0);

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

  // Tab switch detection
  useEffect(() => {
    if (!activeQuiz || isQuizCancelled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount((prev) => prev + 1);
        setIsQuizCancelled(true);
        toast({
          title: "Quiz Cancelled",
          description: "Tab switching detected. Your quiz attempt has been cancelled.",
          variant: "destructive",
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeQuiz, isQuizCancelled, toast]);

  const { data: materials } = useQuery<StudyMaterial[]>({
    queryKey: ["/api/study-materials"],
    enabled: isAuthenticated,
  });

  const { data: quizzes } = useQuery<QuizWithQuestions[]>({
    queryKey: ["/api/quizzes", selectedMaterial],
    queryFn: async () => {
      const url = selectedMaterial 
        ? `/api/quizzes?materialId=${selectedMaterial}`
        : "/api/quizzes";
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch quizzes");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const { data: attempts } = useQuery<QuizAttempt[]>({
    queryKey: ["/api/quiz-attempts"],
    enabled: isAuthenticated,
  });

  const generateMutation = useMutation<QuizWithQuestions, Error, void>({
    mutationFn: async () => {
      if (!selectedMaterial) throw new Error("No material selected");
      const response = await apiRequest("POST", "/api/quizzes/generate", {
        materialId: selectedMaterial,
        questionCount: parseInt(questionCount),
      });
      return response.json();
    },
    onSuccess: (quiz: QuizWithQuestions) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quizzes", selectedMaterial] });
      toast({
        title: "Success",
        description: "Quiz generated successfully!",
      });
      startQuiz(quiz);
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
        description: error.message || "Failed to generate quiz",
        variant: "destructive",
      });
    },
  });

  const submitAttemptMutation = useMutation({
    mutationFn: async (attemptData: any) => {
      return await apiRequest("POST", "/api/quiz-attempts", attemptData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quiz-attempts"] });
      setActiveQuiz(null);
      setAnswers({});
      setCurrentQuestionIndex(0);
      setTabSwitchCount(0);
      setIsQuizCancelled(false);
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
        description: error.message || "Failed to submit quiz",
        variant: "destructive",
      });
    },
  });

  const startQuiz = (quiz: QuizWithQuestions) => {
    // Safety check: ensure quiz has questions array
    if (!quiz.questions || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
      toast({
        title: "Error",
        description: "This quiz has no questions",
        variant: "destructive",
      });
      return;
    }
    setActiveQuiz(quiz);
    setAnswers({});
    setCurrentQuestionIndex(0);
    setTabSwitchCount(0);
    setIsQuizCancelled(false);
    startTimeRef.current = Date.now();
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

  const handleAnswerChange = (answer: string) => {
    setAnswers({ ...answers, [currentQuestionIndex]: answer });
  };

  const handleNext = () => {
    if (currentQuestionIndex < (activeQuiz?.questions?.length || 0) - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = () => {
    if (!activeQuiz || !activeQuiz.questions || !Array.isArray(activeQuiz.questions)) return;

    if (isQuizCancelled) {
      submitAttemptMutation.mutate({
        quizId: activeQuiz.id,
        answers: {},
        score: 0,
        totalQuestions: activeQuiz.questions.length,
        correctAnswers: 0,
        timeSpentSeconds: Math.floor((Date.now() - startTimeRef.current) / 1000),
        isCancelled: true,
      });
      toast({
        title: "Quiz Cancelled",
        description: "Your attempt was cancelled due to tab switching",
        variant: "destructive",
      });
      return;
    }

    let correctCount = 0;
    activeQuiz.questions.forEach((q, index: number) => {
      if (answers[index] === q.correctAnswer) {
        correctCount++;
      }
    });

    const score = Math.round((correctCount / activeQuiz.questions.length) * 100);

    submitAttemptMutation.mutate({
      quizId: activeQuiz.id,
      answers,
      score,
      totalQuestions: activeQuiz.questions.length,
      correctAnswers: correctCount,
      timeSpentSeconds: Math.floor((Date.now() - startTimeRef.current) / 1000),
      isCancelled: false,
    });

    toast({
      title: "Quiz Submitted!",
      description: `You scored ${score}% (${correctCount}/${activeQuiz.questions.length} correct)`,
    });
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

  if (activeQuiz && activeQuiz.questions && activeQuiz.questions.length > 0) {
    const currentQuestion = activeQuiz.questions[currentQuestionIndex];
    if (!currentQuestion) {
      // Safety: if current question is undefined, reset quiz
      setActiveQuiz(null);
      setCurrentQuestionIndex(0);
      return null;
    }
    const progress = ((currentQuestionIndex + 1) / activeQuiz.questions.length) * 100;
    const answeredCount = Object.keys(answers).length;

    return (
      <div className="container mx-auto px-4 py-6 md:py-8 max-w-4xl">
        <AnimatePresence>
          {isQuizCancelled && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="p-4 mb-6 bg-destructive/10 border-2 border-destructive" data-testid="card-cancelled">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-gradient-to-br from-destructive/30 to-destructive/10">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <p className="text-destructive font-semibold">
                    Quiz Cancelled - Tab switching detected
                  </p>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10">
              <Target className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            </div>
            <h1 className="font-heading font-bold text-xl md:text-2xl" data-testid="text-quiz-title">
              {activeQuiz.title}
            </h1>
          </div>
          <div className="flex items-center justify-between text-sm md:text-base text-muted-foreground mb-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse"></div>
              <span className="font-medium">
                Question {currentQuestionIndex + 1} of {activeQuiz.questions.length}
              </span>
            </div>
            <p className="font-medium">
              Answered: {answeredCount}/{activeQuiz.questions.length}
            </p>
          </div>
          <Progress value={progress} className="h-2" />
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0, x: 20, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.43, 0.13, 0.23, 0.96] }}
          >
            <Card className="p-6 md:p-8 mb-6 border-2 shadow-lg" data-testid={`card-question-${currentQuestionIndex}`}>
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="font-heading font-semibold text-lg md:text-xl mb-6 leading-relaxed"
              >
                {currentQuestion.question}
              </motion.h2>
              <RadioGroup
                value={answers[currentQuestionIndex] || ""}
                onValueChange={handleAnswerChange}
                disabled={isQuizCancelled}
              >
                {currentQuestion.options.map((option: string, index: number) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + index * 0.05 }}
                    className="flex items-center space-x-3 p-4 rounded-xl hover-elevate border-2 mb-3 last:mb-0"
                    data-testid={`option-${index}`}
                  >
                    <RadioGroupItem value={option} id={`option-${index}`} />
                    <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer text-sm md:text-base">
                      {option}
                    </Label>
                  </motion.div>
                ))}
              </RadioGroup>
            </Card>
          </motion.div>
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="flex flex-col sm:flex-row justify-between gap-4"
        >
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            data-testid="button-previous"
            className="w-full sm:w-auto shadow-sm"
          >
            Previous
          </Button>
          <div className="flex gap-2 justify-end">
            {currentQuestionIndex === activeQuiz.questions.length - 1 ? (
              <Button
                onClick={handleSubmit}
                disabled={isQuizCancelled && submitAttemptMutation.isPending}
                data-testid="button-submit"
                className="w-full sm:w-auto shadow-sm"
              >
                {submitAttemptMutation.isPending ? "Submitting..." : "Submit Quiz"}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={isQuizCancelled}
                data-testid="button-next"
                className="w-full sm:w-auto shadow-sm"
              >
                Next
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

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
            <Target className="h-6 w-6 md:h-7 md:w-7 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="font-heading font-bold text-2xl md:text-3xl" data-testid="text-quizzes-title">
              Quizzes
            </h1>
            <p className="text-muted-foreground text-sm md:text-base" data-testid="text-quizzes-subtitle">
              Test your knowledge with AI-generated quizzes
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
            <Label className="mb-2 block text-sm font-medium">Questions</Label>
            <Input
              type="number"
              min="5"
              max="20"
              value={questionCount}
              onChange={(e) => setQuestionCount(e.target.value)}
              data-testid="input-count"
              className="border-2"
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Button
            onClick={handleGenerate}
            disabled={!selectedMaterial || generateMutation.isPending}
            className="w-full sm:w-auto mb-8 shadow-sm"
            data-testid="button-generate"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {generateMutation.isPending ? "Generating..." : "Generate Quiz"}
          </Button>
        </motion.div>
      </motion.div>

      <AnimatePresence mode="wait">
        {quizzes && quizzes.length > 0 ? (
          <motion.div
            key="quizzes"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="grid md:grid-cols-2 gap-6"
          >
            {quizzes.map((quiz, index) => {
              const quizAttempts = attempts?.filter((a) => a.quizId === quiz.id) || [];
              const bestScore = quizAttempts.length > 0
                ? Math.max(...quizAttempts.map((a) => a.score))
                : null;

              return (
                <motion.div
                  key={quiz.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <Card className="p-6 hover-elevate border-2 shadow-sm" data-testid={`card-quiz-${quiz.id}`}>
                    <div className="flex items-start gap-4 mb-4">
                      <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex-shrink-0">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-heading font-semibold text-lg mb-1">
                          {quiz.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-2">
                          {quiz.questions.length} questions
                        </p>
                        {bestScore !== null && (
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-br from-gamification/20 to-gamification/10 border">
                            <Trophy className="h-3 w-3 text-gamification" />
                            <p className="text-xs font-semibold text-gamification">
                              Best: {bestScore}%
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={() => startQuiz(quiz)}
                      className="w-full shadow-sm"
                      data-testid={`button-start-${quiz.id}`}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Start Quiz
                    </Button>
                  </Card>
                </motion.div>
              );
            })}
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
                <Target className="h-12 w-12 md:h-16 md:w-16 text-primary" />
              </motion.div>
              <motion.h3
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="font-heading font-semibold text-lg md:text-xl mb-2"
              >
                No Quizzes Yet
              </motion.h3>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-muted-foreground mb-4 text-sm md:text-base"
              >
                {selectedMaterial
                  ? "Generate a quiz with AI to get started and test your knowledge"
                  : "Select a study material above to begin creating quizzes"}
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
