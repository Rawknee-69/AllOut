import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import { generateAudioFromText } from "./deepgram";
import { objectStorage } from "./objectStorage";
import { setObjectAclPolicy } from "./objectAcl";
import { sanitizeMarkdown, sanitizeUserInput, sanitizeForAudio, sanitizeMindMapNode } from "./textUtils";
import { setupCollabWebSocket } from "./collabWebSocket";
import {
  insertStudyMaterialSchema,
  insertFlashcardSchema,
  insertQuizSchema,
  insertQuizAttemptSchema,
  insertMindMapSchema,
  insertSummarySchema,
  insertStudySessionSchema,
  insertTodoSchema,
  insertPomodoroSessionSchema,
  insertChatMessageSchema,
  updateUserProfileSchema,
  insertCollabSessionSchema,
  insertCollabParticipantSchema,
  insertCollabWhiteboardSchema,
  insertCollabActivitySchema,
} from "@shared/schema";

// Initialize Gemini AI
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Setup multer for file uploads (in-memory storage)
const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User profile routes
  app.patch("/api/user/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profileData = updateUserProfileSchema.parse(req.body);
      const updatedUser = await storage.updateUserProfile(userId, profileData);
      res.json(updatedUser);
    } catch (error: any) {
      console.error("Error updating profile:", error);
      res.status(400).json({ message: error.message || "Failed to update profile" });
    }
  });

  // Study Materials routes
  app.get("/api/study-materials", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const materials = await storage.getStudyMaterialsByUser(userId);
      res.json(materials);
    } catch (error) {
      console.error("Error fetching study materials:", error);
      res.status(500).json({ message: "Failed to fetch study materials" });
    }
  });

  app.get("/api/study-materials/:id", isAuthenticated, async (req: any, res) => {
    try {
      const material = await storage.getStudyMaterial(req.params.id);
      if (!material) {
        return res.status(404).json({ message: "Study material not found" });
      }
      // Verify ownership
      if (material.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Forbidden" });
      }
      res.json(material);
    } catch (error) {
      console.error("Error fetching study material:", error);
      res.status(500).json({ message: "Failed to fetch study material" });
    }
  });

  app.post("/api/study-materials/upload", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      if (file.mimetype !== "application/pdf") {
        return res.status(400).json({ message: "Only PDF files are allowed" });
      }

      const { objectStorage } = await import("./objectStorage");
      const { setObjectAclPolicy } = await import("./objectAcl");
      
      const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `pdfs/${userId}/${Date.now()}_${sanitizedFilename}`;
      
      // Upload file to object storage
      await objectStorage.uploadFile(fileName, file.buffer, file.mimetype);
      
      // Set ACL policy for the uploaded file
      const objectFile = await objectStorage.getObjectEntityFile(`/objects/${fileName}`);
      await setObjectAclPolicy(objectFile, {
        owner: userId,
        visibility: "private",
      });
      
      const objectPath = `/objects/${fileName}`;

      const material = await storage.createStudyMaterial({
        userId,
        title: file.originalname.replace(".pdf", ""),
        fileName: file.originalname,
        fileUrl: objectPath,
        fileSize: file.size,
      });

      res.json(material);
    } catch (error: any) {
      console.error("Error uploading study material:", error);
      res.status(500).json({ message: error.message || "Failed to upload study material" });
    }
  });

  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const { ObjectStorageService, ObjectNotFoundError } = await import("./objectStorage");
    const { ObjectPermission } = await import("./objectAcl");
    
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.delete("/api/study-materials/:id", isAuthenticated, async (req: any, res) => {
    try {
      const material = await storage.getStudyMaterial(req.params.id);
      if (!material) {
        return res.status(404).json({ message: "Study material not found" });
      }
      // Verify ownership
      if (material.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Forbidden" });
      }
      await storage.deleteStudyMaterial(req.params.id);
      res.json({ message: "Study material deleted successfully" });
    } catch (error) {
      console.error("Error deleting study material:", error);
      res.status(500).json({ message: "Failed to delete study material" });
    }
  });

  // Flashcard routes
  app.get("/api/flashcards", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { materialId } = req.query;
      
      const flashcards = materialId
        ? await storage.getFlashcardsByMaterial(materialId as string)
        : await storage.getFlashcardsByUser(userId);
      
      res.json(flashcards);
    } catch (error) {
      console.error("Error fetching flashcards:", error);
      res.status(500).json({ message: "Failed to fetch flashcards" });
    }
  });

  app.post("/api/flashcards/generate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { materialId, count = 10 } = req.body;

      const material = await storage.getStudyMaterial(materialId);
      if (!material || material.userId !== userId) {
        return res.status(404).json({ message: "Study material not found" });
      }

      // Use Gemini to generate flashcards
      const prompt = `Generate ${count} flashcards from this study material titled "${material.title}". 
      Return ONLY a JSON array with objects containing 'question' and 'answer' fields. No additional text or markdown formatting.
      Use plain text only - no asterisks, underscores, or markdown syntax.
      Example format: [{"question": "What is X?", "answer": "X is..."}, ...]`;

      const result = await genAI.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: prompt,
      });
      const text = result.text || "";
      
      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error("Failed to parse AI response");
      }
      
      const flashcardsData = JSON.parse(jsonMatch[0]);

      // Save flashcards to database with sanitized content
      const createdFlashcards = [];
      for (const card of flashcardsData) {
        const flashcard = await storage.createFlashcard({
          userId,
          materialId,
          question: sanitizeMarkdown(card.question || ""),
          answer: sanitizeMarkdown(card.answer || ""),
          isAIGenerated: true,
        });
        createdFlashcards.push(flashcard);
      }

      res.json(createdFlashcards);
    } catch (error: any) {
      console.error("Error generating flashcards:", error);
      res.status(500).json({ message: error.message || "Failed to generate flashcards" });
    }
  });

  app.post("/api/flashcards", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const flashcardData = insertFlashcardSchema.parse({ ...req.body, userId });
      const flashcard = await storage.createFlashcard(flashcardData);
      res.json(flashcard);
    } catch (error: any) {
      console.error("Error creating flashcard:", error);
      res.status(400).json({ message: error.message || "Failed to create flashcard" });
    }
  });

  app.delete("/api/flashcards/:id", isAuthenticated, async (req: any, res) => {
    try {
      const flashcard = await storage.getFlashcard(req.params.id);
      if (!flashcard || flashcard.userId !== req.user.claims.sub) {
        return res.status(404).json({ message: "Flashcard not found" });
      }
      await storage.deleteFlashcard(req.params.id);
      res.json({ message: "Flashcard deleted successfully" });
    } catch (error) {
      console.error("Error deleting flashcard:", error);
      res.status(500).json({ message: "Failed to delete flashcard" });
    }
  });

  // Quiz routes
  app.get("/api/quizzes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { materialId } = req.query;
      
      const quizzes = materialId
        ? await storage.getQuizzesByMaterial(materialId as string)
        : await storage.getQuizzesByUser(userId);
      
      res.json(quizzes);
    } catch (error) {
      console.error("Error fetching quizzes:", error);
      res.status(500).json({ message: "Failed to fetch quizzes" });
    }
  });

  app.get("/api/quizzes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const quiz = await storage.getQuiz(req.params.id);
      if (!quiz || quiz.userId !== req.user.claims.sub) {
        return res.status(404).json({ message: "Quiz not found" });
      }
      res.json(quiz);
    } catch (error) {
      console.error("Error fetching quiz:", error);
      res.status(500).json({ message: "Failed to fetch quiz" });
    }
  });

  app.post("/api/quizzes/generate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { materialId, questionCount = 10 } = req.body;

      const material = await storage.getStudyMaterial(materialId);
      if (!material || material.userId !== userId) {
        return res.status(404).json({ message: "Study material not found" });
      }

      // Use Gemini to generate quiz
      const prompt = `Generate ${questionCount} multiple choice quiz questions from this study material titled "${material.title}". 
      Return ONLY a JSON array with objects containing 'question', 'options' (array of 4 choices), and 'correctAnswer' (the correct option text). No additional text or markdown formatting.
      Use plain text only - no asterisks, underscores, or markdown syntax.
      Example format: [{"question": "What is X?", "options": ["A", "B", "C", "D"], "correctAnswer": "A"}, ...]`;

      const result = await genAI.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: prompt,
      });
      const text = result.text || "";
      
      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error("Failed to parse AI response");
      }
      
      const questions = JSON.parse(jsonMatch[0]);

      // Sanitize quiz questions and options
      const sanitizedQuestions = questions.map((q: any) => ({
        question: sanitizeMarkdown(q.question || ""),
        options: (q.options || []).map((opt: string) => sanitizeMarkdown(opt)),
        correctAnswer: sanitizeMarkdown(q.correctAnswer || ""),
      }));

      // Save quiz to database
      const quiz = await storage.createQuiz({
        userId,
        materialId,
        title: `${material.title} Quiz`,
        questions: sanitizedQuestions,
        isAIGenerated: true,
      });

      res.json(quiz);
    } catch (error: any) {
      console.error("Error generating quiz:", error);
      res.status(500).json({ message: error.message || "Failed to generate quiz" });
    }
  });

  // Quiz Attempt routes
  app.get("/api/quiz-attempts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const attempts = await storage.getQuizAttemptsByUser(userId);
      res.json(attempts);
    } catch (error) {
      console.error("Error fetching quiz attempts:", error);
      res.status(500).json({ message: "Failed to fetch quiz attempts" });
    }
  });

  app.post("/api/quiz-attempts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const attemptData = insertQuizAttemptSchema.parse({ ...req.body, userId });
      
      const attempt = await storage.createQuizAttempt(attemptData);

      // Update user quiz stats if not cancelled
      if (!attemptData.isCancelled) {
        const user = await storage.getUser(userId);
        if (user) {
          await storage.updateUserStats(userId, {
            totalQuizScore: user.totalQuizScore + attemptData.score,
            quizzesCompleted: user.quizzesCompleted + 1,
          });
        }
      }

      res.json(attempt);
    } catch (error: any) {
      console.error("Error creating quiz attempt:", error);
      res.status(400).json({ message: error.message || "Failed to create quiz attempt" });
    }
  });

  // Summary routes
  app.get("/api/summaries", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { materialId } = req.query;
      
      if (materialId) {
        const summary = await storage.getSummaryByMaterial(materialId as string);
        res.json(summary || null);
      } else {
        const summaries = await storage.getSummariesByUser(userId);
        res.json(summaries);
      }
    } catch (error) {
      console.error("Error fetching summaries:", error);
      res.status(500).json({ message: "Failed to fetch summaries" });
    }
  });

  app.post("/api/summaries/generate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { materialId } = req.body;

      const material = await storage.getStudyMaterial(materialId);
      if (!material || material.userId !== userId) {
        return res.status(404).json({ message: "Study material not found" });
      }

      // Check if summary already exists
      const existingSummary = await storage.getSummaryByMaterial(materialId);
      if (existingSummary && existingSummary.audioUrl) {
        // Summary with audio already exists, return it
        return res.json(existingSummary);
      }
      
      // If summary exists but no audio, we'll regenerate both for consistency
      let content = "";
      if (existingSummary) {
        // Sanitize existing content in case it has old markdown
        content = sanitizeMarkdown(existingSummary.content);
      } else {

        // Use Gemini to generate an educational summary with examples
        const prompt = `You are an expert tutor helping a student understand the study material titled "${material.title}".

Generate a comprehensive educational summary that:
1. Explains the main concepts in simple, everyday language
2. Provides real-world examples to illustrate difficult concepts
3. Uses analogies and metaphors to make complex ideas easy to understand
4. Breaks down challenging topics step-by-step
5. Includes practical applications of the concepts

Make the explanation engaging and conversational, as if you're speaking directly to the student.
Format the summary to be clear and well-organized with headings and sections.

IMPORTANT: 
- Use plain text only. Do not use markdown formatting like asterisks, underscores, or special characters for emphasis.
- If the content includes mathematical formulas, symbols, or equations, ALWAYS spell them out in words so they sound natural when spoken aloud.
- For example, write "alpha" instead of "α", "sum" instead of "∑", "pi" instead of "π"
- Write "x equals 2" instead of "x = 2", "x squared" instead of "x²"
- Make all mathematical content readable and understandable when spoken.

Your goal is to ensure that even the most difficult concepts become easy to understand through your explanations and examples.`;

        const result = await genAI.models.generateContent({
          model: "gemini-2.0-flash-exp",
          contents: prompt,
        });
        content = sanitizeMarkdown(result.text || "");
      }

      // Generate audio from the summary using Deepgram
      // Text will be automatically chunked if it exceeds Deepgram's 2000 char limit
      let audioUrl: string | null = null;
      try {
        console.log("Generating audio summary with Deepgram...");
        
        // Sanitize content for audio - removes markdown and converts symbols to readable text
        const audioText = sanitizeForAudio(content);
        console.log("Text sanitized for audio, length:", audioText.length);
        
        const audioBuffer = await generateAudioFromText({ 
          text: audioText,
          model: "aura-asteria-en" // Natural, clear voice for educational content
        });

        console.log("Audio buffer generated, size:", audioBuffer.length, "bytes");

        // Upload audio to object storage
        const audioFileName = `summaries/audio_${materialId}_${Date.now()}.wav`;
        console.log("Uploading audio to:", audioFileName);
        
        await objectStorage.uploadFile(audioFileName, audioBuffer, "audio/wav");
        console.log("Audio uploaded successfully");
        
        // Set ACL policy so user can access the audio
        const audioFile = await objectStorage.getObjectEntityFile(`/objects/${audioFileName}`);
        await setObjectAclPolicy(audioFile, {
          owner: userId,
          visibility: "private"
        });
        
        audioUrl = `/objects/${audioFileName}`;
        console.log("Audio summary generated and uploaded:", audioUrl);
      } catch (audioError) {
        console.error("Error generating audio summary:", audioError);
        console.error("Audio error stack:", audioError instanceof Error ? audioError.stack : "");
        // Continue without audio if generation fails
      }

      // Save or update summary in database with audio URL
      let summary;
      if (existingSummary) {
        // Update existing summary with audio URL
        summary = await storage.updateSummary(existingSummary.id, { audioUrl });
      } else {
        // Create new summary
        summary = await storage.createSummary({
          userId,
          materialId,
          content,
          audioUrl,
        });
      }

      res.json(summary);
    } catch (error: any) {
      console.error("Error generating summary:", error);
      res.status(500).json({ message: error.message || "Failed to generate summary" });
    }
  });

  // Mind Map routes
  app.get("/api/mind-maps", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { materialId } = req.query;
      
      const mindMaps = materialId
        ? await storage.getMindMapsByMaterial(materialId as string)
        : await storage.getMindMapsByUser(userId);
      
      res.json(mindMaps);
    } catch (error) {
      console.error("Error fetching mind maps:", error);
      res.status(500).json({ message: "Failed to fetch mind maps" });
    }
  });

  app.post("/api/mind-maps/generate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { materialId } = req.body;

      const material = await storage.getStudyMaterial(materialId);
      if (!material || material.userId !== userId) {
        return res.status(404).json({ message: "Study material not found" });
      }

      // Use Gemini to generate mind map structure
      const prompt = `Generate a mind map structure for this study material titled "${material.title}". 
      Return ONLY a JSON object with a hierarchical node structure. Each node should have 'id', 'label', and 'children' (array of child nodes).
      Use plain text only for labels - no asterisks, underscores, or markdown syntax.
      Example: {"id": "root", "label": "Main Topic", "children": [{"id": "1", "label": "Subtopic 1", "children": []}, ...]}`;

      const result = await genAI.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: prompt,
      });
      const text = result.text || "";
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Failed to parse AI response");
      }
      
      const mindMapContent = JSON.parse(jsonMatch[0]);

      // Recursively sanitize node labels
      const sanitizedContent = sanitizeMindMapNode(mindMapContent);

      // Save mind map to database
      const mindMap = await storage.createMindMap({
        userId,
        materialId,
        title: `${material.title} Mind Map`,
        content: sanitizedContent,
      });

      res.json(mindMap);
    } catch (error: any) {
      console.error("Error generating mind map:", error);
      res.status(500).json({ message: error.message || "Failed to generate mind map" });
    }
  });

  // Chat routes
  app.get("/api/chat/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { materialId } = req.query;
      
      const messages = materialId
        ? await storage.getChatMessagesByMaterial(materialId as string)
        : await storage.getChatMessagesByUser(userId);
      
      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  app.post("/api/chat/message", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { materialId, content } = req.body;

      // Sanitize user input
      const sanitizedContent = sanitizeUserInput(content);

      // Save user message
      const userMessage = await storage.createChatMessage({
        userId,
        materialId: materialId || null,
        role: "user",
        content: sanitizedContent,
      });

      // Set up SSE headers for streaming
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Get conversation history
      const history = materialId
        ? await storage.getChatMessagesByMaterial(materialId)
        : [];

      // Generate AI response using Gemini with streaming
      let prompt = sanitizedContent;
      if (materialId) {
        const material = await storage.getStudyMaterial(materialId);
        if (material) {
          prompt = `You are a helpful study assistant. The student is studying "${material.title}". 
          Previous conversation: ${history.slice(-5).map(m => `${m.role}: ${m.content}`).join("\n")}
          Student question: ${sanitizedContent}
          
          Provide a helpful, educational response in plain text without any markdown formatting. Do not use asterisks, underscores, or other markdown syntax.`;
        }
      } else {
        prompt = `You are a helpful study assistant. Student question: ${sanitizedContent}
        
        Provide a helpful, educational response in plain text without any markdown formatting. Do not use asterisks, underscores, or other markdown syntax.`;
      }

      // Send user message ID first
      res.write(`data: ${JSON.stringify({ type: "userMessage", message: userMessage })}\n\n`);

      let fullResponse = "";
      
      // Stream the AI response
      const stream = await genAI.models.generateContentStream({
        model: "gemini-2.0-flash-exp",
        contents: prompt,
      });

      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) {
          fullResponse += text;
          const sanitized = sanitizeMarkdown(text);
          res.write(`data: ${JSON.stringify({ type: "chunk", content: sanitized })}\n\n`);
        }
      }

      // Save the complete AI response
      const assistantMessage = await storage.createChatMessage({
        userId,
        materialId: materialId || null,
        role: "assistant",
        content: sanitizeMarkdown(fullResponse),
      });

      // Send completion event with full message
      res.write(`data: ${JSON.stringify({ type: "complete", message: assistantMessage })}\n\n`);
      res.end();
    } catch (error: any) {
      console.error("Error processing chat message:", error);
      res.write(`data: ${JSON.stringify({ type: "error", message: error.message || "Failed to process chat message" })}\n\n`);
      res.end();
    }
  });

  // Study Session routes
  app.get("/api/study-sessions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sessions = await storage.getStudySessionsByUser(userId);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching study sessions:", error);
      res.status(500).json({ message: "Failed to fetch study sessions" });
    }
  });

  app.post("/api/study-sessions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sessionData = insertStudySessionSchema.parse({ ...req.body, userId });
      const session = await storage.createStudySession(sessionData);
      res.json(session);
    } catch (error: any) {
      console.error("Error creating study session:", error);
      res.status(400).json({ message: error.message || "Failed to create study session" });
    }
  });

  app.patch("/api/study-sessions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const session = await storage.getStudySession(req.params.id);
      if (!session || session.userId !== req.user.claims.sub) {
        return res.status(404).json({ message: "Study session not found" });
      }

      const updates = req.body;
      const updatedSession = await storage.updateStudySession(req.params.id, updates);

      // Update user stats if session ended
      if (updates.endTime && updates.duration) {
        const user = await storage.getUser(req.user.claims.sub);
        if (user) {
          const totalStudyTime = user.totalStudyTime + updates.duration;
          
          // Update streak logic
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const lastStudy = user.lastStudyDate ? new Date(user.lastStudyDate) : null;
          lastStudy?.setHours(0, 0, 0, 0);
          
          let currentStreak = user.currentStreak;
          if (updates.duration >= 30 && updates.tabSwitches === 0) { // Min 30 min focused study
            if (!lastStudy || lastStudy.getTime() === today.getTime()) {
              // Same day, no change
            } else if (lastStudy && (today.getTime() - lastStudy.getTime() === 86400000)) {
              // Consecutive day
              currentStreak++;
            } else {
              // Streak broken
              currentStreak = 1;
            }
          }

          await storage.updateUserStats(req.user.claims.sub, {
            totalStudyTime,
            currentStreak,
            longestStreak: Math.max(currentStreak, user.longestStreak),
            lastStudyDate: today,
          });
        }
      }

      res.json(updatedSession);
    } catch (error: any) {
      console.error("Error updating study session:", error);
      res.status(400).json({ message: error.message || "Failed to update study session" });
    }
  });

  // Todo routes
  app.get("/api/todos", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const todos = await storage.getTodosByUser(userId);
      res.json(todos);
    } catch (error) {
      console.error("Error fetching todos:", error);
      res.status(500).json({ message: "Failed to fetch todos" });
    }
  });

  app.post("/api/todos", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const todoData = insertTodoSchema.parse({ ...req.body, userId });
      const todo = await storage.createTodo(todoData);
      res.json(todo);
    } catch (error: any) {
      console.error("Error creating todo:", error);
      res.status(400).json({ message: error.message || "Failed to create todo" });
    }
  });

  app.patch("/api/todos/:id", isAuthenticated, async (req: any, res) => {
    try {
      const todo = await storage.getTodo(req.params.id);
      if (!todo || todo.userId !== req.user.claims.sub) {
        return res.status(404).json({ message: "Todo not found" });
      }
      const updatedTodo = await storage.updateTodo(req.params.id, req.body);
      res.json(updatedTodo);
    } catch (error: any) {
      console.error("Error updating todo:", error);
      res.status(400).json({ message: error.message || "Failed to update todo" });
    }
  });

  app.delete("/api/todos/:id", isAuthenticated, async (req: any, res) => {
    try {
      const todo = await storage.getTodo(req.params.id);
      if (!todo || todo.userId !== req.user.claims.sub) {
        return res.status(404).json({ message: "Todo not found" });
      }
      await storage.deleteTodo(req.params.id);
      res.json({ message: "Todo deleted successfully" });
    } catch (error) {
      console.error("Error deleting todo:", error);
      res.status(500).json({ message: "Failed to delete todo" });
    }
  });

  // Pomodoro routes
  app.get("/api/pomodoro-sessions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sessions = await storage.getPomodoroSessionsByUser(userId);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching pomodoro sessions:", error);
      res.status(500).json({ message: "Failed to fetch pomodoro sessions" });
    }
  });

  app.post("/api/pomodoro-sessions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sessionData = insertPomodoroSessionSchema.parse({ ...req.body, userId });
      const session = await storage.createPomodoroSession(sessionData);
      res.json(session);
    } catch (error: any) {
      console.error("Error creating pomodoro session:", error);
      res.status(400).json({ message: error.message || "Failed to create pomodoro session" });
    }
  });

  // Leaderboard routes
  app.get("/api/leaderboard/study-time", isAuthenticated, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const topUsers = await storage.getTopUsersByStudyTime(limit);
      
      // Transform data to match frontend expectations
      const leaderboard = topUsers.map(user => ({
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        totalTime: user.totalStudyTime, // in minutes
      }));
      
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching study time leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch study time leaderboard" });
    }
  });

  app.get("/api/leaderboard/quiz-score", isAuthenticated, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const topUsers = await storage.getTopUsersByQuizScore(limit);
      
      // Transform data to match frontend expectations
      const leaderboard = topUsers.map(user => ({
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        averageScore: user.quizzesCompleted > 0 
          ? (user.totalQuizScore / user.quizzesCompleted) 
          : 0,
        quizCount: user.quizzesCompleted,
      }));
      
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching quiz score leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch quiz score leaderboard" });
    }
  });

  // Collaboration Session routes
  app.post("/api/collab/sessions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sessionCode = Math.random().toString(36).substring(2, 12).toUpperCase();
      const sessionData = insertCollabSessionSchema.parse({
        ...req.body,
        hostUserId: userId,
        sessionCode,
      });
      const session = await storage.createCollabSession(sessionData);
      
      // Create whiteboard for session
      await storage.createCollabWhiteboard({
        sessionId: session.id,
        content: { elements: [] },
      });
      
      // Add host as participant
      await storage.createCollabParticipant({
        sessionId: session.id,
        userId,
        role: "host",
      });
      
      res.json(session);
    } catch (error: any) {
      console.error("Error creating collab session:", error);
      res.status(400).json({ message: error.message || "Failed to create collab session" });
    }
  });

  app.get("/api/collab/sessions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const session = await storage.getCollabSession(req.params.id);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Error fetching collab session:", error);
      res.status(500).json({ message: "Failed to fetch collab session" });
    }
  });

  app.get("/api/collab/sessions/code/:code", isAuthenticated, async (req: any, res) => {
    try {
      const session = await storage.getCollabSessionByCode(req.params.code);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Error fetching collab session by code:", error);
      res.status(500).json({ message: "Failed to fetch collab session" });
    }
  });

  app.get("/api/collab/my-sessions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sessions = await storage.getCollabSessionsByHost(userId);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching user's collab sessions:", error);
      res.status(500).json({ message: "Failed to fetch collab sessions" });
    }
  });

  app.post("/api/collab/sessions/:id/end", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const session = await storage.getCollabSession(req.params.id);
      
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      if (session.hostUserId !== userId) {
        return res.status(403).json({ message: "Only the host can end the session" });
      }
      
      const endedSession = await storage.endCollabSession(req.params.id);
      res.json(endedSession);
    } catch (error) {
      console.error("Error ending collab session:", error);
      res.status(500).json({ message: "Failed to end collab session" });
    }
  });

  // Collaboration Participant routes
  app.post("/api/collab/sessions/:id/join", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sessionId = req.params.id;
      
      const session = await storage.getCollabSession(sessionId);
      if (!session || !session.isActive) {
        return res.status(404).json({ message: "Session not found or inactive" });
      }
      
      // Check if already a participant
      const existing = await storage.getCollabParticipantByUserAndSession(userId, sessionId);
      if (existing) {
        return res.json(existing);
      }
      
      const participantData = insertCollabParticipantSchema.parse({
        sessionId,
        userId,
        role: "member",
      });
      
      const participant = await storage.createCollabParticipant(participantData);
      res.json(participant);
    } catch (error: any) {
      console.error("Error joining collab session:", error);
      res.status(400).json({ message: error.message || "Failed to join collab session" });
    }
  });

  app.get("/api/collab/sessions/:id/participants", isAuthenticated, async (req: any, res) => {
    try {
      const participants = await storage.getActiveCollabParticipantsBySession(req.params.id);
      
      // Fetch user details for each participant
      const participantsWithUsers = await Promise.all(
        participants.map(async (p) => {
          const user = await storage.getUser(p.userId);
          return { ...p, user };
        })
      );
      
      res.json(participantsWithUsers);
    } catch (error) {
      console.error("Error fetching participants:", error);
      res.status(500).json({ message: "Failed to fetch participants" });
    }
  });

  // Collaboration Whiteboard routes
  app.get("/api/collab/sessions/:id/whiteboard", isAuthenticated, async (req: any, res) => {
    try {
      const whiteboard = await storage.getCollabWhiteboardBySession(req.params.id);
      if (!whiteboard) {
        return res.status(404).json({ message: "Whiteboard not found" });
      }
      res.json(whiteboard);
    } catch (error) {
      console.error("Error fetching whiteboard:", error);
      res.status(500).json({ message: "Failed to fetch whiteboard" });
    }
  });

  app.patch("/api/collab/whiteboards/:id", isAuthenticated, async (req: any, res) => {
    try {
      const updates = { content: req.body.content };
      const whiteboard = await storage.updateCollabWhiteboard(req.params.id, updates);
      res.json(whiteboard);
    } catch (error) {
      console.error("Error updating whiteboard:", error);
      res.status(500).json({ message: "Failed to update whiteboard" });
    }
  });

  // Collaboration Activity routes
  app.get("/api/collab/sessions/:id/activities", isAuthenticated, async (req: any, res) => {
    try {
      const activities = await storage.getCollabActivitiesBySession(req.params.id);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  const httpServer = createServer(app);
  
  // Setup WebSocket for collaboration (skip on Vercel/serverless)
  // Vercel doesn't support WebSockets in serverless functions
  if (process.env.VERCEL !== "1" && typeof process.env.VERCEL === "undefined") {
    try {
      setupCollabWebSocket(httpServer);
    } catch (error) {
      console.warn("WebSocket setup failed (this is expected on Vercel):", error);
    }
  } else {
    console.log("WebSocket disabled: Running on Vercel (serverless functions don't support WebSockets)");
  }
  
  return httpServer;
}
