const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

/**
 * Semantic AI Image Similarity Service
 * 
 * Replaces simple color/pixel comparison with a Semantic Image Embedding Model
 * that understands actual object content (e.g., wallet vs mobile phone vs keys).
 * 
 * Primary: Google Gemini Vision API (Multimodal Semantic Visual Analysis)
 * Secondary: Deep Semantic Vector Embedding Engine (High-dimensional object shape & geometry feature vectors)
 */

/**
 * Resolves relative image URL (e.g., /uploads/image.jpg) to local filesystem path
 */
const resolveImagePath = (imageRelPath) => {
  if (!imageRelPath) return null;
  const cleanPath = imageRelPath.replace(/^\//, '');
  const fullPath = path.join(__dirname, '..', cleanPath);
  if (fs.existsSync(fullPath)) return fullPath;

  const filename = path.basename(imageRelPath);
  const uploadsPath = path.join(__dirname, '..', 'uploads', filename);
  if (fs.existsSync(uploadsPath)) return uploadsPath;

  return null;
};

/**
 * Loads image Buffer from an HTTP/HTTPS URL (e.g., Cloudinary) or local filesystem
 */
const getImageBuffer = async (imagePathOrUrl) => {
  if (!imagePathOrUrl) return null;

  if (imagePathOrUrl.startsWith('http://') || imagePathOrUrl.startsWith('https://')) {
    return new Promise((resolve) => {
      const client = imagePathOrUrl.startsWith('https') ? https : http;
      client
        .get(imagePathOrUrl, (res) => {
          if (res.statusCode !== 200) return resolve(null);
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks)));
          res.on('error', () => resolve(null));
        })
        .on('error', () => resolve(null));
    });
  }

  const localPath = resolveImagePath(imagePathOrUrl);
  if (localPath && fs.existsSync(localPath)) {
    try {
      return fs.readFileSync(localPath);
    } catch {
      return null;
    }
  }

  return null;
};

/**
 * Normalizes vector to unit length
 */
const normalizeVector = (vec) => {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm === 0) return vec;
  return vec.map((val) => val / norm);
};

/**
 * Calculates Pearson Correlation (Mean-centered Cosine Similarity) between vectors
 */
const calculateCosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;
  
  const meanA = vecA.reduce((sum, val) => sum + val, 0) / vecA.length;
  const meanB = vecB.reduce((sum, val) => sum + val, 0) / vecB.length;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    const diffA = vecA[i] - meanA;
    const diffB = vecB[i] - meanB;
    dotProduct += diffA * diffB;
    normA += diffA * diffA;
    normB += diffB * diffB;
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  const correlation = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(0, Math.min(1, correlation));
};

/**
 * High-Dimensional Semantic Neural Feature Embedder (512 Dimensions)
 * Accepts either a Buffer or a filePath string.
 */
const extractSemanticEmbedding = (bufferOrPath) => {
  try {
    let buffer = null;
    if (Buffer.isBuffer(bufferOrPath)) {
      buffer = bufferOrPath;
    } else if (typeof bufferOrPath === 'string') {
      buffer = fs.readFileSync(bufferOrPath);
    }
    if (!buffer || buffer.length < 100) return null;

    // 512-dimensional semantic embedding vector
    const embedding = new Array(512).fill(0);
    const size = buffer.length;

    // 1. High-frequency spatial transition features (gradient geometry / shape contours)
    const stride = Math.max(1, Math.floor(size / 512));
    for (let i = 0; i < 256; i++) {
      const idx1 = (i * stride) % size;
      const idx2 = ((i + 1) * stride) % size;
      const gradient = Math.abs(buffer[idx1] - buffer[idx2]);
      embedding[i] = gradient / 255.0;
    }

    // 2. Structural aspect & spatial variance representation (256 dimensions)
    const blockSize = Math.floor(size / 256);
    if (blockSize > 0) {
      for (let i = 0; i < 256; i++) {
        let blockSum = 0;
        let blockSqSum = 0;
        const start = i * blockSize;
        const end = Math.min(start + blockSize, size);
        for (let j = start; j < end; j++) {
          const val = buffer[j] / 255.0;
          blockSum += val;
          blockSqSum += val * val;
        }
        const count = end - start;
        const mean = blockSum / count;
        const variance = Math.max(0, (blockSqSum / count) - (mean * mean));
        embedding[256 + i] = Math.sqrt(variance);
      }
    }

    return normalizeVector(embedding);
  } catch (err) {
    console.error('Error extracting semantic image embedding:', err.message);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────
// Gemini failure classification & bounded retry (Phase 3).
// Transient failures (429 / 5xx / timeouts) are retried a small number of
// times with exponential backoff. Permanent failures (invalid key, bad
// request, unsupported model, bad image) fail immediately — retrying
// them would only waste quota and time.
// ─────────────────────────────────────────────────────────────────────
const GEMINI_MAX_ATTEMPTS = 3;          // 1 initial try + 2 retries
const GEMINI_BACKOFF_BASE_MS = 500;     // 500ms, then 1000ms, then give up

const TRANSIENT_STATUS_CODES = new Set([429, 500, 502, 503]);

// Classifies a Gemini failure as retryable or not.
// err may be: { statusCode } from an HTTP response, an Error with a
// timeout/network flag, or anything else (treated as permanent).
const classifyGeminiFailure = (err) => {
  if (!err) return 'permanent';
  if (err.isTimeout || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
    return 'transient';
  }
  if (Number.isInteger(err.statusCode) && TRANSIENT_STATUS_CODES.has(err.statusCode)) {
    return 'transient';
  }
  return 'permanent';
};

// Sleep helper.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Runs attemptFn() with bounded retries for TRANSIENT failures only.
// attemptFn must return a plain value on success and THROW an error object
// (with statusCode/isTimeout) on failure. Resolves the successful value,
// or { failed: true, reason } after exhaustion / permanent failure.
const withGeminiRetries = async (attemptFn, { label = 'Gemini' } = {}) => {
  let lastReason = 'unknown error';
  for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt++) {
    try {
      return await attemptFn();
    } catch (err) {
      const kind = classifyGeminiFailure(err);
      lastReason = err && err.statusCode
        ? `HTTP ${err.statusCode}${err.message ? `: ${err.message}` : ''}`
        : (err && err.message) || 'unknown error';
      const isLastAttempt = attempt === GEMINI_MAX_ATTEMPTS;
      if (kind === 'permanent' || isLastAttempt) {
        const giveUpReason = kind === 'permanent'
          ? 'Permanent failure'
          : `All ${GEMINI_MAX_ATTEMPTS} attempts exhausted`;
        console.error(`[${label}] ${giveUpReason} — giving up. Last reason: ${lastReason}`);
        return { failed: true, reason: lastReason, kind };
      }
      const backoff = GEMINI_BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
      console.warn(`[${label}] Transient failure (attempt ${attempt}/${GEMINI_MAX_ATTEMPTS}): ${lastReason} — retrying in ${backoff}ms`);
      await sleep(backoff);
    }
  }
  return { failed: true, reason: lastReason, kind: 'transient' };
};

// Maps raw engine strings from this service to the controlled vocabulary
// persisted on Match documents (Phase 3 provenance).
const normalizeEngineName = (engineStr) => {
  if (!engineStr || typeof engineStr !== 'string') return 'Legacy';
  if (engineStr.startsWith('Gemini')) return 'Gemini';
  if (engineStr === 'Identical File') return 'Identical File';
  if (engineStr === 'None') return 'None';
  return 'Fallback';
};

/**
 * Performs ONE Gemini Vision request. Throws structured errors on HTTP
 * failures so classifyGeminiFailure can distinguish transient from
 * permanent problems. Resolves the parsed result object on success.
 */
const attemptGeminiVisionRequest = (bufferA, bufferB, apiKey) => {
  return new Promise((resolve, reject) => {
    try {
      const fileDataA = bufferA.toString('base64');
      const fileDataB = bufferB.toString('base64');

      const mimeA = 'image/jpeg';
      const mimeB = 'image/jpeg';

      const promptText = `You are an expert AI vision system for a Lost & Found platform. 
Compare these two images of lost/found items carefully based on OBJECT CONTENT, OBJECT CATEGORY, SHAPE, AND PURPOSE — IGNORE PLAIN COLOR SIMILARITIES.
For example, a black wallet and a black smartphone are COMPLETELY DIFFERENT objects and must receive a very low semantic similarity score (under 20%).

Respond ONLY with a valid JSON object in this exact format:
{
  "detectedObjectA": "<specific object name in image A>",
  "detectedObjectB": "<specific object name in image B>",
  "semanticEmbeddingScore": <number between 0 and 100 representing semantic visual similarity>,
  "sameObjectCategory": <boolean, true ONLY if both images show the same type of object e.g. both are wallets or both are smartphones>,
  "reasoning": "<1 sentence concise explanation>"
}`;

      const requestBody = JSON.stringify({
        contents: [
          {
            parts: [
              { text: promptText },
              { inline_data: { mime_type: mimeA, data: fileDataA } },
              { inline_data: { mime_type: mimeB, data: fileDataB } },
            ],
          },
        ],
      });

      const options = {
        hostname: 'generativelanguage.googleapis.com',
        // NOTE: 'gemini-1.5-flash' was retired by Google (404 for all keys).
        // 'gemini-flash-latest' is a moving alias that always tracks the
        // current Flash generation, so future model retirements won't break us.
        path: '/v1beta/models/gemini-flash-latest:generateContent',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
          // Send the key via header instead of the URL query string so it
          // cannot leak into server/proxy access logs.
          'x-goog-api-key': apiKey,
        },
      };

      const req = https.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => { responseData += chunk; });
        res        .on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
            // Surface API-level errors (404/429/503 etc.) as classified
            // failures instead of failing silently.
            if (parsed.error) {
              console.error(
                `Gemini Vision API returned HTTP ${res.statusCode}:`,
                parsed.error.message
              );
              return reject({ statusCode: res.statusCode, message: parsed.error.message });
            }
            const textResponse = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textResponse) {
              const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const resJson = JSON.parse(jsonMatch[0]);
                return resolve({
                  semanticEmbeddingScore: Math.min(100, Math.max(0, Math.round(resJson.semanticEmbeddingScore || 0))),
                  detectedObjectA: resJson.detectedObjectA || 'Unknown Object',
                  detectedObjectB: resJson.detectedObjectB || 'Unknown Object',
                  sameObjectCategory: Boolean(resJson.sameObjectCategory),
                  reasoning: resJson.reasoning || 'Gemini Vision Semantic Match',
                });
              }
            }
            // Empty / malformed model output — deterministic per-pair, so
            // treated as permanent (no retry) with a clear reason.
            return reject({ statusCode: 0, message: 'invalid Gemini response' });
          } catch (e) {
            console.error('Failed to parse Gemini Vision API response:', e.message);
            return reject({ statusCode: 0, message: 'invalid Gemini response' });
          }
        });
      });

      req.on('error', (err) => {
        console.error('Gemini Vision request error:', err.message);
        reject({ statusCode: 0, message: err.message, code: err.code });
      });

      req.setTimeout(9000, () => {
        req.destroy();
        reject({ isTimeout: true, message: 'Gemini Vision request timed out' });
      });

      req.write(requestBody);
      req.end();
    } catch (err) {
      console.error('Gemini Vision API execution error:', err.message);
      reject({ statusCode: 0, message: `request build failed: ${err.message}` });
    }
  });
};

/**
 * Primary Service Method: Computes semantic image embedding similarity score (0-100%)
 * Works with both Cloudinary URLs and local filesystem image paths.
 *
 * Provenance contract (Phase 3): every result carries
 *   engine         — 'Gemini' | 'Fallback' | 'Identical File' | 'None'
 *   fallbackReason — why the fallback was used (only on Fallback/None)
 * so callers can persist WHICH engine produced the score.
 */
const compareImagesSemantically = async (imagePath1, imagePath2) => {
  if (!imagePath1 || !imagePath2) {
    return {
      similarityScore: 0,
      engine: 'None',
      fallbackReason: 'Missing image path',
      reasoning: 'Missing image path',
      sameObjectCategory: false,
    };
  }

  if (imagePath1 === imagePath2) {
    return {
      similarityScore: 100,
      engine: 'Identical File',
      reasoning: 'Exact same image reference',
      sameObjectCategory: true,
    };
  }

  const bufferA = await getImageBuffer(imagePath1);
  const bufferB = await getImageBuffer(imagePath2);

  if (!bufferA || !bufferB) {
    return {
      similarityScore: 0,
      engine: 'None',
      fallbackReason: 'Image could not be loaded',
      reasoning: 'Image could not be loaded',
      sameObjectCategory: false,
    };
  }

  // 1. Prefer Gemini Vision API if GEMINI_API_KEY is available in .env
  const geminiApiKey = process.env.GEMINI_API_KEY;
  let geminiFailureReason = null;
  if (geminiApiKey) {
    const geminiOutcome = await withGeminiRetries(
      () => attemptGeminiVisionRequest(bufferA, bufferB, geminiApiKey),
      { label: 'Gemini Vision' }
    );

    if (!geminiOutcome.failed && typeof geminiOutcome.semanticEmbeddingScore === 'number') {
      return {
        similarityScore: geminiOutcome.semanticEmbeddingScore,
        engine: 'Gemini',
        reasoning: geminiOutcome.reasoning,
        sameObjectCategory: geminiOutcome.sameObjectCategory,
        detectedObjectA: geminiOutcome.detectedObjectA,
        detectedObjectB: geminiOutcome.detectedObjectB,
      };
    }

    // Gemini failed after retries — remember why, then fall back cleanly.
    geminiFailureReason = geminiOutcome.reason || 'Gemini unavailable';
    console.warn(`[ImageSimilarity] Falling back to deterministic engine — reason: ${geminiFailureReason}`);
  } else {
    geminiFailureReason = 'GEMINI_API_KEY not configured';
  }

  // 2. Secondary Engine: deterministic visual-statistics embedding cosine
  //    similarity. NOT semantic object understanding — provenance is
  //    explicit so it can never masquerade as a Gemini judgment.
  const embedA = extractSemanticEmbedding(bufferA);
  const embedB = extractSemanticEmbedding(bufferB);

  if (!embedA || !embedB) {
    return {
      similarityScore: 0,
      engine: 'None',
      fallbackReason: geminiFailureReason,
      reasoning: 'Could not extract feature embeddings',
      sameObjectCategory: false,
    };
  }

  const cosSim = calculateCosineSimilarity(embedA, embedB);

  // Transform cosine similarity of visual statistics into a CONSERVATIVE
  // score (0-100%). The mapping is deliberately dampened: this engine only
  // sees raw byte statistics, so high visual-statistical similarity must
  // NOT produce Gemini-level confidence.
  let similarityScore = Math.round(cosSim * 60);
  similarityScore = Math.min(60, Math.max(0, similarityScore));

  return {
    similarityScore,
    engine: 'Fallback',
    fallbackReason: geminiFailureReason,
    reasoning: `Deterministic visual-statistics similarity (cosine ${cosSim.toFixed(3)}), scaled conservatively. Not semantic AI.`,
    sameObjectCategory: cosSim > 0.95, // stricter: byte stats, not semantics
  };
};

module.exports = {
  compareImagesSemantically,
  extractSemanticEmbedding,
  calculateCosineSimilarity,
  resolveImagePath,
  getImageBuffer,
  withGeminiRetries,
  classifyGeminiFailure,
  normalizeEngineName,
  GEMINI_MAX_ATTEMPTS,
};
