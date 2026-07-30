import {
  MetaCognitionErrorV1,
  type MetaProviderOutputV1,
} from "./meta-types.v1.js";
import { assertBoundedMetaJsonV1 } from "./canonical.v1.js";
import { parseMetaProviderOutputV1 } from "./validation.v1.js";

export const META_PROVIDER_RESPONSE_SCHEMA_V1 = Object.freeze({
  schema_version: "meta_provider_response_schema.v1",
  output_schema: "meta_provider_output.v1",
  additional_properties: false,
  evidence_required: true,
});

export interface MetaProviderRequestV1 {
  readonly prompt: string;
  readonly response_schema: typeof META_PROVIDER_RESPONSE_SCHEMA_V1;
  readonly parser: "meta_provider_output_parser.v1";
}

export interface MetaProviderTransportV1 {
  complete(
    request: MetaProviderRequestV1,
    signal: AbortSignal,
  ): Promise<unknown>;
  checkReadiness?(signal: AbortSignal): Promise<void>;
}

export interface MetaProviderParserV1 {
  readonly parser_id: "meta_provider_output_parser.v1";
  parse(value: unknown): unknown;
}

export interface StructuredMetaProviderPortV1 {
  generate(
    prompt: string,
    signal?: AbortSignal,
  ): Promise<MetaProviderOutputV1>;
  checkReadiness?(signal: AbortSignal): Promise<void>;
}

export const JSON_META_PROVIDER_PARSER_V1: MetaProviderParserV1 =
  Object.freeze({
    parser_id: "meta_provider_output_parser.v1",
    parse(value: unknown): unknown {
      if (typeof value !== "string") return value;
      return JSON.parse(value);
    },
  });

function linkedAbortController(
  parent: AbortSignal,
  timeoutMs: number,
): Readonly<{ controller: AbortController; dispose(): void }> {
  const controller = new AbortController();
  const abort = () => controller.abort(parent.reason);
  if (parent.aborted) abort();
  else parent.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(
    () => controller.abort(new Error("Meta provider timed out")),
    timeoutMs,
  );
  timer.unref();
  return {
    controller,
    dispose() {
      clearTimeout(timer);
      parent.removeEventListener("abort", abort);
    },
  };
}

export function createStructuredMetaProviderAdapterV1(
  transport: MetaProviderTransportV1,
  parser: MetaProviderParserV1 = JSON_META_PROVIDER_PARSER_V1,
  options: Readonly<{
    timeout_ms: number;
    max_parse_retries: number;
    max_output_items: number;
    max_evidence_refs: number;
    max_response_bytes?: number;
  }>,
): StructuredMetaProviderPortV1 {
  const maxResponseBytes = options.max_response_bytes ?? 2 * 1_048_576;
  if (
    parser.parser_id !== "meta_provider_output_parser.v1" ||
    !Number.isSafeInteger(options.timeout_ms) ||
    options.timeout_ms < 100 ||
    !Number.isSafeInteger(options.max_parse_retries) ||
    options.max_parse_retries < 0 ||
    options.max_parse_retries > 3 ||
    !Number.isSafeInteger(maxResponseBytes) ||
    maxResponseBytes < 1_024 ||
    maxResponseBytes > 16 * 1_048_576
  ) {
    throw new Error("Meta provider adapter options are invalid");
  }
  return Object.freeze({
    async generate(
      prompt: string,
      signal = new AbortController().signal,
    ): Promise<MetaProviderOutputV1> {
      if (typeof prompt !== "string" || prompt.length === 0) {
        throw new MetaCognitionErrorV1(
          "provider_invalid",
          "Meta provider prompt is empty",
          false,
        );
      }
      const stableRequest = Object.freeze({
        prompt,
        response_schema: META_PROVIDER_RESPONSE_SCHEMA_V1,
        parser: parser.parser_id,
      });
      let lastError: unknown;
      for (
        let attempt = 0;
        attempt <= options.max_parse_retries;
        attempt += 1
      ) {
        const timeout = linkedAbortController(signal, options.timeout_ms);
        try {
          const raw = await transport.complete(
            stableRequest,
            timeout.controller.signal,
          );
          if (
            typeof raw === "string" &&
            Buffer.byteLength(raw, "utf8") > maxResponseBytes
          ) {
            throw new MetaCognitionErrorV1(
              "provider_invalid",
              "Meta provider response exceeds its byte budget",
              true,
            );
          }
          if (typeof raw !== "string") {
            try {
              assertBoundedMetaJsonV1(raw, {
                max_bytes: maxResponseBytes,
              });
            } catch (error) {
              throw new MetaCognitionErrorV1(
                "provider_invalid",
                "Meta provider transport returned non-canonical JSON",
                false,
                { cause: error },
              );
            }
          }
          const parsed = parser.parse(raw);
          try {
            assertBoundedMetaJsonV1(parsed, {
              max_bytes: maxResponseBytes,
            });
          } catch (error) {
            throw new MetaCognitionErrorV1(
              "provider_invalid",
              "Meta provider response exceeds its bounded JSON contract",
              false,
              { cause: error },
            );
          }
          return parseMetaProviderOutputV1(parsed, {
            max_output_items: options.max_output_items,
            max_evidence_refs: options.max_evidence_refs,
          });
        } catch (error) {
          lastError = error;
          if (signal.aborted) throw error;
        } finally {
          timeout.dispose();
        }
      }
      throw new MetaCognitionErrorV1(
        "provider_invalid",
        "Meta provider structured output could not be parsed",
        true,
        { cause: lastError },
      );
    },
    ...(transport.checkReadiness === undefined
      ? {}
      : {
          checkReadiness(signal: AbortSignal) {
            return transport.checkReadiness!(signal);
          },
        }),
  });
}
