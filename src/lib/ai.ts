const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

export async function generateText(prompt: string): Promise<string | null> {
  if (!GEMINI_API_KEY) {
    console.error("[AI] GEMINI_API_KEY not set")
    return null
  }

  try {
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 1.0,
          maxOutputTokens: 1024,
        },
      }),
    })

    if (!res.ok) {
      console.error(`[AI] Gemini ${res.status}: ${await res.text()}`)
      return null
    }

    const json = await res.json()
    return json.candidates?.[0]?.content?.parts?.[0]?.text ?? null
  } catch (err) {
    console.error("[AI] Gemini failed:", err)
    return null
  }
}
