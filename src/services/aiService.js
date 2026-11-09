/**
 * AI Service for EPIA Fertility Patient Follow-up Draft Generation
 * Supports:
 * 1. Google Gemini API (via @google/genai)
 * 2. OpenAI API (via native fetch)
 * 3. Intelligent Mock Fallback (when keys are omitted or network is unavailable)
 */

const { GoogleGenAI } = require('@google/genai');

/**
 * Generates an empathetic, high-quality mock draft when live LLM APIs are not configured.
 * Rotates through warm healthcare phrasing while adhering strictly to:
 * - Patient personalization (name and consultation date)
 * - Concise length (< 60 words)
 * - Zero placeholders
 */
function generateMockDraft(patientName, consultationDate) {
  const templates = [
    `Hi ${patientName}, this is EPIA Fertility checking in after your consultation on ${consultationDate}. We hope you are resting well! Just a gentle reminder about your follow-up appointment scheduled for today. Please let us know if you have any questions or need to adjust your time. We're here for you!`,
    `Hello ${patientName}, warm greetings from EPIA Fertility. Following up on your visit from ${consultationDate}—how are you feeling today? We look forward to seeing you for your follow-up appointment later today. Feel free to reply right here if you need any assistance before your visit.`,
    `Dear ${patientName}, the team at EPIA Fertility hopes you are doing well since our consultation on ${consultationDate}. This is a quick note to remind you of your follow-up check-in today. We are looking forward to connecting with you. Please let us know if there is anything you need beforehand!`
  ];

  // Pick deterministic or semi-random template based on patient name hash
  const charSum = patientName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const index = charSum % templates.length;
  return templates[index];
}

/**
 * Builds the standard EPIA prompt template
 */
function buildPrompt(patientName, consultationDate) {
  return `You are a clinic care coordinator for EPIA Fertility. Draft a concise, warm WhatsApp follow-up message to ${patientName} who had their consultation on ${consultationDate}. Ask how they are feeling and remind them of their follow-up appointment today. Keep it under 60 words and exclude placeholders.`;
}

/**
 * Primary draft generation function
 */
async function generateFollowUpDraft(patientName, consultationDate) {
  const prompt = buildPrompt(patientName, consultationDate);

  // 1. Try Google Gemini API
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
    try {
      console.log(`[AI Service] Generating draft via Google Gemini API for ${patientName}...`);
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY.trim() });
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      const responseText = response.text ? response.text.trim() : '';
      if (responseText) {
        return {
          draft: responseText,
          provider: 'Google Gemini (gemini-2.5-flash)',
          prompt
        };
      }
    } catch (err) {
      console.warn(`[AI Service] Gemini API call failed (${err.message}). Falling back...`);
    }
  }

  // 2. Try OpenAI API
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '') {
    try {
      console.log(`[AI Service] Generating draft via OpenAI API for ${patientName}...`);
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY.trim()}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a warm, professional care coordinator at EPIA Fertility clinic.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 150,
          temperature: 0.7
        })
      });

      if (response.ok) {
        const data = await response.json();
        const draft = data.choices?.[0]?.message?.content?.trim();
        if (draft) {
          return {
            draft,
            provider: 'OpenAI (gpt-4o-mini)',
            prompt
          };
        }
      } else {
        const errorText = await response.text();
        console.warn(`[AI Service] OpenAI API error: ${response.status} - ${errorText}`);
      }
    } catch (err) {
      console.warn(`[AI Service] OpenAI API call failed (${err.message}). Falling back...`);
    }
  }

  // 3. Fallback to Mock Generator
  console.log(`[AI Service] Using Mock AI Generator for ${patientName} (no external API keys configured).`);
  const mockDraft = generateMockDraft(patientName, consultationDate);
  return {
    draft: mockDraft,
    provider: 'Mock Fallback (Built-in Heuristic Generator)',
    prompt
  };
}

module.exports = {
  generateFollowUpDraft,
  buildPrompt,
  generateMockDraft
};
