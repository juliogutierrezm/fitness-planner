# Fitness Planner

Angular 19 fitness planning application with custom AWS Cognito authentication, multi-tenant architecture, and AI-powered workout plan generation.

## Features

- 🔐 Custom AWS Cognito authentication (signup, confirmacion, login, reset, force-change-password)
- 🛡️ Protected routes with role-based guards (Admin, Trainer, Client, System)
- 🏢 Multi-tenant architecture (modo gimnasio vs independiente) por `companyId`
- 🤖 AI-powered workout plan generation (3-step parametric wizard + free-form prompt)
- 🌐 JWT token-based API authentication (auto-attached to API calls)
- 📋 Workout planner with drag & drop, supersets, templates, and progressions
- 👥 User management (clients, trainers) with role-based visibility
- 📊 Dashboard with KPIs by tenant mode
- 📏 Client body metrics tracking (BMI, measurements)
- 🎨 Tenant branding (theme colors, logo upload)
- 📄 PDF generation with bilingual support (es/en)
- 🌍 Localization support (exercise names, equipment labels, PDF labels)
- 🚀 SPA (static hosting) ready for AWS S3 + CloudFront

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
2. Crea una cuenta en `/signup` y confirma el codigo
3. Inicia sesion para llegar a `/dashboard` (los guards redirigen a onboarding/unauthorized segun grupos)

### 4. Verify Everything Works
1. After login, visit `http://localhost:4200/diagnostics` (requires System group)
2. Check authentication status and token info
3. Test API calls with the built-in buttons

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

### Authentication & Security
- **AuthService**: Core authentication logic (signup, login, reset, tokens, role resolution)
- **AuthGuard**: Route protection for authenticated-only pages
- **AuthFlowGuard**: Idempotent access for auth routes and steps
- **OnboardingGuard**: Controls access to onboarding flow
- **PostLoginRedirectGuard**: Prevents post-login navigation loops
- **RoleGuard**: Validates user roles against route requirements
- **SystemGuard**: Requires System group membership
- **AuthInterceptor**: Auto-attaches Bearer tokens + JWT issuer validation

### Core Modules
- **Planner**: Workout plan creation/editing with drag & drop, supersets, templates, AI integration
- **AI Plan Generation**: 3-step parametric wizard + free-form prompt + polling + timeline visualization
- **Exercise Manager**: Exercise library with filters, pagination, inline editing (System group)
- **Dashboard**: KPIs by tenant mode (gym admin, gym trainer, independent trainer)
- **User Management**: Clients (CRUD, status, trainer assignment) + Trainers (admin management)
- **Templates**: Plan templates with tenant-scoped filtering and client assignment
- **Body Metrics**: Client measurements and BMI tracking
- **PDF Generator**: Branded PDF output with bilingual labels
- **Settings**: Tenant branding (theme colors, logo upload)

### Protected Routes
- `/dashboard` - Main dashboard with role-specific KPIs
- `/planner` / `/planner/:id` - Workout planning interface
- `/templates` - Training templates management
- `/plan/:id` - Plan view page
- `/exercise-manager` - Exercise library management
- `/clients` / `/users` - Client management
- `/users/:id` - User detail and plan history
- `/clients/:id/body-metrics` - Body metrics tracking
- `/ai-plans` - AI plans dashboard
- `/ai-plans/user/:id` - AI plans per user
- `/ai-plans/user/:id/plan/:executionId` - AI plan detail
- `/trainers` - Trainer management (Admin)
- `/diagnostics` - System diagnostics (System group)
- `/settings/appearance` - Theme and branding settings
- `/onboarding` - Post-login initialization

### API Integration
- All requests to `environment.apiBase` automatically get `Authorization: Bearer <id_token>` header
- JWT issuer validation against Cognito User Pool per environment
- Non-API requests are not modified
- Token validation and expiration handling built-in

## Authentication Flow

```
1. User visits /login or a protected route
2. AuthGuard/AuthFlowGuard valida la sesion con Cognito (Amplify)
3. Login/signup se realizan con forms custom
4. Cognito entrega tokens y Amplify los mantiene en sesion
5. Guards redirigen a /dashboard o a /onboarding/unauthorized segun grupos
6. Todas las llamadas al API incluyen Authorization: Bearer <token>
7. JWT issuer se valida contra el User Pool del entorno actual
```

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run unit tests
npm test

# Build for production
npm run build

# Build in watch mode
npm run watch

# Run API smoke tests
API_BASE=<url> ID_TOKEN=<token> TEST_USER_ID=<id> node scripts/smoke-api.mjs
```

## Documentation

- [DOCUMENTATION.md](DOCUMENTATION.md) - Full technical documentation
- [DEVELOPER..md](DEVELOPER..md) - Developer standards and practices
- [AGENT_RULES.md](AGENT_RULES.md) - AI agent rules and code generation policy

# Run tests in watch mode
npm test -- --watch

# Build for production (SPA static output)
npm run build

# Serve in development
npm run start
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
- Set `cognito.redirectUri` to your CloudFront callback URL (for example: `https://<distribution>.cloudfront.net/callback`)
- Build with `npm run build -- --configuration production`
- Upload contents of `dist/fitness-planner/` to S3 (no server runtime required)
