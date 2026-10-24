import { geminiModel } from '../config/gemini';

export interface GeneratedQuestion {
  text: string;
  type: 'mcq' | 'true_false';
  options: { text: string; is_correct: boolean }[];
  explanation: string;
  hint: string;
  difficulty_score: number;
}

export interface GenerateQuizInput {
  content: string;
  difficulty: 'easy' | 'medium' | 'hard';
  count: number;
}

const buildPrompt = ({ content, difficulty, count }: GenerateQuizInput): string => `
You are an expert quiz generator. Based on the content provided, generate exactly ${count} quiz questions.
Difficulty level: ${difficulty}

STRICT RULES:
- Return ONLY a valid JSON object. No markdown, no code fences, no explanation text.
- Each question must have exactly ONE correct option.
- Hints must be helpful but must NOT give away the answer directly.
- Explanations must be 1-2 sentences explaining why the correct answer is right.
- difficulty_score must be a float between 1.0 (easiest) and 5.0 (hardest).
  Easy questions: 1.0–2.5 | Medium: 2.5–3.5 | Hard: 3.5–5.0

Content to generate questions from:
---
${content.slice(0, 30000)}
---

Return this exact JSON structure (nothing else):
{
  "questions": [
    {
      "text": "Question text here",
      "type": "mcq",
      "options": [
        { "text": "Option A", "is_correct": false },
        { "text": "Option B", "is_correct": true },
        { "text": "Option C", "is_correct": false },
        { "text": "Option D", "is_correct": false }
      ],
      "explanation": "Brief explanation of why the correct answer is right.",
      "hint": "A helpful nudge without giving away the answer.",
      "difficulty_score": 2.5
    }
  ]
}
`;

/**
 * Call Gemini and parse the structured JSON response.
 * Throws if the model returns invalid JSON.
 */
export const generateQuizQuestions = async (
  input: GenerateQuizInput,
): Promise<GeneratedQuestion[]> => {
  const prompt = buildPrompt(input);

  const result = await geminiModel.generateContent(prompt);
  const raw = result.response.text().trim();

  // Strip accidental markdown fences if the model adds them
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

  let parsed: { questions: GeneratedQuestion[] };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('AI returned invalid JSON. Please retry.');
  }

  if (!parsed.questions || !Array.isArray(parsed.questions)) {
    throw new Error('AI response missing questions array. Please retry.');
  }

  return parsed.questions;
};
