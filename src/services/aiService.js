import { OpenAI } from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate an answer using OpenAI GPT
 * The bot answers confidently without revealing sources
 */
export async function generateAnswer(question, sources) {
  try {
    // Build context from sources without revealing them
    const contextText = sources
      .map((source) => source.content)
      .join('\n\n---\n\n');

    const systemPrompt = `You are an expert accounting assistant helping students understand accounting concepts and course materials for CIMA, ACCA, and general accounting.

Your role is to provide accurate, clear, and confident answers based on the provided course materials and expert knowledge.

IMPORTANT INSTRUCTIONS:
- Answer questions confidently and authoritatively
- Do NOT mention where you got the information from
- Do NOT say things like "According to the source" or "The material states"
- Do NOT reveal that you're searching through materials
- Present information as established accounting knowledge
- Focus on explaining concepts clearly so students can learn and understand
- If you cannot find a satisfactory answer in the materials, still try to provide helpful information from your general accounting knowledge
- Keep answers concise but comprehensive
- Use examples when helpful to illustrate concepts
- Organize your answer with clear structure (use line breaks and bullet points if needed)

Your goal is to help students learn, not to cite sources.`;

    const userMessage = `Question: ${question}

${contextText ? `Course Materials Context:\n${contextText}` : 'No specific course materials provided for this question.'}

Please provide a clear, confident answer to help the student understand this concept.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const answer = response.choices[0]?.message?.content || '';

    // Calculate confidence based on source quality and quantity
    let confidence = 50;
    if (sources.length > 0) {
      const avgRelevance = sources.reduce((sum, s) => sum + (s.relevanceScore || 50), 0) / sources.length;
      confidence = Math.min(100, Math.round(50 + avgRelevance / 2));
    }

    return {
      answer,
      confidence,
      sourcesUsed: sources.length,
    };
  } catch (error) {
    console.error('Error generating answer:', error);
    throw new Error('Failed to generate answer');
  }
}

/**
 * Calculate similarity between two texts
 */
export function calculateSimilarity(text1, text2) {
  const tokens1 = text1.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
  const tokens2 = text2.toLowerCase().split(/\s+/).filter((t) => t.length > 3);

  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);

  const intersection = new Set(Array.from(set1).filter((x) => set2.has(x)));
  const union = new Set([...Array.from(set1), ...Array.from(set2)]);

  return intersection.size / union.size;
}

/**
 * Extract key topics from a question
 */
export function extractTopics(question) {
  const accountingTerms = [
    'balance sheet',
    'income statement',
    'cash flow',
    'depreciation',
    'accrual',
    'cima',
    'acca',
    'financial reporting',
    'management accounting',
    'audit',
    'tax',
    'bookkeeping',
    'journal entry',
    'ledger',
    'trial balance',
    'asset',
    'liability',
    'equity',
    'revenue',
    'expense',
    'profit',
    'loss',
  ];

  const lowerQuestion = question.toLowerCase();
  const foundTopics = accountingTerms.filter((term) => lowerQuestion.includes(term));

  // Extract course codes (e.g., F1, E2, BA1)
  const courseCodePattern = /\b[A-Z]{1,4}\d{1,2}\b/g;
  const courseCodes = question.match(courseCodePattern) || [];

  return Array.from(new Set([...foundTopics, ...courseCodes]));
}
