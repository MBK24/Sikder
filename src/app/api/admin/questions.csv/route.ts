import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { getSession, hasRole } from "@/server/auth";
import { CSV_COLUMNS, questionToFields } from "@/server/admin-questions";
import { toCsv } from "@/lib/csv";

/** CSV export of every question (or ?template=1 for just the header plus one example row). Admins only. */
export async function GET(req: Request) {
  const s = await getSession();
  if (!s || !hasRole(s.user, "ADMIN")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const template = new URL(req.url).searchParams.get("template") === "1";
  let rows: (string | boolean)[][];
  if (template) {
    rows = [
      [
        "cp-example-01", "CP", "5A", "CORE", "acids-and-bases", "",
        "What is the pH of a $1.0 \\times 10^{-3}$ M HCl solution?",
        "1", "3", "7", "11", "B",
        "HCl dissociates completely, so $[\\ce{H3O+}] = 10^{-3}$ M and pH = 3.",
        "Uses the concentration exponent with the wrong sign.", "", "Neutral water, not an acid solution.", "That's the pOH.",
        true, false, true,
      ],
    ];
  } else {
    const qs = await db.question.findMany({
      orderBy: [{ part: "asc" }, { key: "asc" }],
      include: { topic: { select: { code: true } }, chapter: { select: { slug: true } }, passage: { select: { key: true } } },
    });
    rows = qs.map((q) => {
      const f = questionToFields(q);
      return CSV_COLUMNS.map((c) => f[c]);
    });
  }
  const csv = toCsv([[...CSV_COLUMNS], ...rows]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${template ? "questions-template" : "questions"}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
