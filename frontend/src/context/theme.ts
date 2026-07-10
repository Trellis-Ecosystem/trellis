import { createContext } from 'react'

export type Theme = 'dark' | 'light'

export interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

export const THEME_STORAGE_KEY = 'trellis_theme'

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function isTheme(value: string | null): value is Theme {
  return value === 'dark' || value === 'light'
}

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(storedTheme) ? storedTheme : 'dark'
  } catch {
    return 'dark'
  }
}

export function persistTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Ignore storage failures; the current session still updates visually.
  }
}

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return

  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.classList.toggle('light', theme === 'light')
  document.documentElement.style.colorScheme = theme
}
