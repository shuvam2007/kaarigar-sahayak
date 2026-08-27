// api/generate-listing.js
// Vercel serverless function — keeps GEMINI_API_KEY on the server.

const GEMINI_MODEL = 'gemini-3.6-flash';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ 
      error: 'GEMINI_API_KEY is not set on the server. Check your environment variables and restart `vercel dev`.' 
    });
  }

  const { imageBase64, imageMediaType, notes, langInstruction } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 is required' });
  }

  const systemPrompt = `You are a cataloging assistant embedded in a mobile app for low-literacy Indian artisans and weavers selling handmade goods (textiles, pottery, jewelry, woodwork, etc). Given a photo of a product and optional notes from the artisan (which may be informal, in Hindi/English/Hinglish, or voice-transcribed), produce a market-ready e-commerce catalog listing.

${langInstruction || 'Provide fields in BOTH English and Hindi (Devanagari script) as specified.'}

Consider real Indian handicraft marketplace conventions (Amazon Karigar, GeM Indiahandmade, ONDC network listings) for tone and pricing realism. Base the suggested price range on visible material, craftsmanship complexity, and typical Indian handicraft market rates — be realistic, not inflated.`;

  const requestBody = {
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: [
      {
        role: 'user',
        parts: [
          { inline_data: { mime_type: imageMediaType || 'image/jpeg', data: imageBase64 } },
          { text: notes ? `Artisan's notes: ${notes}` : 'No additional notes provided by the artisan — infer everything from the photo.' }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
      responseSchema: {
        type: "OBJECT",
        properties: {
          title_en: { type: "STRING", description: "max 8 words, e-commerce style title" },
          title_hi: { type: "STRING", description: "in Devanagari, max 8 words" },
          description_en: { type: "STRING", description: "2-3 sentences, max 60 words, highlights craftsmanship and materials" },
          description_hi: { type: "STRING", description: "in Devanagari, 2-3 sentences, max 60 words" },
          category: { type: "STRING", description: "e.g. Handloom Textiles / Pottery / Jewelry / Woodwork / Metalwork / Other" },
          materials: { type: "STRING", description: "short comma-separated string" },
          price_min_inr: { type: "INTEGER" },
          price_max_inr: { type: "INTEGER" },
          price_reasoning: { type: "STRING", description: "max 25 words, why this range" },
          tags: { 
            type: "ARRAY", 
            items: { type: "STRING" },
            description: "array of 5 short lowercase tags"
          },
          marketplace_readiness: { type: "INTEGER", description: "integer from 1-10" },
          readiness_tip: { type: "STRING", description: "max 20 words, one concrete tip to improve the listing or photo" }
        },
        required: ["title_en", "title_hi", "description_en", "description_hi", "category", "materials", "price_min_inr", "price_max_inr", "price_reasoning", "tags", "marketplace_readiness", "readiness_tip"]
      }
    }
  };

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY 
        },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Gemini API error: ${errText}` });
    }

    const data = await response.json();
    const candidate = data.candidates && data.candidates[0];
    const parts = candidate && candidate.content && candidate.content.parts;
    const textBlock = (parts || []).map(p => p.text || '').join('');

    if (!textBlock) {
      return res.status(502).json({ 
        error: 'Gemini returned no content — the image may have been blocked by safety filters, or the free-tier rate limit was hit.' 
      });
    }

    // The API now strictly enforces the JSON structure, so regex cleanups are no longer needed
    const listing = JSON.parse(textBlock.trim());

    return res.status(200).json(listing);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unknown server error' });
  }
}