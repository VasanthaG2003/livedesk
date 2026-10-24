import type { ReactNode } from 'react'
import { CircleCheck } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { SupportHero } from '@/components/illustrations/SupportHero'

const points = [
  'Track every request in one place',
  'Get live updates from our team',
  'Secure, private conversations',
]

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-navy-900 p-10 text-white lg:flex">
        <Logo tone="light" />
        <div>
          <h2 className="max-w-sm text-2xl leading-snug font-semibold">
            Support that keeps up with you — in real time.
          </h2>
          <ul className="mt-6 space-y-3 text-sm text-navy-text">
            {points.map((p) => (
              <li key={p} className="flex items-center gap-2.5">
                <CircleCheck className="size-4 text-emerald-400" aria-hidden /> {p}
              </li>
            ))}
          </ul>
        </div>
        <SupportHero className="w-full max-w-sm self-center opacity-95" />
      </aside>
      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-2xl font-semibold text-ink-900">{title}</h1>
          <p className="mt-1.5 text-sm text-ink-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  )
}
