export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function notFoundError(message = "Not Found"): AppError {
  return new AppError(404, "NOT FOUND", message);
}
export function forbiddenError(message = "Forbidden"): AppError {
  return new AppError(403, "FORBIDDEN", message);
}
export function conflictError(code: string, message: string): AppError {
  return new AppError(409, code, message);
}
