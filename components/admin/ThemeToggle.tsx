'use client'
// ThemeToggle — botón sol/luna para cambiar entre modo claro y oscuro
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/providers/ThemeProvider'

export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className={className}
      title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {theme === 'dark'
        ? <Sun  size={14} />
        : <Moon size={14} />
      }
      <span className="flex-1">{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
    </button>
  )
}
