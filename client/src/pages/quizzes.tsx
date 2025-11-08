import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Play, FileText, Trophy, AlertTriangle } from "lucide-react";
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
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {isQuizCancelled && (
          <Card className="p-4 mb-4 bg-destructive/10 border-destructive" data-testid="card-cancelled">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <p className="text-destructive font-semibold">
                Quiz Cancelled - Tab switching detected
              </p>
            </div>
          </Card>
        )}

        <div className="mb-6">
          <h1 className="font-heading font-bold text-2xl mb-2" data-testid="text-quiz-title">
            {activeQuiz.title}
          </h1>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>
              Question {currentQuestionIndex + 1} of {activeQuiz.questions.length}
            </p>
            <p>
              Answered: {answeredCount}/{activeQuiz.questions.length}
            </p>
          </div>
          <Progress value={progress} className="mt-2" />
        </div>

        <Card className="p-8 mb-6" data-testid={`card-question-${currentQuestionIndex}`}>
          <h2 className="font-heading font-semibold text-xl mb-6">
            {currentQuestion.question}
          </h2>
          <RadioGroup
            value={answers[currentQuestionIndex] || ""}
            onValueChange={handleAnswerChange}
            disabled={isQuizCancelled}
          >
            {currentQuestion.options.map((option: string, index: number) => (
              <div
                key={index}
                className="flex items-center space-x-2 p-4 rounded-lg hover-elevate"
                data-testid={`option-${index}`}
              >
                <RadioGroupItem value={option} id={`option-${index}`} />
                <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </Card>

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            data-testid="button-previous"
          >
            Previous
          </Button>
          <div className="flex gap-2">
            {currentQuestionIndex === activeQuiz.questions.length - 1 ? (
              <Button
                onClick={handleSubmit}
                disabled={isQuizCancelled && submitAttemptMutation.isPending}
                data-testid="button-submit"
              >
                {submitAttemptMutation.isPending ? "Submitting..." : "Submit Quiz"}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={isQuizCancelled}
                data-testid="button-next"
              >
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-heading font-bold text-3xl md:text-4xl mb-2" data-testid="text-quizzes-title">
          Quizzes
        </h1>
        <p className="text-muted-foreground" data-testid="text-quizzes-subtitle">
          Test your knowledge with AI-generated quizzes
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="md:col-span-2">
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
        <div>
          <Label className="mb-2 block">Questions</Label>
          <Input
            type="number"
            min="5"
            max="20"
            value={questionCount}
            onChange={(e) => setQuestionCount(e.target.value)}
            data-testid="input-count"
          />
        </div>
      </div>

      <Button
        onClick={handleGenerate}
        disabled={!selectedMaterial || generateMutation.isPending}
        className="mb-8"
        data-testid="button-generate"
      >
        <Sparkles className="h-4 w-4 mr-2" />
        {generateMutation.isPending ? "Generating..." : "Generate Quiz"}
      </Button>

      <div className="grid md:grid-cols-2 gap-6">
        {quizzes && quizzes.length > 0 ? (
          quizzes.map((quiz) => {
            const quizAttempts = attempts?.filter((a) => a.quizId === quiz.id) || [];
            const bestScore = quizAttempts.length > 0
              ? Math.max(...quizAttempts.map((a) => a.score))
              : null;

            return (
              <Card key={quiz.id} className="p-6 hover-elevate" data-testid={`card-quiz-${quiz.id}`}>
                <div className="flex items-start gap-4 mb-4">
                  <FileText className="h-10 w-10 text-primary flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-heading font-semibold text-lg mb-1">
                      {quiz.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {quiz.questions.length} questions
                    </p>
                    {bestScore !== null && (
                      <div className="flex items-center gap-1 mt-2">
                        <Trophy className="h-4 w-4 text-gamification" />
                        <p className="text-sm font-semibold text-gamification">
                          Best: {bestScore}%
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  onClick={() => startQuiz(quiz)}
                  className="w-full"
                  data-testid={`button-start-${quiz.id}`}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Quiz
                </Button>
              </Card>
            );
          })
        ) : (
          <Card className="p-12 text-center md:col-span-2" data-testid="card-empty-state">
            <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-heading font-semibold text-lg mb-2">No Quizzes Yet</h3>
            <p className="text-muted-foreground">
              {selectedMaterial
                ? "Generate a quiz with AI to get started"
                : "Select a study material to create quizzes"}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
