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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
        <ThemeProvider>
          <NavStyleProvider>
            <UserProvider>
              {children}
            </UserProvider>
          </NavStyleProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
