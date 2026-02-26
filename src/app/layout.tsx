import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { NavStyleProvider } from "@/components/nav-style-provider"
import { UserProvider } from "@/components/user-provider"

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
})

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "ProjectHub | Project Management Dashboard",
  description: "A modern project management dashboard for tracking projects, team members, and budgets.",
}

const themeScript = `
  (function() {
    try {
      var localTheme = localStorage.getItem('projecthub-theme');
      var supportDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches === true;
      if (!localTheme && supportDarkMode) {
        localTheme = 'dark';
      }
      if (localTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {}
  })();
`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
        <UserProvider>
          <ThemeProvider>
            <NavStyleProvider>
              {children}
            </NavStyleProvider>
          </ThemeProvider>
        </UserProvider>
      </body>
    </html>
  )
}
