import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BookOpen, Brain, Target, Trophy, Timer, Zap } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-primary" data-testid="logo-icon" />
            <span className="text-2xl font-heading font-bold" data-testid="logo-text">StudyMaster</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild data-testid="button-login">
              <a href="/api/login">Sign In</a>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-secondary/5 to-gamification/5" />
        <div className="container mx-auto px-4 relative">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="font-heading font-bold text-4xl md:text-6xl mb-6 bg-gradient-to-r from-primary via-secondary to-gamification bg-clip-text text-transparent" data-testid="text-hero-title">
              AI-Powered Study Platform
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8" data-testid="text-hero-subtitle">
              Transform your PDFs into flashcards, quizzes, mind maps, and summaries with cutting-edge AI. Track your progress, compete on leaderboards, and master your studies.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button size="lg" asChild className="text-lg" data-testid="button-get-started">
                <a href="/api/login">Get Started Free</a>
              </Button>
              <Button size="lg" variant="outline" className="text-lg" asChild data-testid="button-learn-more">
                <a href="#features">Learn More</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <h2 className="font-heading font-bold text-3xl md:text-4xl text-center mb-12" data-testid="text-features-title">
            Powerful AI Study Tools
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="p-6 hover-elevate" data-testid="card-feature-ai-chat">
              <Brain className="h-12 w-12 text-primary mb-4" />
              <h3 className="font-heading font-semibold text-xl mb-2">AI Study Chat</h3>
              <p className="text-muted-foreground">
                Ask questions about your study materials and get instant, intelligent answers from our AI assistant.
              </p>
            </Card>

            <Card className="p-6 hover-elevate" data-testid="card-feature-flashcards">
              <Zap className="h-12 w-12 text-secondary mb-4" />
              <h3 className="font-heading font-semibold text-xl mb-2">Auto Flashcards</h3>
              <p className="text-muted-foreground">
                Generate flashcards automatically from your PDFs using AI. Review and master key concepts effortlessly.
              </p>
            </Card>

            <Card className="p-6 hover-elevate" data-testid="card-feature-quizzes">
              <Target className="h-12 w-12 text-success mb-4" />
              <h3 className="font-heading font-semibold text-xl mb-2">Smart Quizzes</h3>
              <p className="text-muted-foreground">
                AI-generated quizzes with anti-cheat tab detection. Test your knowledge and track your scores.
              </p>
            </Card>

            <Card className="p-6 hover-elevate" data-testid="card-feature-mind-maps">
              <BookOpen className="h-12 w-12 text-warning mb-4" />
              <h3 className="font-heading font-semibold text-xl mb-2">Mind Maps</h3>
              <p className="text-muted-foreground">
                Visualize complex topics with AI-generated mind maps. See connections and understand concepts better.
              </p>
            </Card>

            <Card className="p-6 hover-elevate" data-testid="card-feature-leaderboards">
              <Trophy className="h-12 w-12 text-gamification mb-4" />
              <h3 className="font-heading font-semibold text-xl mb-2">Global Leaderboards</h3>
              <p className="text-muted-foreground">
                Compete with students worldwide. Earn points for study time, quiz scores, and maintain daily streaks.
              </p>
            </Card>

            <Card className="p-6 hover-elevate" data-testid="card-feature-productivity">
              <Timer className="h-12 w-12 text-destructive mb-4" />
              <h3 className="font-heading font-semibold text-xl mb-2">Productivity Tools</h3>
              <p className="text-muted-foreground">
                Pomodoro timer, todo lists, and concentration mode with focus tracking to maximize your study sessions.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-gradient-to-br from-primary/10 to-secondary/10">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-heading font-bold text-3xl md:text-4xl mb-6" data-testid="text-cta-title">
              Ready to Transform Your Study Experience?
            </h2>
            <p className="text-xl text-muted-foreground mb-8" data-testid="text-cta-subtitle">
              Join thousands of students who are already mastering their subjects with AI-powered learning tools.
            </p>
            <Button size="lg" asChild className="text-lg" data-testid="button-cta-start">
              <a href="/api/login">Start Learning Today</a>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-12 border-t">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h4 className="font-heading font-semibold mb-3">Product</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#features" className="hover-elevate">Features</a></li>
                <li><a href="/api/login" className="hover-elevate">Pricing</a></li>
                <li><a href="/api/login" className="hover-elevate">Dashboard</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-heading font-semibold mb-3">Resources</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#features" className="hover-elevate">How It Works</a></li>
                <li><a href="#features" className="hover-elevate">Study Guides</a></li>
                <li><a href="#features" className="hover-elevate">Blog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-heading font-semibold mb-3">Company</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#features" className="hover-elevate">About Us</a></li>
                <li><a href="#features" className="hover-elevate">Contact</a></li>
                <li><a href="#features" className="hover-elevate">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-heading font-semibold mb-3">Legal</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#features" className="hover-elevate">Privacy Policy</a></li>
                <li><a href="#features" className="hover-elevate">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-muted-foreground">
            <p data-testid="text-copyright">© 2024 StudyMaster. All rights reserved.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
