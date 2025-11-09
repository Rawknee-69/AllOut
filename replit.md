# Ascend - AI-Powered Study Platform

## Overview

Ascend is an AI-powered study platform designed to transform students' study materials (e.g., PDFs) into interactive learning content. Key features include AI-generated flashcards, quizzes, mind maps, summaries, and audio/video explanations. The platform also incorporates gamification elements like leaderboards and streak tracking, alongside productivity tools such as a Pomodoro timer, to-do lists, and a concentration mode. A core ambition is to foster collaborative learning through real-time shared study sessions.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is a Single-Page Application (SPA) built with React and TypeScript, using Vite for development and Wouter for routing. It utilizes Shadcn UI (New York style) based on Radix UI primitives and Tailwind CSS for styling, following a design system inspired by Notion, Duolingo, and Khan Academy. State management relies on TanStack Query for server state and React Context for global states like authentication. Authentication is handled via Replit OpenID Connect (OIDC) and Passport.js, with session-based authentication. File uploads are managed by Multer and stored in Replit Object Storage, with access control.

### Backend Architecture
The backend is an Express.js server on Node.js, written in TypeScript. It provides a RESTful API with Zod for request validation. Session management uses Express session middleware with a PostgreSQL store. Authentication integrates with Replit Auth via openid-client. AI functionalities, including content generation for flashcards, quizzes, mind maps, and summaries, are powered by Google Gemini AI. Audio explanations are generated using Deepgram API for text-to-speech. Centralized error handling uses HTTP status codes.

### Data Storage Solutions
The platform uses PostgreSQL (Neon serverless) with Drizzle ORM for type-safe queries. Core entities include Users, Study Materials, Flashcards, Quizzes, Quiz Attempts, Mind Maps, Summaries, Study Sessions, Todos, Pomodoro Sessions, Chat Messages, and Sessions. Binary files like PDFs are stored in Replit Object Storage, with metadata and paths in PostgreSQL.

### Collaboration System
The platform features a real-time collaboration system using WebSockets for shared study sessions. This includes a collaborative whiteboard with pen/eraser/highlighter tools (1px-8px sizes), host-controlled concentration mode, coordinated break timers, and activity tracking. WebSocket connections are authenticated via Express session cookies, and authorization is enforced for all actions. Session, participant, whiteboard, and activity data are stored in dedicated PostgreSQL tables with cascade deletes.

### Gamification System
The platform includes a comprehensive leaderboard system that tracks and ranks users based on their study activity:
- **Study Time Leaderboard**: Ranks users by total study time (in minutes), updated automatically when Pomodoro sessions complete
- **Quiz Score Leaderboard**: Ranks users by total quiz score, displaying average score percentage and quiz count, updated when quiz attempts are submitted
- User stats tracked: `totalStudyTime`, `totalQuizScore`, `quizzesCompleted`, `currentStreak`, `longestStreak`, `lastStudyDate`
- Leaderboards filter to show only users with activity (study time > 0 or quizzes completed > 0)
- Real-time UI updates with current user highlighting and rank indicators (trophies/medals for top 3)

## External Dependencies

### AI Services
- **Google Gemini API**: For natural language processing and content generation (flashcards, quizzes, mind maps, summaries, chat responses).
- **Deepgram API**: For text-to-speech conversion of summaries into audio explanations.

### Database Service
- **Neon PostgreSQL**: Serverless database for persistent data storage.

### Authentication Provider
- **Replit OpenID Connect (OIDC)**: For user authentication and profile syncing.

### Third-Party UI Libraries
- **Radix UI**: Primitives for building UI components.
- **Shadcn UI**: Component library built on Radix UI.
- **Tailwind CSS**: Utility-first CSS framework.
- **React Flow**: For interactive mind map visualizations.
- **Recharts**: For data visualization (charts).
- **Lucide React**: For iconography.

### Utility Libraries
- **Zod**: For runtime schema validation.
- **date-fns**: For date manipulation.

### Build & Development Tools
- **Vite**: Frontend build tool.
- **TypeScript**: For type-safe development.
- **ESBuild**: For server-side bundling.
- **PostCSS**: CSS preprocessor.
- **Drizzle Kit**: For database migrations.