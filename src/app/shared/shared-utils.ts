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
