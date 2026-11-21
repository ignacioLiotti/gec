import type { AnchorHTMLAttributes, ReactNode } from "react";
import { guideDestination, navigate } from "./navigation";
type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string | { pathname?: string };
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
  children?: ReactNode;
};
export default function Link({
  href,
  prefetch: _prefetch,
  replace: _replace,
  scroll: _scroll,
  onClick,
  ...props
}: Props) {
  const url = typeof href === "string" ? href : href.pathname || "/";
  // These framework-only options have no meaning in a static guide.
  void _prefetch;
  void _replace;
  void _scroll;
  return (
    <a
      {...props}
      href={"./" + guideDestination(url)}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        navigate(url);
      }}
    />
  );
}
