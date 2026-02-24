import express from 'express';
import pool from '../db/connection.js';

const router = express.Router();

// Middleware to check admin API key
const checkAdminKey = (req, res, next) => {
  const apiKey = req.headers['x-admin-key'];
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(403).json({
      error: true,
      message: 'Unauthorized: Invalid admin key',
    });
  }
  next();
};

/**
 * GET /api/admin/stats
 * Get dashboard statistics
 */
router.get('/stats', checkAdminKey, async (req, res) => {
  try {
    const conn = await pool.getConnection();

    try {
      // Get total questions
      const [totalQuestions] = await conn.query(
        'SELECT COUNT(*) as count FROM questions'
      );

      // Get total users
      const [totalUsers] = await conn.query(
        'SELECT COUNT(*) as count FROM users'
      );

      // Get unanswered questions
      const [unanswered] = await conn.query(
        'SELECT COUNT(*) as count FROM unanswered_questions WHERE notification_sent = 0'
      );

      // Get average confidence
      const [avgConfidence] = await conn.query(
        'SELECT AVG(confidence_score) as avg FROM cached_answers'
      );

      // Get cache hit rate
      const [cacheStats] = await conn.query(
        'SELECT COUNT(*) as total, SUM(was_from_cache) as from_cache FROM conversation_history'
      );

      conn.release();

      const cacheHitRate =
        cacheStats[0].total > 0
          ? Math.round((cacheStats[0].from_cache / cacheStats[0].total) * 100)
          : 0;

      res.json({
        success: true,
        stats: {
          totalQuestions: totalQuestions[0].count,
          totalUsers: totalUsers[0].count,
          unansweredQuestions: unanswered[0].count,
          averageConfidence: Math.round(avgConfidence[0].avg || 0),
          cacheHitRate,
          totalConversations: cacheStats[0].total,
        },
      });
    } catch (error) {
      conn.release();
      throw error;
    }
  } catch (error) {
    console.error('Error in /stats endpoint:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to retrieve statistics',
    });
  }
});

/**
 * GET /api/admin/unanswered
 * Get unanswered questions
 */
router.get('/unanswered', checkAdminKey, async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const conn = await pool.getConnection();

    try {
      const [unanswered] = await conn.query(
        `SELECT 
          id,
          question_id,
          user_id,
          question_text,
          attempted_sources,
          created_at,
          admin_response
        FROM unanswered_questions
        WHERE notification_sent = 0
        ORDER BY created_at DESC
        LIMIT ?`,
        [parseInt(limit)]
      );

      conn.release();

      res.json({
        success: true,
        data: unanswered,
        count: unanswered.length,
      });
    } catch (error) {
      conn.release();
      throw error;
    }
  } catch (error) {
    console.error('Error in /unanswered endpoint:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to retrieve unanswered questions',
    });
  }
});

/**
 * POST /api/admin/respond
 * Add admin response to unanswered question
 */
router.post('/respond', checkAdminKey, async (req, res) => {
  try {
    const { unansweredId, response } = req.body;

    if (!unansweredId || !response) {
      return res.status(400).json({
        error: true,
        message: 'Missing required fields: unansweredId, response',
      });
    }

    const conn = await pool.getConnection();

    try {
      await conn.query(
        `UPDATE unanswered_questions 
        SET admin_response = ?, admin_responded_at = NOW(), notification_sent = 1, notification_sent_at = NOW()
        WHERE id = ?`,
        [response, unansweredId]
      );

      conn.release();

      res.json({
        success: true,
        message: 'Response recorded successfully',
      });
    } catch (error) {
      conn.release();
      throw error;
    }
  } catch (error) {
    console.error('Error in /respond endpoint:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to record response',
    });
  }
});

/**
 * GET /api/admin/logs
 * Get admin activity logs
 */
router.get('/logs', checkAdminKey, async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    const conn = await pool.getConnection();

    try {
      const [logs] = await conn.query(
        `SELECT 
          id,
          admin_id,
          action,
          target_id,
          details,
          created_at
        FROM admin_logs
        ORDER BY created_at DESC
        LIMIT ?`,
        [parseInt(limit)]
      );

      conn.release();

      res.json({
        success: true,
        data: logs,
        count: logs.length,
      });
    } catch (error) {
      conn.release();
      throw error;
    }
  } catch (error) {
    console.error('Error in /logs endpoint:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to retrieve logs',
    });
  }
});

/**
 * POST /api/admin/pdf-upload
 * Record PDF upload
 */
router.post('/pdf-upload', checkAdminKey, async (req, res) => {
  try {
    const { fileName, filePath, courseCode, courseName, pageCount, fileSize } = req.body;

    if (!fileName || !filePath) {
      return res.status(400).json({
        error: true,
        message: 'Missing required fields: fileName, filePath',
      });
    }

    const conn = await pool.getConnection();

    try {
      const [result] = await conn.query(
        `INSERT INTO pdf_documents (uploaded_by, file_name, file_path, course_code, course_name, page_count, file_size)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [1, fileName, filePath, courseCode || null, courseName || null, pageCount || 0, fileSize || 0]
      );

      // Log the action
      await conn.query(
        `INSERT INTO admin_logs (admin_id, action, target_id, details)
        VALUES (?, ?, ?, ?)`,
        [1, 'PDF_UPLOADED', result.insertId, JSON.stringify({ fileName, courseCode })]
      );

      conn.release();

      res.json({
        success: true,
        message: 'PDF recorded successfully',
        pdfId: result.insertId,
      });
    } catch (error) {
      conn.release();
      throw error;
    }
  } catch (error) {
    console.error('Error in /pdf-upload endpoint:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to record PDF',
    });
  }
});

/**
 * GET /api/admin/pdfs
 * Get list of uploaded PDFs
 */
router.get('/pdfs', checkAdminKey, async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    const conn = await pool.getConnection();

    try {
      const [pdfs] = await conn.query(
        `SELECT 
          id,
          file_name,
          file_path,
          course_code,
          course_name,
          page_count,
          file_size,
          uploaded_at
        FROM pdf_documents
        ORDER BY uploaded_at DESC
        LIMIT ?`,
        [parseInt(limit)]
      );

      conn.release();

      res.json({
        success: true,
        data: pdfs,
        count: pdfs.length,
      });
    } catch (error) {
      conn.release();
      throw error;
    }
  } catch (error) {
    console.error('Error in /pdfs endpoint:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to retrieve PDFs',
    });
  }
});

export default router;
