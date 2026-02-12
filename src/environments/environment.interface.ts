/**
 * Purpose: Shared type definition for all Angular environment files.
 * Enforces a consistent shape across DEV, PROD, and TEST configurations.
 * Standards Check: SRP OK | DRY OK | Tests N/A (type-only).
 */
export interface Environment {
  /** true for production builds, false otherwise */
  production: boolean;

  /** Fully qualified API Gateway base URL for the target environment */
  apiBase: string;

  /** AWS Cognito User Pool configuration for the target environment */
  cognito: {
    domain: string;
    userPoolId: string;
    clientId: string;
  };
}
