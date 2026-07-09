import * as React from "react"

// Keep in sync with Tailwind's `md` breakpoint — responsive classes and this
// hook must agree on where "mobile" ends or layouts fork inconsistently.
const MOBILE_BREAKPOINT = 768

/**
 * True below the 768px breakpoint. Returns `false` during SSR and the first
 * client paint (state starts undefined), so branches gated by this hook
 * render their desktop variant first — don't use it for content that must be
 * correct pre-hydration; use CSS responsive classes for that.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
