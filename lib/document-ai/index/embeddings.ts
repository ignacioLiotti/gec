const EMBEDDING_MODEL = "text-embedding-3-small";

export async function createDocumentAiEmbedding(input: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || input.trim().length === 0) return null;
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: input.slice(0, 8000),
    }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    console.warn("[document-ai/embeddings] skipped", payload);
    return null;
  }
  const payload = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
  const embedding = payload.data?.[0]?.embedding;
  return Array.isArray(embedding) && embedding.length === 1536 ? embedding : null;
}
