import { pipeline } from '@xenova/transformers';
import fs from 'fs';
import path from 'path';

const TRAINING_FILE = path.resolve('./data/training.json');
const SIMILARITY_THRESHOLD = 0.3;

let embedder: any = null;
let trainedEmbeddings: number[][] = [];
let trainedSentences: string[] = [];

export async function loadModel(): Promise<void> {
  if (!embedder) {
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('Model loaded successfully.');
  }
}

export async function trainModel(sentences: string[]): Promise<void> {
  await loadModel();
  trainedSentences = sentences;

  trainedEmbeddings = await Promise.all(
    sentences.map(async (s) => {
      try {
        const res = await embedder(s, { pooling: 'mean', normalize: true });
        const embedding = (await res.tolist())[0]; 
        if (!Array.isArray(embedding) || embedding.length === 0) {
          throw new Error(`Invalid embedding for sentence: "${s}"`);
        }
        return embedding;
      } catch (err) {
        console.error('Embedding error:', err);
        return new Array(384).fill(0); 
      }
    })
  );

  fs.writeFileSync(TRAINING_FILE, JSON.stringify(sentences, null, 2));
  console.log('Training completed and saved.');
}

export async function testSentence(sentence: string): Promise<{ bestMatch: string | null; bestScore: number | null }> {
  await loadModel();

  if (trainedEmbeddings.length === 0 || trainedSentences.length === 0) {
    if (fs.existsSync(TRAINING_FILE)) {
      const saved = JSON.parse(fs.readFileSync(TRAINING_FILE, 'utf-8'));
      await trainModel(saved);
    } else {
      console.warn('No training data available.');
      return { bestMatch: null, bestScore: null };
    }
  }

  try {
    const res = await embedder(sentence, { pooling: 'mean', normalize: true });
    const testEmbedding = (await res.tolist())[0]; // ✅ extract flat vector
    if (!Array.isArray(testEmbedding) || testEmbedding.length === 0) {
      throw new Error('Failed to generate embedding for test sentence.');
    }

    let bestMatch: string | null = null;
    let bestScore = -Infinity;

    trainedEmbeddings.forEach((embedding, i) => {
      const score = cosineSimilarity(testEmbedding, embedding);
      console.log(`Similarity with "${trainedSentences[i]}": ${score.toFixed(2)}`);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = trainedSentences[i];
      }
    });

    if (bestScore < SIMILARITY_THRESHOLD) {
      console.log(`No match passed the threshold (${SIMILARITY_THRESHOLD}).`);
      return { bestMatch: null, bestScore };
    }

    console.log('Best match:', bestMatch);
    return { bestMatch, bestScore };
  } catch (error) {
    console.error('Test sentence error:', error);
    return { bestMatch: null, bestScore: null };
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return normA && normB ? dot / (normA * normB) : 0;
}
