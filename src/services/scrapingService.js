/**
 * Web scraping service for extracting content from target websites
 */

const TARGET_SOURCES = {
  AFT: {
    name: 'Accountants for Tomorrow',
    baseUrl: 'https://accountantsfortomorrow.co.za',
    searchPaths: ['/courses/', '/blog/'],
  },
  AICPA_CIMA: {
    name: 'AICPA & CIMA',
    baseUrl: 'https://www.aicpa-cima.com',
    searchPaths: ['/resources/', '/studying/'],
  },
  ACCA: {
    name: 'ACCA Global',
    baseUrl: 'https://www.accaglobal.com',
    searchPaths: ['/student/exam-support-resources/', '/student/'],
  },
  ACCOUNTING_COACH: {
    name: 'Accounting Coach',
    baseUrl: 'https://www.accountingcoach.com',
    searchPaths: ['/accounting-basics/', '/financial-accounting/'],
  },
};

/**
 * Search for content across target websites
 */
export async function searchWebsites(query, topics) {
  const results = [];

  for (const [, source] of Object.entries(TARGET_SOURCES)) {
    try {
      const sourceResults = await searchSource(query, topics, source);
      results.push(...sourceResults);
    } catch (error) {
      console.warn(`Error searching ${source.name}:`, error.message);
    }
  }

  return results;
}

/**
 * Search a specific source website
 */
async function searchSource(query, topics, source) {
  const results = [];
  const searchUrls = buildSearchUrls(query, topics, source);

  for (const url of searchUrls) {
    try {
      const content = await fetchAndParseContent(url);
      if (content) {
        results.push({
          url,
          title: extractTitle(content),
          content: extractMainContent(content),
          source: source.name,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      console.warn(`Error fetching ${url}:`, error.message);
    }
  }

  return results;
}

/**
 * Build search URLs for a specific source
 */
function buildSearchUrls(query, topics, source) {
  const urls = [];

  if (source.baseUrl.includes('accountingcoach')) {
    const searchTerm = encodeURIComponent(query);
    urls.push(`${source.baseUrl}/?s=${searchTerm}`);
  }

  for (const topic of topics.slice(0, 3)) {
    const topicPath = topic.toLowerCase().replace(/\s+/g, '-');
    for (const path of source.searchPaths) {
      urls.push(`${source.baseUrl}${path}${topicPath}/`);
    }
  }

  return urls;
}

/**
 * Fetch and parse HTML content from a URL
 */
async function fetchAndParseContent(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    return html;
  } catch (error) {
    console.warn(`Error fetching ${url}:`, error.message);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Extract title from HTML content
 */
function extractTitle(html) {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    return titleMatch[1].trim();
  }

  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) {
    return h1Match[1].trim();
  }

  return 'Untitled';
}

/**
 * Extract main content from HTML
 */
function extractMainContent(html) {
  let content = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  content = content.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  content = content.replace(/<[^>]+>/g, ' ');
  content = decodeHTMLEntities(content);
  content = content.replace(/\s+/g, ' ').trim();

  return content.substring(0, 2000);
}

/**
 * Decode HTML entities
 */
function decodeHTMLEntities(text) {
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
  };

  return text.replace(/&[a-z]+;/gi, (entity) => entities[entity] || entity);
}

/**
 * Calculate relevance score for scraped content
 */
export function calculateRelevanceScore(content, query, topics) {
  let score = 0;
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();

  if (lowerContent.includes(lowerQuery)) {
    score += 40;
  }

  for (const topic of topics) {
    if (lowerContent.includes(topic.toLowerCase())) {
      score += 10;
    }
  }

  const queryWords = lowerQuery.split(/\s+/).filter((w) => w.length > 3);
  const matchedWords = queryWords.filter((w) => lowerContent.includes(w)).length;
  score += (matchedWords / queryWords.length) * 30;

  return Math.min(100, score);
}
