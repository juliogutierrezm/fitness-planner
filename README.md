# Fitness Planner

Angular 19 fitness planning application with custom AWS Cognito authentication and API integration.

## Features

- 🔐 Custom AWS Cognito authentication (signup, confirmación, login, reset)
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

1. Navigate to `http://localhost:4200/login`
2. Crea una cuenta en `/signup` y confirma el código
3. Inicia sesión para llegar a `/dashboard` (los guards redirigen a onboarding/unauthorized según grupos)

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
   apiBase: 'https://4e3slegwi9.execute-api.us-east-1.amazonaws.com/dev',
  cognito: {
    domain: 'fitness-planner-dev-auth.auth.us-east-1.amazoncognito.com',
    userPoolId: 'us-east-1_8jk4VBnTQ',
    clientId: '1t134cjf2t07f018cruflg41rk'
  }
};
```

## Architecture

### Authentication Components
- **AuthService**: Core authentication logic (signup, login, reset, tokens)
- **AuthGuard**: Route protection for authenticated-only pages
- **AuthFlowGuard**: Idempotent access for auth routes and steps
- **AuthInterceptor**: Auto-attaches Bearer tokens to API requests
- **Auth UI**: login, signup, confirm-signup, forgot/reset password, force-change-password

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
1. User visits /login or a protected route
2. AuthGuard/AuthFlowGuard valida la sesión con Cognito (Amplify)
3. Login/signup se realizan con forms custom
4. Cognito entrega tokens y Amplify los mantiene en sesión
5. Guards redirigen a /dashboard o a /onboarding/unauthorized según grupos
6. Todas las llamadas al API incluyen Authorization: Bearer <token>
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
```bash
# Run all tests
npm test
```

## Troubleshooting

### Common Issues

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
- Update `apiBase` to production API URL
- Verifica el dominio y clientId del User Pool según tu entorno
