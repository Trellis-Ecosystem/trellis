import { useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { ThemeContext, applyTheme, getStoredTheme, persistTheme, type Theme } from './theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const initialTheme = getStoredTheme()
    applyTheme(initialTheme)
    return initialTheme
  })

  useLayoutEffect(() => {
    applyTheme(theme)
    persistTheme(theme)
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      toggleTheme: () => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark')),
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
