import { useEffect, useState } from 'react'

// Dark/light theme stored in localStorage; Tailwind reads the "dark" class on <html>.
export default function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light')
    } catch {
      /* storage may be blocked */
    }
  }, [dark])
  return [dark, () => setDark((d) => !d)]
}
