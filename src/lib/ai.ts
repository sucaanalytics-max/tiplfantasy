const GROQ_API_KEY = process.env.GROQ_API_KEY
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

export async function generateText(prompt: string): Promise<string | null> {
  if (!GROQ_API_KEY) {
    console.error("[AI] GROQ_API_KEY not set")
    return null
  }

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 1.0,
        max_tokens: 1024,
      }),
    })

    if (!res.ok) {
      console.error(`[AI] Groq ${res.status}: ${await res.text()}`)
      return null
    }

    const json = await res.json()
    return json.choices?.[0]?.message?.content ?? null
  } catch (err) {
    console.error("[AI] Groq failed:", err)
    return null
  }
}
