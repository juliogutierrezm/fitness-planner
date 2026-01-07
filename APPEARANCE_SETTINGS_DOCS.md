# Configuración de Apariencia (White-Label Theming) - Documentación

## 📋 Descripción General

Se ha implementado un formulario de configuración de apariencia (white-label theming) en la aplicación Angular. Permite que administradores (Admin) personalizen los colores, modo oscuro y tipografía **para guardar en la configuración del sistema**. 

**Importante**: Los cambios se guardan en el servidor pero **NO afectan globalmente la aplicación**. El preview visual es **local al componente** para propósitos de visualización.

## 🏗️ Arquitectura

### Servicios Principales

#### 1. **ThemeService** (`src/app/services/theme.service.ts`)
- Maneja la comunicación con el backend
- Métodos:
  - `getTheme()`: Obtiene la configuración actual del tema
  - `saveTheme(config)`: Guarda la configuración en el servidor
  - `getLogoUploadUrl()`: Obtiene URL pre-firmada para S3
  - `uploadLogoToS3(url, file)`: Carga el logo usando fetch nativo
  - `loadTheme()`: Carga el tema y devuelve valores por defecto si no está configurado

### Componente UI

#### **AppearanceSettingsComponent** (`src/app/pages/settings/`)
- Componente standalone con formulario reactivo
- Características:
  - Color picker para color primario y acento
  - Toggle para modo oscuro/claro (visual en preview solamente)
  - Selector de tipografía
  - Upload de logo con preview inmediato
  - **Vista previa visual LOCAL** (solo en el formulario)
  - Guardado en servidor (sin aplicar globalmente)

### Archivos Creados

```
src/app/
├── services/
│   ├── theme.service.ts
│   └── theme-application.service.ts
└── pages/
    └── settings/
        ├── appearance-settings.component.ts
        ├── appearance-settings.component.html
        └── appearance-settings.component.scss
```

## 🔐 Seguridad y Restricciones

✅ **Solo Admin puede acceder**
- Ruta protegida con AuthGuard y RoleGuard
- Validación en `canActivate` con rol 'admin'

✅ **No se envían IDs desde el frontend**
- Backend resuelve tenant usando claims JWT
- No hay trainerId ni companyId en las peticiones

✅ **Upload a S3 con fetch nativo**
- NO usa HttpClient (evita interceptores)
- NO envía Authorization header
- Usa método PUT con pre-signed URL
- Solo envía el archivo y Content-Type
✅ **Cambios guardados en servidor**
- Se persisten en la base de datos
- NO se aplican globalmente a la app
- NO afectan otros usuarios
- El preview es solo local al formulario
✅ **Flujos existentes no se rompen**
- Los temas solo aplican estilos dinámicos
- No afecta la lógica de negocio
- Compatible con modo SSR

## 📡 API Endpoints

Todos usan el tenant resuelto por el backend (sin enviar ID):

```
GET    /tenant/theme              → Obtener configuración actual
PUT    /tenant/theme              → Guardar configuración
POST   /tenant/logo-upload-url    → Obtener URL pre-firmada para S3
```

## 🎨 Configuración del Tema

### Estructura del Objeto `ThemeConfig`

```typescript
{
  primaryColor: string;      // Color principal (ej: #1976d2)
  accentColor: string;       // Color acento (ej: #ff4081)
  darkMode: boolean;         // Modo oscuro activado
  typography: string;        // Familia tipográfica (roboto, opensans, lato, montserrat)
  logoUrl?: string;          // URL del logo (opcional)
}
```

### Valores por Defecto

Si el usuario nunca configuró el tema, la app muestra:
- Color primario: `#1976d2` (azul Material)
- Color acento: `#ff4081` (rosa)
- Modo oscuro: `false`
- Tipografía: `roboto`
- Logo: `/assets/TrainGrid.png`

## 🎯 Variables CSS Dinámicas

El `ThemeApplicationService` inyecta estas variables en `:root`:

```css
--primary-color: #1976d2;
--primary-rgb: 25, 118, 210;
--accent-color: #ff4081;
--accent-rgb: 255, 64, 129;
--dark-mode: 0|1;
--typography: roboto|opensans|lato|montserrat;
```

## 🚀 Uso del Upload de Logo

### Flujo completo:

1. **Usuario selecciona archivo**
   - Validación de tipo (image/*)
   - Validación de tamaño (máx 5MB)
   - Preview inmediato

2. **Obtener URL pre-firmada**
   ```typescript
   const { uploadUrl, fileKey } = await 
     themeService.getLogoUploadUrl().toPromise();
   ```

3. **Subir a S3 con fetch nativo**
   ```typescript
   await fetch(uploadUrl, {
     method: 'PUT',
     body: file,
     headers: { 'Content-Type': file.type }
   });
   ```

4. **Guardar referencia en la app**
   - Se guarda junto al resto de la configuración

## 🔄 Integración en la Aplicación

### En el Sidebar (Layout)

Se agregó nueva opción visible solo para Admin:

```html
<a class="nav-link" routerLink="/settings/appearance" *ngIf="user?.role === 'admin'">
  <mat-icon>palette</mat-icon>
  <span>Apariencia</span>
</a>
```

### En AppComponent

Se carga el tema al iniciar la aplicación:

```typescript
ngOnInit() {
  this.themeApplicationService.loadAndApplyTheme();
  await this.authService.checkAuthState();
}
```

### En las Rutas

```typescript
{
  path: 'settings/appearance',
  loadComponent: () => import('./pages/settings/appearance-settings.component'),
  canActivate: [AuthGuard],
  data: { roles: [UserRole.ADMIN] }
}
```

## 🌙 Modo Oscuro

El modo oscuro es **solo visual** en el preview del formulario:
- El toggle afecta cómo se ve el preview
- Aplica un filtro brightness() a los componentes en preview
- Cambia el fondo del área de texto
- NO afecta la app globalmente

## 💾 Persistencia

El tema se persiste de una sola forma:

1. **Server-side**: Base de datos (configuración de tenants)
   - Se guarda cuando el usuario hace click en "Guardar cambios"
   - El frontend solo visualiza el preview localmente

## ⚙️ Configuración del Entorno

Se agregó `apiUrl` a los archivos de ambiente:

```typescript
// environment.ts (desarrollo)
apiUrl: '/api'

// environment.prod.ts (producción)
apiUrl: 'https://k2ok2k1ft9.execute-api.us-east-1.amazonaws.com/prod'
```

## 🧪 Testing

El componente es standalone y puede probarse:

```typescript
TestBed.configureTestingModule({
  imports: [AppearanceSettingsComponent],
  providers: [ThemeService, ThemeApplicationService, MatSnackBar]
});
```

## 📱 Responsive

El componente es completamente responsive:
- Diseño grid que se adapta a móvil
- Material Design completo
- Sin librerías externas

## 🎬 Flujo de Usuario

1. Acceder a `/settings/appearance`
2. Ver configuración actual (o defaults)
3. Modificar colores, modo oscuro, tipografía
4. Ver preview visual **local** en tiempo real
5. Cargar logo (opcional)
6. Guardar cambios → se guardan en el servidor
7. El preview desaparece, la app sigue igual
8. Restaurar valores por defecto (botón opcional)

## ✨ Características Destacadas

✅ Preview visual **local** en tiempo real
✅ Guardado en servidor sin recargar
✅ Upload de logo integrado
✅ Validación de archivos
✅ Modo oscuro **solo en preview**
✅ Valores por defecto sensatos
✅ Material Design consistente
✅ UX amigable con snackbars
✅ **NO afecta globalmente la app**
✅ **Solo la configuración se guarda**

## 🔗 Rutas Relacionadas

- `/settings/appearance` - Configuración de apariencia
- Backend resuelve tenant desde JWT claims
- No hay necesidad de pasar IDs

## 📝 Notas Importantes

1. **El backend debe proporcionar los endpoints descritos**
2. **S3 debe devolver URLs pre-firmadas válidas**
3. **El JWT debe incluir información del tenant**
4. **Los valores por defecto nunca se fuerzan, se sugieren**
5. **El preview es LOCAL al formulario, no afecta la app**
6. **Los cambios se guardan en la BD del tenant**
7. **El ThemeApplicationService ya NO se usa**
8. **Usar `fetch` nativo para S3 evita interceptores**
