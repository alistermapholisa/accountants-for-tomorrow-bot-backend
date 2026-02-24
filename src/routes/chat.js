import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/connection.js';
import { generateAnswer, calculateSimilarity, extractTopics } from '../services/aiService.js';
import { searchWebsites, calculateRelevanceScore } from '../services/scrapingService.js';

const router = express.Router();

const SIMILARITY_THRESHOLD = 0.65;
const CONFIDENCE_THRESHOLD = 60;

/**
 * POST /api/chat/ask
 * Main endpoint for asking questions
 * 
 * Request body:
 * {
 *   "question": "What is depreciation?",
 *   "userId": "optional-user-id",
 *   "category": "optional-category"
 * }
 */
router.post('/ask', async (req, res) => {
  try {
    const { question, userId, category } = req.body;

    // Validate input
    if (!question || question.trim().length < 5) {
      return res.status(400).json({
        error: true,
        message: 'Question must be at least 5 characters long',
      });
    }

    const conn = await pool.getConnection();

    try {
      // Create or get user
      let actualUserId = userId;
      if (!actualUserId) {
        actualUserId = uuidv4();
        await conn.query(
          'INSERT INTO users (email, name, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)',
          [`user_${actualUserId}@bot.local`, `User ${actualUserId.substring(0, 8)}`, 'student']
        );
      }

      // Insert question
      const [questionResult] = await conn.query(
        'INSERT INTO questions (user_id, question_text, category) VALUES (?, ?, ?)',
        [actualUserId, question, category || 'General']
      );
      const questionId = questionResult.insertId;

      // Extract topics for better searching
      const topics = extractTopics(question);

      // Check for cached similar answers
      let cachedAnswer = null;
      let similarityScore = 0;

      try {
        const [previousQuestions] = await conn.query(
          'SELECT id, question_text FROM questions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
          [actualUserId]
        );

        for (const prevQuestion of previousQuestions) {
          const similarity = calculateSimilarity(question, prevQuestion.question_text);
          if (similarity > SIMILARITY_THRESHOLD) {
            const [cached] = await conn.query(
              'SELECT * FROM cached_answers WHERE question_id = ? LIMIT 1',
              [prevQuestion.id]
            );
            if (cached.length > 0) {
              cachedAnswer = cached[0];
              similarityScore = Math.round(similarity * 100);
              break;
            }
          }
        }
      } catch (error) {
        console.warn('Error checking cache:', error.message);
      }

      // If we found a cached answer, return it
      if (cachedAnswer) {
        await conn.query(
          'INSERT INTO conversation_history (user_id, question_id, cached_answer_id, was_from_cache, similarity_score) VALUES (?, ?, ?, ?, ?)',
          [actualUserId, questionId, cachedAnswer.id, true, similarityScore]
        );

        conn.release();

        return res.json({
          success: true,
          answer: cachedAnswer.answer_text,
          sources: JSON.parse(cachedAnswer.sources || '[]'),
          confidence: cachedAnswer.confidence_score || 75,
          isFromCache: true,
          similarityScore,
        });
      }

      // Search for content from target websites
      const websiteResults = await searchWebsites(question, topics);

      // Calculate relevance scores
      const scoredWebResults = websiteResults.map((result) => ({
        ...result,
        relevanceScore: calculateRelevanceScore(result.content, question, topics),
      }));

      // Sort by relevance and take top 5
      const topResults = scoredWebResults
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 5);

      // Generate answer using LLM
      let answerData;
      try {
        answerData = await generateAnswer(question, topResults);
      } catch (error) {
        console.error('Error generating answer:', error);

        // Record unanswered question
        await conn.query(
          'INSERT INTO unanswered_questions (question_id, user_id, question_text, attempted_sources) VALUES (?, ?, ?, ?)',
          [questionId, actualUserId, question, JSON.stringify(topResults.map((r) => r.url))]
        );

        conn.release();

        return res.status(500).json({
          error: true,
          message: 'Unable to generate answer at this time. Please try again later.',
        });
      }

      // Check if answer meets confidence threshold
      if (answerData.confidence < CONFIDENCE_THRESHOLD) {
        await conn.query(
          'INSERT INTO unanswered_questions (question_id, user_id, question_text, attempted_sources) VALUES (?, ?, ?, ?)',
          [questionId, actualUserId, question, JSON.stringify(topResults.map((r) => r.url))]
        );
      }

      // Cache the answer
      const [cacheResult] = await conn.query(
        'INSERT INTO cached_answers (question_id, answer_text, sources, confidence_score) VALUES (?, ?, ?, ?)',
        [
          questionId,
          answerData.answer,
          JSON.stringify(topResults.map((r) => ({ url: r.url, title: r.title, source: r.source }))),
          answerData.confidence,
        ]
      );

      // Create conversation history entry
      await conn.query(
        'INSERT INTO conversation_history (user_id, question_id, cached_answer_id, was_from_cache, similarity_score) VALUES (?, ?, ?, ?, ?)',
        [actualUserId, questionId, cacheResult.insertId, false, 0]
      );

      conn.release();

      return res.json({
        success: true,
        answer: answerData.answer,
        sources: topResults.map((r) => ({ url: r.url, title: r.title, source: r.source })),
        confidence: answerData.confidence,
        isFromCache: false,
      });
    } catch (error) {
      conn.release();
      throw error;
    }
  } catch (error) {
    console.error('Error in /ask endpoint:', error);
    res.status(500).json({
      error: true,
      message: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { details: error.message }),
    });
  }
});

/**
 * GET /api/chat/history/:userId
 * Get conversation history for a user
 */
router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const conn = await pool.getConnection();

    try {
      const [history] = await conn.query(
        `SELECT 
          ch.id,
          ch.user_id,
          ch.question_id,
          q.question_text,
          ca.answer_text,
          ca.confidence_score,
          ch.was_from_cache,
          ch.similarity_score,
          ch.created_at
        FROM conversation_history ch
        LEFT JOIN questions q ON ch.question_id = q.id
        LEFT JOIN cached_answers ca ON ch.cached_answer_id = ca.id
        WHERE ch.user_id = ?
        ORDER BY ch.created_at DESC
        LIMIT ? OFFSET ?`,
        [userId, parseInt(limit), parseInt(offset)]
      );

      conn.release();

      res.json({
        success: true,
        data: history,
        count: history.length,
      });
    } catch (error) {
      conn.release();
      throw error;
    }
  } catch (error) {
    console.error('Error in /history endpoint:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to retrieve history',
    });
  }
});

/**
 * POST /api/chat/rate
 * Rate an answer
 */
router.post('/rate', async (req, res) => {
  try {
    const { conversationId, rating, feedback } = req.body;

    if (!conversationId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        error: true,
        message: 'Invalid rating. Must be between 1 and 5.',
      });
    }

    const conn = await pool.getConnection();

    try {
      await conn.query(
        'UPDATE conversation_history SET user_rating = ?, feedback = ? WHERE id = ?',
        [rating, feedback || null, conversationId]
      );

      conn.release();

      res.json({
        success: true,
        message: 'Rating recorded successfully',
      });
    } catch (error) {
      conn.release();
      throw error;
    }
  } catch (error) {
    console.error('Error in /rate endpoint:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to record rating',
    });
  }
});

export default router;
