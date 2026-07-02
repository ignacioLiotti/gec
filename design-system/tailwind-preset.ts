import type { Config } from "tailwindcss"
import { tokens } from "./tokens"

const acmePreset = {
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1280px"
      }
    },
    extend: {
      colors: {
        border: tokens.color.border,
        input: tokens.color.input,
        ring: tokens.color.ring,
        background: tokens.color.background,
        foreground: tokens.color.foreground,
        canvas: {
          DEFAULT: tokens.color.canvas,
          muted: tokens.color.canvasMuted
        },
        surface: {
          DEFAULT: tokens.color.surface,
          muted: tokens.color.surfaceMuted,
          raised: tokens.color.surfaceRaised,
          recessed: tokens.color.surfaceRecessed,
          warm: tokens.color.surfaceWarm,
          glass: tokens.color.surfaceGlass
        },
        content: {
          DEFAULT: tokens.color.content,
          secondary: tokens.color.contentSecondary,
          muted: tokens.color.contentMuted,
          disabled: tokens.color.contentDisabled
        },
        stroke: {
          DEFAULT: tokens.color.border,
          soft: tokens.color.borderSoft,
          strong: tokens.color.borderStrong
        },
        "orange-primary": tokens.color.orangePrimary,
        primary: {
          DEFAULT: tokens.color.primary,
          foreground: tokens.color.primaryForeground
        },
        secondary: {
          DEFAULT: tokens.color.secondary,
          foreground: tokens.color.secondaryForeground
        },
        destructive: {
          DEFAULT: tokens.color.destructive,
          foreground: tokens.color.destructiveForeground
        },
        success: {
          DEFAULT: tokens.color.success,
          foreground: tokens.color.successForeground
        },
        warning: {
          DEFAULT: tokens.color.warning,
          foreground: tokens.color.warningForeground
        },
        muted: {
          DEFAULT: tokens.color.muted,
          foreground: tokens.color.mutedForeground
        },
        accent: {
          DEFAULT: tokens.color.accent,
          soft: tokens.color.accentSoft,
          border: tokens.color.accentBorder,
          foreground: tokens.color.accentForeground
        },
        popover: {
          DEFAULT: tokens.color.popover,
          foreground: tokens.color.popoverForeground
        },
        card: {
          DEFAULT: tokens.color.card,
          foreground: tokens.color.cardForeground
        },
        table: {
          "row-alt": tokens.color.tableRowAlt,
          "row-hover": tokens.color.tableRowHover
        }
      },
      borderRadius: {
        sm: tokens.radius.sm,
        md: tokens.radius.md,
        lg: tokens.radius.lg,
        xl: tokens.radius.xl
      },
      boxShadow: tokens.shadow,
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"]
      },
      spacing: {
        "acme-xs": tokens.spacing.xs,
        "acme-sm": tokens.spacing.sm,
        "acme-md": tokens.spacing.md,
        "acme-lg": tokens.spacing.lg,
        "acme-xl": tokens.spacing.xl,
        "acme-2xl": tokens.spacing["2xl"]
      },
      zIndex: tokens.zIndex,
      screens: tokens.breakpoint,
      transitionDuration: tokens.motion.duration,
      transitionTimingFunction: tokens.motion.easing
    }
  }
} satisfies Partial<Config>

export default acmePreset
