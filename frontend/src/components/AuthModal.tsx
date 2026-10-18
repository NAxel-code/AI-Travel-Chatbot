import { useEffect, useRef, useState } from 'react'
import { X, Loader2, Mail, Lock, Route } from 'lucide-react'
import { useLanguage } from '../lib/i18n'

type AuthMode = 'login' | 'register'

type AuthModalProps = {
  onClose: () => void
  // Returns an error message to show inline, or null on success.
  onSubmit: (mode: AuthMode, email: string, password: string) => Promise<string | null>
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function AuthModal({ onClose, onSubmit }: AuthModalProps) {
  const { lang } = useLanguage()
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
      setError(
        lang === 'id' ? 'Masukkan alamat email yang valid.' : 'Please enter a valid email address.'
      )
      return
    }
    if (mode === 'register' && (password.length < 8 || password.length > 128)) {
      setError(
        lang === 'id' ? 'Password harus 8-128 karakter.' : 'Password must be 8-128 characters.'
      )
      return
    }
    if (!password) {
      setError(lang === 'id' ? 'Password wajib diisi.' : 'Password is required.')
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
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-stone-900/50 dark:bg-black/75 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={
        isLogin
          ? lang === 'id'
            ? 'Masuk ke akun'
            : 'Sign in to account'
          : lang === 'id'
          ? 'Buat akun baru'
          : 'Create new account'
      }
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="animate-rise w-full max-w-md rounded-t-2xl border border-stone-200/90 bg-white dark:border-stone-800 dark:bg-[#141920] p-6 shadow-2xl shadow-stone-900/20 sm:rounded-2xl">
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-700 text-white shadow-xs shadow-teal-900/20">
              <Route className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
                {isLogin
                  ? lang === 'id'
                    ? 'Masuk'
                    : 'Sign In'
                  : lang === 'id'
                  ? 'Buat Akun'
                  : 'Create Account'}
              </h2>
              <p className="text-xs text-stone-600 dark:text-stone-400 font-medium">
                {isLogin
                  ? lang === 'id'
                    ? 'Preferensi dan perjalananmu mengikuti akun, bukan perangkat.'
                    : 'Your preferences and trips follow your account, not your device.'
                  : lang === 'id'
                  ? 'Simpan preferensi dan semua perjalanan dalam satu akun.'
                  : 'Save preferences and all travel plans in one account.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200 outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
            aria-label={lang === 'id' ? 'Tutup dialog' : 'Close dialog'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="mb-5 flex gap-1 rounded-full bg-stone-100 dark:bg-[#1a212b] p-1" role="tablist">
          {([
            ['login', lang === 'id' ? 'Masuk' : 'Sign In'],
            ['register', lang === 'id' ? 'Daftar' : 'Register'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => switchMode(value)}
              className={`min-h-[40px] flex-1 rounded-full px-4 text-sm font-semibold transition active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-teal-700/80 ${
                mode === value
                  ? 'bg-white text-teal-800 shadow-xs dark:bg-[#141920] dark:text-teal-300'
                  : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-stone-700 dark:text-stone-300">Email</span>
            <span className="relative block">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
              <input
                ref={emailRef}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full rounded-xl border border-stone-200 bg-stone-50/70 py-2.5 pl-10 pr-3 text-sm text-stone-900 placeholder:text-stone-400 transition focus:border-teal-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/20 dark:border-stone-800 dark:bg-[#1a212b] dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:bg-[#141920]"
              />
            </span>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-stone-700 dark:text-stone-300">Password</span>
            <span className="relative block">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
              <input
                type="password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  isLogin
                    ? lang === 'id'
                      ? 'Password akun'
                      : 'Account password'
                    : lang === 'id'
                    ? 'Minimal 8 karakter'
                    : 'At least 8 characters'
                }
                className="w-full rounded-xl border border-stone-200 bg-stone-50/70 py-2.5 pl-10 pr-3 text-sm text-stone-900 placeholder:text-stone-400 transition focus:border-teal-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/20 dark:border-stone-800 dark:bg-[#1a212b] dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:bg-[#141920]"
              />
            </span>
          </label>

          {error && (
            <p className="rounded-xl bg-rose-50 border border-rose-200/80 px-3 py-2 text-xs font-medium text-rose-800 dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-300" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white shadow-xs transition hover:bg-teal-800 active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>
              {isLogin
                ? lang === 'id'
                  ? 'Masuk'
                  : 'Sign In'
                : lang === 'id'
                ? 'Buat Akun'
                : 'Create Account'}
            </span>
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-stone-600 dark:text-stone-400">
          {isLogin
            ? lang === 'id'
              ? 'Belum punya akun? '
              : "Don't have an account? "
            : lang === 'id'
            ? 'Sudah punya akun? '
            : 'Already have an account? '}
          <button
            type="button"
            onClick={() => switchMode(isLogin ? 'register' : 'login')}
            className="font-semibold text-teal-800 dark:text-teal-400 underline-offset-2 hover:underline outline-none focus-visible:ring-1 focus-visible:ring-teal-700 rounded-sm"
          >
            {isLogin
              ? lang === 'id'
                ? 'Daftar sekarang'
                : 'Sign up now'
              : lang === 'id'
              ? 'Masuk di sini'
              : 'Sign in here'}
          </button>
        </p>
      </div>
    </div>
  )
}
