import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function generateSimilarSentences(prompt: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'Generate 10 sentences similar to the user input.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
  });

  return response.choices[0].message.content?.split('\n').filter(Boolean) || [];
}
