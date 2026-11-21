export const tokens = {
  color: {
    background: "var(--background)",
    foreground: "var(--foreground)",
    canvas: "hsl(var(--canvas))",
    canvasMuted: "hsl(var(--canvas-muted))",
    surface: "hsl(var(--surface))",
    surfaceMuted: "hsl(var(--surface-muted))",
    surfaceRaised: "hsl(var(--surface-raised))",
    surfaceRecessed: "hsl(var(--surface-recessed))",
    surfaceWarm: "hsl(var(--surface-warm))",
    surfaceGlass: "hsl(var(--surface-glass))",
    content: "hsl(var(--content))",
    contentSecondary: "hsl(var(--content-secondary))",
    contentMuted: "hsl(var(--content-muted))",
    contentDisabled: "hsl(var(--content-disabled))",
    card: "var(--card)",
    cardForeground: "var(--card-foreground)",
    popover: "var(--popover)",
    popoverForeground: "var(--popover-foreground)",
    info: "hsl(var(--info))",
    infoForeground: "hsl(var(--info-foreground))",
    category: "hsl(var(--category))",
    primary: "var(--primary)",
    primaryForeground: "var(--primary-foreground)",
    orangePrimary: "hsl(var(--orange-primary))",
    secondary: "var(--secondary)",
    secondaryForeground: "var(--secondary-foreground)",
    muted: "var(--muted)",
    mutedForeground: "var(--muted-foreground)",
    accent: "var(--accent)",
    accentSoft: "hsl(var(--accent-soft))",
    accentBorder: "hsl(var(--accent-border))",
    accentForeground: "var(--accent-foreground)",
    destructive: "var(--destructive)",
    destructiveForeground: "hsl(var(--destructive-foreground))",
    success: "hsl(var(--success))",
    successForeground: "hsl(var(--success-foreground))",
    warning: "hsl(var(--warning))",
    warningForeground: "hsl(var(--warning-foreground))",
    border: "var(--border)",
    borderSoft: "hsl(var(--border-soft))",
    borderStrong: "hsl(var(--border-strong))",
    input: "var(--input)",
    ring: "var(--ring)",
    tableRowAlt: "hsl(var(--table-row-alt))",
    tableRowHover: "hsl(var(--table-row-hover))"
  },
  spacing: {
    xs: "0.5rem",
    sm: "0.75rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
    "2xl": "3rem"
  },
  radius: {
    sm: "var(--radius-sm)",
    md: "var(--radius-md)",
    lg: "var(--radius-lg)",
    xl: "var(--radius-xl)"
  },
  typography: {
    fontSans: "var(--font-sans)",
    fontMono: "var(--font-mono)",
    size: {
      xs: "0.6875rem",
      sm: "0.8125rem",
      md: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem"
    },
    lineHeight: {
      tight: "1.2",
      normal: "1.5",
      relaxed: "1.7"
    }
  },
  shadow: {
    sm: "0 1px 2px 0 rgb(15 23 42 / 0.08)",
    md: "0 8px 24px -16px rgb(15 23 42 / 0.35)",
    lg: "0 18px 48px -24px rgb(15 23 42 / 0.45)",
    card: "var(--shadow-card)",
    raised: "var(--shadow-raised)",
    "raised-hover": "var(--shadow-raised-hover)",
    raisedHover: "var(--shadow-raised-hover)",
    pressed: "var(--shadow-pressed)",
    recessed: "var(--shadow-recessed)",
    glass: "var(--shadow-glass)",
    panel: "var(--shadow-panel)",
    modal: "var(--shadow-modal)"
  },
  zIndex: {
    base: "0",
    dropdown: "40",
    sticky: "50",
    overlay: "80",
    modal: "100",
    tooltip: "110",
    toast: "120"
  },
  breakpoint: {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1536px"
  },
  motion: {
    duration: {
      fast: "150ms",
      normal: "200ms",
      slow: "300ms",
      press: "34ms"
    },
    easing: {
      standard: "cubic-bezier(0.2, 0, 0, 1)",
      emphasized: "cubic-bezier(0.2, 0, 0, 1)"
    }
  }
} as const

export type AcmeTokens = typeof tokens
