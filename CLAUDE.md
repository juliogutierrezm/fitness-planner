# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Angular 19 fitness planner application with SSR support. The application allows users to create and manage workout plans with AI-generated suggestions, exercise management, and session planning.

## Development Commands

### Core Commands
- **Start development server**: `ng serve` or `npm start`
- **Build project**: `ng build` or `npm run build`
- **Run tests**: `ng test` or `npm test`
- **Watch build**: `npm run watch`
- **Serve SSR build**: `npm run serve:ssr:fitness-planner`

### Angular CLI Commands
- **Generate component**: `ng generate component component-name`
- **Generate service**: `ng generate service service-name`
- **View available schematics**: `ng generate --help`

## Architecture

### Application Structure
- **Standalone Components**: All components use Angular's standalone component architecture
- **Lazy Loading**: Routes use lazy loading with dynamic imports
- **Material Design**: Uses Angular Material with the azure-blue theme
- **SCSS Styling**: Component styles use SCSS format
- **SSR Ready**: Application supports Server Side Rendering

### Key Directories
- `src/app/layout/`: Contains the main layout component with sidebar navigation
- `src/app/pages/`: Feature pages (dashboard, workout-plans, exercise-manager)
- `src/app/components/`: Reusable components (planner, workout-plan-view)
- `src/app/shared/`: Shared models and utilities

### Core Models (src/app/shared/models.ts)
- **Exercise**: Base exercise with id, name, equipment, muscle, category
- **PlanItem**: Workout plan item with sets, reps, rest, notes, and grouping support
- **Session**: Training session containing multiple plan items
- **WorkoutPlan**: Complete workout plan with multiple sessions

### Services
- **ExerciseApiService**: Handles all API communications
  - Exercise CRUD operations
  - Workout plan management
  - AI-generated workout plans via `/generatePlanFromAI` endpoint
  - Local session storage management
  - AWS API Gateway backend at `k2ok2k1ft9.execute-api.us-east-1.amazonaws.com`

### Routing Structure
- Base route wraps everything in LayoutComponent
- Lazy-loaded routes: `/dashboard`, `/planner`, `/workout-plans`, `/exercise-manager`
- Default redirect to `/dashboard`

### Key Features
- **Drag & Drop**: Uses Angular CDK for reordering exercises and sessions
- **AI Integration**: Generates workout plans using AI prompts
- **Session Management**: Local storage for workout sessions
- **Exercise Database**: CRUD operations for exercise management
- **Material UI**: Consistent Material Design components throughout

### Development Notes
- Component prefix: `app-`
- Style language: SCSS
- Testing framework: Jasmine with Karma
- Bundle size limits: 500kB warning, 1MB error for initial bundle