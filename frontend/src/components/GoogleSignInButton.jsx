import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Loader2 } from 'lucide-react'

export default function GoogleSignInButton({ dark }) {
  const { loginWithCredential, authError } = useAuth()
  const btnRef = useRef(null)
  const [signingIn, setSigningIn] = useState(false)
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  useEffect(() => {
    if (!clientId) {
      console.warn('VITE_GOOGLE_CLIENT_ID is not configured in frontend/.env')
      return
    }

    let intervalId = null
    let attempts = 0
    const maxAttempts = 30 // ~4.5 seconds

    const initAndRender = () => {
      if (window.google?.accounts?.id && btnRef.current) {
        if (intervalId) clearInterval(intervalId)
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response) => {
              if (response.credential) {
                setSigningIn(true)
                try {
                  await loginWithCredential(response.credential)
                } finally {
                  setSigningIn(false)
                }
              }
            },
          })

          btnRef.current.innerHTML = ''
          window.google.accounts.id.renderButton(btnRef.current, {
            theme: dark ? 'filled_black' : 'outline',
            size: 'medium',
            shape: 'pill',
            text: 'signin_with',
          })
        } catch (e) {
          console.error('Error rendering Google button:', e)
        }
        return true
      }
      return false
    }

    if (!initAndRender()) {
      intervalId = setInterval(() => {
        attempts++
        if (initAndRender() || attempts >= maxAttempts) {
          clearInterval(intervalId)
        }
      }, 150)
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [clientId, dark, loginWithCredential])

  if (signingIn) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3.5 py-1.5 text-xs font-semibold text-violet-700 shadow-sm dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-300">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />
        <span>Authenticating…</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end">
      <div ref={btnRef} className="min-h-[38px] flex items-center" />
      {authError && (
        <span className="mt-1 max-w-[200px] text-right text-[11px] text-rose-500">
          {authError}
        </span>
      )}
    </div>
  )
}
