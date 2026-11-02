import { useEffect, useState } from 'react'
import Button from '../ui/Button'
import { authApi } from '../../api/auth'

/** Social sign-in buttons, rendered only for providers the backend reports as configured. */
export default function OAuthButtons() {
  const [providers, setProviders] = useState([])
  useEffect(() => {
    let active = true
    authApi
      .oauthProviders()
      .then((result) => active && setProviders((result?.providers || []).filter((p) => p.enabled)))
      .catch(() => active && setProviders([]))
    return () => {
      active = false
    }
  }, [])
  if (!providers.length) return null
  return (
    <div className="mt-6">
      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-slate-200" />
        </div>
        <p className="relative mx-auto w-fit bg-white px-3 text-xs text-slate-500">or continue with</p>
      </div>
      <div className="mt-4 grid gap-2">
        {providers.map((provider) => (
          <Button key={provider.name} as="a" href={authApi.oauthLoginUrl(provider.name)} variant="secondary" className="w-full">
            {provider.label || provider.name}
          </Button>
        ))}
      </div>
    </div>
  )
}
