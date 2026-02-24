-- Accounting Assistant Bot Database Schema

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  role ENUM('student', 'admin') DEFAULT 'student',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Questions Table
CREATE TABLE IF NOT EXISTS questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  question_text TEXT NOT NULL,
  category VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
);

-- Cached Answers Table
CREATE TABLE IF NOT EXISTS cached_answers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  question_id INT NOT NULL,
  answer_text LONGTEXT NOT NULL,
  sources JSON,
  confidence_score INT DEFAULT 50,
  is_manually_reviewed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  INDEX idx_question_id (question_id)
);

-- Conversation History Table
CREATE TABLE IF NOT EXISTS conversation_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  question_id INT,
  cached_answer_id INT,
  was_from_cache BOOLEAN DEFAULT FALSE,
  similarity_score INT,
  user_rating INT,
  feedback TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE SET NULL,
  FOREIGN KEY (cached_answer_id) REFERENCES cached_answers(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
);

-- PDF Documents Table
CREATE TABLE IF NOT EXISTS pdf_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uploaded_by INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  course_code VARCHAR(50),
  course_name VARCHAR(255),
  extracted_text LONGTEXT,
  page_count INT,
  file_size INT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_course_code (course_code),
  INDEX idx_uploaded_at (uploaded_at)
);

-- Unanswered Questions Table
CREATE TABLE IF NOT EXISTS unanswered_questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  question_id INT,
  user_id INT NOT NULL,
  question_text TEXT NOT NULL,
  attempted_sources JSON,
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_sent_at TIMESTAMP NULL,
  admin_response TEXT,
  admin_responded_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notification_sent (notification_sent),
  INDEX idx_created_at (created_at)
);

-- Admin Logs Table
CREATE TABLE IF NOT EXISTS admin_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  target_id INT,
  details JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_admin_id (admin_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
);

-- Content Sources Table
CREATE TABLE IF NOT EXISTS content_sources (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  url VARCHAR(500),
  source_type ENUM('website', 'pdf', 'manual') DEFAULT 'website',
  is_active BOOLEAN DEFAULT TRUE,
  priority INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_is_active (is_active),
  INDEX idx_priority (priority)
);

-- Insert default content sources
INSERT INTO content_sources (name, url, source_type, is_active, priority) VALUES
('Accountants for Tomorrow', 'https://accountantsfortomorrow.co.za', 'website', TRUE, 100),
('AICPA & CIMA', 'https://www.aicpa-cima.com', 'website', TRUE, 90),
('ACCA Global', 'https://www.accaglobal.com', 'website', TRUE, 90),
('Accounting Coach', 'https://www.accountingcoach.com', 'website', TRUE, 80)
ON DUPLICATE KEY UPDATE is_active=TRUE;
