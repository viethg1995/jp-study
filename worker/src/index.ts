// Cloudflare Worker chấm bài luyện dịch. Web tĩnh (GitHub Pages) gọi POST /grade.
// Giữ API key ở đây (secret) — không bao giờ đưa key ra trình duyệt.
//
// Luồng: CORS → giới hạn tần suất (theo IP) → Turnstile (nếu bật) → cache KV → lần lượt từng
// nhà cung cấp trong PROVIDERS (lỗi / hết quota / JSON sai → thử nhà kế tiếp) → lưu cache.
import { getExercise } from "./exercises";
import { PROMPT_VERSION, SYSTEM_PROMPT, userPrompt } from "./prompt";
import { anthropic } from "./providers/anthropic";
import { gemini } from "./providers/gemini";
import type { Provider } from "./providers/types";
import { workersAi } from "./providers/workers-ai";
import { type GradeResult, parseGrade } from "./result";

export interface Env {
  // Secret (wrangler secret put …) — thiếu key nào thì bỏ qua nhà cung cấp đó
  GEMINI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  TURNSTILE_SECRET?: string; // có → bắt buộc token Turnstile
  // Binding (wrangler.jsonc) — đều tùy chọn
  AI?: Ai;
  CACHE?: KVNamespace;
  RATE_LIMITER?: RateLimit;
  // Biến thường
  ALLOWED_ORIGINS: string; // "https://user.github.io,http://localhost:4321"
  PROVIDERS: string; // thứ tự thử: "gemini,workers-ai,anthropic"
  GEMINI_MODEL: string;
  WORKERS_AI_MODEL: string;
  ANTHROPIC_MODEL: string;
  MAX_ANSWER_CHARS?: string;
}

type ErrorCode = "bad_request" | "origin" | "rate_limited" | "captcha" | "unknown_exercise" | "too_long" | "unavailable";

const MESSAGES: Record<ErrorCode, string> = {
  bad_request: "Yêu cầu không hợp lệ.",
  origin: "Trang này không được phép gọi máy chấm.",
  rate_limited: "Bạn nộp hơi nhanh, đợi một phút rồi thử lại nhé.",
  captcha: "Chưa xác minh được bạn không phải robot, tải lại trang rồi thử lại.",
  unknown_exercise: "Không tìm thấy đề này.",
  too_long: "Bài làm quá dài.",
  unavailable: "Máy chấm đang quá tải hoặc hết lượt miễn phí hôm nay. Thử lại sau nhé.",
};
const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  origin: 403,
  rate_limited: 429,
  captcha: 403,
  unknown_exercise: 404,
  too_long: 413,
  unavailable: 503,
};
const CACHE_TTL = 60 * 60 * 24 * 30; // 30 ngày
const PROVIDER_TIMEOUT_MS = 30_000;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("origin") ?? "";
    const allowed = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
    const cors = corsHeaders(allowed.includes(origin) ? origin : null);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (url.pathname === "/health") {
      return json({ ok: true, providers: providers(env).map((p) => p.name) }, 200, cors);
    }
    if (url.pathname !== "/grade" || request.method !== "POST") return new Response("Not found", { status: 404 });

    const fail = (code: ErrorCode): Response =>
      json({ ok: false, error: code, message_vi: MESSAGES[code] }, STATUS[code], cors);
    if (!allowed.includes(origin)) return fail("origin");

    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    if (env.RATE_LIMITER) {
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) return fail("rate_limited");
    }

    let body: { exerciseId?: unknown; answer?: unknown; turnstileToken?: unknown };
    try {
      body = await request.json();
    } catch {
      return fail("bad_request");
    }
    if (typeof body.exerciseId !== "string" || typeof body.answer !== "string") return fail("bad_request");
    const answer = normalize(body.answer);
    if (!answer) return fail("bad_request");
    if (answer.length > Number(env.MAX_ANSWER_CHARS ?? 1000)) return fail("too_long");
    const exercise = getExercise(body.exerciseId);
    if (!exercise) return fail("unknown_exercise");

    if (env.TURNSTILE_SECRET) {
      const token = typeof body.turnstileToken === "string" ? body.turnstileToken : "";
      if (!(await verifyTurnstile(env.TURNSTILE_SECRET, token, ip))) return fail("captcha");
    }

    const key = await cacheKey(exercise.id, answer);
    const hit = await env.CACHE?.get<{ result: GradeResult; provider: string }>(key, "json");
    if (hit) return json({ ok: true, ...hit, cached: true }, 200, cors);

    const req = { system: SYSTEM_PROMPT, user: userPrompt(exercise, answer) };
    for (const p of providers(env)) {
      try {
        const raw = await p.grade(req, AbortSignal.timeout(PROVIDER_TIMEOUT_MS));
        const result = parseGrade(raw, exercise.sentences.length);
        if (env.CACHE) {
          ctx.waitUntil(env.CACHE.put(key, JSON.stringify({ result, provider: p.name }), { expirationTtl: CACHE_TTL }));
        }
        return json({ ok: true, result, provider: p.name, cached: false }, 200, cors);
      } catch (e) {
        // Không ghi bài làm của học viên vào log — chỉ ghi lỗi
        console.warn(`[grade] ${exercise.id} ${p.name} lỗi: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return fail("unavailable");
  },
} satisfies ExportedHandler<Env>;

/** Danh sách nhà cung cấp theo thứ tự PROVIDERS, bỏ qua nhà chưa cấu hình key/binding. */
function providers(env: Env): Provider[] {
  const out: Provider[] = [];
  for (const name of env.PROVIDERS.split(",").map((s) => s.trim())) {
    if (name === "gemini" && env.GEMINI_API_KEY) out.push(gemini(env.GEMINI_API_KEY, env.GEMINI_MODEL));
    else if (name === "workers-ai" && env.AI) out.push(workersAi(env.AI, env.WORKERS_AI_MODEL));
    else if (name === "anthropic" && env.ANTHROPIC_API_KEY) out.push(anthropic(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL));
  }
  return out;
}

/** Chuẩn hóa để cache khớp: NFC, gộp khoảng trắng (cả khoảng trắng toàn góc), bỏ khoảng trắng đầu/cuối dòng. */
function normalize(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[ \t　]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

async function cacheKey(exerciseId: string, answer: string): Promise<string> {
  const data = new TextEncoder().encode(`${PROMPT_VERSION}|${exerciseId}|${answer}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hex = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `grade:${exerciseId}:${hex}`;
}

async function verifyTurnstile(secret: string, token: string, ip: string): Promise<boolean> {
  if (!token) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  form.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  const out = (await res.json()) as { success?: boolean };
  return out.success === true;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const h: Record<string, string> = {
    "access-control-allow-methods": "POST, GET, OPTIONS",
    "access-control-allow-headers": "content-type",
    vary: "origin",
  };
  if (origin) h["access-control-allow-origin"] = origin;
  return h;
}

function json(data: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "content-type": "application/json; charset=utf-8" },
  });
}
