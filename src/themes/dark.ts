import { ThemeTokens } from "./base"
import { themeTokens } from "./tokens"

export const darkTheme: ThemeTokens = {
  colors: {
    background: themeTokens.slates[950],
    foreground: themeTokens.slates[50],
    card: themeTokens.slates[900],
    cardForeground: themeTokens.slates[50],
    popover: themeTokens.slates[900],
    popoverForeground: themeTokens.slates[50],
    primary: themeTokens.emeralds[500],
    primaryForeground: "#ffffff",
    secondary: themeTokens.slates[800],
    secondaryForeground: themeTokens.slates[100],
    muted: themeTokens.slates[800],
    mutedForeground: themeTokens.slates[400],
    accent: themeTokens.slates[800],
    accentForeground: themeTokens.slates[100],
    destructive: "#7f1d1d",
    destructiveForeground: themeTokens.slates[50],
    border: themeTokens.slates[800],
    input: themeTokens.slates[800],
    ring: themeTokens.emeralds[400],
  },
  radius: "0.5rem",
}
