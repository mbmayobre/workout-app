/**
 * Shared building blocks: buttons, chips, cards, inputs.
 *
 * Screens are assembled from these so that spacing, colours, and touch-target
 * sizes are decided once. Two rules they all follow:
 *
 * - Anything tappable is at least 44px tall, the minimum comfortable size
 *   for a thumb (and sweaty gym hands).
 * - Colours come from the tokens in src/index.css (`bg-surface`, `text-soft`),
 *   never from literal hex values, so light and dark mode both work.
 */
import { ChevronLeft, Minus, Plus } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

/** Join class names, skipping empty values: cx('a', false && 'b') -> 'a'. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

// ── Button ───────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  // Use at most one primary button per screen: it marks THE main action.
  primary: 'bg-accent text-on-accent font-semibold',
  secondary: 'bg-raised text-ink border border-line',
  ghost: 'text-soft',
  danger: 'text-bad border border-line',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  /** Stretch to the full width of the container. */
  full?: boolean
}

export function Button({ variant = 'secondary', full, className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm',
        'transition active:scale-[0.98] disabled:opacity-40',
        BUTTON_STYLES[variant],
        full && 'w-full',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

/** A square button holding only an icon. `label` is read out by screen readers. */
export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-soft',
        'transition active:scale-95 active:bg-raised disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

// ── Chip ─────────────────────────────────────────────────────────────────

/** A small pill. With `onClick` it is a toggle button; without, a static tag. */
export function Chip({
  selected,
  onClick,
  children,
}: {
  selected?: boolean
  onClick?: () => void
  children: ReactNode
}) {
  const style = cx(
    'rounded-full px-3 text-xs whitespace-nowrap',
    selected ? 'bg-accent-soft text-accent' : 'bg-raised text-soft',
  )
  if (!onClick) return <span className={cx(style, 'py-1')}>{children}</span>
  return (
    <button type="button" aria-pressed={selected} onClick={onClick} className={cx(style, 'min-h-9 py-2 text-sm')}>
      {children}
    </button>
  )
}

// ── Layout pieces ────────────────────────────────────────────────────────

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-2xl bg-surface p-4', className)}>{children}</div>
}

/** Small muted heading above a group of controls. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="mt-5 mb-2 text-xs font-medium tracking-wide text-soft">{children}</h2>
}

/**
 * The title area at the top of a screen.
 * `back` shows a back arrow: pass a path to go to, or `true` to go back in history.
 */
export function PageHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: string
  subtitle?: string
  back?: string | true
  action?: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <header className="mb-4 flex items-center gap-1">
      {back && (
        <IconButton label="Back" className="-ml-2" onClick={() => (back === true ? navigate(-1) : navigate(back))}>
          <ChevronLeft />
        </IconButton>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-semibold">{title}</h1>
        {subtitle && <p className="text-sm text-soft">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}

/** A row in a list, with a hairline under it. Becomes a button when `onClick` is given. */
export function Row({
  onClick,
  children,
  className,
}: {
  onClick?: () => void
  children: ReactNode
  className?: string
}) {
  const style = cx('flex min-h-14 w-full items-center gap-3 border-b border-line py-2 text-left last:border-b-0', className)
  return onClick ? (
    <button type="button" onClick={onClick} className={cx(style, 'active:bg-raised')}>
      {children}
    </button>
  ) : (
    <div className={style}>{children}</div>
  )
}

// ── Inputs ───────────────────────────────────────────────────────────────

/** − value + control for small whole numbers (sets, exercise count). */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  label,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  label: string
}) {
  return (
    <div className="flex items-center gap-1">
      <IconButton label={`Decrease ${label}`} className="bg-raised" disabled={value <= min} onClick={() => onChange(value - 1)}>
        <Minus size={18} />
      </IconButton>
      <span className="digits w-10 text-center text-lg font-semibold" aria-label={label}>
        {value}
      </span>
      <IconButton label={`Increase ${label}`} className="bg-raised" disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Plus size={18} />
      </IconButton>
    </div>
  )
}

/**
 * A labelled number box.
 *
 * The value is kept as TEXT, not a number, so the user can clear the box or
 * type "82." on the way to "82.5" without the input fighting them. The
 * screen converts it to a number (with `parseNumber`) only when saving.
 * `inputMode="decimal"` brings up the phone's number pad.
 */
export function NumberField({
  label,
  value,
  onChange,
  suffix,
  placeholder,
}: {
  label: string
  value: string
  onChange: (text: string) => void
  suffix?: string
  placeholder?: string
}) {
  return (
    <label className="block min-w-0 flex-1">
      <span className="mb-1 block text-xs text-soft">{label}</span>
      <span className="flex items-center rounded-xl border border-line bg-raised focus-within:border-accent">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onFocus={(event) => event.target.select()}
          className="digits h-12 w-full min-w-0 bg-transparent px-3 text-lg font-semibold outline-none placeholder:text-faint"
        />
        {suffix && <span className="pr-3 text-sm text-soft">{suffix}</span>}
      </span>
    </label>
  )
}

/** A labelled single-line text box. */
export function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (text: string) => void
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-soft">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-xl border border-line bg-raised px-3 outline-none placeholder:text-faint focus:border-accent"
      />
    </label>
  )
}

/** A row of mutually exclusive options, like a light switch with several positions. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl bg-raised p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={cx(
            'min-h-9 flex-1 rounded-lg px-2 text-sm',
            option.value === value ? 'bg-surface font-medium text-ink shadow-sm' : 'text-soft',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** An on/off switch with its label on the left. */
export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-12 w-full items-center justify-between gap-3 text-left"
    >
      <span>{label}</span>
      <span className={cx('flex h-7 w-12 items-center rounded-full p-0.5 transition', checked ? 'bg-accent' : 'bg-raised')}>
        <span className={cx('size-6 rounded-full bg-white transition', checked && 'translate-x-5')} />
      </span>
    </button>
  )
}
