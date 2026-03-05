"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <button
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
    >
      <Sun className="h-5 w-5 text-gray-900 dark:hidden" />
      <Moon className="hidden h-5 w-5 text-gray-100 dark:block" />
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}
