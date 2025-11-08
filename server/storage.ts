import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";
import type {
  User,
  InsertUser,
  UpsertUser,
  UpdateUserProfile,
  StudyMaterial,
  InsertStudyMaterial,
  Flashcard,
  InsertFlashcard,
  Quiz,
  InsertQuiz,
  QuizAttempt,
  InsertQuizAttempt,
  MindMap,
  InsertMindMap,
  Summary,
  InsertSummary,
  StudySession,
  InsertStudySession,
  Todo,
  InsertTodo,
  PomodoroSession,
  InsertPomodoroSession,
  ChatMessage,
  InsertChatMessage,
} from "@shared/schema";
import {
  users,
  studyMaterials,
  flashcards,
  quizzes,
  quizAttempts,
  mindMaps,
  summaries,
  studySessions,
  todos,
  pomodoroSessions,
  chatMessages,
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserProfile(userId: string, profile: UpdateUserProfile): Promise<User | undefined>;
  updateUserStats(
    userId: string,
    stats: {
      totalStudyTime?: number;
      currentStreak?: number;
      longestStreak?: number;
      lastStudyDate?: Date;
      totalQuizScore?: number;
      quizzesCompleted?: number;
    }
  ): Promise<User | undefined>;
  getTopUsersByStudyTime(limit: number): Promise<User[]>;
  getTopUsersByQuizScore(limit: number): Promise<User[]>;

  // Study Material operations
  getStudyMaterial(id: string): Promise<StudyMaterial | undefined>;
  getStudyMaterialsByUser(userId: string): Promise<StudyMaterial[]>;
  createStudyMaterial(material: InsertStudyMaterial): Promise<StudyMaterial>;
  deleteStudyMaterial(id: string): Promise<void>;

  // Flashcard operations
  getFlashcard(id: string): Promise<Flashcard | undefined>;
  getFlashcardsByUser(userId: string): Promise<Flashcard[]>;
  getFlashcardsByMaterial(materialId: string): Promise<Flashcard[]>;
  createFlashcard(flashcard: InsertFlashcard): Promise<Flashcard>;
  deleteFlashcard(id: string): Promise<void>;

  // Quiz operations
  getQuiz(id: string): Promise<Quiz | undefined>;
  getQuizzesByUser(userId: string): Promise<Quiz[]>;
  getQuizzesByMaterial(materialId: string): Promise<Quiz[]>;
  createQuiz(quiz: InsertQuiz): Promise<Quiz>;
  deleteQuiz(id: string): Promise<void>;

  // Quiz Attempt operations
  getQuizAttempt(id: string): Promise<QuizAttempt | undefined>;
  getQuizAttemptsByUser(userId: string): Promise<QuizAttempt[]>;
  getQuizAttemptsByQuiz(quizId: string): Promise<QuizAttempt[]>;
  createQuizAttempt(attempt: InsertQuizAttempt): Promise<QuizAttempt>;

  // Mind Map operations
  getMindMap(id: string): Promise<MindMap | undefined>;
  getMindMapsByUser(userId: string): Promise<MindMap[]>;
  getMindMapsByMaterial(materialId: string): Promise<MindMap[]>;
  createMindMap(mindMap: InsertMindMap): Promise<MindMap>;
  deleteMindMap(id: string): Promise<void>;

  // Summary operations
  getSummary(id: string): Promise<Summary | undefined>;
  getSummariesByUser(userId: string): Promise<Summary[]>;
  getSummaryByMaterial(materialId: string): Promise<Summary | undefined>;
  createSummary(summary: InsertSummary): Promise<Summary>;
  updateSummary(id: string, updates: Partial<InsertSummary>): Promise<Summary | undefined>;
  deleteSummary(id: string): Promise<void>;

  // Study Session operations
  getStudySession(id: string): Promise<StudySession | undefined>;
  getStudySessionsByUser(userId: string): Promise<StudySession[]>;
  createStudySession(session: InsertStudySession): Promise<StudySession>;
  updateStudySession(
    id: string,
    updates: Partial<InsertStudySession>
  ): Promise<StudySession | undefined>;

  // Todo operations
  getTodo(id: string): Promise<Todo | undefined>;
  getTodosByUser(userId: string): Promise<Todo[]>;
  createTodo(todo: InsertTodo): Promise<Todo>;
  updateTodo(id: string, updates: Partial<InsertTodo>): Promise<Todo | undefined>;
  deleteTodo(id: string): Promise<void>;

  // Pomodoro operations
  getPomodoroSession(id: string): Promise<PomodoroSession | undefined>;
  getPomodoroSessionsByUser(userId: string): Promise<PomodoroSession[]>;
  createPomodoroSession(session: InsertPomodoroSession): Promise<PomodoroSession>;

  // Chat Message operations
  getChatMessage(id: string): Promise<ChatMessage | undefined>;
  getChatMessagesByUser(userId: string): Promise<ChatMessage[]>;
  getChatMessagesByMaterial(materialId: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  deleteChatMessagesByMaterial(materialId: string): Promise<void>;
}

export class DbStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const result = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  }

  async updateUserProfile(userId: string, profile: UpdateUserProfile): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async updateUserStats(
    userId: string,
    stats: {
      totalStudyTime?: number;
      currentStreak?: number;
      longestStreak?: number;
      lastStudyDate?: Date;
      totalQuizScore?: number;
      quizzesCompleted?: number;
    }
  ): Promise<User | undefined> {
    const result = await db.update(users).set(stats).where(eq(users.id, userId)).returning();
    return result[0];
  }

  async getTopUsersByStudyTime(limit: number): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.totalStudyTime)).limit(limit);
  }

  async getTopUsersByQuizScore(limit: number): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.totalQuizScore)).limit(limit);
  }

  // Study Material operations
  async getStudyMaterial(id: string): Promise<StudyMaterial | undefined> {
    const result = await db.select().from(studyMaterials).where(eq(studyMaterials.id, id));
    return result[0];
  }

  async getStudyMaterialsByUser(userId: string): Promise<StudyMaterial[]> {
    return await db
      .select()
      .from(studyMaterials)
      .where(eq(studyMaterials.userId, userId))
      .orderBy(desc(studyMaterials.uploadedAt));
  }

  async createStudyMaterial(material: InsertStudyMaterial): Promise<StudyMaterial> {
    const result = await db.insert(studyMaterials).values(material).returning();
    return result[0];
  }

  async deleteStudyMaterial(id: string): Promise<void> {
    await db.delete(studyMaterials).where(eq(studyMaterials.id, id));
  }

  // Flashcard operations
  async getFlashcard(id: string): Promise<Flashcard | undefined> {
    const result = await db.select().from(flashcards).where(eq(flashcards.id, id));
    return result[0];
  }

  async getFlashcardsByUser(userId: string): Promise<Flashcard[]> {
    return await db
      .select()
      .from(flashcards)
      .where(eq(flashcards.userId, userId))
      .orderBy(desc(flashcards.createdAt));
  }

  async getFlashcardsByMaterial(materialId: string): Promise<Flashcard[]> {
    return await db
      .select()
      .from(flashcards)
      .where(eq(flashcards.materialId, materialId))
      .orderBy(desc(flashcards.createdAt));
  }

  async createFlashcard(flashcard: InsertFlashcard): Promise<Flashcard> {
    const result = await db.insert(flashcards).values(flashcard).returning();
    return result[0];
  }

  async deleteFlashcard(id: string): Promise<void> {
    await db.delete(flashcards).where(eq(flashcards.id, id));
  }

  // Quiz operations
  async getQuiz(id: string): Promise<Quiz | undefined> {
    const result = await db.select().from(quizzes).where(eq(quizzes.id, id));
    return result[0];
  }

  async getQuizzesByUser(userId: string): Promise<Quiz[]> {
    return await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.userId, userId))
      .orderBy(desc(quizzes.createdAt));
  }

  async getQuizzesByMaterial(materialId: string): Promise<Quiz[]> {
    return await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.materialId, materialId))
      .orderBy(desc(quizzes.createdAt));
  }

  async createQuiz(quiz: InsertQuiz): Promise<Quiz> {
    const result = await db.insert(quizzes).values(quiz).returning();
    return result[0];
  }

  async deleteQuiz(id: string): Promise<void> {
    await db.delete(quizzes).where(eq(quizzes.id, id));
  }

  // Quiz Attempt operations
  async getQuizAttempt(id: string): Promise<QuizAttempt | undefined> {
    const result = await db.select().from(quizAttempts).where(eq(quizAttempts.id, id));
    return result[0];
  }

  async getQuizAttemptsByUser(userId: string): Promise<QuizAttempt[]> {
    return await db
      .select()
      .from(quizAttempts)
      .where(eq(quizAttempts.userId, userId))
      .orderBy(desc(quizAttempts.completedAt));
  }

  async getQuizAttemptsByQuiz(quizId: string): Promise<QuizAttempt[]> {
    return await db
      .select()
      .from(quizAttempts)
      .where(eq(quizAttempts.quizId, quizId))
      .orderBy(desc(quizAttempts.completedAt));
  }

  async createQuizAttempt(attempt: InsertQuizAttempt): Promise<QuizAttempt> {
    const result = await db.insert(quizAttempts).values(attempt).returning();
    return result[0];
  }

  // Mind Map operations
  async getMindMap(id: string): Promise<MindMap | undefined> {
    const result = await db.select().from(mindMaps).where(eq(mindMaps.id, id));
    return result[0];
  }

  async getMindMapsByUser(userId: string): Promise<MindMap[]> {
    return await db
      .select()
      .from(mindMaps)
      .where(eq(mindMaps.userId, userId))
      .orderBy(desc(mindMaps.createdAt));
  }

  async getMindMapsByMaterial(materialId: string): Promise<MindMap[]> {
    return await db
      .select()
      .from(mindMaps)
      .where(eq(mindMaps.materialId, materialId))
      .orderBy(desc(mindMaps.createdAt));
  }

  async createMindMap(mindMap: InsertMindMap): Promise<MindMap> {
    const result = await db.insert(mindMaps).values(mindMap).returning();
    return result[0];
  }

  async deleteMindMap(id: string): Promise<void> {
    await db.delete(mindMaps).where(eq(mindMaps.id, id));
  }

  // Summary operations
  async getSummary(id: string): Promise<Summary | undefined> {
    const result = await db.select().from(summaries).where(eq(summaries.id, id));
    return result[0];
  }

  async getSummariesByUser(userId: string): Promise<Summary[]> {
    return await db
      .select()
      .from(summaries)
      .where(eq(summaries.userId, userId))
      .orderBy(desc(summaries.createdAt));
  }

  async getSummaryByMaterial(materialId: string): Promise<Summary | undefined> {
    const result = await db
      .select()
      .from(summaries)
      .where(eq(summaries.materialId, materialId))
      .orderBy(desc(summaries.createdAt))
      .limit(1);
    return result[0];
  }

  async createSummary(summary: InsertSummary): Promise<Summary> {
    const result = await db.insert(summaries).values(summary).returning();
    return result[0];
  }

  async updateSummary(id: string, updates: Partial<InsertSummary>): Promise<Summary | undefined> {
    const result = await db.update(summaries).set(updates).where(eq(summaries.id, id)).returning();
    return result[0];
  }

  async deleteSummary(id: string): Promise<void> {
    await db.delete(summaries).where(eq(summaries.id, id));
  }

  // Study Session operations
  async getStudySession(id: string): Promise<StudySession | undefined> {
    const result = await db.select().from(studySessions).where(eq(studySessions.id, id));
    return result[0];
  }

  async getStudySessionsByUser(userId: string): Promise<StudySession[]> {
    return await db
      .select()
      .from(studySessions)
      .where(eq(studySessions.userId, userId))
      .orderBy(desc(studySessions.startTime));
  }

  async createStudySession(session: InsertStudySession): Promise<StudySession> {
    const result = await db.insert(studySessions).values(session).returning();
    return result[0];
  }

  async updateStudySession(
    id: string,
    updates: Partial<InsertStudySession>
  ): Promise<StudySession | undefined> {
    const result = await db
      .update(studySessions)
      .set(updates)
      .where(eq(studySessions.id, id))
      .returning();
    return result[0];
  }

  // Todo operations
  async getTodo(id: string): Promise<Todo | undefined> {
    const result = await db.select().from(todos).where(eq(todos.id, id));
    return result[0];
  }

  async getTodosByUser(userId: string): Promise<Todo[]> {
    return await db
      .select()
      .from(todos)
      .where(eq(todos.userId, userId))
      .orderBy(desc(todos.createdAt));
  }

  async createTodo(todo: InsertTodo): Promise<Todo> {
    const result = await db.insert(todos).values(todo).returning();
    return result[0];
  }

  async updateTodo(id: string, updates: Partial<InsertTodo>): Promise<Todo | undefined> {
    const result = await db.update(todos).set(updates).where(eq(todos.id, id)).returning();
    return result[0];
  }

  async deleteTodo(id: string): Promise<void> {
    await db.delete(todos).where(eq(todos.id, id));
  }

  // Pomodoro operations
  async getPomodoroSession(id: string): Promise<PomodoroSession | undefined> {
    const result = await db.select().from(pomodoroSessions).where(eq(pomodoroSessions.id, id));
    return result[0];
  }

  async getPomodoroSessionsByUser(userId: string): Promise<PomodoroSession[]> {
    return await db
      .select()
      .from(pomodoroSessions)
      .where(eq(pomodoroSessions.userId, userId))
      .orderBy(desc(pomodoroSessions.createdAt));
  }

  async createPomodoroSession(session: InsertPomodoroSession): Promise<PomodoroSession> {
    const result = await db.insert(pomodoroSessions).values(session).returning();
    return result[0];
  }

  // Chat Message operations
  async getChatMessage(id: string): Promise<ChatMessage | undefined> {
    const result = await db.select().from(chatMessages).where(eq(chatMessages.id, id));
    return result[0];
  }

  async getChatMessagesByUser(userId: string): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.userId, userId))
      .orderBy(desc(chatMessages.createdAt));
  }

  async getChatMessagesByMaterial(materialId: string): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.materialId, materialId))
      .orderBy(chatMessages.createdAt);
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const result = await db.insert(chatMessages).values(message).returning();
    return result[0];
  }

  async deleteChatMessagesByMaterial(materialId: string): Promise<void> {
    await db.delete(chatMessages).where(eq(chatMessages.materialId, materialId));
  }
}

export const storage = new DbStorage();
