/** Client-side mirrors of backend validation rules (the API remains the source of truth). */

/** Password policy: 8–72 bytes (bcrypt limit), at least one letter and one digit. */
export function passwordProblems(password = '') {
  const problems = []
  if (password.length < 8) problems.push('at least 8 characters')
  if (new TextEncoder().encode(password).length > 72) problems.push('at most 72 bytes')
  if (!/[A-Za-z]/.test(password)) problems.push('a letter')
  if (!/\d/.test(password)) problems.push('a digit')
  return problems
}

const CURRENT_YEAR = new Date().getFullYear()

/** Year options from the current year back to 2000, newest first. */
export const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - 1999 }, (_, i) => {
  const year = CURRENT_YEAR - i
  return { value: String(year), label: String(year) }
})
