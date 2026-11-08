import type { ComponentProps } from "react";

type HeadingProps = ComponentProps<"h2"> & { "data-number"?: string };

function makeHeading(Tag: "h2" | "h3") {
  return function Heading({ id, children, ...rest }: HeadingProps) {
    const number = rest["data-number"];
    return (
      <Tag id={id} className="group scroll-mt-24" {...rest}>
        {number ? <span className="header-section-number">{number}</span> : null}
        {children}
        {id ? (
          <a href={`#${id}`} className="anchor-link" aria-label="Link to this section">
            #
          </a>
        ) : null}
      </Tag>
    );
  };
}

export const H2 = makeHeading("h2");
export const H3 = makeHeading("h3");
