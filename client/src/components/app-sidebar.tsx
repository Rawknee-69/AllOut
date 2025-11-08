import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  BookOpen,
  Brain,
  FileText,
  Target,
  Map,
  FileStack,
  Volume2,
  Trophy,
  CheckSquare,
  Timer,
  Focus,
  Users,
  User,
  LogOut,
} from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const studyItems = [
  { title: "Study Materials", url: "/materials", icon: BookOpen },
  { title: "AI Chat", url: "/chat", icon: Brain },
  { title: "Flashcards", url: "/flashcards", icon: FileText },
  { title: "Quizzes", url: "/quizzes", icon: Target },
  { title: "Mind Maps", url: "/mind-maps", icon: Map },
  { title: "Summaries", url: "/summaries", icon: FileStack },
  { title: "Audio Library", url: "/audio-library", icon: Volume2 },
];

const gamificationItems = [
  { title: "Leaderboards", url: "/leaderboard", icon: Trophy },
];

const productivityItems = [
  { title: "To-Do List", url: "/todos", icon: CheckSquare },
  { title: "Pomodoro", url: "/pomodoro", icon: Timer },
  { title: "Concentration", url: "/concentration", icon: Focus },
  { title: "Collaboration", url: "/collab", icon: Users },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const userInitials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.email?.[0]?.toUpperCase() || "U";

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <span className="font-heading font-bold text-xl">StudyMaster</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Study Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {studyItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`sidebar-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Gamification</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {gamificationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`sidebar-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Productivity</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {productivityItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`sidebar-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild data-testid="sidebar-profile">
              <a href="/profile" className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.profileImageUrl || undefined} />
                  <AvatarFallback>{userInitials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {user?.firstName || user?.email}
                  </span>
                  <span className="text-xs text-muted-foreground">Profile</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild data-testid="sidebar-logout">
              <a href="/api/logout" className="text-destructive">
                <LogOut />
                <span>Sign Out</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
