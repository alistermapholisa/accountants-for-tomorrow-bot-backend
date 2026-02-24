# Accounting Assistant Bot - Backend

A production-ready Node.js/Express backend for the Accounting Assistant Bot. This backend provides AI-powered answers to accounting questions, caches responses for performance, and integrates with multiple educational sources.

## Features

✅ **AI-Powered Answers** - Uses OpenAI GPT-4 to generate confident, authoritative answers
✅ **Smart Caching** - Identifies similar questions and returns cached answers instantly
✅ **Web Scraping** - Searches CIMA, ACCA, Accounting Coach, and other sources
✅ **Confidence Scoring** - Rates answer quality based on source relevance
✅ **Admin Dashboard** - Monitor unanswered questions and manage content
✅ **User History** - Tracks conversation history per user
✅ **Answer Rating** - Collect feedback on answer quality
✅ **Secure** - API key authentication for admin endpoints

## Quick Start

### Prerequisites

- Node.js 16+ 
- MySQL 5.7+
- OpenAI API Key
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd accounting-bot-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and fill in your configuration:
   ```env
   PORT=3000
   NODE_ENV=production
   
   # Database
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=accounting_bot
   
   # OpenAI
   OPENAI_API_KEY=sk-...
   
   # CORS
   CORS_ORIGIN=https://accountantsfortomorrow.co.za
   
   # Admin
   ADMIN_API_KEY=your_secure_admin_key
   ```

4. **Set up the database**
   ```bash
   mysql -u root -p < src/db/schema.sql
   ```

5. **Start the server**
   ```bash
   npm start
   ```

   For development with auto-reload:
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3000`

## API Endpoints

### Chat Endpoints

#### POST `/api/chat/ask`
Ask a question and get an answer

**Request:**
```json
{
  "question": "What is depreciation?",
  "userId": "optional-user-id",
  "category": "optional-category"
}
```

**Response:**
```json
{
  "success": true,
  "answer": "Depreciation is the systematic allocation of an asset's cost over its useful life...",
  "sources": [
    {
      "url": "https://example.com",
      "title": "Understanding Depreciation",
      "source": "Accounting Coach"
    }
  ],
  "confidence": 85,
  "isFromCache": false
}
```

#### GET `/api/chat/history/:userId`
Get conversation history for a user

**Query Parameters:**
- `limit` (default: 50) - Number of records to return
- `offset` (default: 0) - Pagination offset

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "question_text": "What is depreciation?",
      "answer_text": "...",
      "confidence_score": 85,
      "was_from_cache": false,
      "created_at": "2024-02-23T10:30:00Z"
    }
  ],
  "count": 1
}
```

#### POST `/api/chat/rate`
Rate an answer

**Request:**
```json
{
  "conversationId": 1,
  "rating": 5,
  "feedback": "Very helpful answer"
}
```

### Admin Endpoints

All admin endpoints require the `X-Admin-Key` header with your `ADMIN_API_KEY`.

#### GET `/api/admin/stats`
Get dashboard statistics

**Headers:**
```
X-Admin-Key: your_secure_admin_key
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalQuestions": 150,
    "totalUsers": 45,
    "unansweredQuestions": 3,
    "averageConfidence": 82,
    "cacheHitRate": 35,
    "totalConversations": 200
  }
}
```

#### GET `/api/admin/unanswered`
Get unanswered questions

**Headers:**
```
X-Admin-Key: your_secure_admin_key
```

**Query Parameters:**
- `limit` (default: 50) - Number of records to return

#### POST `/api/admin/respond`
Add admin response to unanswered question

**Headers:**
```
X-Admin-Key: your_secure_admin_key
```

**Request:**
```json
{
  "unansweredId": 1,
  "response": "Here's the correct answer..."
}
```

#### GET `/api/admin/pdfs`
Get list of uploaded PDFs

**Headers:**
```
X-Admin-Key: your_secure_admin_key
```

#### POST `/api/admin/pdf-upload`
Record a PDF upload

**Headers:**
```
X-Admin-Key: your_secure_admin_key
```

**Request:**
```json
{
  "fileName": "CIMA-F1-Study-Guide.pdf",
  "filePath": "/uploads/pdfs/cima-f1.pdf",
  "courseCode": "F1",
  "courseName": "Fundamentals of Management Accounting",
  "pageCount": 150,
  "fileSize": 5242880
}
```

#### GET `/api/admin/logs`
Get admin activity logs

**Headers:**
```
X-Admin-Key: your_secure_admin_key
```

### Health Check

#### GET `/api/health`
Check server and database health

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-02-23T10:30:00Z",
  "database": "connected"
}
```

## Deployment

### Using PM2 (Recommended)

1. **Install PM2 globally**
   ```bash
   npm install -g pm2
   ```

2. **Create ecosystem.config.js**
   ```javascript
   module.exports = {
     apps: [
       {
         name: 'accounting-bot',
         script: './src/index.js',
         env: {
           NODE_ENV: 'production',
           PORT: 3000,
         },
         instances: 'max',
         exec_mode: 'cluster',
         error_file: './logs/error.log',
         out_file: './logs/out.log',
       },
     ],
   };
   ```

3. **Start the application**
   ```bash
   pm2 start ecosystem.config.js
   ```

4. **Monitor**
   ```bash
   pm2 monit
   ```

### Using Docker

1. **Create Dockerfile**
   ```dockerfile
   FROM node:18-alpine
   
   WORKDIR /app
   
   COPY package*.json ./
   RUN npm ci --only=production
   
   COPY src ./src
   
   EXPOSE 3000
   
   CMD ["npm", "start"]
   ```

2. **Build and run**
   ```bash
   docker build -t accounting-bot-backend .
   docker run -p 3000:3000 --env-file .env accounting-bot-backend
   ```

### Using Nginx as Reverse Proxy

```nginx
server {
    listen 80;
    server_name bot.accountantsfortomorrow.co.za;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 3000 | Server port |
| `NODE_ENV` | No | development | Environment (development/production) |
| `DB_HOST` | Yes | localhost | Database host |
| `DB_PORT` | No | 3306 | Database port |
| `DB_USER` | Yes | root | Database user |
| `DB_PASSWORD` | Yes | - | Database password |
| `DB_NAME` | Yes | accounting_bot | Database name |
| `OPENAI_API_KEY` | Yes | - | OpenAI API key |
| `CORS_ORIGIN` | No | * | CORS origin (your website URL) |
| `ADMIN_API_KEY` | Yes | - | Admin authentication key |
| `LOG_LEVEL` | No | info | Logging level |

## Architecture

### Database Schema

The backend uses MySQL with the following main tables:

- **users** - Student and admin accounts
- **questions** - All questions asked by users
- **cached_answers** - Cached Q&A pairs for fast retrieval
- **conversation_history** - User interaction history
- **pdf_documents** - Uploaded course materials
- **unanswered_questions** - Questions the bot couldn't answer confidently
- **admin_logs** - Admin activity tracking
- **content_sources** - Available knowledge sources

### Answer Generation Flow

1. **Question Received** → Validate and store in database
2. **Cache Check** → Search for similar cached questions (similarity > 65%)
3. **If Cached** → Return cached answer immediately
4. **If Not Cached** → Extract topics from question
5. **Web Search** → Search target websites for relevant content
6. **Score Content** → Calculate relevance scores for found content
7. **Generate Answer** → Use GPT-4 to generate confident answer
8. **Cache Result** → Store answer for future similar questions
9. **Return Answer** → Send to user with confidence score

### Confidence Scoring

Confidence is calculated based on:
- Number of relevant sources found
- Relevance scores of sources
- Quality of source content
- Answer generation success

Answers below 60% confidence are marked as unanswered for admin review.

## Security

- **API Key Authentication** - Admin endpoints require `X-Admin-Key` header
- **CORS Protection** - Configurable CORS origin
- **Input Validation** - All inputs validated before processing
- **SQL Injection Prevention** - Using parameterized queries
- **Rate Limiting** - Recommended to add rate limiting in production
- **HTTPS** - Use HTTPS in production (configure via reverse proxy)

## Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:3306
```
- Ensure MySQL is running
- Check DB credentials in `.env`
- Verify database exists

### OpenAI API Error
```
Error: 401 Unauthorized
```
- Verify `OPENAI_API_KEY` is correct
- Check API key has sufficient credits
- Ensure API key has chat completion permissions

### CORS Error
```
Access to XMLHttpRequest blocked by CORS policy
```
- Update `CORS_ORIGIN` in `.env` to match your website URL
- Restart the server after changing `.env`

## Performance Optimization

1. **Enable Caching** - The bot automatically caches answers
2. **Database Indexing** - Schema includes optimized indexes
3. **Connection Pooling** - Uses MySQL connection pool
4. **Compression** - Response compression enabled
5. **Load Balancing** - Use PM2 cluster mode or Docker Swarm

## Monitoring

Monitor these metrics:

- **Cache Hit Rate** - Should increase over time (target: 40-60%)
- **Average Confidence** - Should stay above 70%
- **Response Time** - Cached answers should be <100ms
- **Unanswered Questions** - Review regularly for knowledge gaps
- **Error Rate** - Should be <1%

## Support & Maintenance

### Regular Tasks

- Review unanswered questions weekly
- Update content sources as needed
- Monitor API usage and costs
- Backup database regularly
- Update dependencies monthly

### Logs Location

- Server logs: `./logs/`
- Database logs: MySQL log directory
- Error logs: `./logs/error.log`

## License

MIT

## Contact

For issues or questions, contact: info@accountantsfortomorrow.co.za
