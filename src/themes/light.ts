import { ThemeTokens } from "./base"
import { themeTokens } from "./tokens"

export const lightTheme: ThemeTokens = {
  colors: {
    background: themeTokens.slates[50],
    foreground: themeTokens.slates[900],
    card: "#ffffff",
    cardForeground: themeTokens.slates[900],
    popover: "#ffffff",
    popoverForeground: themeTokens.slates[900],
    primary: themeTokens.emeralds[600],
    primaryForeground: "#ffffff",
    secondary: themeTokens.slates[100],
    secondaryForeground: themeTokens.slates[700],
    muted: themeTokens.slates[100],
    mutedForeground: themeTokens.slates[500],
    accent: themeTokens.slates[100],
    accentForeground: themeTokens.slates[700],
    destructive: themeTokens.red[500],
    destructiveForeground: "#ffffff",
    border: themeTokens.slates[200],
    input: themeTokens.slates[200],
    ring: themeTokens.emeralds[500],
  },
  radius: "0.5rem",
}
