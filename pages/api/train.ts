import { trainModel } from '../../lib/model';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed. Use POST.' });
  }

  const { sentences } = req.body;

  if (!Array.isArray(sentences) || sentences.length === 0) {
    return res.status(400).json({ message: 'No training sentences provided.' });
  }

  try {
    await trainModel(sentences);
    res.status(200).json({ message: 'Model trained successfully.' });
  } catch (error: any) {
    console.error('Training error:', error);
    res.status(500).json({ message: error.message || 'Training failed due to server error.' });
  }
}
