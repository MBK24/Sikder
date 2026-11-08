import { describe, expect, it } from "vitest";
import { questionSchema, chapterFrontmatterSchema } from "@/lib/content/schema";

const base = {
  id: "cp-test-01",
  usage: "quiz",
  topic: "5A",
  difficulty: "core",
  stem: "What is the pH of pure water at 25 °C?",
  choices: { A: "5", B: "7", C: "9", D: "14" },
  answer: "B",
  explanation: "Kw = 1e-14 at 25 °C, so [H+] = [OH-] = 1e-7 M and pH = 7.",
};

describe("questionSchema", () => {
  it("accepts whyWrong without an entry for the correct answer", () => {
    expect(questionSchema.safeParse({ ...base, whyWrong: { A: "too acidic", C: "basic", D: "pOH confusion" } }).success).toBe(true);
  });
  it("rejects unknown AAMC codes", () => {
    expect(questionSchema.safeParse({ ...base, topic: "11Z" }).success).toBe(false);
  });
  it("rejects a fifth choice", () => {
    expect(questionSchema.safeParse({ ...base, choices: { ...base.choices, E: "x" } }).success).toBe(false);
  });
});

describe("chapterFrontmatterSchema", () => {
  it("rejects unknown keys so typos surface", () => {
    expect(
      chapterFrontmatterSchema.safeParse({ title: "T", summary: "A summary long enough.", estReadMinutes: 10, difficulty: "core", access: "free", acess: "x" }).success,
    ).toBe(false);
  });
});
