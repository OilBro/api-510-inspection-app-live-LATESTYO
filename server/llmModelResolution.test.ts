import { describe, expect, it } from "vitest";

import { isOpenAIUrl, resolveModelName } from "./_core/llm";

describe("resolveModelName", () => {
  it("prefers an explicit model override", () => {
    expect(
      resolveModelName({
        forgeApiUrl: "https://api.openai.com",
        llmModel: "gpt-5.4",
      })
    ).toBe("gpt-5.4");
  });

  it("ignores blank overrides and falls back to the OpenAI default", () => {
    expect(
      resolveModelName({
        forgeApiUrl: "https://api.openai.com",
        llmModel: "   ",
      })
    ).toBe("gpt-4o");
  });

  it("uses the Gemini default for non-OpenAI endpoints", () => {
    expect(
      resolveModelName({
        forgeApiUrl: "https://forge.manus.im",
      })
    ).toBe("gemini-2.5-flash");
  });
});

describe("isOpenAIUrl", () => {
  it("detects OpenAI-compatible endpoints", () => {
    expect(isOpenAIUrl("https://api.openai.com")).toBe(true);
    expect(isOpenAIUrl("https://api.openai.com/v1")).toBe(true);
  });

  it("does not flag other providers", () => {
    expect(isOpenAIUrl("https://forge.manus.im")).toBe(false);
    expect(isOpenAIUrl(undefined)).toBe(false);
  });
});
