// Utility functions for age calculations and display

/**
 * Calculate age from date of birth
 */
export function calculateAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null
  
  const birthDate = new Date(dateOfBirth)
  const today = new Date()
  
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  
  return age
}

/**
 * Format age in natural language
 */
export function formatAge(dateOfBirth: string | null): string {
  const age = calculateAge(dateOfBirth)
  if (age === null) return 'Age not set'
  
  if (age === 1) return '1 year old'
  return `${age} years old`
}

/**
 * Validate date of birth (must be 18+)
 */
export function isValidDateOfBirth(dateOfBirth: string): boolean {
  const age = calculateAge(dateOfBirth)
  return age !== null && age >= 18
}

/**
 * Get minimum allowed date (18 years ago from today)
 */
export function getMinimumDateOfBirth(): string {
  const today = new Date()
  const minDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())
  return minDate.toISOString().split('T')[0]
}
