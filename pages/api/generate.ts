// api/generate.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error('GEMINI_API_KEY environment variable not set.');
}

const ai = new GoogleGenAI({ apiKey });
const MODEL_NAME = 'gemini-2.5-flash-lite';

//system instruction

const SYSTEM_INSTRUCTION = `You are an NLP model designed to generate a list of exactly 10 sentences that are grammatically correct and contextually similar to the user with simple vocabulary's input sentence, but with different phrasing and sentence structure. 
Your entire response must be a valid JSON array of strings, where each string is one of the generated sentences. DO NOT include any explanatory text, markdown outside of the JSON block, or numbering.
Example response: ["Sentence one.", "Sentence two.", "Sentence three.", "Sentence four.", "Sentence five.",...]`

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { sentence: inputSentence } = req.body;

  if (!inputSentence) {
    return res.status(400).json({ error: 'Missing sentence in request body.' });
  }

  const prompt = `Input sentence to rephrase: "${inputSentence}"`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json', // Enforce JSON output
        responseSchema: { // Define the expected structure
          type: 'array',
          items: {
            type: 'string',
          },
        },
        temperature: 0.8, // Add some creativity to the rephrasing
        maxOutputTokens: 1024,
      },
    });

    const jsonText = (response.text as string).trim();

    let generatedSentences: string[];
    
    try {
      // The response text is the JSON string
      generatedSentences = JSON.parse(jsonText);
      if (!Array.isArray(generatedSentences)) {
        throw new Error('Model did not return a valid JSON array.');
      }
    } catch (e) {
      console.error('Failed to parse model output as JSON:', jsonText);
      return res.status(500).json({ 
        error: 'Model output was not in the expected JSON format.', 
        rawOutput: jsonText // Useful for debugging
      });
    }

    // Success: return the array of sentences
    return res.status(200).json({ generatedSentences });
    
  } catch (error) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({ error: 'Gemini API call failed.' });
  }
}