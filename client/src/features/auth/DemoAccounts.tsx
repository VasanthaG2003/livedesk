const accounts = [
  { label: 'Customer', email: 'customer@livedesk.dev' },
  { label: 'Agent', email: 'agent@livedesk.dev' },
  { label: 'Admin', email: 'admin@livedesk.dev' },
]
const DEMO_PASSWORD = 'Demo@12345'

/**
 * Development only (not rendered in production builds). Matches the accounts
 * the server seeds into the in-memory dev database.
 */
export function DemoAccounts({ onPick }: { onPick: (email: string, password: string) => void }) {
  if (!import.meta.env.DEV) return null
  return (
    <div className="mt-10 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
      <p className="font-medium">Demo accounts (development only)</p>
      <p className="mt-0.5">
        Password for all: <code className="font-mono">{DEMO_PASSWORD}</code>
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {accounts.map((a) => (
          <button
            key={a.email}
            type="button"
            onClick={() => onPick(a.email, DEMO_PASSWORD)}
            className="rounded-md bg-white px-2.5 py-1 font-medium shadow-card hover:bg-amber-100"
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  )
}
