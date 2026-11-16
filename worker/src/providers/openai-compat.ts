// Server AI tương thích OpenAI (POST {baseUrl}/chat/completions) — nhà cung cấp chính.
// Structured output qua response_format json_schema.
import { GRADE_JSON_SCHEMA } from "../result";
import { type GradeRequest, type Provider, ProviderError } from "./types";

interface ChatResponse {
  choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
}

export function openaiCompat(baseUrl: string, apiKey: string, model: string): Provider {
  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  return {
    name: "openai-compat",
    async grade(req: GradeRequest, signal: AbortSignal): Promise<unknown> {
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          signal,
          headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            max_tokens: 8000,
            temperature: 0.2,
            messages: [
              { role: "system", content: req.system },
              { role: "user", content: req.user },
            ],
            response_format: {
              type: "json_schema",
              json_schema: { name: "grade_result", strict: true, schema: GRADE_JSON_SCHEMA },
            },
          }),
        });
      } catch (e) {
        throw new ProviderError("openai-compat", e instanceof Error ? e.message : String(e));
      }
      if (!res.ok) {
        throw new ProviderError("openai-compat", `HTTP ${res.status} ${(await res.text()).slice(0, 200)}`, res.status);
      }
      const choice = ((await res.json()) as ChatResponse).choices?.[0];
      if (choice?.message?.refusal) throw new ProviderError("openai-compat", "từ chối trả lời");
      if (choice?.finish_reason === "length") throw new ProviderError("openai-compat", "câu trả lời bị cắt (max_tokens)");
      const text = choice?.message?.content ?? "";
      if (!text.trim()) throw new ProviderError("openai-compat", `không có nội dung (finish_reason=${choice?.finish_reason ?? "?"})`);
      return text;
    },
  };
}
