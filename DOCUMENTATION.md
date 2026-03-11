# Fitness Planner - Documentacion Tecnica del Repositorio

Ultima actualizacion: 2026-03-09

## 1) Contexto del proyecto
Fitness Planner es una aplicacion Angular 19 para gestion de entrenamiento fisico con:
- Autenticacion custom con AWS Cognito (via `aws-amplify`, sin Hosted UI).
- Autorizacion por grupos Cognito (`Admin`, `Trainer`, `Client`, `System`).
- Arquitectura multi-tenant por `companyId` (modo gimnasio vs independiente).
- Gestion de usuarios, planes, plantillas, ejercicios, planes IA y metricas corporales.
- Generacion de planes de entrenamiento con IA (wizard parametrico de 3 pasos + prompt libre).
- Soporte bilingue (es/en) para nombres de ejercicios y generacion de PDF.
- SPA Angular 19 para despliegue estatico en AWS S3 + CloudFront.

Este documento describe el estado actual observable en codigo fuente.

## 2) Stack y runtime
- Frontend: Angular 19 standalone + Angular Material `^19.0.5` + RxJS `~7.8.0`.
- Auth: AWS Amplify Auth (`aws-amplify` v6, `^6.15.5`).
- Hosting: salida estatica (sin runtime Node/Express).
- PDF: `jspdf` `^4.1.0`.
- AWS SDK: `@aws-sdk/client-dynamodb` `^3.958.0`.
- TypeScript: `~5.6.2`.
- Requisito de Node: `>=20 <21` (definido en `package.json`).

Archivos de referencia:
- `package.json`
- `angular.json`
- `src/main.ts`

## 3) Arquitectura de alto nivel
### 3.1 Capas
- UI: paginas/componentes standalone (`src/app/pages`, `src/app/components`).
- Dominio frontend: servicios de negocio (`src/app/services`).
- Integracion HTTP: wrappers API (`src/app/exercise-api.service.ts`, `src/app/user-api.service.ts`, `src/app/services/ai-plans.service.ts`).
- Seguridad y navegacion: guards (`src/app/guards`) + interceptor (`src/app/interceptors/auth.interceptor.ts`).
- Utilidades/modelos: `src/app/shared` (modelos, pipes, configs, utilidades de localizacion y feedback).

### 3.2 Bootstrap y navegacion inicial
- `APP_INITIALIZER` bloquea navegacion inicial hasta resolver auth en cliente.
- En cliente, `AuthService.checkAuthState()` tiene timeout determinista de 8s para cerrar en estado final.
- `AppComponent` muestra splash mientras auth sigue en `unknown` (nunca indefinido en browser).

Archivos clave:
- `src/app/app.config.ts`
- `src/app/app.component.ts`
- `src/app/app.component.html`

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
- Decision de entrada centralizada (`resolveEntryTarget`):
  - `unauthenticated` => `/login`
  - `authenticated` sin inicializar => `/onboarding`
  - `authenticated` inicializado => `/dashboard`
- Usuario inicializado: grupos planner (`Admin` o `Trainer`) + `companyId` valido (incluye `INDEPENDENT`).

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
- `AuthFlowGuard`: controla rutas publicas segun paso de auth y usa decision central de entrada.
- `OnboardingGuard`: restringe acceso a onboarding y evita acceso cuando el destino final no es onboarding.
- `PostLoginRedirectGuard`: redirige a onboarding/unauthorized segun estado post-login.
- `RoleGuard`: valida roles requeridos por ruta esperando resolucion explicita de `authStatus`.
- `SystemGuard`: exige pertenencia al grupo `System` esperando resolucion explicita de `authStatus`.

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
- `/confirm-code` (alias legacy -> redirige a `/confirm-signup`)
- `/forgot-password`
- `/reset-password`
- `/force-change-password`
- `/force-new-password` (alias legacy -> redirige a `/force-change-password`)
- `/unauthorized`

Privadas principales (dentro de `LayoutComponent`):
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
- `/user-plans-dialog`

Fallbacks:
- `/` (empty path) redirige a `/dashboard`
- `**` (catch-all) redirige a `/login`

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
- Integracion IA (wizard parametrico de 3 pasos + prompt libre + polling por `executionId`).
- Enriquecimiento de sesiones con Exercise Library antes de render/guardar.
- Previsualizacion del plan en dialogo usando `WorkoutPlanViewComponent` con layout de tabla y scroll horizontal para sesiones extensas.

Flujo actual del dialogo parametrico de IA:
- Paso 1 `Perfil`: muestra resumen del usuario disponible (nombre, edad, genero, lesiones) y captura nivel de experiencia.
- Paso 2 `Configuracion`: captura objetivo, duracion, ejercicios esperados, equipo disponible y notas opcionales.
- Paso 3 `Sesiones`: define blueprint por sesion con tabs, selector de sesion activa, grupos musculares, patrones de movimiento y opcion de superseries.
- Navegacion progresiva: cada paso valida sus propios campos antes de permitir avanzar o saltar entre pasos.
- UX reactiva: usa `signal`/`computed` de Angular para step actual, sesion activa y estado de navegacion, con animaciones laterales entre pasos.

Subestructura del planner:
- `ai/` — Dialogos de IA:
  - `ai-generation-dialog.component.ts`: inicia generacion IA.
  - `ai-parametric-dialog.component.ts`: wizard parametrico de 3 pasos con validacion por paso, transiciones animadas y blueprint por sesion con tabs.
  - `ai-prompt-dialog.component.ts`: generacion por prompt libre de texto.
- `dialogs/` — Dialogos auxiliares:
  - `exercise-preview-dialog.component.ts`: preview de ejercicio.
  - `plan-preview-dialog.component.ts`: preview de plan completo.
  - `previous-plans-dialog.component.ts`: seleccion de planes previos.
- `models/` — Modelos del planner:
  - `planner-column.model.ts`: estructura de columnas.
  - `planner-exercise.model.ts`: modelos de ejercicio en planner.
  - `planner-plan.model.ts`: tipos de progresion (`ProgressionWeek`, `PlanProgressions`).
  - `planner-session.model.ts`: modelos de sesion.
- `services/` — Servicios del planner:
  - `planner-state.service.ts`: gestion centralizada de estado.
  - `planner-form.service.ts`: gestion de formularios.
  - `planner-exercise-filter.service.ts`: filtrado de ejercicios.
  - `planner-drag-drop.service.ts`: funcionalidad drag & drop.

Archivo principal:
- `src/app/components/planner/planner.component.ts`
- `src/app/components/planner/dialogs/plan-preview-dialog.component.ts`
- `src/app/components/workout-plan-view/workout-plan-view.component.ts`

### 7.3 Gestion de usuarios
- `UsersComponent`: modulo base de clientes (crear, editar, activar/desactivar, eliminar inactivos, asignar entrenador).
- `ClientsComponent`: contenedor standalone usado por rutas `/clients` y `/users`, reutiliza `UsersComponent`.
- `TrainersManagementComponent`: entrenadores (gestion admin + metricas + limites trial).
- `UserDetailComponent`: historial de planes por cliente, asignacion de plantillas y descarga PDF.
- `UserPlansDialogComponent`: dialogo para visualizar planes de un usuario con numeracion ordinal.

Archivos:
- `src/app/pages/clients/clients.component.ts`
- `src/app/pages/users/users.component.ts`
- `src/app/pages/trainers/trainers-management.component.ts`
- `src/app/pages/user-detail/user-detail.component.ts`
- `src/app/pages/user-plans-dialog/user-plans-dialog.component.ts`

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
- Subcomponentes modulares: `exercise-detail`, `exercise-edit-dialog`, `exercise-filters`, `exercise-table`, `exercise-video-dialog`.

Archivo:
- `src/app/pages/exercise-manager/exercise-manager.component.ts`
- `src/app/pages/exercise-manager/components/` (subcomponentes)

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
- Soporte bilingue (es/en) via `getPdfLabels()` de `locale.utils.ts`.

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
- PUT directo a S3 (via `fetch()`, bypass del interceptor)

### 8.7 Metricas
- `GET /clients/metrics/:clientId`
- `POST /clients/metrics/:clientId`
- `DELETE /clients/metrics/:clientId?measurementDate=<iso>`

## 9) Shared: utilidades, configs y pipes
### 9.1 Utilidades (`src/app/shared/shared-utils.ts`)
- `isPlanItemMissingMinimumInfo()` — valida completitud de ejercicio.
- `findIncompletePlanItems()` — recopila items incompletos de sesiones.
- `isGymMode()` / `isIndependentTenant()` — deteccion de tipo de tenant.
- `sanitizeName()` — generacion de ID de ejercicio.
- `calculateAge()` — calculo de edad a partir de fecha de nacimiento.
- `getPlanItemEquipmentLabel()` — label de equipo para display.
- `getPlanItemDisplayName()` — nombre de display de ejercicio.
- `normalizePlanItemsForRender()` / `normalizePlanSessionsForRender()` — normalizacion de items para render.
- `enrichPlanSessionsFromLibrary()` — enriquecimiento de sesiones con datos de Exercise Library.
- `parsePlanSessions()` — parsing de sesiones raw.
- `hasRenderablePlanContent()` — validacion de contenido renderizable.
- `getPlanKey()` / `getTemplateDisplayName()` — helpers de identificacion de planes/plantillas.
- `getPlanCreatedAtTime()` / `sortPlansByCreatedAt()` / `buildPlanOrdinalMap()` — ordenamiento y numeracion ordinal de planes.

### 9.2 Configuraciones
- `training-goal.config.ts`: enum `TrainingGoal` (HYPERTROPHY, WEIGHT_LOSS, ENDURANCE, POWER, CARDIO), interfaz `TrainingGoalProfile` con rangos de reps, periodos de descanso, volumen/intensidad, tipos de ejercicio preferidos.
- `training-methods.config.ts`: tipo `TrainingMethod` (13 metodos: standard, pyramid, reverse_pyramid, superset, giant_set, drop_set, circuit, emom, amrap, cluster, contrast, interval, steady_state), definiciones con descripcion.
- `ai-plan-limits.ts`: `MAX_AI_PLANS_PER_TRAINER = 20`, interfaz `AiPlanQuota`.

### 9.3 Feedback y logging (`src/app/shared/feedback-utils.ts`)
- `FeedbackTheme` enum: SUCCESS, ERROR, INFO.
- `OperationType` enum: CREATE, UPDATE.
- `FeedbackConfig`: duraciones y configs de MatSnackBar.
- `ExerciseMessages`: mensajes predefinidos de feedback para ejercicios.
- `ErrorMapper`: mapeo de errores HTTP (400, 401, 403, 413, 422, 429, 500, 502, 503, 504) a mensajes amigables.
- `DevLogger`: logging estructurado para desarrollo.

### 9.4 Localizacion (`src/app/shared/locale.utils.ts`)
- `detectUserLocale()`: deteccion de locale del navegador (es/en).
- `getLocalizedExerciseName()`: nombre de ejercicio con cadena de fallback (name_es -> name_en -> name).
- `getLocalizedEquipmentLabel()`: label de equipo localizado.
- `getPdfLabels()`: diccionario de labels para PDF (bilingue, 20+ pares).

### 9.5 Validadores de auth (`src/app/shared/auth-validators.ts`)
- `matchFieldsValidator()`: comparacion de campos (passwords).
- `passwordPolicyValidator()`: validacion de fortaleza de contrasena.

### 9.6 Errores de auth (`src/app/shared/auth-error-utils.ts`)
- `getAuthErrorName()`: extrae identificador de error Cognito.
- `mapCognitoError()`: mensajes amigables para 15+ tipos de error Cognito.

### 9.7 Pipes
- `UserDisplayNamePipe` (`userDisplayName`): formatea nombre de display de usuario (givenName + familyName con fallback a email).

### 9.8 Componentes compartidos
- `AiGenerationTimelineComponent`: timeline visual de progreso de generacion IA (6 pasos secuenciales: analisis de perfil, estrategia, estructura, seleccion de ejercicios, optimizacion, validacion final).

## 10) Configuracion de entorno
Archivos:
- `src/environments/environment.ts` (dev)
- `src/environments/environment.prod.ts` (prod)
- `src/environments/environment.test.ts` (tests)
- `src/environments/environment.interface.ts` (shape comun)

Tambien hay reemplazo de `src/aws-exports.ts` en build de produccion (ver `angular.json`).

## 11) Persistencia local en frontend
Llaves principales en navegador:
- `auth_flow_state` (sessionStorage, pasos de auth flow persistibles).
- `fp_sessions_<userId>` (localStorage, sesiones del planner por usuario).
- `planner-filters` (localStorage, filtros planner).
- `exercise-manager-filters` y `exercise-manager-filters-paginator` (localStorage).

## 12) Scripts y comandos
Comandos npm (`package.json`):
- `npm run ng` -> passthrough del CLI Angular.
- `npm run build` -> build app SPA.
- `npm run watch` -> build en modo desarrollo watch.
- `npm test` -> tests con Karma.
- `npm run start` -> levanta servidor de desarrollo Angular (`ng serve`).

Comando util adicional:
- `node scripts/smoke-api.mjs`
  - Env vars: `API_BASE`, `ID_TOKEN`, `TEST_USER_ID`, `WRITE_TESTS=true`.

## 13) Estructura resumida del repo
```text
fitness-planner/
|-- src/
|   |-- app/
|   |   |-- components/
|   |   |   |-- planner/
|   |   |   |   |-- ai/            # Dialogos IA (parametrico, prompt)
|   |   |   |   |-- dialogs/       # Dialogos auxiliares (preview, planes previos)
|   |   |   |   |-- models/        # Modelos del planner
|   |   |   |   `-- services/      # State, form, filter, drag-drop
|   |   |   |-- workout-plan-view/
|   |   |   |-- confirm-dialog/
|   |   |   |-- login/
|   |   |   |-- signup/
|   |   |   `-- ...                # Auth components
|   |   |-- guards/
|   |   |-- interceptors/
|   |   |-- layout/
|   |   |-- models/
|   |   |-- pages/
|   |   |   |-- ai-plan-detail/
|   |   |   |-- ai-plans-dashboard/
|   |   |   |-- ai-plans-user/
|   |   |   |-- client-body-metrics/
|   |   |   |-- clients/
|   |   |   |-- dashboard/
|   |   |   |-- diagnostics/
|   |   |   |-- exercise-manager/
|   |   |   |   `-- components/    # Subcomponentes: detail, edit-dialog, filters, table, video-dialog
|   |   |   |-- onboarding/
|   |   |   |-- plan-view/
|   |   |   |-- settings/
|   |   |   |-- templates/
|   |   |   |-- trainers/
|   |   |   |-- user-detail/
|   |   |   |-- user-plans-dialog/
|   |   |   `-- users/
|   |   |-- services/
|   |   `-- shared/                # Utils, configs, pipes, feedback, locale
|   |-- aws/
|   |-- environments/
|   `-- main.ts
|-- scripts/
|   `-- smoke-api.mjs
|-- angular.json
|-- package.json
|-- README.md
|-- DOCUMENTATION.md
|-- DEVELOPER..md
`-- AGENT_RULES.md
```

## 14) Estado de pruebas (unitarias)
Specs presentes actualmente (16 archivos):
- `src/app/app.component.spec.ts`
- `src/app/services/client-body-metrics.service.spec.ts`
- `src/app/services/auth.service.spec.ts`
- `src/app/guards/system.guard.spec.ts`
- `src/app/guards/post-login-redirect.guard.spec.ts`
- `src/app/guards/onboarding.guard.spec.ts`
- `src/app/guards/auth-flow.guard.spec.ts`
- `src/app/guards/role.guard.spec.ts`
- `src/app/pages/templates/templates.component.spec.ts`
- `src/app/pages/dashboard/dashboard.component.spec.ts`
- `src/app/components/workout-plan-view/workout-plan-view.component.spec.ts`
- `src/app/components/planner/planner.component.spec.ts`
- `src/app/components/planner/services/planner-state.service.spec.ts`
- `src/app/components/planner/services/planner-form.service.spec.ts`
- `src/app/components/planner/services/planner-exercise-filter.service.spec.ts`
- `src/app/components/planner/services/planner-drag-drop.service.spec.ts`

Cobertura funcional existe en modulos clave, pero no cubre toda la superficie del producto.

## 15) Notas operativas importantes
- El repo puede estar en cambios activos; valida `git status` antes de asumir baseline limpio.
- Varias rutas y componentes dependen de grupos Cognito reales; para probar flujos completos necesitas usuarios de prueba con grupos correctos.
- `System` habilita features tecnicas (diagnostics y modificacion de ejercicios).
- `Admin` sin `Trainer` se trata como `Gym Admin` (acceso mas restringido en ciertas vistas de operacion).

## 16) Referencias primarias de codigo
- Rutas: `src/app/app.routes.ts`
- Config app: `src/app/app.config.ts`
- Auth: `src/app/services/auth.service.ts`
- Interceptor: `src/app/interceptors/auth.interceptor.ts`
- Planner: `src/app/components/planner/planner.component.ts`
- Planner IA: `src/app/components/planner/ai/ai-parametric-dialog.component.ts`
- Usuarios: `src/app/user-api.service.ts`
- Planes/ejercicios: `src/app/exercise-api.service.ts`
- IA: `src/app/services/ai-plans.service.ts`
- Theme: `src/app/services/theme.service.ts`
- PDF: `src/app/services/pdf-generator.service.ts`
- Localizacion: `src/app/shared/locale.utils.ts`
- Configs de entrenamiento: `src/app/shared/training-goal.config.ts`, `src/app/shared/training-methods.config.ts`
- Feedback/UX: `src/app/shared/feedback-utils.ts`
- Utilidades compartidas: `src/app/shared/shared-utils.ts`
