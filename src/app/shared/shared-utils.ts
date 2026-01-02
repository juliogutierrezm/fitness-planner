/**
 * Sanitize exercise name for ID generation by replacing spaces and special characters with underscores
 */
export function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')  // Replace spaces with underscores
    .replace(/[^a-z0-9_]/g, '_')  // Replace special characters with underscores
    .replace(/_+/g, '_')  // Replace multiple consecutive underscores with a single underscore
    .replace(/^_+|_+$/g, '');  // Remove leading/trailing underscores
}

/**
 * Calculate age from date of birth string (ISO format: YYYY-MM-DD or full ISO)
 */
export function calculateAge(dateOfBirth: string): number | null {
  if (!dateOfBirth) return null;

  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  return age >= 0 ? age : null;
}
