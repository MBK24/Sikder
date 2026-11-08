/** A run of static, server-rendered chapter HTML (trusted content from /content). */
export function HtmlChunk({ html }: { html: string }) {
  return <div className="contents" dangerouslySetInnerHTML={{ __html: html }} />;
}
