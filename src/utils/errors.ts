export class AppError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
    public code = "BAD_REQUEST",
    public details?: unknown
  ) {
    super(message);
  }
}

export function assertApp(condition: unknown, message: string, statusCode = 400, code = "BAD_REQUEST"): asserts condition {
  if (!condition) throw new AppError(message, statusCode, code);
}
