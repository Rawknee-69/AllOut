import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users table with Replit Auth integration and degree/class information
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  degree: text("degree"),
  className: text("class_name"),
  totalStudyTime: integer("total_study_time").notNull().default(0), // in minutes
  currentStreak: integer("current_streak").notNull().default(0), // days
  longestStreak: integer("longest_streak").notNull().default(0), // days
  lastStudyDate: timestamp("last_study_date"),
  totalQuizScore: integer("total_quiz_score").notNull().default(0),
  quizzesCompleted: integer("quizzes_completed").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Study materials (PDFs uploaded by users)
export const studyMaterials = pgTable("study_materials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(), // Object storage URL
  fileSize: integer("file_size").notNull(), // in bytes
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

// Flashcards generated from study materials
export const flashcards = pgTable("flashcards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  materialId: varchar("material_id").references(() => studyMaterials.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  isAIGenerated: boolean("is_ai_generated").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Quizzes with questions and answers
export const quizzes = pgTable("quizzes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  materialId: varchar("material_id").references(() => studyMaterials.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  questions: jsonb("questions").notNull(), // Array of {question, options, correctAnswer}
  isAIGenerated: boolean("is_ai_generated").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Quiz attempts with scores and tab-switch tracking
export const quizAttempts = pgTable("quiz_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  quizId: varchar("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  score: integer("score").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  tabSwitchCount: integer("tab_switch_count").notNull().default(0),
  isCancelled: boolean("is_cancelled").notNull().default(false), // Cancelled due to tab switching
  completedAt: timestamp("completed_at").notNull().defaultNow(),
});

// Mind maps generated from study materials
export const mindMaps = pgTable("mind_maps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  materialId: varchar("material_id").notNull().references(() => studyMaterials.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: jsonb("content").notNull(), // Node structure for mind map
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// AI-generated summaries
export const summaries = pgTable("summaries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  materialId: varchar("material_id").notNull().references(() => studyMaterials.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  audioUrl: text("audio_url"), // URL to Deepgram-generated audio in object storage
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Study sessions for tracking focused time
export const studySessions = pgTable("study_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  startTime: timestamp("start_time").notNull().defaultNow(),
  endTime: timestamp("end_time"),
  duration: integer("duration").notNull().default(0), // in minutes
  tabSwitches: integer("tab_switches").notNull().default(0),
  timeWasted: integer("time_wasted").notNull().default(0), // in minutes
  isConcentrationMode: boolean("is_concentration_mode").notNull().default(false),
  pauseCount: integer("pause_count").notNull().default(0), // number of times paused
  pauseDuration: integer("pause_duration").notNull().default(0), // total pause time in seconds
  pauseReasons: jsonb("pause_reasons").default(sql`'[]'::jsonb`), // Array of {reason, duration, timestamp}
});

// Todo list items
export const todos = pgTable("todos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  isCompleted: boolean("is_completed").notNull().default(false),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Pomodoro sessions
export const pomodoroSessions = pgTable("pomodoro_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  workDuration: integer("work_duration").notNull(), // in minutes
  breakDuration: integer("break_duration").notNull(), // in minutes
  completedCycles: integer("completed_cycles").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Chat messages with AI
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  materialId: varchar("material_id").references(() => studyMaterials.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  totalStudyTime: true,
  currentStreak: true,
  longestStreak: true,
  lastStudyDate: true,
  totalQuizScore: true,
  quizzesCompleted: true,
  createdAt: true,
  updatedAt: true,
});

export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
});

export const updateUserProfileSchema = createInsertSchema(users).pick({
  degree: true,
  className: true,
});

export const insertStudyMaterialSchema = createInsertSchema(studyMaterials).omit({
  id: true,
  uploadedAt: true,
});

export const insertFlashcardSchema = createInsertSchema(flashcards).omit({
  id: true,
  createdAt: true,
});

export const insertQuizSchema = createInsertSchema(quizzes).omit({
  id: true,
  createdAt: true,
});

export const insertQuizAttemptSchema = createInsertSchema(quizAttempts).omit({
  id: true,
  completedAt: true,
});

export const insertMindMapSchema = createInsertSchema(mindMaps).omit({
  id: true,
  createdAt: true,
});

export const insertSummarySchema = createInsertSchema(summaries).omit({
  id: true,
  createdAt: true,
});

export const insertStudySessionSchema = createInsertSchema(studySessions).omit({
  id: true,
  startTime: true,
});

export const insertTodoSchema = createInsertSchema(todos).omit({
  id: true,
  createdAt: true,
});

export const insertPomodoroSessionSchema = createInsertSchema(pomodoroSessions).omit({
  id: true,
  createdAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;
export type User = typeof users.$inferSelect;

export type InsertStudyMaterial = z.infer<typeof insertStudyMaterialSchema>;
export type StudyMaterial = typeof studyMaterials.$inferSelect;

export type InsertFlashcard = z.infer<typeof insertFlashcardSchema>;
export type Flashcard = typeof flashcards.$inferSelect;

// Quiz question type structure
export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
}

export type InsertQuiz = z.infer<typeof insertQuizSchema>;
export type Quiz = typeof quizzes.$inferSelect;

// Extended Quiz type with properly typed questions array
export interface QuizWithQuestions extends Omit<Quiz, 'questions'> {
  questions: QuizQuestion[];
}

export type InsertQuizAttempt = z.infer<typeof insertQuizAttemptSchema>;
export type QuizAttempt = typeof quizAttempts.$inferSelect;

export type InsertMindMap = z.infer<typeof insertMindMapSchema>;
export type MindMap = typeof mindMaps.$inferSelect;

export type InsertSummary = z.infer<typeof insertSummarySchema>;
export type Summary = typeof summaries.$inferSelect;

export type InsertStudySession = z.infer<typeof insertStudySessionSchema>;
export type StudySession = typeof studySessions.$inferSelect;

export type InsertTodo = z.infer<typeof insertTodoSchema>;
export type Todo = typeof todos.$inferSelect;

export type InsertPomodoroSession = z.infer<typeof insertPomodoroSessionSchema>;
export type PomodoroSession = typeof pomodoroSessions.$inferSelect;

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
