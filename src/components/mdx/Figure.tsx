/* eslint-disable @next/next/no-img-element */
export function Figure({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <figure className="my-8">
      <img src={src} alt={alt} className="mx-auto max-w-full dark:invert-[.88] dark:hue-rotate-180" loading="lazy" />
      {caption ? <figcaption className="mt-2 text-center font-sans text-sm text-muted">{caption}</figcaption> : null}
    </figure>
  );
}
