PROJECT_CONTEXT.md — SpeedUp Coach
1. Descripción general

SpeedUp Coach es una plataforma fitness compuesta por dos aplicaciones Angular y un backend serverless en AWS.

El ecosistema permite:

generar planes de entrenamiento con IA

crear y editar planes manualmente

gestionar sesiones, ejercicios y plantillas

visualizar planes desde la app del cliente

mostrar videos de ejercicios

registrar métricas de composición corporal

manejar branding multi-tenant por companyId

Arquitectura general:

Angular SPA
↓
CloudFront
↓
S3
↓
API Gateway
↓
Lambda
↓
DynamoDB / S3 / Step Functions / Cognito

La cuenta AWS usada es:

Account ID: 750391387727

Región principal: us-east-1

2. Estado actual de arquitectura

Anteriormente las apps usaban Elastic Beanstalk + SSR/Node/Express.
Eso ya fue eliminado.

Ahora las dos aplicaciones frontend son SPA puras desplegadas en:

S3

CloudFront

Route 53

ACM

No se debe volver a usar:

Elastic Beanstalk

SSR

Express

Node server para servir Angular

La arquitectura objetivo y vigente es:

Angular SPA → S3 → CloudFront

3. Aplicación 1 — SpeedUp Coach Client App
Propósito

Aplicación para usuarios finales (Client) donde pueden:

ver sus planes

ver sesiones

ver ejercicios y videos

ver perfil

ver composición corporal

Repositorio

SpeedUp-Coach-Client-App

Dominio productivo

https://app.speedupcoach.net

Infraestructura actual

S3 bucket: speedup-coach-client-prod-1773449774

CloudFront distribution: ESH61K1RXOIQO

CloudFront domain: d16l6e09np87ho.cloudfront.net

Certificado ACM: arn:aws:acm:us-east-1:750391387727:certificate/5dcf28bf-9dee-49d3-be7f-f000ddb36257

Frontend stack

Angular 19 standalone

AWS Amplify Auth

RxJS

TailwindCSS

ApexCharts

Auth

Usa Cognito con login custom vía Amplify.
El token se adjunta a requests hacia environment.apiBase mediante interceptor.

Rutas principales

Públicas:

/login

/forgot-password

/change-password

/unauthorized

Privadas:

/plans

/plans/:planId

/plans/:planId/session/:sessionIndex

/plans/:planId/session/:sessionIndex/exercise/:exerciseIndex

/plans/:planId/session/:sessionIndex/exercise/:exerciseIndex/video

/profile

/body-composition

Build actual

Comando:

npm run build

Salida:

dist/speedup-coach-client/browser
Deploy actual

Subir build a S3:

aws s3 sync dist/speedup-coach-client/browser s3://speedup-coach-client-prod-1773449774 --delete

Invalidar CloudFront:

aws cloudfront create-invalidation \
  --distribution-id ESH61K1RXOIQO \
  --paths "/*"
PWA

La app client era/puede ser PWA.
Para que funcione bien sobre S3 + CloudFront hay que verificar:

serviceWorker: true

ngsw-config.json

ngsw.json

ngsw-worker.js

manifest.webmanifest

HTTPS activo

Si se toca esta parte, validar service worker y caché después del deploy.

4. Aplicación 2 — Fitness Planner / Manager App
Propósito

Aplicación interna para entrenadores/admins donde se puede:

crear y editar planes

construir sesiones

arrastrar ejercicios y sesiones

usar wizard de IA para generar planes

administrar plantillas

administrar ejercicios

administrar usuarios

ver dashboards y planes IA

Dominio productivo

Actualmente el manager/planner está desplegado en CloudFront.
En el contexto histórico se trabajó con bucket:

S3 bucket: speedup-coach-manager-prod-1772429681

Y con una distribución separada de CloudFront.
Si en un nuevo chat se necesita redeploy del manager, primero confirmar el Distribution ID actual del manager antes de invalidar caché.

Estado funcional documentado

Según la documentación técnica actual del repositorio, Fitness Planner es una app Angular 19 con:

auth custom con Cognito

autorización por grupos (Admin, Trainer, Client, System)

multi-tenant por companyId

gestión de usuarios, planes, plantillas, ejercicios, planes IA y métricas

wizard paramétrico de IA de 3 pasos + prompt libre

SPA desplegada en S3 + CloudFront

Módulos importantes

Dashboard

Planner

Templates

Exercise Manager

AI Plans

Trainers

Clients / Users

Appearance / branding

Body metrics

PDF generator

Rutas privadas principales

Incluyen:

/dashboard

/planner

/planner/:id

/templates

/exercise-manager

/ai-plans

/trainers

/clients

/users

/settings/appearance

Build

Comando:

npm run build

La carpeta exacta de salida para redeploy debe confirmarse en el repo actual antes de subir, pero en la conversación previa se trabajó con salida SPA lista para S3.

Deploy esperado del manager

La lógica operativa es la misma:

aws s3 sync <carpeta-build-manager> s3://speedup-coach-manager-prod-1772429681 --delete
aws cloudfront create-invalidation --distribution-id <DISTRIBUTION_MANAGER> --paths "/*"

Si se abre un chat nuevo y se pide redeploy del manager, el asistente debe primero identificar la carpeta de build exacta y el distribution ID actual antes de dar el comando final.

5. Backend serverless del planner

La generación de planes con IA corre sobre AWS Step Functions + Lambda + S3 + DynamoDB + Bedrock.

Step Function principal

La máquina de estados actual sigue este flujo:

Validate Params

Filter Exercises

Resolve Sessions

Build Session Structure

Generate Sessions (Map)

Finalize Workout Plan

Store Workout Plan

Lambdas principales
validateParamsSF

recibe params

toma executionArn y extrae executionId

valida userId, companyId, totalSessions

normaliza sessionBlueprint

escribe progreso VALIDATING_INPUT en S3

devuelve validatedParams

filterExercisesSF

carga snapshot del catálogo desde S3

filtra por dificultad, equipo y targets

guarda un JSON filtrado por sesión en S3

escribe progreso FILTERING_EXERCISES

devuelve referencias filteredExercisesRef por sesión

resolveSessionsSF

une sessionBlueprint con filterResult.sessions

no reinterpreta targets

agrega contexto común: goal, difficulty, duration, injuries, notes

escribe progreso STRUCTURING_PLAN

devuelve la lista final de sesiones que el Map iterará

sessionBuilderSF

construye sessionStructure

genera goalProfile según trainingGoal, dificultad y duración

soporta estructuras como:

COMPOUND

ISOLATION

COMPOUND_PAIR

ISOLATION_PAIR

COMPOUND_SUPERSET

ISOLATION_SUPERSET

MIXED_SUPERSET

escribe progreso BUILDING_SESSION_STRUCTURE

generateWorkoutPlanAI

carga ejercicios filtrados desde S3

crea un catálogo compacto para el prompt

construye el prompt para Claude/Bedrock

incorpora:

nivel

objetivo

duración

equipo

lesiones

notas

targets

sessionStructure

métodos permitidos

exige JSON válido

si el LLM falla o devuelve algo incompleto, hace fallback con synthesizeFromStructure

devuelve name e items mapeados a exerciseId, sets, reps, rest

finalizeWorkoutPlanSF

valida que el plan generado no esté vacío

extrae userId y executionId

escribe progreso OPTIMIZING_LOAD

ordena sesiones de forma estable

devuelve { plan } para persistencia final

storeWorkoutPlanSF

escribe progreso FINAL_VALIDATION

guarda plan final en S3

actualiza latest.json

guarda el plan completo en DynamoDB como source of truth

usa tabla AIWorkoutPlans

indexa por usuario, trainer y company cuando aplica

6. Buckets y storage relevantes

Buckets vistos en el proyecto:

speedup-coach-client-prod-1773449774

speedup-coach-manager-prod-1772429681

temp-user-plans

ai-plan-temp

exercise-snapshots

exercise-videos-fitness-planner

tenant-assets-speed-up-coach

Uso general:

client / manager buckets: frontend estático

temp-user-plans: progreso y planes generados

ai-plan-temp: ejercicios filtrados por sesión

exercise-snapshots: snapshot catálogo

exercise-videos-fitness-planner: videos/GIFs de ejercicios

tenant-assets-speed-up-coach: logos/branding

7. Flujo correcto para actualizar producción
Si se actualiza la app client

Entrar al repo correcto

Build:

npm run build

Subir a S3:

aws s3 sync dist/speedup-coach-client/browser s3://speedup-coach-client-prod-1773449774 --delete

Invalidar CloudFront:

aws cloudfront create-invalidation \
  --distribution-id ESH61K1RXOIQO \
  --paths "/*"

Verificar:

https://app.speedupcoach.net

auth

rutas profundas

manifest/service worker si aplica

Si se actualiza el manager/planner

Entrar al repo correcto

Verificar output de build actual

Build:

npm run build

Subir a bucket del manager:

aws s3 sync <output-build-manager> s3://speedup-coach-manager-prod-1772429681 --delete

Invalidar la distribución actual del manager:

aws cloudfront create-invalidation \
  --distribution-id <DISTRIBUTION_MANAGER> \
  --paths "/*"

Verificar:

login

dashboard

planner

wizard IA

ai-plans

drag & drop

8. Configuración CloudFront importante

Para ambas apps Angular SPA, CloudFront debe manejar fallback SPA:

403 -> /index.html (200)

404 -> /index.html (200)

Esto permite que rutas como /planner/123, /plans/abc o /profile funcionen aunque se refresque el navegador.

9. Reglas para futuros chats

En cualquier nuevo chat, el asistente debe asumir:

hay dos apps Angular distintas

ambas ya viven en S3 + CloudFront

no se debe volver a EBS

no se debe reintroducir SSR

backend serverless no debe romperse

si se pide “redeploy”, el flujo correcto es:

build

sync a S3

invalidation CloudFront

si se pide ayuda con IA del planner, debe considerar la Step Function y las Lambdas actuales documentadas arriba

10. Qué pedir en un chat nuevo

Si abres otro chat, puedes pegar este documento y luego escribir algo como:

Para redeploy del client

“Usa este contexto. Necesito actualizar y redeployar la app client en producción.”

Para redeploy del manager

“Usa este contexto. Necesito revisar el output actual del manager y darme el flujo exacto para redeployarlo en CloudFront.”

Para mejorar IA del planner

“Usa este contexto. Quiero revisar la generación de planes IA y optimizar la estructura por objetivo, superseries y fallback del LLM.”

Para cambios de infraestructura

“Usa este contexto. Quiero revisar la configuración actual de S3, CloudFront y Route 53 para ambas apps.”

11. Referencias del contexto actual

Documentación técnica actual del planner:

Step Function actual:

generateWorkoutPlanAI:

filterExercisesSF:

resolveSessionsSF:

sessionBuilderSF:

finalizeWorkoutPlanSF:

storeWorkoutPlanSF:

validateParamsSF: