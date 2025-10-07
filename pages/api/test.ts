// api/test.ts

import { testSentence } from '../../lib/model';

export default async function handler(req:any, res:any) {
  const { sentence } = req.body;
  const result = await testSentence(sentence);
  res.status(200).json(result);
}
