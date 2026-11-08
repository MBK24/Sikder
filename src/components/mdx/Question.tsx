import { getContentQuestion } from "@/server/content/book";
import { inlineMarkdownToHtml, markdownToHtml } from "@/lib/content/markdown";
import { QuestionCard } from "./QuestionCard";

/** <Question id="..." /> in MDX: stem + choices rendered at build time; grading happens on the server. */
export function Question({ id }: { id: string }) {
  const q = getContentQuestion(id);
  if (!q) return null;
  return (
    <QuestionCard
      questionKey={q.id}
      stemHtml={markdownToHtml(q.stem)}
      passageHtml={q.passageBody ? markdownToHtml(q.passageBody) : undefined}
      passageTitle={q.passageTitle}
      choices={(["A", "B", "C", "D"] as const).map((k) => ({ id: k, html: inlineMarkdownToHtml(q.choices[k]) }))}
    />
  );
}
