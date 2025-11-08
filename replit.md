# AI-Powered Study Platform

## Overview

An AI-powered study platform that helps students transform their study materials into interactive learning content. Students can upload PDFs and access AI-generated flashcards, quizzes, mind maps, summaries, audio/video explanations, and more. The platform includes gamification features like global leaderboards, streak tracking, and productivity tools including a Pomodoro timer, to-do lists, and concentration mode.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React with TypeScript for type-safe component development
- Vite as the build tool and development server for fast HMR (Hot Module Replacement)
- Wouter for lightweight client-side routing
- Single-page application (SPA) architecture with client-side rendering

**UI Component System**
- Shadcn UI component library (New York style variant) built on Radix UI primitives
- Tailwind CSS for utility-first styling with custom design tokens
- Design system based on Notion (clean documents), Duolingo (gamification), and Khan Academy (learning dashboard)
- Custom color scheme: Indigo (primary), Purple (gamification), Emerald (success), Amber (warnings), Pink (accents)
- Typography: Inter for UI/body text, Poppins for headings
- Responsive design with mobile-first approach using Tailwind breakpoints
- Interactive mind map visualization using React Flow with collapsible nodes and Dagre auto-layout

**State Management**
- TanStack Query (React Query) for server state management, data fetching, and caching
- React Context for auth state and sidebar state
- Local component state with React hooks

**Authentication Flow**
- Replit OpenID Connect (OIDC) integration via Passport.js
- Session-based authentication with cookies
- Auth state managed through React Query with automatic refetching
- Protected routes redirect unauthenticated users to login

**File Upload Strategy**
- Multer middleware with in-memory storage for PDF uploads
- Files uploaded to Replit Object Storage using Google Cloud Storage SDK
- Object storage service (`server/objectStorage.ts`) handles all file operations
- Access control implemented via ACL policies (`server/objectAcl.ts`)
- Private files require authentication and owner verification
- Study materials stored with metadata in database referencing object storage paths

### Backend Architecture

**Server Framework**
- Express.js for HTTP server and API routing
- Node.js runtime environment
- TypeScript for type safety across frontend and backend

**API Design**
- RESTful API endpoints under `/api` prefix
- Route organization:
  - `/api/auth/*` - Authentication endpoints
  - `/api/user/*` - User profile management
  - `/api/study-materials/*` - Material upload and retrieval
  - Additional routes for flashcards, quizzes, summaries, mind maps, todos, etc.
- Request validation using Zod schemas shared between client and server
- JSON request/response format
- Multipart form-data for file uploads

**Session Management**
- Express session middleware with PostgreSQL session store (connect-pg-simple)
- 7-day session TTL (time to live)
- HTTP-only, secure cookies for session tokens
- Session data includes OIDC tokens and user claims

**Authentication System**
- Replit Auth via openid-client library
- Passport.js strategy for OIDC integration
- User profile synced with Replit user data (email, name, profile image)
- Token refresh mechanism for maintaining active sessions

**AI Integration**
- Google Gemini AI via `@google/genai` SDK
- Used for generating:
  - Flashcards from uploaded PDFs
  - Quiz questions and answers
  - Mind maps and concept relationships
  - Educational text summaries with real-world examples
  - Chat responses based on study materials

**Audio Integration**
- Deepgram API via `@deepgram/sdk` for text-to-speech
- Converts educational summaries into spoken audio explanations
- Uses aura-asteria-en voice model for natural, clear speech
- Audio format: WAV (linear16 encoding) for universal browser compatibility
- Audio files stored in object storage with private ACL policies
- Graceful degradation: summaries created even if audio generation fails
- Available on both Summaries page and Material Detail page under AI Tools

**Error Handling**
- Centralized error handling with try-catch blocks
- HTTP status codes for different error types
- Client-side error handling with toast notifications
- Unauthorized errors (401) trigger re-authentication flow

### Data Storage Solutions

**Database**
- PostgreSQL database (via Neon serverless)
- Drizzle ORM for type-safe database queries and schema management
- Connection pooling with `@neondatabase/serverless`
- WebSocket-based connections for serverless compatibility

**Schema Design**

Core entities:
- **Users**: Stores user profiles with degree/class, study statistics, streak data
- **Study Materials**: PDF uploads with file metadata and storage URLs
- **Flashcards**: AI-generated cards linked to study materials and users
- **Quizzes**: Generated quiz questions with multiple choice options
- **Quiz Attempts**: User quiz submissions and scores for leaderboard
- **Mind Maps**: Visual concept maps in JSON format
- **Summaries**: AI-generated educational summaries with optional audio (audioUrl field for Deepgram-generated WAV files)
- **Study Sessions**: Time tracking for streak and leaderboard calculations with enhanced pause functionality including pause count, pause duration (seconds), and pause reasons (jsonb array)
- **Todos**: Task management with completion tracking
- **Pomodoro Sessions**: Timer sessions for productivity tracking
- **Chat Messages**: Conversation history with AI chatbot
- **Sessions**: Server-side session storage for authentication

Database indexes on frequently queried fields (user_id, session expiry)

**Storage Strategy**
- File metadata stored in PostgreSQL
- Binary files (PDFs) stored in Replit Object Storage private directory
- File paths stored as `/objects/{fileName}` in database
- ObjectStorageService handles upload, download, and ACL policy enforcement
- Owner-based access control ensures users can only access their own files
- JSON data for complex structures (mind maps, quiz options)
- Timestamps for all records (createdAt, updatedAt)

### External Dependencies

**AI Services**
- Google Gemini API for natural language processing and content generation
- API key configured via environment variable `GEMINI_API_KEY`

**Database Service**
- Neon PostgreSQL serverless database
- Connection string via `DATABASE_URL` environment variable
- Automatic connection pooling and WebSocket support

**Authentication Provider**
- Replit OpenID Connect (OIDC) service
- Issuer URL: `https://replit.com/oidc`
- Client credentials via `REPL_ID` environment variable
- Session secret via `SESSION_SECRET` environment variable

**Development Tools**
- Replit-specific Vite plugins for development experience:
  - Runtime error overlay modal
  - Cartographer for code navigation
  - Dev banner for environment indicators

**Third-Party UI Libraries**
- Radix UI primitives (20+ component primitives)
- Lucide React for iconography
- Recharts for data visualization (charts)
- cmdk for command palette interface
- react-day-picker for calendar/date selection
- Embla carousel for image/content carousels
- Vaul for drawer components
- React Flow for interactive node-based graph visualization (mind maps)
- Dagre for automatic graph layout algorithm

**Utility Libraries**
- Zod for runtime schema validation
- date-fns for date manipulation
- clsx and tailwind-merge for className management
- class-variance-authority for component variant handling
- nanoid for unique ID generation
- memoizee for function memoization

**Build & Development**
- TypeScript compiler for type checking
- ESBuild for server-side bundling
- PostCSS with Tailwind and Autoprefixer
- Drizzle Kit for database migrations