import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvObjects, toCsv } from "@/lib/csv";

describe("csv", () => {
  it("parses quoted fields with commas, quotes, and newlines", () => {
    const text = 'a,b,c\r\n1,"x, y","He said ""hi""\nnext line"\r\n';
    expect(parseCsv(text)).toEqual([
      ["a", "b", "c"],
      ["1", "x, y", 'He said "hi"\nnext line'],
    ]);
  });

  it("strips a BOM and ignores blank lines", () => {
    expect(parseCsv("﻿k,v\n\n1,2\n")).toEqual([
      ["k", "v"],
      ["1", "2"],
    ]);
  });

  it("maps rows to objects by header", () => {
    expect(parseCsvObjects("Key, Answer\nq1, C\n")).toEqual([{ key: "q1", answer: "C" }]);
  });

  it("round-trips through toCsv", () => {
    const rows = [["stem", "note"], ["What is $K_a$?", 'a "quoted", multi\nline']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it("rejects an unterminated quote", () => {
    expect(() => parseCsv('a\n"open')).toThrow();
  });
});
