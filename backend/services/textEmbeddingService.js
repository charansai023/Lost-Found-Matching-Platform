const fs = require('fs');
const https = require('https');

/**
 * Reusable Synonym Dictionary
 */
const SYNONYM_DICTIONARY = {
  phone: ['mobile', 'smartphone', 'cellphone', 'cell'],
  mobile: ['phone', 'smartphone', 'cellphone', 'cell'],
  smartphone: ['phone', 'mobile', 'cellphone', 'cell'],
  laptop: ['notebook', 'computer', 'portable computer', 'pc', 'dell', 'macbook', 'lenovo', 'hp'],
  notebook: ['laptop', 'computer', 'portable computer', 'pc'],
  computer: ['laptop', 'notebook', 'pc'],
  keys: ['keychain', 'key', 'fob', 'vehicle keys'],
  keychain: ['keys', 'key', 'fob'],
  wallet: ['purse', 'billfold', 'cardholder', 'clutch'],
  purse: ['wallet', 'billfold', 'cardholder', 'bag'],
  bottle: ['flask', 'tumbler', 'water bottle', 'canteen'],
  flask: ['bottle', 'tumbler', 'water bottle'],
  playground: ['college ground', 'field', 'sports ground', 'ground'],
  'college ground': ['playground', 'field', 'sports ground', 'ground'],
  'id card': ['identity card', 'identity', 'badge', 'id'],
  'identity card': ['id card', 'identity', 'badge', 'id'],
};

// Common stopwords to filter out before generating embeddings / tokenizing
const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'arent',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'cant', 'cannot', 'could', 'couldnt', 'did', 'didnt', 'do', 'does', 'doesnt', 'doing', 'dont',
  'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadnt', 'has', 'hasnt', 'have',
  'havent', 'having', 'he', 'hed', 'hell', 'hes', 'her', 'here', 'heres', 'hers', 'herself', 'him',
  'himself', 'his', 'how', 'hows', 'i', 'id', 'ill', 'im', 'ive', 'if', 'in', 'into', 'is', 'isnt',
  'it', 'its', 'itself', 'lets', 'me', 'more', 'most', 'mustnt', 'my', 'myself', 'no', 'nor', 'not',
  'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over',
  'own', 'same', 'shant', 'she', 'shed', 'shell', 'shes', 'should', 'shouldnt', 'so', 'some', 'such',
  'than', 'that', 'thats', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'theres',
  'these', 'they', 'theyd', 'theyll', 'theyre', 'theyve', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very', 'was', 'wasnt', 'we', 'wed', 'well', 'were', 'weve', 'werent',
  'what', 'whats', 'when', 'whens', 'where', 'wheres', 'which', 'while', 'who', 'whos', 'whom',
  'why', 'whys', 'with', 'wont', 'would', 'wouldnt', 'you', 'youd', 'youll', 'youre', 'youve',
  'your', 'yours', 'yourself', 'yourselves'
]);

/**
 * Text Normalization, Synonym Replacement, and Stopword Filtering
 */
const normalizeText = (text) => {
  if (!text) return '';
  
  // 1. Lowercase, remove punctuation and extra spaces
  let cleaned = text
    .toString()
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 2. Tokenize and filter stopwords & apply canonical synonym mapping
  const words = cleaned.split(' ');
  const processedWords = [];

  for (let word of words) {
    if (STOPWORDS.has(word) || word.length <= 1) continue;

    let canonical = word;
    for (const [key, synonyms] of Object.entries(SYNONYM_DICTIONARY)) {
      if (key === word || synonyms.includes(word)) {
        canonical = key;
        break;
      }
    }
    processedWords.push(canonical);
  }

  // 3. Normalize compound synonym phrases
  let joined = processedWords.join(' ');
  for (const [key, synonyms] of Object.entries(SYNONYM_DICTIONARY)) {
    if (key.includes(' ') && joined.includes(key)) {
      joined = joined.replace(key, key.replace(/\s+/g, ''));
    }
    for (const syn of synonyms) {
      if (syn.includes(' ') && joined.includes(syn)) {
        joined = joined.replace(syn, key.replace(/\s+/g, ''));
      }
    }
  }

  return joined;
};

/**
 * Cosine Similarity Helper
 */
const calculateCosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Gemini Embedding API
 */
const getGeminiTextEmbedding = async (text, apiKey) => {
  return new Promise((resolve) => {
    try {
      const requestBody = JSON.stringify({
        model: 'models/text-embedding-004',
        content: {
          parts: [{ text }]
        }
      });

      const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody)
        }
      };

      const req = https.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
            const values = parsed.embedding?.values;
            if (values && Array.isArray(values)) {
              return resolve(values);
            }
          } catch (e) {
            console.error('Failed to parse Gemini Text Embedding response:', e.message);
          }
          resolve(null);
        });
      });

      req.on('error', (err) => {
        console.error('Gemini Text Embedding API request error:', err.message);
        resolve(null);
      });

      req.setTimeout(5000, () => {
        req.destroy();
        resolve(null);
      });

      req.write(requestBody);
      req.end();
    } catch (err) {
      console.error('Gemini Text Embedding execution error:', err.message);
      resolve(null);
    }
  });
};

/**
 * Offline Semantic Text Vector Generator (512 dimensions)
 * Maps words to dimensions based on character hash distributions and synonym overlap.
 */
const generateLocalTextEmbedding = (text) => {
  const norm = normalizeText(text);
  const words = norm.split(' ').filter(w => w.length > 0);
  const vector = new Array(512).fill(0);

  if (words.length === 0) return vector;

  // Compute character hashing to map tokens to unique dimensions
  words.forEach((word) => {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash << 5) - hash + word.charCodeAt(i);
      hash |= 0;
    }
    
    // Map word to 3 distinct dimensions for robust overlap
    for (let d = 0; d < 3; d++) {
      const dim = Math.abs((hash + d * 97) % 512);
      vector[dim] += 1.0;
    }

    // Reinforce dimensions corresponding to its synonym classes
    Object.keys(SYNONYM_DICTIONARY).forEach((key) => {
      if (word === key || SYNONYM_DICTIONARY[key].includes(word)) {
        // Map synonym group to dedicated signature dimensions
        let groupHash = 0;
        for (let i = 0; i < key.length; i++) {
          groupHash = (groupHash << 5) - groupHash + key.charCodeAt(i);
        }
        for (let d = 0; d < 2; d++) {
          const dim = Math.abs((groupHash + d * 149) % 512);
          vector[dim] += 1.5; // Give stronger weight to semantic classes
        }
      }
    });
  });

  // Normalize to unit vector
  let normVal = 0;
  for (let i = 0; i < 512; i++) normVal += vector[i] * vector[i];
  normVal = Math.sqrt(normVal);

  if (normVal > 0) {
    for (let i = 0; i < 512; i++) vector[i] /= normVal;
  }

  return vector;
};

/**
 * Public method: Generates text embedding using Gemini (if key exists) or local fallback
 */
const generateTextEmbedding = async (text) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const normalized = normalizeText(text);

  if (apiKey) {
    const embed = await getGeminiTextEmbedding(normalized, apiKey);
    if (embed) return embed;
  }

  return generateLocalTextEmbedding(normalized);
};

/**
 * Generates synonyms search array for MongoDB query expansion (Semantic Search)
 */
const getSearchQuerySynonyms = (query) => {
  if (!query) return [];
  const normalized = query.toLowerCase().trim();
  const synonymsSet = new Set([normalized]);

  // Try matching individual tokens
  const tokens = normalized.split(/\s+/);
  tokens.forEach((token) => {
    if (SYNONYM_DICTIONARY[token]) {
      SYNONYM_DICTIONARY[token].forEach((syn) => synonymsSet.add(syn));
    }
    // Check if token is synonym of a key
    Object.keys(SYNONYM_DICTIONARY).forEach((key) => {
      if (SYNONYM_DICTIONARY[key].includes(token)) {
        synonymsSet.add(key);
        SYNONYM_DICTIONARY[key].forEach((syn) => synonymsSet.add(syn));
      }
    });
  });

  return Array.from(synonymsSet);
};

module.exports = {
  normalizeText,
  calculateCosineSimilarity,
  generateTextEmbedding,
  getSearchQuerySynonyms,
  SYNONYM_DICTIONARY,
};
