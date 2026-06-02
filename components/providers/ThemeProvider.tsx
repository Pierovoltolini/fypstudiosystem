'use client'
// ThemeProvider — gestiona el modo oscuro con localStorage
// Setea la clase 'dark' en <html> y provee el contexto a toda la app
import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme:      Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme:       'light',
  toggleTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  // Leer preferencia guardada al montar
  useEffect(() => {
    const saved = localStorage.getItem('fyp_theme') as Theme | null
    const preferred: Theme = saved ?? 'light'
    setTheme(preferred)
    applyTheme(preferred)
  }, [])

  function applyTheme(t: Theme) {
    if (t === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  function toggleTheme() {
    const next: Theme = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    applyTheme(next)
    localStorage.setItem('fyp_theme', next)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
