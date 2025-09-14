// AWS Amplify configuration
// Note: These values should be replaced with actual Cognito User Pool details
export const awsExports = {
  aws_project_region: 'us-east-1',
  aws_cognito_region: 'us-east-1',
  aws_user_pools_id: 'us-east-1_8jk4VBnTQ',
  aws_user_pools_web_client_id: '1t134cjf2t07f018cruflg41rk',
  oauth: {
    domain: 'fitness-planner-dev-auth.auth.us-east-1.amazoncognito.com',
    scope: ['email', 'openid', 'profile'],
    redirectSignIn: 'http://localhost:4200/callback',
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
