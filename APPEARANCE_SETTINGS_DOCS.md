# Configuracion de Apariencia (White-Label Theming) - Documentacion

## Descripcion General

Se implemento un formulario de configuracion de apariencia en la aplicacion Angular. Permite a usuarios Admin personalizar branding (nombre y tagline), colores, modo claro/oscuro y tipografia. Los cambios se guardan en el servidor pero **no se aplican globalmente**; la vista previa es **local al componente**.

## Arquitectura

### Servicio Principal

#### 1. ThemeService (`src/app/services/theme.service.ts`)
- Maneja la comunicacion con el backend
- Metodos:
  - `getTheme()`: Obtiene configuracion actual
  - `saveTheme(config)`: Guarda configuracion
  - `getLogoUploadUrl(filename, contentType)`: Obtiene URL pre-firmada para S3
  - `uploadLogoToS3(url, file)`: Carga el logo usando fetch nativo
  - `loadTheme()`: Carga el tema y retorna defaults si no hay configuracion
  - `getDefaultTheme()`, `getCurrentTheme()`, `setThemeInMemory()`

### Componente UI

#### AppearanceSettingsComponent (`src/app/pages/settings/appearance-settings.component.*`)
- Componente standalone con formulario reactivo
- Caracteristicas:
  - Color picker y campo Hex para color primario y acento
  - Toggle para modo oscuro (solo preview)
  - Selector de tipografia
  - Campos de branding (nombre y tagline)
  - Upload de logo con preview inmediato
  - Vista previa local en tiempo real (sin aplicar tema global)
  - Guardado en servidor

### Archivos

```
src/app/
|-- services/
|   |-- theme.service.ts
|-- pages/
    |-- settings/
        |-- appearance-settings.component.ts
        |-- appearance-settings.component.html
        |-- appearance-settings.component.scss
```

## Seguridad y Restricciones

- Solo Admin puede acceder (AuthGuard + RoleGuard)
- No se envian IDs desde el frontend (backend resuelve tenant con JWT)
- Upload a S3 con fetch nativo (sin Authorization header)
- Cambios guardados en servidor, **no aplican globalmente**
- Preview es local al formulario

## API Endpoints

Todos usan el tenant resuelto por el backend:

```
GET  /tenant/theme
PUT  /tenant/theme
POST /tenant/logo-upload-url
```

## Configuracion del Tema

### Estructura del objeto ThemeConfig (backend)

```typescript
{
  primaryColor: string;    // Ej: #FF9900
  accentColor: string;     // Ej: #22D3EE
  backgroundMode?: string; // 'light' | 'dark'
  fontFamily?: string;     // Ej: Inter, Roboto, Poppins
  appName?: string;        // Max 40 chars
  tagline?: string;        // Max 80 chars
  logoKey?: string;        // S3 key
  logoUrl?: string;        // Solo display
}
```

### Mapeo UI -> Backend

- UI `darkMode` se guarda como `backgroundMode`
- UI `typography` se guarda como `fontFamily`
- `logoKey` se guarda solo si se sube un nuevo logo

### Valores por Defecto

Si no hay configuracion guardada:
- primaryColor: `#FF9900`
- accentColor: `#22D3EE`
- backgroundMode: `light`
- fontFamily: `Inter`
- logoUrl: `/assets/TrainGrid.png`

## Tipografias Disponibles

- Inter
- Roboto
- Poppins
- Montserrat
- Oswald
- Lato

## Vista Previa (Local)

La preview se aplica via estilos inline en el template (no inyecta CSS global).
Se actualiza en tiempo real con los valores del formulario.

## Flujo de Upload de Logo

1. Usuario selecciona archivo (image/*, max 5MB)
2. Solicita URL pre-firmada con `filename` y `contentType`
3. Sube el archivo a S3 con `fetch` (PUT)
4. Guarda `logoKey` junto a la configuracion

Ejemplo de subida:

```typescript
const { uploadUrl, fileKey } = await themeService
  .getLogoUploadUrl(file.name, file.type)
  .toPromise();
await themeService.uploadLogoToS3(uploadUrl, file);
```

## Integracion en la Aplicacion

### Sidebar

Se agrega una opcion solo para Admin:

```html
<a class="nav-link" routerLink="/settings/appearance" *ngIf="user?.role === 'admin'">
  <mat-icon>palette</mat-icon>
  <span>Apariencia</span>
</a>
```

### Rutas

```typescript
{
  path: 'settings/appearance',
  loadComponent: () => import('./pages/settings/appearance-settings.component'),
  canActivate: [AuthGuard],
  data: { roles: [UserRole.ADMIN] }
}
```

## Notas Importantes

1. El backend debe exponer los endpoints anteriores
2. S3 debe devolver URL pre-firmadas validas
3. El JWT debe incluir informacion del tenant
4. La preview es local; no se aplica el tema globalmente
