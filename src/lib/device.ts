/**
 * Small wrappers around phone features: sound, vibration, and keeping the
 * screen awake. Every one of these is optional. Browsers that lack a feature
 * (or have it blocked) simply skip it, so each wrapper fails silently.
 */
import { useEffect } from 'react'

let audioContext: AudioContext | undefined

/**
 * Prepare audio. Browsers only allow sound after the user has tapped
 * something, so call this from a tap handler (for example "Log set") before
 * the beep is needed.
 */
export function unlockAudio(): void {
  try {
    audioContext ??= new AudioContext()
    if (audioContext.state === 'suspended') void audioContext.resume()
  } catch {
    // No audio support: timers will be silent.
  }
}

/** Play a short double beep, generated in code so no sound file is needed. */
export function beep(): void {
  if (!audioContext) return
  const context = audioContext
  for (const delay of [0, 0.25]) {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = 880
    oscillator.connect(gain)
    gain.connect(context.destination)
    const start = context.currentTime + delay
    // Fade out quickly so the beep does not end with a click.
    gain.gain.setValueAtTime(0.3, start)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18)
    oscillator.start(start)
    oscillator.stop(start + 0.2)
  }
}

/** Vibrate (Android only; iPhones ignore this). */
export function vibrate(pattern: number | number[] = [200, 100, 200]): void {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Not supported.
  }
}

/**
 * Keep the screen on while `active` is true, so the phone does not lock
 * between sets. The browser releases the lock whenever the page is hidden,
 * so we ask again each time the page becomes visible.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | undefined
    let cancelled = false

    const request = async () => {
      try {
        const granted = await navigator.wakeLock.request('screen')
        if (cancelled) void granted.release()
        else lock = granted
      } catch {
        // Denied (for example in battery saver mode).
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request()
    }

    void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release()
    }
  }, [active])
}
