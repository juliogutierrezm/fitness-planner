# Fitness Planner

Angular 19 fitness planning application with AWS Cognito Hosted UI authentication and API integration.

## Features

- 🔐 AWS Cognito Hosted UI authentication with JWT tokens
- 🛡️ Protected routes with AuthGuard (`/planner`, `/plans`, `/exercise-manager`, `/diagnostics`)
- 🌐 JWT token-based API authentication (auto-attached to API calls)
- 🔧 SSR (Server-Side Rendering) compatible
- 🎨 Material Design UI with responsive layout
- 📊 Built-in diagnostics page for auth and API testing

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
ng serve
```
The application will be available at `http://localhost:4200`

### 3. Test Authentication Flow

**Option A: Direct Hosted UI URL**
Navigate to the Cognito Hosted UI directly:
```
https://fitness-planner-dev-auth.auth.us-east-1.amazoncognito.com/oauth2/authorize?client_id=1t134cjf2t07f018cruflg41rk&response_type=code&scope=email+openid+profile&redirect_uri=http%3A%2F%2Flocalhost%3A4200%2Fcallback
```

**Option B: Protected Route Redirect**
1. Navigate to `http://localhost:4200/planner`
2. You'll be automatically redirected to Cognito Hosted UI
3. After login, you'll be redirected back to `/callback` then to `/dashboard`

### 4. Verify Everything Works
1. After login, visit `http://localhost:4200/diagnostics`
2. Check authentication status and token info
3. Test API calls with the buttons:
   - "Call /exercise" → `GET /exercise`
   - "Call /workoutPlans" → `GET /workoutPlans?trainerId=<user-id>`

## Current Configuration

The application is pre-configured with these values:

```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  apiBase: 'https://k2ok2k1ft9.execute-api.us-east-1.amazonaws.com/dev',
  cognito: {
    domain: 'fitness-planner-dev-auth.auth.us-east-1.amazoncognito.com',
    userPoolId: 'us-east-1_8jk4VBnTQ',
    clientId: '1t134cjf2t07f018cruflg41rk',
    redirectUri: 'http://localhost:4200/callback'
  }
};
```

## Architecture

### Authentication Components
- **AuthService**: Core authentication logic (login, logout, token management)
- **AuthGuard**: Route protection for authenticated-only pages
- **AuthInterceptor**: Auto-attaches Bearer tokens to API requests
- **CallbackComponent**: Handles OAuth callback after Cognito login

### Protected Routes
- `/planner` - Workout planning interface
- `/plans` - Redirects to `/workout-plans`
- `/workout-plans` - List of workout plans
- `/exercise-manager` - Exercise management
- `/diagnostics` - **Auth and API testing interface**

### API Integration
- All requests to `environment.apiBase` automatically get `Authorization: Bearer <id_token>` header
- Non-API requests are not modified
- Token validation and expiration handling built-in

## Authentication Flow

```
1. User visits protected route (e.g., /planner)
2. AuthGuard checks authentication status
3. If not logged in → Redirect to Cognito Hosted UI
4. User completes login in Cognito
5. Cognito redirects to /callback with authorization code
6. CallbackComponent exchanges code for JWT tokens
7. Tokens stored in localStorage
8. User redirected to /dashboard
9. All subsequent API calls include Bearer token automatically
```

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
ng serve

# Run unit tests
npm test

# Run tests in watch mode
npm test -- --watch

# Build for production (includes SSR)
npm run build

# Serve production build locally
npm run serve:ssr:fitness-planner
```

## Testing

### Unit Tests
- Mock utilities provided in `src/app/auth/test-utils.ts`
- Tests avoid real network calls and Cognito API
- localStorage and window.location properly mocked

```bash
# Run all tests
npm test

# Run auth tests only
npm test -- --include="**/auth/**/*.spec.ts"
```

## Troubleshooting

### Common Issues

#### ❌ "Invalid callback URL" error
**Problem**: Cognito rejects the callback URL
**Solution**: 
1. Check that `http://localhost:4200/callback` is configured in Cognito App Client settings
2. Verify the port number matches your dev server (default: 4200)
3. Ensure no trailing slashes in the callback URL

#### ❌ Token missing or 401 Unauthorized
**Problem**: API calls fail with authentication errors
**Solutions**:
1. Check if logged in: Visit `/diagnostics` to see auth status
2. Verify token expiration: Tokens expire after ~1 hour
3. Re-login if needed: Click "Logout" then "Login" again
4. Check API base URL: Ensure `environment.apiBase` is correct

#### ❌ "User does not exist" error during signup
**Problem**: Cognito User Pool settings restrict registration
**Solutions**:
1. Use existing test account if provided
2. Check Cognito User Pool settings allow new user registration
3. Contact admin to create account manually

#### ❌ Page shows "Loading..." forever
**Problem**: JavaScript errors or failed authentication
**Solutions**:
1. Open browser DevTools (F12) and check Console for errors
2. Clear localStorage: `localStorage.clear()` in browser console
3. Visit `/diagnostics` to check authentication state
4. Hard refresh: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)

#### ❌ API calls fail with CORS errors
**Problem**: API doesn't allow requests from localhost
**Solutions**:
1. This is expected for external APIs - check if API supports CORS
2. Use a proxy or API Gateway with CORS enabled
3. For testing: Use browser extensions to disable CORS (not recommended for production)

### Debug Steps

1. **Check Authentication State**:
   ```
   Visit: http://localhost:4200/diagnostics
   Look for: Login status, token expiration, user email
   ```

2. **Verify Network Requests**:
   ```
   Open DevTools → Network tab
   Trigger API call from /diagnostics
   Check: Request headers include Authorization: Bearer <token>
   ```

3. **Inspect JWT Token**:
   ```
   Visit: /diagnostics → Expand "Decode JWT Token"
   Verify: Payload contains expected user data and expiration
   ```

4. **Check Console Logs**:
   ```
   Open DevTools → Console tab
   Look for: Authentication errors, token parsing issues
   ```

### Reset Authentication
If authentication gets stuck, reset completely:
```javascript
// In browser console:
localStorage.clear();
window.location.href = '/';
```

## Production Deployment

For production deployment, update `src/environments/environment.prod.ts`:
- Change `redirectUri` to your production domain
- Update `apiBase` to production API URL
- Ensure Cognito User Pool is configured with production callback URLs
