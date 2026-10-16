import { useEffect, useRef, useState } from 'react'
import { X, Loader2, Mail, Lock, Route } from 'lucide-react'

type AuthMode = 'login' | 'register'

type AuthModalProps = {
  onClose: () => void
  // Returns an error message to show inline, or null on success.
  onSubmit: (mode: AuthMode, email: string, password: string) => Promise<string | null>
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function AuthModal({ onClose, onSubmit }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    emailRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  function switchMode(next: AuthMode) {
    setMode(next)
    setError(null)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (isSubmitting) return
    const trimmedEmail = email.trim().toLowerCase()
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError('Masukkan alamat email yang valid.')
      return
    }
    if (mode === 'register' && (password.length < 8 || password.length > 128)) {
      setError('Password harus 8-128 karakter.')
      return
    }
    if (!password) {
      setError('Password wajib diisi.')
      return
    }
    setError(null)
    setIsSubmitting(true)
    const result = await onSubmit(mode, trimmedEmail, password)
    setIsSubmitting(false)
    if (result) setError(result)
  }

  const isLogin = mode === 'login'

/* Hallmark · component: AuthModal · genre: editorial · theme: Sand & Sea
 * states: default · hover · focus-visible · active · disabled · loading · error · success
 * contrast: pass (4.5:1+)
 */
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-stone-900/50 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isLogin ? 'Masuk ke akun' : 'Buat akun baru'}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="animate-rise w-full max-w-md rounded-t-2xl border border-stone-200/90 bg-white p-6 shadow-2xl shadow-stone-900/20 sm:rounded-2xl">
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-700 text-white shadow-xs shadow-teal-900/20">
              <Route className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-xl font-bold text-stone-900">
                {isLogin ? 'Masuk' : 'Buat akun'}
              </h2>
              <p className="text-xs text-stone-600 font-medium">
                {isLogin
                  ? 'Preferensi dan perjalananmu mengikuti akun, bukan perangkat.'
                  : 'Simpan preferensi dan semua perjalanan dalam satu akun.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
            aria-label="Tutup dialog masuk"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="mb-5 flex gap-1 rounded-full bg-stone-100 p-1" role="tablist">
          {([['login', 'Masuk'], ['register', 'Daftar']] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => switchMode(value)}
              className={`min-h-[40px] flex-1 rounded-full px-4 text-sm font-semibold transition active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-teal-700/80 ${
                mode === value ? 'bg-white text-teal-800 shadow-xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-stone-700">Email</span>
            <span className="relative block">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                ref={emailRef}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="kamu@email.com"
                className="w-full rounded-xl border border-stone-200 bg-stone-50/70 py-2.5 pl-10 pr-3 text-sm text-stone-900 placeholder:text-stone-400 transition focus:border-teal-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/20"
              />
            </span>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-stone-700">Password</span>
            <span className="relative block">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isLogin ? 'Password akun' : 'Minimal 8 karakter'}
                className="w-full rounded-xl border border-stone-200 bg-stone-50/70 py-2.5 pl-10 pr-3 text-sm text-stone-900 placeholder:text-stone-400 transition focus:border-teal-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/20"
              />
            </span>
          </label>

          {error && (
            <p className="rounded-xl bg-rose-50 border border-rose-200/80 px-3 py-2 text-xs font-medium text-rose-800" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white shadow-xs transition hover:bg-teal-800 active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{isLogin ? 'Masuk' : 'Buat akun'}</span>
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-stone-600">
          {isLogin ? 'Belum punya akun? ' : 'Sudah punya akun? '}
          <button
            type="button"
            onClick={() => switchMode(isLogin ? 'register' : 'login')}
            className="font-semibold text-teal-800 underline-offset-2 hover:underline outline-none focus-visible:ring-1 focus-visible:ring-teal-700 rounded-sm"
          >
            {isLogin ? 'Daftar sekarang' : 'Masuk di sini'}
          </button>
        </p>
      </div>
    </div>
  )
}
