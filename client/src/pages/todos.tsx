import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Todo } from "@shared/schema";

export default function Todos() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [newTodoTitle, setNewTodoTitle] = useState("");

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

  const { data: todos, isLoading } = useQuery<Todo[]>({
    queryKey: ["/api/todos"],
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: async (title: string) => {
      return await apiRequest("POST", "/api/todos", {
        title,
        completed: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/todos"] });
      setNewTodoTitle("");
      toast({
        title: "Success",
        description: "Todo created successfully!",
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
        description: error.message || "Failed to create todo",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      return await apiRequest("PATCH", `/api/todos/${id}`, { completed });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/todos"] });
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
        description: error.message || "Failed to update todo",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/todos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/todos"] });
      toast({
        title: "Deleted",
        description: "Todo deleted successfully",
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
        description: error.message || "Failed to delete todo",
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    if (!newTodoTitle.trim()) {
      toast({
        title: "Empty Todo",
        description: "Please enter a todo title",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(newTodoTitle);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCreate();
    }
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

  const completedTodos = todos?.filter((t) => t.completed) || [];
  const pendingTodos = todos?.filter((t) => !t.completed) || [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="font-heading font-bold text-3xl md:text-4xl mb-2" data-testid="text-todos-title">
          Todo List
        </h1>
        <p className="text-muted-foreground" data-testid="text-todos-subtitle">
          Manage your study tasks and stay organized
        </p>
      </div>

      <Card className="p-6 mb-8">
        <div className="flex gap-2">
          <Input
            value={newTodoTitle}
            onChange={(e) => setNewTodoTitle(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Add a new todo..."
            disabled={createMutation.isPending}
            data-testid="input-new-todo"
          />
          <Button
            onClick={handleCreate}
            disabled={!newTodoTitle.trim() || createMutation.isPending}
            data-testid="button-create"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading todos...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {pendingTodos.length > 0 && (
            <div>
              <h2 className="font-heading font-semibold text-lg mb-4">Pending</h2>
              <div className="space-y-2">
                {pendingTodos.map((todo) => (
                  <Card
                    key={todo.id}
                    className="p-4 hover-elevate"
                    data-testid={`card-todo-${todo.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={todo.completed}
                        onCheckedChange={(checked) =>
                          updateMutation.mutate({ id: todo.id, completed: checked as boolean })
                        }
                        data-testid={`checkbox-${todo.id}`}
                      />
                      <span className="flex-1">{todo.title}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(todo.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${todo.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {completedTodos.length > 0 && (
            <div>
              <h2 className="font-heading font-semibold text-lg mb-4">Completed</h2>
              <div className="space-y-2">
                {completedTodos.map((todo) => (
                  <Card
                    key={todo.id}
                    className="p-4 opacity-60 hover-elevate"
                    data-testid={`card-todo-${todo.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                      <span className="flex-1 line-through">{todo.title}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(todo.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${todo.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {!todos || todos.length === 0 ? (
            <Card className="p-12 text-center" data-testid="card-empty-state">
              <CheckCircle2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-heading font-semibold text-lg mb-2">No Todos Yet</h3>
              <p className="text-muted-foreground">Add your first todo to get started</p>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
