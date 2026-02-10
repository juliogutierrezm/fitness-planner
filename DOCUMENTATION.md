# Fitness Planner - Documentacion Tecnica del Repositorio

Ultima actualizacion: 2026-02-09

## 1) Contexto del proyecto
Fitness Planner es una aplicacion Angular 19 para gestion de entrenamiento fisico con:
- Autenticacion custom con AWS Cognito (via `aws-amplify`, sin Hosted UI).
- Autorizacion por grupos Cognito (`Admin`, `Trainer`, `Client`, `System`).
- Arquitectura multi-tenant por `companyId` (modo gimnasio vs independiente).
- Gestion de usuarios, planes, plantillas, ejercicios, planes IA y metricas corporales.
- Soporte SSR con Angular + Express.

Este documento describe el estado actual observable en codigo fuente.

## 2) Stack y runtime
- Frontend: Angular 19 standalone + Angular Material + RxJS.
- Auth: AWS Amplify Auth (`aws-amplify` v6).
- SSR: `@angular/ssr` + `express`.
- PDF: `jspdf`.
- Requisito de Node: `>=20 <21` (definido en `package.json`).

Archivos de referencia:
- `package.json`
- `angular.json`
- `src/main.ts`
- `src/server.ts`

## 3) Arquitectura de alto nivel
### 3.1 Capas
- UI: paginas/componentes standalone (`src/app/pages`, `src/app/components`).
- Dominio frontend: servicios de negocio (`src/app/services`).
- Integracion HTTP: wrappers API (`src/app/exercise-api.service.ts`, `src/app/user-api.service.ts`, `src/app/services/ai-plans.service.ts`).
- Seguridad y navegacion: guards (`src/app/guards`) + interceptor (`src/app/interceptors/auth.interceptor.ts`).
- Utilidades/modelos: `src/app/shared`.

### 3.2 SSR y bootstrap
- `APP_INITIALIZER` bloquea navegacion inicial hasta resolver auth en cliente.
- Durante SSR el estado de auth se mantiene en `unknown`.
- `AppComponent` muestra splash mientras auth sigue en `unknown`.
- Express incluye healthcheck en `/health`.

Archivos clave:
- `src/app/app.config.ts`
- `src/app/app.component.ts`
- `src/app/app.component.html`
- `src/app/app.config.server.ts`
- `src/app/app.routes.server.ts`

## 4) Autenticacion, roles y tenant
### 4.1 Roles
Mapeo de grupos Cognito -> rol app (en `AuthService`):
- `Admin` -> `admin`
- `Trainer` -> `trainer`
- default/fallback -> `client`

El control real de permisos usa grupos Cognito.

### 4.2 Grupos especiales
- `System`: habilita funciones tecnicas (diagnostics y modificaciones en catalogo de ejercicios).

### 4.3 Tenant
El tenant se deriva de `companyId`:
- `INDEPENDENT` -> modo independiente.
- Distinto de `INDEPENDENT` -> modo gimnasio.

Helpers:
- `isGymMode(companyId)` y `isIndependentTenant(companyId)` en `src/app/shared/shared-utils.ts`.

### 4.4 Onboarding
- Onboarding ocurre post-login en `/onboarding`.
- Envia `userType` (`GYM_OWNER` o `INDEPENDENT_TRAINER`) a `POST /users/initialize`.
- Tras inicializar, se refresca estado auth para reflejar nuevos grupos Cognito.

Servicio:
- `src/app/services/user-initialization.service.ts`

### 4.5 Interceptor
`AuthInterceptor`:
- Adjunta `Authorization: Bearer <token>` solo a requests que inician con `environment.apiBase`.
- Valida `iss` del JWT contra el User Pool esperado por entorno.
- Bloquea request si detecta mismatch de entorno/token.

Archivo:
- `src/app/interceptors/auth.interceptor.ts`

## 5) Guards y control de rutas
Guards implementados:
- `AuthGuard`: requiere usuario autenticado.
- `AuthFlowGuard`: controla rutas publicas segun paso de auth.
- `OnboardingGuard`: restringe acceso a onboarding.
- `PostLoginRedirectGuard`: redirige a onboarding o unauthorized segun estado.
- `RoleGuard`: valida roles requeridos por ruta.
- `SystemGuard`: exige pertenencia al grupo `System`.

Archivos:
- `src/app/guards/auth.guard.ts`
- `src/app/guards/auth-flow.guard.ts`
- `src/app/guards/onboarding.guard.ts`
- `src/app/guards/post-login-redirect.guard.ts`
- `src/app/guards/role.guard.ts`
- `src/app/guards/system.guard.ts`

## 6) Mapa de rutas actual (app)
Definidas en `src/app/app.routes.ts`.

Publicas de autenticacion:
- `/login`
- `/signup`
- `/confirm-signup`
- `/forgot-password`
- `/reset-password`
- `/force-change-password`
- `/unauthorized`

Privadas principales:
- `/onboarding`
- `/dashboard`
- `/planner`
- `/planner/:id`
- `/templates`
- `/plan/:id`
- `/exercise-manager`
- `/exercise-detail/:id`
- `/diagnostics`
- `/ai-plans`
- `/ai-plans/user/:id`
- `/ai-plans/user/:id/plan/:executionId`
- `/trainers`
- `/clients`
- `/users` (alias funcional de clientes)
- `/users/:id`
- `/clients/:id/body-metrics`
- `/settings/appearance`

## 7) Modulos funcionales
### 7.1 Dashboard
- Vista segun modo: `GYM_ADMIN`, `GYM_TRAINER`, `INDEPENDENT_TRAINER`.
- KPIs combinando usuarios + planes IA.
- Refresh periodico (cada 60 segundos).

Archivo:
- `src/app/pages/dashboard/dashboard.component.ts`

### 7.2 Planner (core)
- Creacion/edicion de planes.
- Drag & drop de ejercicios y sesiones.
- Superseries (agrupacion y desagrupacion).
- Carga de planes previos.
- Guardado de plantillas.
- Integracion IA (dialogo parametrico + polling por `executionId`).
- Enriquecimiento de sesiones con Exercise Library antes de render/guardar.

Archivo:
- `src/app/components/planner/planner.component.ts`

### 7.3 Gestion de usuarios
- `UsersComponent`: clientes (crear, editar, activar/desactivar, eliminar inactivos, asignar entrenador).
- `TrainersManagementComponent`: entrenadores (gestion admin + metricas + limites trial).
- `UserDetailComponent`: historial de planes por cliente, asignacion de plantillas y descarga PDF.

Archivos:
- `src/app/pages/users/users.component.ts`
- `src/app/pages/trainers/trainers-management.component.ts`
- `src/app/pages/user-detail/user-detail.component.ts`

### 7.4 Plantillas
- Lista de plantillas por tenant.
- Filtros y asignacion de plantilla a cliente.
- Navegacion a planner con `queryParams` (`userId`, `templateId`).

Archivo:
- `src/app/pages/templates/templates.component.ts`

### 7.5 Planes IA
- Dashboard agregado (`by-gym` / `by-trainer`).
- Historial por usuario (`by-user`).
- Detalle por `executionId` con opcion de asignar o guardar como plantilla.
- Cuota de planes IA por entrenador: limite actual `20`.

Archivos:
- `src/app/services/ai-plans.service.ts`
- `src/app/pages/ai-plans-dashboard/ai-plans-dashboard.component.ts`
- `src/app/pages/ai-plans-user/ai-plans-user.component.ts`
- `src/app/pages/ai-plan-detail/ai-plan-detail.component.ts`
- `src/app/shared/ai-plan-limits.ts`

### 7.6 Ejercicios
- Catalogo desde `GET /exercise/library`.
- Filtros avanzados, paginacion y edicion inline/dialogo.
- Modificaciones (create/update/delete) condicionadas en UI al grupo `System`.

Archivo:
- `src/app/pages/exercise-manager/exercise-manager.component.ts`

### 7.7 Metricas corporales
- Historial por cliente.
- Alta y eliminacion de mediciones.
- Calculo de IMC en cliente.

Archivos:
- `src/app/pages/client-body-metrics/client-body-metrics.component.ts`
- `src/app/services/client-body-metrics.service.ts`

### 7.8 Apariencia y branding
- Configuracion por tenant (`/tenant/theme`).
- Subida de logo mediante URL pre-firmada (`/tenant/logo-upload-url` + PUT directo a S3).
- Vista previa en pantalla de settings.

Nota: el componente de settings actualmente usa preview local; no aplica tema global inmediato a toda la app.

Archivos:
- `src/app/pages/settings/appearance-settings.component.ts`
- `src/app/services/theme.service.ts`

### 7.9 PDF de planes
- Generacion PDF con branding de tenant (nombre, tagline, colores, logo).
- Soporta sesiones, superseries y progresiones.
- Enlaces de video clicables.

Archivo:
- `src/app/services/pdf-generator.service.ts`

## 8) Contratos backend consumidos por frontend
Base URL: `environment.apiBase`.

### 8.1 Auth/onboarding
- `POST /users/initialize`

### 8.2 Usuarios
- `GET /users`
- `POST /users`
- `GET /users/:id`
- `PUT /users/:id`
- `POST /users/:id` (status `ACTIVE`/`INACTIVE`)
- `DELETE /users/:id` (frontend fuerza solo inactivos)
- `PUT /users/trainers` (asignacion entrenador)
- `GET /users/plan?userId=<id>`

### 8.3 Planes y plantillas
- `GET /workoutPlans?userId=<id>`
- `GET /workoutPlans/:planId`
- `POST /workoutPlans`
- `PUT /workoutPlans`
- `DELETE /workoutPlans/:planId`
- `GET /workoutPlans/trainer`
- `GET /workoutPlans/company`

### 8.4 IA
- `POST /generatePlanFromAI`
- `GET /generatePlanFromAI/:userId`
- `GET /generatePlanFromAI/:userId/:executionId`
- `GET /generatePlanFromAI?executionArn=<arn>`
- `GET /ai-plans/by-user/:userId`
- `GET /ai-plans/by-trainer/:trainerId`
- `GET /ai-plans/by-gym/:companyId`
- `GET /ai-plans/:executionId`

### 8.5 Ejercicios
- `GET /exercise`
- `POST /exercise`
- `PUT /exercise`
- `DELETE /exercise?id=<id>`
- `POST /exercise/bulk`
- `GET /exercise/library`
- `PUT /exercise/library/:id`

### 8.6 Tenant/theme
- `GET /tenant/theme`
- `PUT /tenant/theme`
- `POST /tenant/logo-upload-url`

### 8.7 Metricas
- `GET /clients/metrics/:clientId`
- `POST /clients/metrics/:clientId`
- `DELETE /clients/metrics/:clientId?measurementDate=<iso>`

## 9) Configuracion de entorno
Archivos:
- `src/environments/environment.ts` (dev)
- `src/environments/environment.prod.ts` (prod)
- `src/environments/environment.test.ts` (tests)
- `src/environments/environment.interface.ts` (shape comun)

Tambien hay reemplazo de `src/aws-exports.ts` en build de produccion (ver `angular.json`).

## 10) Persistencia local en frontend
Llaves principales en navegador:
- `auth_flow_state` (sessionStorage, pasos de auth flow persistibles).
- `fp_sessions_<userId>` (localStorage, sesiones del planner por usuario).
- `planner-filters` (localStorage, filtros planner).
- `exercise-manager-filters` y `exercise-manager-filters-paginator` (localStorage).

## 11) Scripts y comandos
Comandos npm (`package.json`):
- `npm run build` -> build app (incluye SSR output).
- `npm run watch` -> build en modo desarrollo watch.
- `npm test` -> tests con Karma.
- `npm run start` -> ejecuta servidor SSR desde `dist`.
- `npm run serve:ssr:fitness-planner` -> alias de arranque SSR.

Comando util adicional:
- `node scripts/smoke-api.mjs`
  - Env vars: `API_BASE`, `ID_TOKEN`, `TEST_USER_ID`, `WRITE_TESTS=true`.

## 12) Estructura resumida del repo
```text
fitness-planner/
|-- src/
|   |-- app/
|   |   |-- components/
|   |   |-- guards/
|   |   |-- interceptors/
|   |   |-- layout/
|   |   |-- pages/
|   |   |-- services/
|   |   `-- shared/
|   |-- environments/
|   |-- main.ts
|   |-- main.server.ts
|   `-- server.ts
|-- scripts/
|   `-- smoke-api.mjs
|-- angular.json
|-- package.json
|-- README.md
`-- DOCUMENTATION.md
```

## 13) Estado de pruebas (unitarias)
Specs presentes actualmente:
- `src/app/app.component.spec.ts`
- `src/app/services/client-body-metrics.service.spec.ts`
- `src/app/guards/system.guard.spec.ts`
- `src/app/guards/post-login-redirect.guard.spec.ts`
- `src/app/guards/onboarding.guard.spec.ts`
- `src/app/pages/templates/templates.component.spec.ts`
- `src/app/pages/dashboard/dashboard.component.spec.ts`
- `src/app/components/workout-plan-view/workout-plan-view.component.spec.ts`
- `src/app/components/planner/planner.component.spec.ts`
- `src/app/components/planner/services/planner-state.service.spec.ts`
- `src/app/components/planner/services/planner-form.service.spec.ts`
- `src/app/components/planner/services/planner-exercise-filter.service.spec.ts`
- `src/app/components/planner/services/planner-drag-drop.service.spec.ts`

Cobertura funcional existe en modulos clave, pero no cubre toda la superficie del producto.

## 14) Notas operativas importantes
- El repo puede estar en cambios activos; valida `git status` antes de asumir baseline limpio.
- Varias rutas y componentes dependen de grupos Cognito reales; para probar flujos completos necesitas usuarios de prueba con grupos correctos.
- `System` habilita features tecnicas (diagnostics y modificacion de ejercicios).
- `Admin` sin `Trainer` se trata como `Gym Admin` (acceso mas restringido en ciertas vistas de operacion).

## 15) Referencias primarias de codigo
- Rutas: `src/app/app.routes.ts`
- Config app: `src/app/app.config.ts`
- Auth: `src/app/services/auth.service.ts`
- Interceptor: `src/app/interceptors/auth.interceptor.ts`
- Planner: `src/app/components/planner/planner.component.ts`
- Usuarios: `src/app/user-api.service.ts`
- Planes/ejercicios: `src/app/exercise-api.service.ts`
- IA: `src/app/services/ai-plans.service.ts`
- Theme: `src/app/services/theme.service.ts`
- SSR server: `src/server.ts`
