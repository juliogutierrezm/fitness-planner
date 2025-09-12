// AWS Amplify configuration
// Note: These values should be replaced with actual Cognito User Pool details
export const awsExports = {
  aws_project_region: 'us-east-1',
  aws_cognito_identity_pool_id: 'us-east-1:YOUR_IDENTITY_POOL_ID',
  aws_cognito_region: 'us-east-1',
  aws_user_pools_id: 'us-east-1_YOUR_USER_POOL_ID',
  aws_user_pools_web_client_id: 'YOUR_CLIENT_ID',
  oauth: {
    domain: 'your-domain.auth.us-east-1.amazoncognito.com',
    scope: ['phone', 'email', 'openid', 'profile', 'aws.cognito.signin.user.admin'],
    redirectSignIn: 'http://localhost:4200/',
    redirectSignOut: 'http://localhost:4200/',
    responseType: 'code'
  },
  federationTarget: 'COGNITO_USER_POOLS',
  aws_cognito_username_attributes: ['email'],
  aws_cognito_social_providers: [],
  aws_cognito_signup_attributes: ['email', 'family_name', 'given_name'],
  aws_cognito_mfa_configuration: 'OFF',
  aws_cognito_mfa_types: ['SMS'],
  aws_cognito_password_protection_settings: {
    passwordPolicyMinLength: 8,
    passwordPolicyCharacters: []
  },
  aws_cognito_verification_mechanisms: ['email']
};