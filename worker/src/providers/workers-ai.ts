// Cloudflare Workers AI — chạy ngay trong worker qua binding env.AI (hạn mức free mỗi ngày).
import { GRADE_JSON_SCHEMA } from "../result";
import { type GradeRequest, type Provider, ProviderError } from "./types";

export function workersAi(ai: Ai, model: string): Provider {
  return {
    name: "workers-ai",
    async grade(req: GradeRequest): Promise<unknown> {
      let out: unknown;
      try {
        out = await ai.run(model as Parameters<Ai["run"]>[0], {
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: req.user },
          ],
          response_format: { type: "json_schema", json_schema: GRADE_JSON_SCHEMA },
          max_tokens: 4000,
          temperature: 0.2,
        } as never);
      } catch (e) {
        throw new ProviderError("workers-ai", e instanceof Error ? e.message : String(e));
      }
      const response = (out as { response?: unknown } | null)?.response;
      if (response === undefined || response === null || response === "") {
        throw new ProviderError("workers-ai", "không có nội dung");
      }
      return response;
    },
  };
}
