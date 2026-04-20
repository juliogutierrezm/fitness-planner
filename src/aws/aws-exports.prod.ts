// AWS Amplify configuration (PROD)
export const awsExports = {
  aws_project_region: 'us-east-1',
  aws_cognito_region: 'us-east-1',

  aws_user_pools_id: 'us-east-1_uUU5kQqKQ',
  aws_user_pools_web_client_id: '6kuo4fgmr4s6qtfniuv4bu59f0',

  federationTarget: 'COGNITO_USER_POOLS',

  aws_cognito_username_attributes: ['email'],
  aws_cognito_social_providers: [],

  aws_cognito_signup_attributes: [
    'email',
    'family_name',
    'given_name'
  ],

  aws_cognito_mfa_configuration: 'OFF',
  aws_cognito_mfa_types: ['SMS'],

  aws_cognito_password_protection_settings: {
    passwordPolicyMinLength: 8,
    passwordPolicyCharacters: []
  },

  aws_cognito_verification_mechanisms: ['email']
};
