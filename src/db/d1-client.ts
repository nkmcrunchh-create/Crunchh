import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";

type D1Query = { sql: string; params?: unknown[] };
type D1Result = { results?: any[]; success: boolean; meta?: { changes?: number; last_row_id?: number }; error?: string };

export class D1HttpClient {
  private endpoint() {
    if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_D1_DATABASE_ID || !env.CLOUDFLARE_D1_API_TOKEN) {
      throw new AppError("Cloudflare D1 REST credentials are not configured.", 503, "D1_NOT_CONFIGURED");
    }
    return `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${env.CLOUDFLARE_D1_DATABASE_ID}/query`;
  }

  async query(sql: string, params: unknown[] = []): Promise<D1Result> {
    const response = await fetch(this.endpoint(), {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.CLOUDFLARE_D1_API_TOKEN}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ sql, params }),
      signal: AbortSignal.timeout(15000)
    });
    const data = await response.json() as any;
    if (!response.ok || !data.success) {
      throw new AppError("D1 query failed.", response.status >= 500 ? 503 : 400, "D1_QUERY_FAILED", data.errors || data);
    }
    const result = data.result?.[0] as D1Result;
    if (!result?.success) throw new AppError("D1 statement failed.", 400, "D1_STATEMENT_FAILED", result);
    return result;
  }

  async batch(queries: D1Query[]): Promise<D1Result[]> {
    const response = await fetch(this.endpoint(), {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.CLOUDFLARE_D1_API_TOKEN}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(queries),
      signal: AbortSignal.timeout(30000)
    });
    const data = await response.json() as any;
    if (!response.ok || !data.success) {
      throw new AppError("D1 batch failed.", response.status >= 500 ? 503 : 400, "D1_BATCH_FAILED", data.errors || data);
    }
    return data.result as D1Result[];
  }

  async first<T = any>(sql: string, params: unknown[] = []): Promise<T | null> {
    const result = await this.query(sql, params);
    return (result.results?.[0] as T) || null;
  }

  async all<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.query(sql, params);
    return (result.results || []) as T[];
  }

  async run(sql: string, params: unknown[] = []) {
    return this.query(sql, params);
  }
}

export const d1 = new D1HttpClient();
