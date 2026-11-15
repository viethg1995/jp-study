// Google Gemini API (gói free của AI Studio) — gọi REST, structured output qua responseSchema.
import { geminiSchema } from "../result";
import { type GradeRequest, type Provider, ProviderError } from "./types";

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

export function gemini(apiKey: string, model: string): Provider {
  return {
    name: "gemini",
    async grade(req: GradeRequest, signal: AbortSignal): Promise<unknown> {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const res = await fetch(url, {
        method: "POST",
        signal,
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.system }] },
          contents: [{ role: "user", parts: [{ text: req.user }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            responseSchema: geminiSchema(),
          },
        }),
      });
      if (!res.ok) {
        // 429 = hết quota free → chuyển nhà cung cấp kế tiếp
        throw new ProviderError("gemini", `HTTP ${res.status} ${(await res.text()).slice(0, 200)}`, res.status);
      }
      const body = (await res.json()) as GeminiResponse;
      if (body.promptFeedback?.blockReason) throw new ProviderError("gemini", `bị chặn: ${body.promptFeedback.blockReason}`);
      const cand = body.candidates?.[0];
      const text = cand?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!text) throw new ProviderError("gemini", `không có nội dung (finishReason=${cand?.finishReason ?? "?"})`);
      return text;
    },
  };
}
