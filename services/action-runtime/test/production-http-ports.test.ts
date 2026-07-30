import { describe, expect, it, vi } from "vitest";

import { materializeSkillTarV1 } from "@pai/skill-package";

import { createActionRuntimeHttpPortsV1 } from "../src/production-http-ports.v1.js";

const encoder = new TextEncoder();

function octal(value: number, width: number): Uint8Array {
  return encoder.encode(value.toString(8).padStart(width - 1, "0") + "\0");
}

function skillTar(): Uint8Array {
  const body = encoder.encode("---\nname: demo\ndescription: Demo.\n---\n# Demo\n");
  const header = new Uint8Array(512);
  header.set(encoder.encode("demo/SKILL.md"), 0);
  header.set(octal(0o600, 8), 100);
  header.set(octal(0, 8), 108);
  header.set(octal(0, 8), 116);
  header.set(octal(body.byteLength, 12), 124);
  header.set(octal(0, 12), 136);
  header.fill(32, 148, 156);
  header[156] = 48;
  header.set(encoder.encode("ustar\0"), 257);
  header.set(encoder.encode("00"), 263);
  let checksum = 0;
  for (const byte of header) checksum += byte;
  header.set(encoder.encode(checksum.toString(8).padStart(6, "0") + "\0 "), 148);
  const padding = new Uint8Array((512 - (body.byteLength % 512)) % 512);
  const result = new Uint8Array(512 + body.byteLength + padding.byteLength + 1024);
  result.set(header, 0);
  result.set(body, 512);
  result.set(padding, 512 + body.byteLength);
  return result;
}

const scope = Object.freeze({
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "prod" as const,
  release_channel: "stable" as const,
});

describe("Action Runtime production HTTP ports", () => {
  it("preserves the exact query-bearing signed content URL and materializes its tar", async () => {
    const bytes = skillTar();
    const materialized = materializeSkillTarV1(bytes);
    const resolution = Object.freeze({
      resolution_id: "resolution-1",
      skill_id: "skill-1",
      skill_key: "demo",
      version_id: "version-1",
      version: "1.0.0",
      package_digest: materialized.package_digest,
      manifest_digest: materialized.manifest_digest,
      runtime_target: "filesystem_bundle.v1" as const,
      granted_capability_refs: Object.freeze([]),
      required: true,
      valid_until: "2030-01-01T00:05:00.000Z",
      security_revocation_epoch: 9,
    });
    const signedUrl = "https://storage.example.test/object/sign/skills/demo.tar?token=secret%2Bsignature";
    const observed: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = input instanceof URL ? input.toString() : String(input);
      observed.push(url);
      if (url.startsWith("https://registry.example.test/internal/")) {
        return new Response(
          JSON.stringify({
            code: "skill_content_authorized",
            message: "authorized",
            retryable: false,
            details: {
              content_ref: signedUrl,
              content_type: "application/vnd.pai.skill+tar",
              size_bytes: bytes.byteLength,
              package_digest: materialized.package_digest,
              manifest_digest: materialized.manifest_digest,
              entrypoint: "SKILL.md",
              expires_at: "2030-01-01T00:04:00.000Z",
              runtime_target: "filesystem_bundle.v1",
            },
            trace_id: "trace-1",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(bytes, {
        status: 200,
        headers: { "content-length": String(bytes.byteLength) },
      });
    });
    const ports = createActionRuntimeHttpPortsV1({
      trigger_processor_url: "https://trigger.example.test",
      skill_registry_url: "https://registry.example.test",
      signer: { sign: async () => "header.payload.signature" },
      fetch: fetchImpl,
      now: () => new Date("2030-01-01T00:00:00.000Z"),
    });

    const loaded = await ports.skills.load(
      resolution,
      { runtime_run_id: "run-1", trace_id: "trace-1", scope },
    );

    expect(loaded.package_digest).toBe(materialized.package_digest);
    expect(observed.at(-1)).toBe(signedUrl);
  });

  it("rejects credentials, fragments, and non-loopback cleartext content grants", async () => {
    const bytes = skillTar();
    const materialized = materializeSkillTarV1(bytes);
    const invalidUrls = [
      "https://user:secret@storage.example.test/object?token=x",
      "https://storage.example.test/object?token=x#fragment",
      "http://storage.example.test/object?token=x",
    ];
    for (const contentRef of invalidUrls) {
      const fetchImpl = vi.fn<typeof fetch>(async () =>
        new Response(
          JSON.stringify({
            code: "skill_content_authorized",
            message: "authorized",
            retryable: false,
            details: {
              content_ref: contentRef,
              content_type: "application/vnd.pai.skill+tar",
              size_bytes: bytes.byteLength,
              package_digest: materialized.package_digest,
              manifest_digest: materialized.manifest_digest,
              entrypoint: "SKILL.md",
              expires_at: "2030-01-01T00:04:00.000Z",
              runtime_target: "filesystem_bundle.v1",
            },
            trace_id: "trace-1",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
      const ports = createActionRuntimeHttpPortsV1({
        trigger_processor_url: "https://trigger.example.test",
        skill_registry_url: "https://registry.example.test",
        signer: { sign: async () => "header.payload.signature" },
        fetch: fetchImpl,
        now: () => new Date("2030-01-01T00:00:00.000Z"),
      });
      await expect(
        ports.skills.load(
          {
            resolution_id: "resolution-1",
            skill_id: "skill-1",
            skill_key: "demo",
            version_id: "version-1",
            version: "1.0.0",
            package_digest: materialized.package_digest,
            manifest_digest: materialized.manifest_digest,
            runtime_target: "filesystem_bundle.v1",
            granted_capability_refs: [],
            required: true,
            valid_until: "2030-01-01T00:05:00.000Z",
            security_revocation_epoch: 9,
          },
          { runtime_run_id: "run-1", trace_id: "trace-1", scope },
        ),
      ).rejects.toMatchObject({ code: "skill_content_mismatch" });
    }
  });
});
