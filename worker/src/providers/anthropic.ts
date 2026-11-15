// Claude (Anthropic API) — trả phí theo token, dùng làm tầng cuối khi các gói free hết hạn mức.
import Anthropic from "@anthropic-ai/sdk";
import { GRADE_JSON_SCHEMA } from "../result";
import { type GradeRequest, type Provider, ProviderError } from "./types";

export function anthropic(apiKey: string, model: string): Provider {
  // maxRetries 0: lỗi thì chuyển ngay sang bước kế (đây đã là tầng cuối, không để người học chờ lâu)
  const client = new Anthropic({ apiKey, maxRetries: 0 });
  return {
    name: "anthropic",
    async grade(req: GradeRequest, signal: AbortSignal): Promise<unknown> {
      let msg: Anthropic.Message;
      try {
        msg = await client.messages.create(
          {
            model,
            max_tokens: 8000,
            system: req.system,
            messages: [{ role: "user", content: req.user }],
            output_config: { effort: "low", format: { type: "json_schema", schema: GRADE_JSON_SCHEMA } },
          },
          { signal },
        );
      } catch (e) {
        const status = e instanceof Anthropic.APIError ? e.status : undefined;
        throw new ProviderError("anthropic", e instanceof Error ? e.message : String(e), status);
      }
      if (msg.stop_reason === "refusal") throw new ProviderError("anthropic", "từ chối trả lời");
      if (msg.stop_reason === "max_tokens") throw new ProviderError("anthropic", "câu trả lời bị cắt (max_tokens)");
      const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
      if (!text) throw new ProviderError("anthropic", "không có nội dung");
      return text;
    },
  };
}
