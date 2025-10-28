# Fitness Planner

## Descripción general
Fitness Planner es una aplicación de planificación de entrenamientos desarrollada en Angular 19, que integra autenticación con AWS Cognito Hosted UI y conectividad con API para gestionar planes de ejercicios, usuarios y recursos fitness. Ofrece una interfaz responsiva con Material Design, soporte para server-side rendering (SSR) y rutas protegidas para funcionalidades administrativas.

## Estructura de carpetas y archivos
```
fitness-planner/
├── .editorconfig
├── .gitignore
├── angular.json
├── cognito-setup.yaml
├── cognito-ui.css
├── DOCUMENTATION.md
├── exercise-video-flow.json
├── package-lock.json
├── package.json
├── proxy.conf.json
├── README.md
├── scripts/
│   └── smoke-api.mjs
├── public/
│   └── favicon.ico
├── src/
│   ├── aws-exports.ts
│   ├── index.html
│   ├── main.server.ts
│   ├── main.ts
│   ├── server.ts
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
│   │   │   └── tempLogo.png
│   │   │   └── TrainGrid.png
│   │   ├── auth/
│   │   │   ├── auth.guard.spec.ts
│   │   │   ├── auth.guard.ts
│   │   │   ├── auth.interceptor.spec.ts
│   │   │   ├── auth.interceptor.ts
│   │   │   ├── auth.service.spec.ts
│   │   │   ├── auth.service.ts
│   │   │   └── test-utils.ts
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
│   │   │   │   ├── plan-preview-dialog.component.ts
│   │   │   │   ├── planner.component.html
│   │   │   │   ├── planner.component.scss
│   │   │   │   ├── planner.component.spec.ts
│   │   │   │   ├── planner.component.ts
│   │   │   │   ├── previous-plans-dialog.component.html
│   │   │   │   ├── previous-plans-dialog.component.scss
│   │   │   │   └── previous-plans-dialog.component.ts
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
│   │   │   │   ├── exercise-manager.component.html
│   │   │   │   ├── exercise-manager.component.scss
│   │   │   │   ├── exercise-manager.component.spec.ts
│   │   │   │   └── exercise-manager.component.ts
│   │   │   ├── plan-view/
│   │   │   │   ├── plan-view.component.html
│   │   │   │   ├── plan-view.component.scss
│   │   │   │   └── plan-view.component.ts
│   │   │   ├── templates/
│   │   │   │   ├── templates.component.html
│   │   │   │   ├── templates.component.scss
│   │   │   │   ├── templates.component.spec.ts
│   │   │   │   └── templates.component.ts
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
│   │   │   └── auth.service.ts
│   │   └── shared/
│   │       ├── models.ts
│   │       └── user-display-name.pipe.ts
│   └── environments/
│       ├── environment.prod.ts
│       ├── environment.test.ts
│       └── environment.ts
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
- **Autenticación con AWS Cognito**: Sistema de login/logout con flujo OAuth 2.0 vía Hosted UI
- **Rutas protegidas**: Acceso condicional a páginas basado en estado de autenticación
- **Dashboard principal**: Panel de control para navegación y resúmenes
- **Planificador de entrenamientos**: Creación y edición de planes de ejercicios personalizados
- **Visualización de planes**: Interfaz para ver detalles de planes existentes
- **Gestión de ejercicios**: Administración de catálogo de ejercicios del sistema
- **Plantillas de entrenamientos**: Creación y gestión de plantillas reutilizables
- **Gestión de usuarios**: Funciones administrativas para ver y gestionar usuarios
- **Diagnósticos**: Herramientas de depuración para verificar autenticación y conexiones API
- **Vista de detalle de usuario**: Información detallada de usuarios individuales
- **Confirmación de acciones**: Diálogos modales para confirmar operaciones críticas
- **Notificaciones de no autorizado**: Manejo de accesos no permitidos

## Ejemplos de uso
### Iniciar sesión y acceder a rutas protegidas
```typescript
// Ejemplo de flujo de autenticación en AuthService
login(): Observable<any> {
  return from(Auth.federatedSignIn({
    customProvider: this.cognitoDomain
  }));
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

### Verificar estado de autenticación
```typescript
// Uso del AuthGuard
canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {
  return this.authService.isLoggedIn$.pipe(
    tap(isLoggedIn => {
      if (!isLoggedIn) {
        this.authService.login();
      }
    })
  );
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

## Estado actual del desarrollo
- **Módulo de autenticación**: Completo - Integración total con AWS Cognito, JWT, guards e interceptores
- **Dashboard principal**: Completo - Navegación básica implementada
- **Planificador de entrenamientos**: Completo - Funcionalidad CRUD para planes
- **Vista de planes**: Completo - Visualización y gestión de planos existentes
- **Gestión de ejercicios**: Completo - Administración de catálogo de ejercicios
- **Gestión de usuarios**: Completo - Funciones administrativas para usuarios
- **Plantillas**: Completo - Creación y gestión de plantillas
- **Diagnósticos**: Completo - Herramientas de debug y pruebas de API
- **SSR y optimizaciones**: Completo - Compatible con server-side rendering
- **Documentación**: Pendiente - Actualización de documentación técnica detallada para todas las APIs
- **Pruebas unitarias**: Parcial - Cobertura básica implementada, se recomiendan pruebas exhaustivas
- **Integración con otras APIs**: Pendiente - Posibles extensiones para integraciones con apps fitness externas
