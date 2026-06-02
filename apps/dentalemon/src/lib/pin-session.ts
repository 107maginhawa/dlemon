/**
 * PIN Session Manager
 *
 * Manages the local "who is currently logged in on this device" state.
 * The session is in-memory only — it is cleared when the tab/app closes,
 * and it auto-expires after INACTIVITY_TIMEOUT_MS of inactivity.
 *
 * The cloud Better-Auth session (the practice owner's cloud account) is
 * separate from this — this is specifically for the PIN-based staff session
 * that controls who can access the dental workspace on-device.
 */

export const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export interface PinSessionData {
  memberId: string;
  displayName: string;
  role: string;
  lastActiveAt: number;
  locked: boolean;
}

export interface StartSessionOptions {
  memberId: string;
  displayName: string;
  role: string;
  /**
   * Override the inactivity timeout for this session (ms). Defaults to
   * INACTIVITY_TIMEOUT_MS. Primarily for tests; production uses the default.
   */
  timeoutMs?: number;
}

export class PinSessionManager {
  private session: PinSessionData | null = null;
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private onExpireCallback: (() => void) | null = null;
  private timeoutMs: number = INACTIVITY_TIMEOUT_MS;

  /** Register a callback to invoke when the inactivity timer fires. */
  onExpire(callback: () => void): void {
    this.onExpireCallback = callback;
  }

  /** Start a new session for the given member. Replaces any existing session. */
  startSession(opts: StartSessionOptions): void {
    this.timeoutMs = opts.timeoutMs ?? INACTIVITY_TIMEOUT_MS;
    this.session = {
      memberId: opts.memberId,
      displayName: opts.displayName,
      role: opts.role,
      lastActiveAt: Date.now(),
      locked: false,
    };
    this._resetTimer();
  }

  /** Return the current session, or null if no session is active. */
  getSession(): PinSessionData | null {
    return this.session;
  }

  /**
   * Update the last-activity timestamp and reset the inactivity timer.
   * Call on any user interaction (mousemove, keydown, click, etc.).
   */
  updateActivity(now: number = Date.now()): void {
    // Once locked, interaction must NOT silently re-arm the session — the user
    // has to re-authenticate via PIN. This prevents a background activity event
    // (or a stray pointer move on a locked screen) from re-firing auto-logoff
    // or masking the locked state.
    if (this.session && !this.session.locked) {
      this.session.lastActiveAt = now;
      this._resetTimer();
    }
  }

  /** Returns true if the session has been inactive beyond the inactivity timeout. */
  isExpired(): boolean {
    if (!this.session) return false;
    return Date.now() - this.session.lastActiveAt > this.timeoutMs;
  }

  /** Returns true if the session is currently locked (pending re-auth). */
  isLocked(): boolean {
    return this.session?.locked === true;
  }

  /**
   * Lock the session for re-authentication.
   * The memberId is preserved so the PIN entry screen can show who needs to re-auth.
   */
  lockForReauth(): void {
    if (this.session) {
      this.session.locked = true;
    }
  }

  /** Unlock the session after successful re-auth. Refreshes lastActiveAt and resets timer. */
  unlockSession(): void {
    if (this.session) {
      this.session.locked = false;
      this.session.lastActiveAt = Date.now();
      this._resetTimer();
    }
  }

  /** Clear the session completely (log out). */
  clearSession(): void {
    this._clearTimer();
    this.session = null;
  }

  /** Reset (or start) the inactivity countdown timer. */
  private _resetTimer(): void {
    this._clearTimer();
    if (!this.session) return;
    this.inactivityTimer = setTimeout(() => {
      if (this.session && !this.isLocked()) {
        this.lockForReauth();
        this.onExpireCallback?.();
      }
    }, this.timeoutMs);
  }

  /** Cancel any pending inactivity timer. */
  private _clearTimer(): void {
    if (this.inactivityTimer !== null) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }
}

/** Module-level singleton for use across the app. */
export const pinSession = new PinSessionManager();
