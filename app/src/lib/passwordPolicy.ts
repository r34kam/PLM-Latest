import { useQuery } from '@tanstack/react-query'

// The app's password policy — length limits, required character classes and the
// expiry/reuse rules — is configured by the app's OWNER on the platform and stored on
// this app's interface record. The API enforces it.
//
// So the app must READ it, never hardcode it. A form validating against invented rules
// disagrees with the server in one direction or the other, and the direction that hurts
// is "form says OK, server says no": the user gets a rejection with nothing on screen
// explaining which rule they broke.
//
// Same record `AppBuilderProvider` already reads to resolve PUBLIC vs PRIVATE, fetched
// from the public `/auth/interface` endpoint (it resolves without a session, which
// matters — the surfaces that set a password are reachable signed-out).

export interface PasswordPolicy {
  lengthLimits?: { minLength?: number; maxLength?: number }
  // backend enum names; PREFERENCE_RULES maps the ones a form can actually check
  preferences?: string[]
  expiryDays?: number
  minAgeDays?: number
  historySize?: number
}

export interface PasswordRule {
  id: string
  label: string
  test: (password: string) => boolean
}

// Rules the browser can decide on its own, so they drive both the live checklist and
// whether the form submits.
const PREFERENCE_RULES: Record<string, PasswordRule> = {
  UPPER_CASE_PATTERN: {
    id: 'UPPER_CASE_PATTERN',
    label: 'One uppercase letter (A-Z)',
    test: (password) => /[A-Z]/.test(password),
  },
  LOWER_CASE_PATTERN: {
    id: 'LOWER_CASE_PATTERN',
    label: 'One lowercase letter (a-z)',
    test: (password) => /[a-z]/.test(password),
  },
  DIGIT_PATTERN: {
    id: 'DIGIT_PATTERN',
    label: 'One number (0-9)',
    test: (password) => /[0-9]/.test(password),
  },
  SPECIAL_CHAR_PATTERN: {
    id: 'SPECIAL_CHAR_PATTERN',
    label: 'One special character (!@#$%^)',
    test: (password) => /[^A-Za-z0-9]/.test(password),
  },
}

// COMMON_PASSWORDS_PATTERN and CONTEXT_SPECIFIC_PASSWORD are deliberately NOT in that map.
// One needs a breached-password dictionary, the other the user's own name and email, and
// the browser has neither — so `rulesFromPolicy` drops them and the form says nothing about
// them up front. They are still enforced: the API rejects the password and its own message
// names the rule, which is the only place either can be decided. Don't reinstate them as a
// checklist item (a permanent tick is a lie, a row that can never tick is noise) and above
// all don't invent a regex — that either fails a password the server accepts, or ticks green
// and gets rejected anyway, which is the exact gap this file exists to close.

// Used only when the owner has configured NO policy. Kept deliberately equal to what the
// template shipped before this was configurable: extra client-side rules can only cause
// friction (rejecting something the API would take), whereas too FEW re-opens the
// form-accepts/server-rejects gap. Friction is the safer way to be wrong.
const DEFAULT_RULES: PasswordRule[] = [
  {
    id: 'minLength',
    label: 'At least 8 characters',
    test: (password) => password.length >= 8,
  },
  PREFERENCE_RULES.UPPER_CASE_PATTERN,
  PREFERENCE_RULES.SPECIAL_CHAR_PATTERN,
]

function lengthRules(policy: PasswordPolicy): PasswordRule[] {
  const { minLength, maxLength } = policy.lengthLimits ?? {}
  const rules: PasswordRule[] = []
  if (minLength && maxLength) {
    rules.push({
      id: 'length',
      label: `Between ${minLength} and ${maxLength} characters`,
      test: (password) => password.length >= minLength && password.length <= maxLength,
    })
    return rules
  }
  if (minLength) {
    rules.push({
      id: 'minLength',
      label: `At least ${minLength} characters`,
      test: (password) => password.length >= minLength,
    })
  }
  if (maxLength) {
    rules.push({
      id: 'maxLength',
      label: `At most ${maxLength} characters`,
      test: (password) => password.length <= maxLength,
    })
  }
  return rules
}

function isPolicyConfigured(policy?: PasswordPolicy): policy is PasswordPolicy {
  if (!policy) return false
  return Boolean(
    policy.lengthLimits?.minLength ||
      policy.lengthLimits?.maxLength ||
      policy.preferences?.length,
  )
}

export function rulesFromPolicy(policy?: PasswordPolicy): PasswordRule[] {
  if (!isPolicyConfigured(policy)) return DEFAULT_RULES
  const preferenceRules = (policy.preferences ?? [])
    .map((preference) => PREFERENCE_RULES[preference])
    .filter(Boolean)
  return [...lengthRules(policy), ...preferenceRules]
}

// Rules about a password's life AFTER it is set. Nothing in a form can check these, so
// they are copy, never validation.
export function lifecycleNotes(policy?: PasswordPolicy): string[] {
  if (!policy) return []
  const notes: string[] = []
  if (policy.expiryDays) notes.push(`Your password expires every ${policy.expiryDays} days.`)
  if (policy.minAgeDays) {
    notes.push(`You can't change it again for ${policy.minAgeDays} days.`)
  }
  if (policy.historySize) {
    notes.push(`Your last ${policy.historySize} passwords can't be reused.`)
  }
  return notes
}

interface InterfaceRecord {
  properties?: {
    security?: { passwordRestrictions?: PasswordPolicy }
    // A packaged app's package security wins over the interface's own — same precedence
    // the SDK applies when resolving PUBLIC vs PRIVATE.
    package?: { security?: { passwordRestrictions?: PasswordPolicy } }
  }
}

const API_BASE = import.meta.env.VITE_ENTITY_API_BASE || ''
const APPLICATION_ID = import.meta.env.VITE_APPLICATION_ID

async function fetchPasswordPolicy(): Promise<PasswordPolicy | undefined> {
  const response = await fetch(`${API_BASE}/auth/interface`, {
    // the app is identified by id, not by domain — a cross-origin preview build can't
    // rely on the route-based lookup, so the header always goes out
    headers: APPLICATION_ID ? { 'x-ua-app': APPLICATION_ID } : undefined,
    credentials: API_BASE ? 'include' : 'same-origin',
  })
  if (!response.ok) throw new Error(`Could not read the app's password policy`)
  const record = (await response.json()) as InterfaceRecord
  const security = record.properties?.package?.security ?? record.properties?.security
  return security?.passwordRestrictions
}

/**
 * The rules a password-setting form should show and enforce.
 *
 * `isLoading` matters: until the policy resolves we don't know the rules, so a form must
 * not accept a submission yet — validating against the fallback and then swapping is how
 * a user gets told their password is fine and then rejected.
 */
export function usePasswordPolicy() {
  const { data, isPending } = useQuery({
    queryKey: ['password-policy'],
    queryFn: fetchPasswordPolicy,
    staleTime: 5 * 60 * 1000,
    // the policy is not worth a retry storm on a sign-in surface; the fallback rules
    // plus the API's own rejection still lead the user somewhere sensible
    retry: false,
  })

  return {
    policy: data,
    rules: rulesFromPolicy(data),
    notes: lifecycleNotes(data),
    isLoading: isPending,
  }
}
