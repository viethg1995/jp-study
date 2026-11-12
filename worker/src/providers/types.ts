export interface GradeRequest {
  system: string;
  user: string;
}

/** Lỗi của một nhà cung cấp — điều phối sẽ thử nhà cung cấp kế tiếp. */
export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    message: string,
    readonly status?: number,
  ) {
    super(`${provider}: ${message}`);
  }
}

export interface Provider {
  name: string;
  /** Trả JSON thô (chuỗi hoặc object) — zod kiểm ở bước sau. */
  grade(req: GradeRequest, signal: AbortSignal): Promise<unknown>;
}
