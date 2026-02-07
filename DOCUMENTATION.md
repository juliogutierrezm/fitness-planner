# Fitness Planner

## Descripción general
Fitness Planner es una aplicación de planificación de entrenamientos desarrollada en Angular 19, que integra autenticación custom con AWS Cognito (Amplify Auth) y conectividad con API para gestionar planes de ejercicios, usuarios y recursos fitness. Ofrece una interfaz responsiva con Material Design, soporte para server-side rendering (SSR), rutas protegidas con control de acceso basado en roles (Admin, Trainer, Client), y funcionalidades administrativas avanzadas.
Tambien incluye configuracion de apariencia por tenant (branding, colores, tipografia, modo claro/oscuro y logo) con vista previa para administradores.

## Arquitectura de Autenticación y AWS Cognito

### Sistema Custom de Autenticación
La aplicación implementa autenticación 100% custom con AWS Cognito y Amplify Auth, sin Hosted UI ni redirects.

#### Componentes principales
- **AuthService** (`src/app/services/auth.service.ts`): manejo de signup/login/reset, tokens, grupos y estado del flujo
- **AuthFlowGuard** (`src/app/guards/auth-flow.guard.ts`): control de rutas públicas según el paso de auth
- **AuthFlowState**: persistencia temporal en `sessionStorage` para confirmación y reset
- **UI de autenticación**: login, signup, confirm-signup, forgot/reset password, force-change-password

### Configuración de AWS Cognito

#### User Pool Configuration (export local JSON)
```json
// user-pool.json (referencia local del User Pool de desarrollo)
{
  "UserPool": {
    "Id": "us-east-1_8jk4VBnTQ",
    "Name": "fitness-planner-dev-user-pool",
    "SchemaAttributes": [
      { "Name": "custom:role", "AttributeDataType": "String" },
      { "Name": "custom:companyId", "AttributeDataType": "String" },
      { "Name": "custom:trainerIds", "AttributeDataType": "String" }
    ]
  }
}
```

#### Grupos de Usuarios
- **Admin**: Acceso completo a todas las funcionalidades
- **Trainer**: Gestión de clientes y planes de entrenamiento
- **Client**: Acceso básico a planes asignados

#### Flujo de Autenticación
1. **Inicio de sesión/registro**: Formularios custom con Amplify Auth
2. **nextStep**: Confirmación de cuenta, reset o cambio de contraseña obligatorio
3. **AuthFlowState**: El estado se guarda temporalmente para recuperar el flujo en navegación
4. **Sesión Cognito**: Amplify mantiene los tokens en storage seguro
5. **Guards**: Redirección a dashboard/onboarding/unauthorized según grupos

#### SSR e hidratación (estado auth `unknown`)
- Durante SSR no se pueden resolver tokens del navegador; el estado inicial de auth es `unknown`.
- `APP_INITIALIZER` ejecuta `checkAuthState` en cliente antes de completar la navegación inicial.
- Guards (`AuthGuard`, `AuthFlowGuard`, `OnboardingGuard`, `RoleGuard`, `SystemGuard`) permiten paso cuando auth es `unknown` para evitar redirecciones incorrectas y "login flash".
- `AppComponent` muestra splash mientras auth permanece en `unknown`.

### Seguridad Implementada
- **Amplify Auth**: manejo de tokens y refresh automático
- **Storage seguro**: tokens gestionados por Amplify
- **Roles por grupos Cognito**: extracción directa desde tokens

#### Guards y Autorización
- **AuthGuard**: Protección base para rutas autenticadas
- **PostLoginRedirectGuard**: Redirige a onboarding si falta inicialización (sin grupos Admin/Trainer)
- **OnboardingGuard**: Permite onboarding solo a usuarios autenticados sin grupos de planner
- **RoleGuard**: Control de acceso por roles + restricción `excludeIndependent` para módulos específicos
- **SystemGuard**: Acceso técnico solo para usuarios del grupo Cognito `System`
- **AuthFlowGuard**: Control de pantallas públicas según el paso activo de autenticación
- **Data Access Control**: Verificación de permisos para acceso a datos de usuarios

### Roles y Permisos

| Rol | Permisos |
|-----|----------|
| **Admin** | Acceso completo a usuarios, planes, ejercicios y configuraciones del sistema |
| **Trainer** | Gestión de sus clientes asignados, creación de planes, acceso al catálogo de ejercicios |
| **Client** | Acceso a sus propios planes asignados y perfil personal |

## User Initialization & Onboarding

### userType (solo onboarding)
- userType indica el contexto operativo del usuario y no es un rol.
- Valores soportados: GYM_OWNER, INDEPENDENT_TRAINER.
- Se usa solo en la UI de onboarding y en el body de POST /users/initialize.
- No se persiste en el perfil ni se usa para permisos.

### Estado de inicializacion (groups only)
- Usuario inicializado para planner = pertenece a Admin o Trainer.
- Fuente de verdad: grupos de Cognito (cognito:groups).

### companyId (aislamiento de tenant)
- companyId se asigna en backend durante /users/initialize.
- INDEPENDENT_TRAINER -> INDEPENDENT
- GYM_OWNER -> GYM#<uuid>

### Rol vs estado
- Role (admin/trainer/client) controla permisos de acceso y se deriva de grupos.
- userType solo define contexto de negocio durante onboarding.

### Por que el onboarding es post-login
- El onboarding requiere un JWT valido para llamar POST /users/initialize.
- Evita mostrar onboarding antes de autenticar al usuario.

### Guards deciden
- AuthGuard solo valida autenticacion.
- OnboardingGuard permite /onboarding solo si el usuario autenticado no tiene grupos Admin/Trainer; si los tiene, redirige a /dashboard.
- PostLoginRedirectGuard redirige a /onboarding cuando el usuario autenticado no tiene grupos Admin/Trainer.

### Integración con API Backend
```typescript
// Interceptor automático de autenticación
export class AuthInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!req.url.startsWith(environment.apiBase)) {
      return next.handle(req);
    }

    return from(fetchAuthSession()).pipe(
      switchMap(session => {
        const token =
          session?.tokens?.idToken?.toString() ??
          session?.tokens?.accessToken?.toString();
        if (!token) return next.handle(req);
        return next.handle(req.clone({
          setHeaders: { Authorization: `Bearer ${token}` }
        }));
      }),
      catchError(() => next.handle(req))
    );
  }
}
```

## Estructura de carpetas y archivos
```text
fitness-planner/
├── DOCUMENTATION.md
├── README.md
├── package.json
├── user-pool.json
├── src/
│   ├── aws-exports.ts
│   ├── environments/
│   │   ├── environment.ts
│   │   └── environment.prod.ts
│   └── app/
│       ├── app.config.ts
│       ├── app.routes.ts
│       ├── services/
│       │   ├── auth.service.ts
│       │   ├── user-initialization.service.ts
│       │   └── theme.service.ts
│       ├── interceptors/
│       │   └── auth.interceptor.ts
│       ├── guards/
│       │   ├── auth.guard.ts
│       │   ├── auth-flow.guard.ts
│       │   ├── onboarding.guard.ts
│       │   ├── post-login-redirect.guard.ts
│       │   ├── role.guard.ts
│       │   └── system.guard.ts
│       ├── layout/
│       ├── pages/
│       │   ├── onboarding/
│       │   ├── dashboard/
│       │   ├── templates/
│       │   ├── clients/
│       │   ├── trainers/
│       │   ├── diagnostics/
│       │   ├── exercise-manager/
│       │   ├── ai-plans-dashboard/
│       │   ├── ai-plans-user/
│       │   ├── ai-plan-detail/
│       │   ├── plan-view/
│       │   └── settings/
│       ├── components/
│       │   ├── login/
│       │   ├── signup/
│       │   ├── confirm-code/
│       │   ├── force-new-password/
│       │   ├── forgot-password/
│       │   ├── reset-password/
│       │   ├── planner/
│       │   └── unauthorized/
│       └── shared/
└── scripts/
```
Nota: esta estructura es referencial y prioriza módulos activos/clave. Para detalle exacto use `tree` o el explorador del IDE.

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
- @aws-sdk/client-dynamodb: ^3.958.0
- aws-amplify: ^6.15.5
- express: ^4.18.2
- jspdf: ^4.1.0
- rxjs: ~7.8.0
- tslib: ^2.3.0
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
    clientId: 'XXXXXXXXXXXXXXXXXXXXX'
  }
};
```

### Ejecutar la aplicación
```bash
ng serve
```
La aplicación estará disponible en `http://localhost:4200`.

## Funcionalidades
- **Autenticación custom con AWS Cognito**: Signup/login/reset con UI propia
- **Control de Acceso Basado en Roles**: Tres niveles jerárquicos (Admin, Trainer, Client) con permisos granulares
- **Gestión de Sesiones con Amplify**: Refresh automático de tokens y manejo de expiración transparente
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
- **Métricas corporales de clientes**: Seguimiento histórico de composición corporal (peso, grasa corporal, masa muscular, IMC, metabolismo basal, edad metabólica) con gráficos y gestión de mediciones
- **Interfaz unificada de usuario**: Arquitectura simplificada donde todos los roles acceden a través de la aplicación principal sin interfaces separadas
- **Flujo de autenticación controlado**: Pantallas públicas con guard de flujo, persistencia temporal en `sessionStorage` y redirecciones claras

## Modulos de usuarios por rol
- **Clientes**: Gestión de usuarios con role = client, con asignación/cambio de entrenador (solo admin). Los clientes acceden a través de la aplicación principal según sus permisos.
- **Entrenadores**: Vista dedicada para usuarios con role = trainer, con conteo de clientes asignados y planes creados.
- **Formularios por contexto**: El rol se infiere por la vista (no hay dropdown de rol).
- **Plantillas**: La asignación de plantillas filtra solo clientes.

## Estado actual del desarrollo



## Ejemplos de uso
### Iniciar sesión custom
```typescript
// Ejemplo con AuthService (src/app/services/auth.service.ts)
await this.authService.signInUser(email, password);
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
// Uso del AuthGuard (src/app/guards/auth.guard.ts)
return from(this.authService.checkAuthState()).pipe(
  switchMap(() => this.authService.isAuthenticated$)
);

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
```

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
5. **Probar autenticación**: Acceder a rutas protegidas y verificar flujo Cognito custom
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
- **Pantallas de autenticación**: Completo - Login, signup, confirmación, reset y cambio de contraseña
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

### Ultimas actualizaciones implementadas (actualizado al 6 de febrero de 2026):
- **5e4b939**: `feat` update video label and adjust column positions for improved layout in PDF generation
- **66e7a8e**: `feat` update video label and adjust column positions for improved layout in PDF generation
- **d14266e**: `feat` update video label and adjust column positions for improved layout in PDF generation
- **9730250**: `feat` add PDF generation for workout plans
- **26ba872**: merge PR #18 (`feat/compact-planner-ui`)
- **9bbd00b**: `feat` implement SystemGuard; exercise hover preview; permisos por grupo System
- **d19786e**: `feat` compact planner UI (layout/estilos de filtros y campos de sesión)
- **db7d2fb**: `feat` compact planner UI (iteración adicional)
- **5c62f08**: `feat` mejoras en sidebar de ejercicios e inputs
- **339a7ed**: merge PR #17 (`fix/testing-app`)

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

## Entrenador asignado vs entrenador actual (decisión de arquitectura)

El sistema distingue explícitamente entre dos conceptos relacionados con entrenadores y clientes, los cuales cumplen propósitos distintos y no deben confundirse.

### Entrenador asignado (administrativo)

- Representa una asignación organizativa dentro del gimnasio.
- Se almacena de forma explícita en el perfil del usuario:
  - `USERS.trainerId`
- Es gestionado únicamente por el administrador / gym owner.
- Se utiliza para:
  - Vistas administrativas
  - Organización interna del gimnasio
  - Conteo de clientes por entrenador
  - Reporting y métricas de gestión
- No representa actividad reciente ni autoría de planes.

### Entrenador actual (operativo)

- Representa al entrenador que más recientemente creó un plan para el cliente.
- **No se almacena como estado fijo**.
- Se deriva dinámicamente a partir del último plan de entrenamiento:
  - `WorkoutPlans` ordenados por fecha descendente.
- Se utiliza para:
  - Experiencia de usuario del cliente
  - Personalización de la interfaz
  - Contexto operativo en vistas de entrenador y cliente
- Un cliente puede tener planes creados por múltiples entrenadores a lo largo del tiempo.

### Relación entre ambos conceptos

- El entrenador asignado **no limita** la creación de planes.
- Cualquier entrenador del mismo gimnasio puede crear planes para cualquier cliente del tenant.
- El entrenador actual puede cambiar de forma natural sin intervención administrativa.
- El historial de planes conserva siempre la autoría original.

### Estado de implementación

- El backend soporta completamente esta separación de responsabilidades.
- La lógica de derivación del entrenador actual está implementada a nivel de datos.
- La UI actual utiliza principalmente la asignación administrativa.
- La exposición completa del entrenador actual en UI (cliente, entrenador, administrador) queda planificada para una implementación posterior.

Esta separación permite flexibilidad operativa, colaboración entre entrenadores y una experiencia de usuario fluida, sin comprometer el control administrativo del gimnasio.



