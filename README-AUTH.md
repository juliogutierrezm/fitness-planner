# Fitness Planner - AWS Cognito Authentication

This document describes the AWS Cognito authentication implementation for the Fitness Planner application.

## Features

- AWS Cognito Hosted UI authentication
- JWT token management with HTTP interceptor
- Protected routes for `/planner`, `/workout-plans`, and `/exercise-manager`
- Environment-based configuration (no secrets in repo)
- User session management

## Environment Variables

Set these environment variables for your deployment:

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `COGNITO_DOMAIN` | Your Cognito Hosted UI domain | `fitness-planner-dev.auth.us-east-1.amazoncognito.com` |
| `USER_POOL_ID` | AWS Cognito User Pool ID | `us-east-1_ABC123DEF` |
| `CLIENT_ID` | AWS Cognito App Client ID | `1234567890abcdefghijk` |
| `REDIRECT_URI` | OAuth redirect URI | `https://yourapp.com` or `http://localhost:4200` |

### Local Development

Create a `.env` file in the project root:

```env
COGNITO_DOMAIN=your-domain.auth.us-east-1.amazoncognito.com
USER_POOL_ID=us-east-1_XXXXXXXXX
CLIENT_ID=your-client-id-here
REDIRECT_URI=http://localhost:4200
```

### GitHub Secrets

For GitHub Actions, set these repository secrets:

```bash
# GitHub repository secrets
COGNITO_DOMAIN
USER_POOL_ID
CLIENT_ID
REDIRECT_URI
```

### AWS Systems Manager (SSM) Parameters

For AWS deployments, store as SSM parameters:

```bash
# SSM Parameter Store
/fitness-planner/dev/cognito-domain
/fitness-planner/dev/user-pool-id
/fitness-planner/dev/client-id
/fitness-planner/dev/redirect-uri

# Production
/fitness-planner/prod/cognito-domain
/fitness-planner/prod/user-pool-id
/fitness-planner/prod/client-id
/fitness-planner/prod/redirect-uri
```

## AWS Cognito Setup

### 1. Create User Pool

```bash
aws cognito-idp create-user-pool \
  --pool-name "fitness-planner-users" \
  --policies "PasswordPolicy={MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true}" \
  --auto-verified-attributes email \
  --username-attributes email
```

### 2. Create App Client

```bash
aws cognito-idp create-user-pool-client \
  --user-pool-id us-east-1_XXXXXXXXX \
  --client-name "fitness-planner-client" \
  --generate-secret false \
  --supported-identity-providers COGNITO \
  --callback-urls "http://localhost:4200","https://yourapp.com" \
  --logout-urls "http://localhost:4200","https://yourapp.com" \
  --allowed-o-auth-flows "code" \
  --allowed-o-auth-scopes "email" "openid" "profile" \
  --allowed-o-auth-flows-user-pool-client
```

### 3. Create Domain

```bash
aws cognito-idp create-user-pool-domain \
  --domain fitness-planner-dev \
  --user-pool-id us-east-1_XXXXXXXXX
```

### 4. Create Test User

```bash
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username testuser@example.com \
  --user-attributes Name=email,Value=testuser@example.com \
  --temporary-password TempPass123! \
  --message-action SUPPRESS
```

## Local Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set environment variables:**
   Create `.env` file with your Cognito configuration.

3. **Start development server:**
   ```bash
   ng serve
   ```

4. **Test authentication flow:**
   - Navigate to `http://localhost:4200/planner`
   - Should redirect to Cognito Hosted UI
   - Login with test credentials
   - Should redirect back and show user badge

## Authentication Flow

1. **Unauthenticated access to protected route:**
   - User navigates to `/planner` or `/workout-plans`
   - AuthGuard detects no authentication
   - Redirects to Cognito Hosted UI

2. **OAuth callback:**
   - User completes authentication on Cognito
   - Redirected back with authorization code
   - AuthService exchanges code for JWT tokens
   - Tokens stored in localStorage
   - User state updated

3. **Authenticated requests:**
   - HTTP interceptor automatically adds `Authorization: Bearer <token>` header
   - Backend APIs can validate JWT tokens

4. **Logout:**
   - Clears localStorage
   - Redirects to Cognito logout URL
   - User redirected back to home page

## Testing

### Run Unit Tests

```bash
ng test
```

### Test Authentication Manually

1. **Start app:** `ng serve`
2. **Test protected route:** Go to `http://localhost:4200/planner`
3. **Verify redirect:** Should redirect to Cognito Hosted UI
4. **Login:** Use test credentials
5. **Verify success:** Should return to app with user badge showing

### Test HTTP Interceptor

Check Network tab in browser DevTools - API requests should include `Authorization` header when logged in.

## Deployment

### Production Build

```bash
# Set production environment variables
export COGNITO_DOMAIN=your-prod-domain.auth.us-east-1.amazoncognito.com
export USER_POOL_ID=us-east-1_PRODPOOLID
export CLIENT_ID=prod-client-id
export REDIRECT_URI=https://yourapp.com

# Build for production
ng build --configuration=production
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm ci --only=production
RUN ng build --configuration=production

# Environment variables will be injected at runtime
ENV COGNITO_DOMAIN=""
ENV USER_POOL_ID=""
ENV CLIENT_ID=""
ENV REDIRECT_URI=""

EXPOSE 4200
CMD ["ng", "serve", "--host", "0.0.0.0"]
```

### AWS Amplify Deployment

```yaml
version: 1
applications:
  - frontend:
      phases:
        preBuild:
          commands:
            - npm install
        build:
          commands:
            - ng build --configuration=production
      artifacts:
        baseDirectory: dist/fitness-planner
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
    appRoot: fitness-planner
```

Set environment variables in Amplify Console under "Environment variables".

## Troubleshooting

### Common Issues

1. **"Invalid redirect URI"**
   - Ensure callback URLs are configured in Cognito App Client
   - Check exact URL match (trailing slash matters)

2. **"Token exchange failed"**
   - Verify App Client configuration
   - Check network connectivity
   - Ensure CORS is configured for your domain

3. **AuthGuard not triggering**
   - Verify routes are protected with `canActivate: [AuthGuard]`
   - Check that AuthService is properly injected

4. **HTTP interceptor not adding token**
   - Verify interceptor is registered in app.config.ts
   - Check that user is authenticated and token exists

### Debug Mode

Enable console logging to debug authentication flow:

```typescript
// In auth.service.ts, add logging
console.log('Auth state:', this.getUser());
console.log('Token:', this.getIdToken());
```

## Security Considerations

- Tokens are stored in localStorage (consider httpOnly cookies for enhanced security)
- Always use HTTPS in production
- Implement token refresh logic for long-lived sessions
- Validate JWT tokens on the backend
- Set appropriate CORS policies
- Use least privilege principle for IAM roles

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Angular App   │    │   AWS Cognito    │    │   Backend API   │
│                 │    │   Hosted UI      │    │                 │
├─────────────────┤    ├──────────────────┤    ├─────────────────┤
│ AuthService     │◄──►│ OAuth 2.0 Flow   │    │ JWT Validation  │
│ AuthGuard       │    │ Token Exchange   │    │ Protected       │
│ AuthInterceptor │    │ User Management  │    │ Resources       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Files Modified/Added

### New Files
- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`
- `src/app/auth/auth.service.ts`
- `src/app/auth/auth.guard.ts`
- `src/app/auth/auth.interceptor.ts`
- `src/app/auth/auth.service.spec.ts`
- `src/app/auth/auth.guard.spec.ts`

### Modified Files
- `src/app/app.config.ts` - Added HTTP interceptor
- `src/app/app.routes.ts` - Added protected routes
- `src/app/app.component.ts` - Added redirect handling
- `src/app/layout/layout.component.*` - Added login/logout UI