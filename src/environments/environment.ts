export const environment = {
  production: false,
  cognito: {
    domain: 'fitness-planner-dev-auth.auth.us-east-1.amazoncognito.com',
    userPoolId: 'us-east-1_8jk4VBnTQ',
    clientId: '1t134cjf2t07f018cruflg41rk',
    redirectUri: 'http://localhost:4200/callback' // ← igualita a la de Cognito
  },
  apiBase: 'https://k2ok2k1ft9.execute-api.us-east-1.amazonaws.com/dev'
};
