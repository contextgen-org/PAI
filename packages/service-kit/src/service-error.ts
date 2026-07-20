export interface ServiceErrorOptions {
  readonly code: string;
  readonly message: string;
  readonly statusCode: number;
  readonly retryable: boolean;
  readonly details?: unknown;
  readonly cause?: unknown;
}

export class ServiceError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly retryable: boolean;
  public readonly details: unknown;

  public constructor(options: ServiceErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "ServiceError";
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.retryable = options.retryable;
    this.details = options.details ?? {};
  }
}
