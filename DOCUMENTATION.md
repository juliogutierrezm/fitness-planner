# Fitness Planner

## Descripción general
Fitness Planner es una aplicación de planificación de entrenamientos desarrollada en Angular 19, que integra un sistema de autenticación híbrido con AWS Cognito (OAuth 2.0 + PKCE + Amplify) y conectividad con API para gestionar planes de ejercicios, usuarios y recursos fitness. Ofrece una interfaz responsiva con Material Design, soporte para server-side rendering (SSR), rutas protegidas con control de acceso basado en roles (Admin, Trainer, Client), y funcionalidades administrativas avanzadas.
Tambien incluye configuracion de apariencia por tenant (branding, colores, tipografia, modo claro/oscuro y logo) con vista previa para administradores.

## Arquitectura de Autenticación y AWS Cognito

### Sistema Híbrido de Autenticación
La aplicación implementa un sistema de autenticación híbrido que combina las mejores características de OAuth 2.0 directo con AWS Amplify para proporcionar una experiencia segura y rica en funcionalidades:

#### 1. **Servicio de OAuth 2.0 Personalizado** (`src/app/auth/auth.service.ts`)
- **PKCE (Proof Key for Code Exchange)**: Implementación completa para mayor seguridad en aplicaciones públicas
- **Intercambio directo de tokens**: Comunicación directa con los endpoints OAuth 2.0 de Cognito
- **Gestión de tokens personalizada**: Almacenamiento seguro en localStorage/sessionStorage con validación de expiración
- **Manejo de callbacks**: Procesamiento robusto de respuestas de autenticación con manejo de errores

#### 2. **Servicio AWS Amplify** (`src/app/services/auth.service.ts`)
- **Control de acceso basado en roles**: Sistema jerárquico con tres roles (Admin, Trainer, Client)
- **Gestión de perfiles de usuario**: Atributos personalizados y metadatos de usuario
- **Sesiones avanzadas**: Manejo automático de refresh tokens y estados de autenticación
- **Integración con grupos de Cognito**: Extracción automática de roles desde grupos y atributos personalizados

### Configuración de AWS Cognito

#### User Pool Configuration (CloudFormation)
```yaml
# cognito-setup.yaml - Configuración completa del User Pool
Resources:
  FitnessUserPool:
    Type: AWS::Cognito::UserPool
    Properties:
      # Atributos personalizados para roles y relaciones
      Schema:
        - Name: role
          AttributeDataType: String
          Required: false
          Mutable: true
        - Name: companyId
          AttributeDataType: String
          Required: false
          Mutable: true
        - Name: trainerIds
          AttributeDataType: String
          Required: false
          Mutable: true
```

#### Grupos de Usuarios
- **Admin**: Acceso completo a todas las funcionalidades
- **Trainer**: Gestión de clientes y planes de entrenamiento
- **Client**: Acceso básico a planes asignados

#### Flujo de OAuth 2.0 con PKCE
1. **Inicio de autenticación**: Generación de code_verifier y code_challenge
2. **Redirección a Hosted UI**: Usuario autenticado en Cognito
3. **Callback processing**: Intercambio de código por tokens usando PKCE
4. **Token storage**: Almacenamiento seguro de ID Token y Access Token
5. **Role extraction**: Determinación de roles desde tokens y grupos

### Seguridad Implementada

#### PKCE Implementation
```typescript
// Generación segura de code verifier (RFC 7636)
private generateCodeVerifier(length: number = 64): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  // Implementación crypto-safe con fallback
}
```

#### Token Management
- **Validación de expiración**: Verificación automática de tokens expirados
- **Refresh automático**: Manejo transparente de refresh tokens
- **Storage seguro**: Uso de localStorage con validaciones de integridad

#### Guards y Autorización
- **AuthGuard**: Protección básica de rutas autenticadas
- **RoleGuard**: Control de acceso basado en roles específicos
- **Data Access Control**: Verificación de permisos para acceder a datos de otros usuarios

### Roles y Permisos

| Rol | Permisos |
|-----|----------|
| **Admin** | Acceso completo a usuarios, planes, ejercicios y configuraciones del sistema |
| **Trainer** | Gestión de sus clientes asignados, creación de planes, acceso al catálogo de ejercicios |
| **Client** | Acceso a sus propios planes asignados y perfil personal |

### Integración con API Backend
```typescript
// Interceptor automático de autenticación
export class AuthInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const isApiRequest = req.url.startsWith(environment.apiBase);
    const idToken = this.authService.getIdToken();

    if (isApiRequest && idToken && this.authService.isLoggedIn()) {
      return next.handle(req.clone({
        setHeaders: { Authorization: `Bearer ${idToken}` }
      }));
    }
    return next.handle(req);
  }
}
```

## Estructura de carpetas y archivos
```
fitness-planner/
├── .editorconfig
├── .gitignore
├── AGENT_RULES.md
├── angular.json
├── APPEARANCE_SETTINGS_DOCS.md
├── cognito-setup.yaml
├── cognito-ui.css
├── DEVELOPER..md
├── DOCUMENTATION.md
├── package-lock.json
├── package.json
├── proxy.conf.json
├── README.md
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.spec.json
├── public/
│   └── favicon.ico
├── scripts/
│   └── smoke-api.mjs
├── src/
│   ├── aws-exports.ts
│   ├── index.html
│   ├── main.server.ts
│   ├── main.ts
│   ├── server.ts
│   ├── stepFunctionExample.json
│   ├── styles.scss
│   ├── app/
│   │   ├── .auth.json
│   │   ├── app.component.html
│   │   ├── app.component.scss
│   │   ├── app.component.spec.ts
│   │   ├── app.component.ts
│   │   ├── app.config.server.ts
│   │   ├── app.config.ts
│   │   ├── app.routes.server.ts
│   │   ├── app.routes.ts
│   │   ├── exercise-api.service.ts
│   │   ├── user-api.service.ts
│   │   ├── assets/
│   │   │   ├── tempLogo.png
│   │   │   └── TrainGrid.png
│   │   ├── auth/
│   │   │   ├── auth.guard.spec.ts
│   │   │   ├── auth.guard.ts
│   │   │   ├── auth.interceptor.spec.ts
│   │   │   ├── auth.interceptor.ts
│   │   │   ├── auth.service.spec.ts
│   │   │   ├── auth.service.ts
│   │   │   └── test-utils.ts
│   │   ├── client/
│   │   │   ├── client.routes.ts
│   │   │   ├── layout/
│   │   │   │   ├── client-layout.component.html
│   │   │   │   ├── client-layout.component.scss
│   │   │   │   ├── client-layout.component.spec.ts
│   │   │   │   └── client-layout.component.ts
│   │   │   ├── pages/
│   │   │   │   ├── exercise-detail/
│   │   │   │   │   ├── client-exercise-detail.component.html
│   │   │   │   │   ├── client-exercise-detail.component.scss
│   │   │   │   │   ├── client-exercise-detail.component.spec.ts
│   │   │   │   │   └── client-exercise-detail.component.ts
│   │   │   │   ├── exercise-video/
│   │   │   │   │   ├── client-exercise-video.component.html
│   │   │   │   │   ├── client-exercise-video.component.scss
│   │   │   │   │   ├── client-exercise-video.component.spec.ts
│   │   │   │   │   └── client-exercise-video.component.ts
│   │   │   │   ├── plan-detail/
│   │   │   │   │   ├── client-plan-detail.component.html
│   │   │   │   │   ├── client-plan-detail.component.scss
│   │   │   │   │   ├── client-plan-detail.component.spec.ts
│   │   │   │   │   └── client-plan-detail.component.ts
│   │   │   │   ├── plans/
│   │   │   │   │   ├── client-plans.component.html
│   │   │   │   │   ├── client-plans.component.scss
│   │   │   │   │   ├── client-plans.component.spec.ts
│   │   │   │   │   └── client-plans.component.ts
│   │   │   │   ├── profile/
│   │   │   │   │   ├── client-profile.component.html
│   │   │   │   │   ├── client-profile.component.scss
│   │   │   │   │   ├── client-profile.component.spec.ts
│   │   │   │   │   └── client-profile.component.ts
│   │   │   │   └── session-exercises/
│   │   │   │       ├── client-session-exercises.component.html
│   │   │   │       ├── client-session-exercises.component.scss
│   │   │   │       ├── client-session-exercises.component.spec.ts
│   │   │   │       └── client-session-exercises.component.ts
│   │   │   ├── services/
│   │   │   │   ├── client-data.service.ts
│   │   │   │   ├── client-plans.service.spec.ts
│   │   │   │   └── getClientDataResponse.json
│   │   │   ├── styles/
│   │   │   │   └── _liquid.scss
│   │   │   └── utils/
│   │   │       └── session-exercise.utils.ts
│   │   ├── components/
│   │   │   ├── callback/
│   │   │   │   ├── callback.component.html
│   │   │   │   ├── callback.component.scss
│   │   │   │   └── callback.component.ts
│   │   │   ├── confirm-dialog/
│   │   │   │   ├── confirm-dialog.component.html
│   │   │   │   ├── confirm-dialog.component.scss
│   │   │   │   └── confirm-dialog.component.ts
│   │   │   ├── login/
│   │   │   │   ├── login.component.html
│   │   │   │   ├── login.component.scss
│   │   │   │   └── login.component.ts
│   │   │   ├── planner/
│   │   │   │   ├── ai/
│   │   │   │   │   ├── ai-generation-dialog.component.ts
│   │   │   │   │   ├── ai-parametric-dialog.component.html
│   │   │   │   │   ├── ai-parametric-dialog.component.scss
│   │   │   │   │   ├── ai-parametric-dialog.component.ts
│   │   │   │   │   ├── ai-prompt-dialog.component.html
│   │   │   │   │   ├── ai-prompt-dialog.component.scss
│   │   │   │   │   └── ai-prompt-dialog.component.ts
│   │   │   │   ├── dialogs/
│   │   │   │   │   ├── exercise-preview-dialog.component.ts
│   │   │   │   │   ├── plan-preview-dialog.component.ts
│   │   │   │   │   ├── previous-plans-dialog.component.html
│   │   │   │   │   ├── previous-plans-dialog.component.scss
│   │   │   │   │   └── previous-plans-dialog.component.ts
│   │   │   │   ├── models/
│   │   │   │   │   ├── planner-column.model.ts
│   │   │   │   │   ├── planner-exercise.model.ts
│   │   │   │   │   ├── planner-plan.model.ts
│   │   │   │   │   └── planner-session.model.ts
│   │   │   │   ├── planner.component.html
│   │   │   │   ├── planner.component.scss
│   │   │   │   ├── planner.component.spec.ts
│   │   │   │   ├── planner.component.ts
│   │   │   │   └── services/
│   │   │   │       ├── planner-drag-drop.service.spec.ts
│   │   │   │       ├── planner-drag-drop.service.ts
│   │   │   │       ├── planner-exercise-filter.service.spec.ts
│   │   │   │       ├── planner-exercise-filter.service.ts
│   │   │   │       ├── planner-form.service.spec.ts
│   │   │   │       ├── planner-form.service.ts
│   │   │   │       ├── planner-state.service.spec.ts
│   │   │   │       └── planner-state.service.ts
│   │   │   ├── test/
│   │   │   │   ├── test.component.html
│   │   │   │   ├── test.component.scss
│   │   │   │   ├── test.component.spec.ts
│   │   │   │   └── test.component.ts
│   │   │   ├── unauthorized/
│   │   │   │   ├── unauthorized.component.html
│   │   │   │   ├── unauthorized.component.scss
│   │   │   │   └── unauthorized.component.ts
│   │   │   └── workout-plan-view/
│   │   │       ├── workout-plan-view.component.html
│   │   │       ├── workout-plan-view.component.scss
│   │   │       ├── workout-plan-view.component.spec.ts
│   │   │       └── workout-plan-view.component.ts
│   │   ├── guards/
│   │   │   ├── auth.guard.ts
│   │   │   └── role.guard.ts
│   │   ├── interceptors/
│   │   │   └── auth.interceptor.ts
│   │   ├── layout/
│   │   │   ├── layout.component.html
│   │   │   ├── layout.component.scss
│   │   │   └── layout.component.ts
│   │   ├── pages/
│   │   │   ├── clients/
│   │   │   │   ├── clients.component.html
│   │   │   │   ├── clients.component.scss
│   │   │   │   └── clients.component.ts
│   │   │   ├── dashboard/
│   │   │   │   ├── dashboard.component.html
│   │   │   │   ├── dashboard.component.scss
│   │   │   │   ├── dashboard.component.spec.ts
│   │   │   │   └── dashboard.component.ts
│   │   │   ├── diagnostics/
│   │   │   │   ├── diagnostics.component.html
│   │   │   │   ├── diagnostics.component.scss
│   │   │   │   └── diagnostics.component.ts
│   │   │   ├── exercise-manager/
│   │   │   │   ├── components/
│   │   │   │   │   ├── exercise-detail/
│   │   │   │   │   │   ├── exercise-detail.component.html
│   │   │   │   │   │   ├── exercise-detail.component.scss
│   │   │   │   │   │   └── exercise-detail.component.ts
│   │   │   │   │   ├── exercise-edit-dialog/
│   │   │   │   │   │   ├── exercise-edit-dialog.component.html
│   │   │   │   │   │   ├── exercise-edit-dialog.component.scss
│   │   │   │   │   │   └── exercise-edit-dialog.component.ts
│   │   │   │   │   ├── exercise-filters/
│   │   │   │   │   │   ├── exercise-filters.component.html
│   │   │   │   │   │   ├── exercise-filters.component.scss
│   │   │   │   │   │   └── exercise-filters.component.ts
│   │   │   │   │   ├── exercise-table/
│   │   │   │   │   │   ├── exercise-table.component.html
│   │   │   │   │   │   ├── exercise-table.component.scss
│   │   │   │   │   │   └── exercise-table.component.ts
│   │   │   │   │   └── exercise-video-dialog/
│   │   │   │   │       ├── exercise-video-dialog.component.html
│   │   │   │   │       ├── exercise-video-dialog.component.scss
│   │   │   │   │       └── exercise-video-dialog.component.ts
│   │   │   │   ├── exercise-manager.component.html
│   │   │   │   ├── exercise-manager.component.scss
│   │   │   │   ├── exercise-manager.component.spec.ts
│   │   │   │   └── exercise-manager.component.ts
│   │   │   ├── plan-view/
│   │   │   │   ├── plan-view.component.html
│   │   │   │   ├── plan-view.component.scss
│   │   │   │   └── plan-view.component.ts
│   │   │   ├── settings/
│   │   │   │   ├── appearance-settings.component.html
│   │   │   │   ├── appearance-settings.component.scss
│   │   │   │   └── appearance-settings.component.ts
│   │   │   ├── templates/
│   │   │   │   ├── templates.component.html
│   │   │   │   ├── templates.component.scss
│   │   │   │   ├── templates.component.spec.ts
│   │   │   │   └── templates.component.ts
│   │   │   ├── trainers/
│   │   │   │   ├── trainers.component.html
│   │   │   │   ├── trainers.component.scss
│   │   │   │   └── trainers.component.ts
│   │   │   ├── user-detail/
│   │   │   │   ├── user-detail.component.html
│   │   │   │   ├── user-detail.component.scss
│   │   │   │   └── user-detail.component.ts
│   │   │   ├── user-plans-dialog/
│   │   │   │   ├── user-plans-dialog.component.html
│   │   │   │   ├── user-plans-dialog.component.scss
│   │   │   │   └── user-plans-dialog.component.ts
│   │   │   └── users/
│   │   │       ├── users.component.html
│   │   │       ├── users.component.scss
│   │   │       └── users.component.ts
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   ├── template-assignment.service.ts
│   │   │   └── theme.service.ts
│   │   ├── shared/
│   │   │   ├── ai-generation-timeline.component.html
│   │   │   ├── ai-generation-timeline.component.scss
│   │   │   ├── ai-generation-timeline.component.ts
│   │   │   ├── feedback-utils.ts
│   │   │   ├── models.ts
│   │   │   ├── shared-utils.ts
│   │   │   └── user-display-name.pipe.ts
│   │   └── environments/
│   │       ├── environment.prod.ts
│   │       ├── environment.test.ts
│   │       └── environment.ts
└── tsconfig.json
```

## Dependencias
- @angular/animations: ^19.0.0
- @angular/cdk: ^19.0.5
- @angular/common: ^19.0.0
- @angular/compiler: ^19.0.0
- @angular/core: ^19.0.0
- @angular/forms: ^19.0.0
- @angular/material: ^19.0.5
- @angular/platform-browser: ^19.0.0
- @angular/platform-browser-dynamic: ^19.0.0
- @angular/platform-server: ^19.0.0
- @angular/router: ^19.0.0
- @angular/ssr: ^19.0.7
- @aws-amplify/ui-angular: ^5.1.3
- aws-amplify: ^6.15.5
- express: ^4.18.2
- rxjs: ~7.8.0
- tsdb: ^2.3.0
- zone.js: ~0.15.0

## Instalación
### Requisitos previos
- Node.js versión 18 o superior
- Angular CLI instalado globalmente
- Configuración de AWS Cognito User Pool y API Gateway (opcional para desarrollo local)

### Instalación de dependencias
```bash
npm install
```

### Configuración del entorno
1. Actualizar `src/environments/environment.ts` con los valores de tu entorno AWS:
```typescript
export const environment = {
  production: false,
  apiBase: 'https://tu-api-endpoint.amazonaws.com/dev',
  apiUrl: 'https://tu-api-endpoint.amazonaws.com/dev',
  cognito: {
    domain: 'tu-cognito-domain.auth.us-east-1.amazoncognito.com',
    userPoolId: 'us-east-1_XXXXXXXXX',
    clientId: 'XXXXXXXXXXXXXXXXXXXXX',
    redirectUri: 'http://localhost:4200/callback'
  }
};
```

### Ejecutar la aplicación
```bash
ng serve
```
La aplicación estará disponible en `http://localhost:4200`.

## Funcionalidades
- **Sistema de Autenticación Híbrido**: OAuth 2.0 con PKCE + AWS Amplify para máxima seguridad y funcionalidades
- **Control de Acceso Basado en Roles**: Tres niveles jerárquicos (Admin, Trainer, Client) con permisos granulares
- **Autenticación con AWS Cognito**: Login/logout seguro vía Hosted UI con validación automática de tokens
- **PKCE (Proof Key for Code Exchange)**: Protección avanzada contra ataques de interceptación en aplicaciones públicas
- **Gestión de Sesiones**: Refresh automático de tokens y manejo de expiración transparente
- **Grupos de Cognito**: Integración con User Groups para asignación automática de roles
- **Atributos Personalizados**: Soporte para companyId, trainerIds y otros metadatos de usuario
- **Rutas protegidas**: Guards avanzados con verificación de autenticación y roles específicos
- **Data Access Control**: Verificación de permisos para acceder a datos de otros usuarios
- **Dashboard principal**: Panel de control para navegación y resúmenes
- **Planificador de entrenamientos**: Creación y edición de planes de ejercicios personalizados con generación IA
- **Generación de planes con IA**: Creación automática de planes usando prompts personalizados y Claude 3
- **Previsualización de planes**: Vista previa inline y en diálogo de planes de entrenamiento
- **Vista de planes anteriores**: Diálogo para reutilizar planes existentes
- **Previsualización de ejercicios**: Diálogos para ver detalles y videos de ejercicios
- **Visualización de planes**: Interfaz para ver detalles de planes existentes
- **Gestión de ejercicios**: Administración completa del catálogo de ejercicios con filtros avanzados, tabla paginada y edición
- **Filtros de ejercicios**: Búsqueda y filtrado por categoría, grupo muscular y tipo de equipo
- **Edición de ejercicios**: Diálogos para crear y editar ejercicios del catálogo
- **Vista de detalle de ejercicios**: Páginas dedicadas para ver información completa de ejercicios
- **Videos de ejercicios**: Diálogos integrados para reproducción de videos demostrativos
- **Plantillas de entrenamientos**: Creacion y gestion de plantillas reutilizables
- **Gestion de clientes y entrenadores**: Vistas separadas por rol con flujos claros (crear, editar, eliminar)
- **Metricas por entrenador**: Conteo de clientes asignados y planes creados en la vista de entrenadores
- **Diagnósticos**: Herramientas de depuración para verificar autenticación y conexiones API
- **Vista de detalle de usuario**: Información detallada de usuarios individuales
- **Confirmación de acciones**: Diálogos modales para confirmar operaciones críticas
- **Notificaciones de no autorizado**: Manejo de accesos no permitidos
- **Sistema de feedback centralizado**: Manejo consistente de mensajes de éxito, error e información
- **Configuracion de apariencia**: Panel admin para branding (nombre, tagline, logo), colores, tipografia y modo claro/oscuro con vista previa en tiempo real
- **Utilidades compartidas**: Funciones auxiliares para sanitización de nombres, cálculo de edad y procesamiento de datos
- **Timeline de generación IA**: Componente visual que muestra el progreso paso a paso de la generación de planes con IA
- **Diálogo parametric AI**: Interfaz avanzada para configuración detallada de planes de entrenamiento generados por IA con perfiles de usuario

## Modulos de usuarios por rol
- **Clientes**: Vista dedicada para usuarios con role = client, con asignacion/cambio de entrenador (solo admin).
- **Entrenadores**: Vista dedicada para usuarios con role = trainer, con conteo de clientes asignados y planes creados.
- **Formularios por contexto**: El rol se infiere por la vista (no hay dropdown de rol).
- **Plantillas**: La asignacion de plantillas filtra solo clientes.

## Ejemplos de uso
### Iniciar sesión con OAuth 2.0 + PKCE
```typescript
// Ejemplo del AuthService personalizado (src/app/auth/auth.service.ts)
async login(): Promise<void> {
  const codeVerifier = this.generateCodeVerifier();
  const codeChallenge = await this.generateCodeChallenge(codeVerifier);

  // Store verifier for token exchange
  sessionStorage.setItem('pkce_verifier', codeVerifier);

  const authUrl = `https://${domain}/oauth2/authorize` +
    `?client_id=${clientId}` +
    `&response_type=code` +
    `&scope=email+openid+profile` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&code_challenge_method=S256` +
    `&code_challenge=${encodeURIComponent(codeChallenge)}`;

  window.location.href = authUrl;
}
```

### Realizar llamadas a la API
```typescript
// Uso del servicio ExerciseApiService
constructor(private exerciseApi: ExerciseApiService) {}

loadExercises() {
  this.exerciseApi.getExercises().subscribe(exercises => {
    // Procesar ejercicios
  });
}
```

### Navegación programática
```typescript
// En un componente, redirigir a un plano específico
this.router.navigate(['/plan', planId]);
```

### Verificar estado de autenticación y roles
```typescript
// Uso del AuthGuard (src/app/auth/auth.guard.ts)
canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
  if (this.authService.isLoggedIn()) {
    return true;
  }
  // Redirect to Cognito Hosted UI for login
  this.authService.login();
  return false;
}

// Uso del RoleGuard para control de acceso basado en roles
canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
  const requiredRoles = route.data?.['roles'] as UserRole[];
  return this.authService.currentUser$.pipe(
    take(1),
    map(user => {
      if (!user) {
        this.router.navigate(['/login']);
        return false;
      }
      if (!requiredRoles.includes(user.role)) {
        this.router.navigate(['/unauthorized']);
        return false;
      }
      return true;
    })
  );
}
```

### Generar planes con IA (Diálogo Parametric)
```typescript
// Uso del PlannerComponent para generación con IA usando diálogo parametric
openAIDialog() {
  const dialogRef = this.dialog.open(AiParametricDialogComponent, {
    width: '1000px',
    maxWidth: '95vw',
    maxHeight: '90vh',
    data: {
      userId: this.selectedUser?.id,
      userProfile: this.selectedUser,
      userAge: this.selectedUser?.age
    }
  });

  dialogRef.afterClosed().subscribe(result => {
    if (result?.executionArn) {
      this.handleAIGeneration(result);
    }
  });
}

private handleAIGeneration(result: any) {
  // Crear plan básico con metadatos
  const planData = {
    name: result.planFormData.name,
    objective: result.planFormData.objective,
    sessions: result.planFormData.sessions,
    generalNotes: result.planFormData.generalNotes
  };

  // Iniciar polling para el resultado de IA
  this.pollAIResult(result.executionArn, planData);
}

private pollAIResult(executionArn: string, planData: any) {
  // Polling cada 3 segundos hasta que el plan esté listo
  const pollInterval = setInterval(() => {
    this.exerciseApi.checkAIPlanStatus(executionArn).subscribe(status => {
      if (status.status === 'SUCCEEDED') {
        clearInterval(pollInterval);
        this.loadCompletedPlan(status.planId);
      } else if (status.status === 'FAILED') {
        clearInterval(pollInterval);
        this.showError('Error en la generación del plan');
      }
    });
  }, 3000);
}
```

### Interfaz AiPlanRequest
```typescript
// Interfaz para solicitudes de generación de planes con IA
export interface AiPlanRequest {
  gender: string;                    // Género del usuario
  difficulty: string;                // Nivel de dificultad ('Principiante', 'Intermedio', 'Avanzado', etc.)
  trainingGoal: string;              // Objetivo de entrenamiento ('Hipertrofia', 'Pérdida de peso', etc.)
  totalSessions: number;             // Número total de sesiones por semana
  sessionDuration: number;           // Duración de cada sesión en minutos
  availableEquipment: string[];      // Equipo disponible para entrenar
  excludeMuscles: string[];          // Grupos musculares a excluir
  includeSupersets: boolean;         // Incluir superseries en el plan
  includeMobility: boolean;          // Incluir trabajo de movilidad
  expectedExercisesPerSession: number; // Número esperado de ejercicios por sesión
  sessionBlueprint: {                // Plano de sesiones personalizado
    name: string;                    // Nombre de la sesión
    targets: string[];               // Grupos musculares objetivo
  }[];
  generalNotes: string;              // Notas generales del plan
  userId?: string;                   // ID del usuario (opcional)
  age?: number;                      // Edad del usuario (opcional)
  userContext?: {                    // Contexto adicional del usuario
    injuries?: string;               // Lesiones o limitaciones
    notes?: string;                  // Notas adicionales
  };
}
```

### Gestionar ejercicios con filtros
```typescript
// Uso del ExerciseManagerComponent
onFiltersChanged(filters: ExerciseFilters): void {
  this.filters = filters;
  this.applyCombinedFilter();
  this.saveFiltersToStorage();
}

private applyCombinedFilter(): void {
  this.filteredExercises = this.exercises.filter(exercise => {
    const matchesSearch = !this.filters.searchValue ||
      exercise.name.toLowerCase().includes(this.filters.searchValue.toLowerCase());
    const matchesCategory = !this.filters.categoryFilter ||
      exercise.category === this.filters.categoryFilter;
    // ... otros filtros
    return matchesSearch && matchesCategory;
  });
}
```

### Sistema de feedback centralizado
```typescript
// Uso de FeedbackUtils para mensajes consistentes
import { FeedbackUtils } from '../shared/feedback-utils';

// Mostrar mensaje de éxito
this.snackBar.open(
  FeedbackUtils.ExerciseMessages.CREATED_SUCCESS,
  'Cerrar',
  FeedbackUtils.FeedbackConfig.successConfig()
);

// Manejar errores de API
catch (error) {
  const message = FeedbackUtils.ErrorMapper.mapHttpError(error);
  this.snackBar.open(message, 'Cerrar', FeedbackUtils.FeedbackConfig.errorConfig());
}
```

### Utilidades compartidas
```typescript
// Uso de SharedUtils para sanitización de nombres
import { sanitizeName } from '../shared/shared-utils';

const exerciseId = sanitizeName(exercise.name); // "press_banca_inclinado" -> "press_banca_inclinado"

### Timeline de generación IA
```typescript
// Uso del AiGenerationTimelineComponent para mostrar progreso visual
// En el template HTML del diálogo de generación IA:
<app-ai-generation-timeline [currentAiStep]="currentStep"></app-ai-generation-timeline>

// En el componente TypeScript:
import { AiStep } from '../../shared/models';

export class AiGenerationDialogComponent {
  currentAiStep: AiStep | undefined;

  // Actualizar el paso actual durante el proceso de generación
  updateProgress(step: AiStep) {
    this.currentAiStep = step;
    this.cdr.markForCheck(); // Forzar detección de cambios
  }
}
```

## Flujo de trabajo de desarrollo
1. **Clonar el repositorio**: Obtener el código fuente desde el repositorio Git
2. **Instalar dependencias**: Ejecutar `npm install` para configurar el entorno
3. **Configurar entorno**: Actualizar archivos de configuración con credenciales AWS
4. **Iniciar servidor de desarrollo**: Ejecutar `ng serve` para desarrollo local
5. **Probar autenticación**: Acceder a rutas protegidas y verificar flujo OAuth
6. **Desarrollar nuevas funcionalidades**: Implementar componentes, servicios y rutas según requisitos
7. **Ejecutar pruebas**: Lanzar `npm test` para verificar funcionalidad
8. **Construir para producción**: Ejecutar `npm run build` para generar assets optimizados
9. **Desplegar**: Subir a servidor de producción, asegurar CORS y URLs correctas

## Arquitectura del sistema

### Integración con AWS Lambda y DynamoDB
- **Función Lambda**: `generateWorkoutPlanAI.mjs` para generación de planes con IA usando Claude 3
- **Tabla DynamoDB**: `ExerciseLibrary` para catálogo de ejercicios con normalización inteligente de nombres
- **Procesamiento de nombres**: Normalización NFD para acentos, conversión a minúsculas, eliminación de paréntesis y espacios múltiples
- **Índice de ejercicios**: Mapa normalizado → metadatos para matching exacto de nombres
- **Límite de catálogo**: 300 ejercicios máximo en el prompt para optimizar el rendimiento

### Funcionalidad de IA
- **Modelo**: Anthropic Claude 3 Sonnet para generación de planes de entrenamiento
- **Enrichment**: Planes generados incluyen todos los metadatos disponibles (tipo de equipo, grupo muscular, dificultad, etc.)
- **Validación**: Verificación de ejercicios existentes en el catálogo antes de retornar el plan
- **Formato estructurado**: Salida consistente con objetos plan y planLegacy para compatibilidad

### Configuracion de apariencia y branding
- **ThemeService** (`src/app/services/theme.service.ts`): Obtiene y guarda configuracion de tema en `/tenant/theme` con cache en memoria y defaults.
- **Appearance Settings** (`src/app/pages/settings/appearance-settings.component.ts`): Panel admin con vista previa en tiempo real para colores, tipografia, modo claro/oscuro, nombre de app y tagline.
- **Carga de logo**: Flujo con URL pre-firmada (`/tenant/logo-upload-url`) y subida directa a S3 usando `PUT`.
- **Campos soportados**: primaryColor, accentColor, backgroundMode, fontFamily, appName, tagline, logoKey/logoUrl.

### Utilidades compartidas
- **FeedbackUtils**: Sistema centralizado de manejo de feedback con temas semánticos (éxito, error, información)
- **ErrorMapper**: Mapeo de códigos de error HTTP a mensajes amigables para el usuario
- **DevLogger**: Utilidades de logging para desarrollo con contexto estructurado
- **SharedUtils**: Funciones auxiliares como sanitización de nombres de ejercicios para IDs consistentes y cálculo de edad basado en fecha de nacimiento

## Estado actual del desarrollo
- **Módulo de autenticación**: Completo - Integración total con AWS Cognito, JWT, guards e interceptores
- **Dashboard principal**: Completo - Navegación básica implementada
- **Planificador de entrenamientos**: Completo - Funcionalidad CRUD para planes con integración de búsqueda de ejercicios y superseries
- **Generación de planes con IA**: Completo - Diálogo parametric avanzado con timeline visual, perfiles de usuario detallados y polling en tiempo real para generación de planes con Claude 3
- **Previsualización de planes**: Completo - Vista previa inline y diálogos para planes de entrenamiento
- **Vista de planes anteriores**: Completo - Diálogo para reutilizar planes existentes
- **Previsualización de ejercicios**: Completo - Diálogos para ver detalles y videos de ejercicios
- **Vista de planes**: Completo - Visualización y gestión de planos existentes
- **Gestión de ejercicios**: Completo - Sistema completo con tabla paginada, filtros avanzados, edición y videos
- **Filtros de ejercicios**: Completo - Búsqueda y filtrado por categoría, grupo muscular y tipo de equipo
- **Edición de ejercicios**: Completo - Diálogos para crear y editar ejercicios del catálogo
- **Vista de detalle de ejercicios**: Completo - Páginas dedicadas para ver información completa de ejercicios
- **Videos de ejercicios**: Completo - Diálogos integrados para reproducción de videos demostrativos
- **Gestion de clientes y entrenadores**: Completo - Vistas separadas por rol con flujos claros y control de asignaciones
- **Plantillas**: Completo - Creación y gestión de plantillas con funcionalidad de guardado y asignación de usuarios
- **Diagnósticos**: Completo - Herramientas de debug y pruebas de API
- **Configuracion de apariencia y branding**: Completo - panel admin para colores, tipografia, modo claro/oscuro y logo con vista previa
- **Sistema de feedback centralizado**: Completo - Manejo consistente de mensajes con temas semánticos
- **Utilidades compartidas**: Completo - Funciones auxiliares para sanitización y procesamiento de datos
- **SSR y optimizaciones**: Completo - Compatible con server-side rendering
- **Documentación**: Completa - Información detallada sobre arquitectura, funcionalidades y estructura del código
- **Gestión de superseries**: Completo - Creación y gestión visual de superseries con mejoras de layout y flags de agrupamiento
- **Gestión de asignación de usuarios**: Completo - Sistema para que entrenadores asignen planes y plantillas a clientes específicos con soporte de diálogos
- **Funcionalidad de guardado de plantillas**: Completo - UI y funcionalidad para guardar plantillas reutilizables
- **Mejoras en visualización de planes**: Completo - Renderizado mejorado y gestión de sesiones de entrenamiento
- **Pruebas unitarias**: Parcial - Cobertura básica implementada, se recomiendan pruebas exhaustivas
- **Integración con otras APIs**: Pendiente - Posibles extensiones para integraciones con apps fitness externas

## Cambios recientes (ultimos commits)

### Ultimas actualizaciones implementadas (últimos 10 commits):
- **c7c1250**: refactor planner component
- **b0f5974**: refactor planner component
- **a2efa95**: Merge pull request #8 from juliogutierrezm/feat/client-app-view
- **98a61a5**: fixed trainers view for trainers-admin
- **749dacc**: fixed progressions and admin-trainer permissions
- **4ab2c63**: fixed experiencie feature
- **cd9ba60**: added all features
- **b6b4420**: fixed progressions
- **e9d001d**: fixed progressions
- **333124b**: added progressions

## Mejoras Pendientes

### Funcionalidad de Superseries
- **Visualización mejorada**: Implementar wrapper visual externo para superseries que muestre "Superserie" como etiqueta
- **Remoción de checkboxes**: Los ejercicios dentro de superseries no deberían tener checkboxes individuales
- **Drag & drop grupal**: Permitir arrastrar superseries completas como unidades
- **Persistencia visual**: Mantener el estado visual de superserie al recargar la página

### Optimizaciones de Rendimiento
- **Virtualización de listas**: Aplicar virtualización a listas largas de ejercicios
- **Lazy loading**: Implementar carga diferida para módulos no críticos
- **Optimización de API**: Mejorar eficiencia de llamadas a servicios backend
