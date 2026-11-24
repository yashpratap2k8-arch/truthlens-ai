import { createContext, useContext, useState, useCallback } from 'react'

const AIContext = createContext(null)

export function AIProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeContext, setActiveContext] = useState(null)

  const openAssistant = useCallback((context = null) => {
    if (context) {
      setActiveContext(context)
    }
    setIsOpen(true)
  }, [])

  const closeAssistant = useCallback(() => {
    setIsOpen(false)
  }, [])

  const clearContext = useCallback(() => {
    setActiveContext(null)
  }, [])

  return (
    <AIContext.Provider
      value={{
        isOpen,
        setIsOpen,
        activeContext,
        setActiveContext,
        openAssistant,
        closeAssistant,
        clearContext,
      }}
    >
      {children}
    </AIContext.Provider>
  )
}

export function useAI() {
  const ctx = useContext(AIContext)
  if (!ctx) throw new Error('useAI must be used within an AIProvider')
  return ctx
}
