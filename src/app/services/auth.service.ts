import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { map, catchError, tap, finalize } from 'rxjs/operators';
import { Amplify } from 'aws-amplify';
import {
  fetchAuthSession,
  signOut,
  getCurrentUser,
  signIn,
  confirmSignIn,
  signUp,
  confirmSignUp,
  resendSignUpCode,
  resetPassword,
  confirmResetPassword
} from 'aws-amplify/auth';
import { awsExports } from '../../aws-exports';
import { isIndependentTenant } from '../shared/shared-utils';

// Configure Amplify
Amplify.configure(awsExports);

export type UserType = 'GYM_OWNER' | 'INDEPENDENT_TRAINER';
export interface UserProfile {
  id: string;
  email: string;
  givenName?: string;
  familyName?: string;
  role: UserRole;
  groups: string[];
  companyId?: string;
  trainerIds?: string[];
  isActive: boolean;
}

export enum UserRole {
  ADMIN = 'admin',
  TRAINER = 'trainer',
  CLIENT = 'client'
}

export type AuthFlowStep = 'confirmSignUp' | 'resetPassword' | 'newPasswordRequired';

export type AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated';

export interface AuthFlowState {
  step: AuthFlowStep;
  username: string;
  createdAt: number;
  nextStep?: any;
}

export interface AuthActionResult {
  nextStep?: AuthFlowStep;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<UserProfile | null>(null);
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private authFlowSubject = new BehaviorSubject<AuthFlowState | null>(null);
  private authLoadingSubject = new BehaviorSubject<boolean>(true);
  private authStatusSubject = new BehaviorSubject<AuthStatus>('unknown');
  private readonly isBrowser: boolean;
  private initialized = false;
  private readonly AUTH_FLOW_STORAGE_KEY = 'auth_flow_state';
  private readonly PERSISTED_FLOW_STEPS: AuthFlowStep[] = ['confirmSignUp', 'resetPassword'];
  
  public currentUser$ = this.currentUserSubject.asObservable();
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  public authFlow$ = this.authFlowSubject.asObservable();
  public isAuthLoading$ = this.authLoadingSubject.asObservable();
  public authStatus$ = this.authStatusSubject.asObservable();

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    if (this.isBrowser) {
      this.restoreAuthFlowState();
    }
  }

  /**
   * Synchronous accessors for guards and bootstrap gates.
   */
  getAuthStatusSync(): AuthStatus {
    return this.authStatusSubject.value;
  }

  isAuthResolvedSync(): boolean {
    return this.authStatusSubject.value !== 'unknown';
  }

  getAuthFlowSnapshot(): AuthFlowState | null {
    return this.authFlowSubject.value;
  }

  clearAuthFlowState(): void {
    // TODO(debug): remove/trim auth debug logs once auth flow is stable.
    const startedAt = Date.now();
    console.debug('[AuthDebug]', { op: 'AuthService.clearAuthFlowState.start' });
    this.authFlowSubject.next(null);
    if (this.isBrowser) {
      try {
        sessionStorage.removeItem(this.AUTH_FLOW_STORAGE_KEY);
        console.debug('[AuthDebug]', { op: 'AuthService.clearAuthFlowState.storageCleared' });
      } catch (error) {
        console.debug('[AuthDebug]', { op: 'AuthService.clearAuthFlowState.storageError', error });
      }
    }
    console.debug('[AuthDebug]', {
      op: 'AuthService.clearAuthFlowState.end',
      elapsedMs: Date.now() - startedAt
    });
  }

  getAuthFlowRoute(step: AuthFlowStep): string {
    if (step === 'confirmSignUp') return '/confirm-signup';
    if (step === 'resetPassword') return '/reset-password';
    if (step === 'newPasswordRequired') return '/force-change-password';
    return '/login';
  }

  async signUpUser(
    email: string,
    password: string,
    givenName?: string,
    familyName?: string
  ): Promise<AuthActionResult> {
    const startedAt = Date.now();
    console.debug('[AuthDebug]', {
      op: 'AuthService.signUpUser.start',
      email,
      hasGivenName: Boolean(givenName),
      hasFamilyName: Boolean(familyName)
    });
    try {
      const result = await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
            given_name: givenName || '',
            family_name: familyName || ''
          }
        }
      });
      console.debug('[AuthDebug]', { op: 'AuthService.signUpUser.result', result });

      if (!result.isSignUpComplete && result.nextStep?.signUpStep === 'CONFIRM_SIGN_UP') {
        this.setAuthFlowState({
          step: 'confirmSignUp',
          username: email,
          createdAt: Date.now(),
          nextStep: result.nextStep
        }, true);
        console.debug('[AuthDebug]', {
          op: 'AuthService.signUpUser.nextStep',
          nextStep: result.nextStep
        });
        return { nextStep: 'confirmSignUp' };
      }

      this.clearAuthFlowState();
      return {};
    } catch (error) {
      console.error('[AuthDebug]', {
        op: 'AuthService.signUpUser.error',
        email,
        error,
        elapsedMs: Date.now() - startedAt
      });
      throw error;
    } finally {
      console.debug('[AuthDebug]', {
        op: 'AuthService.signUpUser.end',
        email,
        elapsedMs: Date.now() - startedAt
      });
    }
  }

  async confirmSignUpUser(email: string, confirmationCode: string): Promise<void> {
    const startedAt = Date.now();
    console.debug('[AuthDebug]', { op: 'AuthService.confirmSignUpUser.start', email });
    try {
      await confirmSignUp({ username: email, confirmationCode });
      console.debug('[AuthDebug]', { op: 'AuthService.confirmSignUpUser.success', email });
      this.clearAuthFlowState();
    } catch (error) {
      console.error('[AuthDebug]', {
        op: 'AuthService.confirmSignUpUser.error',
        email,
        error,
        elapsedMs: Date.now() - startedAt
      });
      throw error;
    } finally {
      console.debug('[AuthDebug]', {
        op: 'AuthService.confirmSignUpUser.end',
        email,
        elapsedMs: Date.now() - startedAt
      });
    }
  }

  async resendSignUpCode(email: string): Promise<void> {
    const startedAt = Date.now();
    console.debug('[AuthDebug]', { op: 'AuthService.resendSignUpCode.start', email });
    try {
      await resendSignUpCode({ username: email });
      console.debug('[AuthDebug]', { op: 'AuthService.resendSignUpCode.success', email });
    } catch (error) {
      console.error('[AuthDebug]', {
        op: 'AuthService.resendSignUpCode.error',
        email,
        error,
        elapsedMs: Date.now() - startedAt
      });
      throw error;
    } finally {
      console.debug('[AuthDebug]', {
        op: 'AuthService.resendSignUpCode.end',
        email,
        elapsedMs: Date.now() - startedAt
      });
    }
  }

  async signInUser(email: string, password: string): Promise<AuthActionResult> {
    const startedAt = Date.now();
    console.debug('[AuthDebug]', { op: 'AuthService.signInUser.start', email });
    try {
      const result = await signIn({ username: email, password });
      console.debug('[AuthDebug]', { op: 'AuthService.signInUser.result', result });

      if (result.isSignedIn) {
        console.debug('[AuthDebug]', { op: 'AuthService.signInUser.signedIn', email });
        await this.checkAuthState(false, true);
        this.clearAuthFlowState();
        return {};
      }

      if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        this.setAuthFlowState({
          step: 'newPasswordRequired',
          username: email,
          createdAt: Date.now(),
          nextStep: result.nextStep
        }, false);
        console.debug('[AuthDebug]', {
          op: 'AuthService.signInUser.nextStep',
          nextStep: result.nextStep
        });
        return { nextStep: 'newPasswordRequired' };
      }

      if (result.nextStep?.signInStep === 'RESET_PASSWORD') {
        const resetResult = await resetPassword({ username: email });
        console.debug('[AuthDebug]', { op: 'AuthService.signInUser.resetPasswordResult', result: resetResult });
        if (resetResult.nextStep?.resetPasswordStep === 'CONFIRM_RESET_PASSWORD_WITH_CODE') {
          this.setAuthFlowState({
            step: 'resetPassword',
            username: email,
            createdAt: Date.now(),
            nextStep: resetResult.nextStep
          }, true);
          console.debug('[AuthDebug]', {
            op: 'AuthService.signInUser.nextStep',
            nextStep: resetResult.nextStep
          });
          return { nextStep: 'resetPassword' };
        }
        this.clearAuthFlowState();
        return {};
      }

      if (result.nextStep?.signInStep === 'CONFIRM_SIGN_UP') {
        this.setAuthFlowState({
          step: 'confirmSignUp',
          username: email,
          createdAt: Date.now(),
          nextStep: result.nextStep
        }, true);
        console.debug('[AuthDebug]', {
          op: 'AuthService.signInUser.nextStep',
          nextStep: result.nextStep
        });
        return { nextStep: 'confirmSignUp' };
      }

      console.debug('[AuthDebug]', {
        op: 'AuthService.signInUser.unhandledNextStep',
        nextStep: result.nextStep
      });
    } catch (error: any) {
      console.error('[AuthDebug]', {
        op: 'AuthService.signInUser.error',
        email,
        error,
        errorName: error?.name,
        elapsedMs: Date.now() - startedAt
      });
      const errorName = error?.name || error?.code || error?.__type;
      const errorMessage = typeof error?.message === 'string' ? error.message : '';
      if (
        errorName === 'SignedInUserAlreadyAuthenticatedException' ||
        errorMessage.includes('There is already a signed in user')
      ) {
        console.debug('[AuthDebug]', {
          op: 'AuthService.signInUser.alreadySignedIn',
          email
        });
        await this.checkAuthState(false, true);
        this.clearAuthFlowState();
        return {};
      }
      if (error?.name === 'UserNotConfirmedException') {
        this.setAuthFlowState({
          step: 'confirmSignUp',
          username: email,
          createdAt: Date.now()
        }, true);
        return { nextStep: 'confirmSignUp' };
      }
      if (error?.name === 'PasswordResetRequiredException') {
        const resetResult = await resetPassword({ username: email });
        if (resetResult.nextStep?.resetPasswordStep === 'CONFIRM_RESET_PASSWORD_WITH_CODE') {
          this.setAuthFlowState({
            step: 'resetPassword',
            username: email,
            createdAt: Date.now(),
            nextStep: resetResult.nextStep
          }, true);
          return { nextStep: 'resetPassword' };
        }
        this.clearAuthFlowState();
        return {};
      }
      throw error;
    } finally {
      console.debug('[AuthDebug]', {
        op: 'AuthService.signInUser.end',
        email,
        elapsedMs: Date.now() - startedAt
      });
    }

    throw new Error('Paso de inicio de sesión no soportado.');
  }

  async confirmNewPassword(newPassword: string, userAttributes?: Record<string, string>): Promise<AuthActionResult> {
    const startedAt = Date.now();
    console.debug('[AuthDebug]', {
      op: 'AuthService.confirmNewPassword.start',
      hasUserAttributes: Boolean(userAttributes && Object.keys(userAttributes).length > 0)
    });
    const options = userAttributes && Object.keys(userAttributes).length > 0
      ? { userAttributes }
      : undefined;
    try {
      const result = await confirmSignIn({ challengeResponse: newPassword, options });
      console.debug('[AuthDebug]', { op: 'AuthService.confirmNewPassword.result', result });

      if (result.isSignedIn) {
        console.debug('[AuthDebug]', { op: 'AuthService.confirmNewPassword.signedIn' });
        await this.checkAuthState(false, true);
        this.clearAuthFlowState();
        return {};
      }

      if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        console.debug('[AuthDebug]', {
          op: 'AuthService.confirmNewPassword.nextStep',
          nextStep: result.nextStep
        });
        return { nextStep: 'newPasswordRequired' };
      }

      console.debug('[AuthDebug]', {
        op: 'AuthService.confirmNewPassword.unhandledNextStep',
        nextStep: result.nextStep
      });
      throw new Error('No se pudo completar el cambio de contraseña.');
    } catch (error) {
      console.error('[AuthDebug]', {
        op: 'AuthService.confirmNewPassword.error',
        error,
        elapsedMs: Date.now() - startedAt
      });
      throw error;
    } finally {
      console.debug('[AuthDebug]', {
        op: 'AuthService.confirmNewPassword.end',
        elapsedMs: Date.now() - startedAt
      });
    }
  }

  async startResetPassword(email: string): Promise<AuthActionResult> {
    const startedAt = Date.now();
    console.debug('[AuthDebug]', { op: 'AuthService.startResetPassword.start', email });
    try {
      const result = await resetPassword({ username: email });
      console.debug('[AuthDebug]', { op: 'AuthService.startResetPassword.result', result });
      if (result.nextStep?.resetPasswordStep === 'CONFIRM_RESET_PASSWORD_WITH_CODE') {
        this.setAuthFlowState({
          step: 'resetPassword',
          username: email,
          createdAt: Date.now(),
          nextStep: result.nextStep
        }, true);
        console.debug('[AuthDebug]', {
          op: 'AuthService.startResetPassword.nextStep',
          nextStep: result.nextStep
        });
        return { nextStep: 'resetPassword' };
      }
      this.clearAuthFlowState();
      return {};
    } catch (error) {
      console.error('[AuthDebug]', {
        op: 'AuthService.startResetPassword.error',
        email,
        error,
        elapsedMs: Date.now() - startedAt
      });
      throw error;
    } finally {
      console.debug('[AuthDebug]', {
        op: 'AuthService.startResetPassword.end',
        email,
        elapsedMs: Date.now() - startedAt
      });
    }
  }

  async confirmResetPassword(email: string, confirmationCode: string, newPassword: string): Promise<void> {
    const startedAt = Date.now();
    console.debug('[AuthDebug]', { op: 'AuthService.confirmResetPassword.start', email });
    try {
      await confirmResetPassword({ username: email, confirmationCode, newPassword });
      console.debug('[AuthDebug]', { op: 'AuthService.confirmResetPassword.success', email });
      this.clearAuthFlowState();
    } catch (error) {
      console.error('[AuthDebug]', {
        op: 'AuthService.confirmResetPassword.error',
        email,
        error,
        elapsedMs: Date.now() - startedAt
      });
      throw error;
    } finally {
      console.debug('[AuthDebug]', {
        op: 'AuthService.confirmResetPassword.end',
        email,
        elapsedMs: Date.now() - startedAt
      });
    }
  }

  async checkAuthState(forceRefresh: boolean = false, bypassCache: boolean = false): Promise<void> {
    const startedAt = Date.now();
    console.debug('[AuthDebug]', {
      op: 'AuthService.checkAuthState.start',
      forceRefresh,
      bypassCache,
      initialized: this.initialized,
      isBrowser: this.isBrowser
    });
    if (this.initialized && !forceRefresh && !bypassCache) {
      console.debug('[AuthDebug]', { op: 'AuthService.checkAuthState.cacheHit' });
      console.debug('[AuthDebug]', {
        op: 'AuthService.checkAuthState.end',
        reason: 'cacheHit',
        elapsedMs: Date.now() - startedAt
      });
      return;
    }
    try {
      if (!this.isBrowser) {
        // SSR: we cannot deterministically resolve browser auth tokens.
        // Keep auth status as 'unknown' so the app can render a neutral splash
        // (never the login UI) until the browser resolves auth.
        console.debug('[AuthDebug]', { op: 'AuthService.checkAuthState.notBrowser' });
        return;
      }
      this.initialized = true;
      const session = await fetchAuthSession({ forceRefresh });
      const tokens = session?.tokens;
      console.debug('[AuthDebug]', {
        op: 'AuthService.checkAuthState.sessionLoaded',
        hasTokens: Boolean(tokens),
        hasIdToken: Boolean(tokens?.idToken),
        hasAccessToken: Boolean(tokens?.accessToken)
      });

      if (!tokens) {
        this.currentUserSubject.next(null);
        this.isAuthenticatedSubject.next(false);
        this.authStatusSubject.next('unauthenticated');
        console.debug('[AuthDebug]', {
          op: 'AuthService.checkAuthState.unauthenticated',
          elapsedMs: Date.now() - startedAt
        });
        return;
      }

      let user: any | null = null;
      try {
        user = await getCurrentUser();
      } catch (error) {
        console.warn('Unable to load current user; falling back to token payload.', error);
        console.debug('[AuthDebug]', {
          op: 'AuthService.checkAuthState.getCurrentUserError',
          error
        });
      }

      const userProfile = await this.buildUserProfile(user, session);
      this.currentUserSubject.next(userProfile);
      this.isAuthenticatedSubject.next(true);
      this.authStatusSubject.next('authenticated');
      this.clearAuthFlowState();
      console.debug('[AuthDebug]', {
        op: 'AuthService.checkAuthState.authenticated',
        userId: userProfile.id,
        role: userProfile.role,
        groups: userProfile.groups,
        elapsedMs: Date.now() - startedAt
      });
    } catch (error) {
      console.error('[AuthDebug]', {
        op: 'AuthService.checkAuthState.error',
        error,
        elapsedMs: Date.now() - startedAt
      });
      this.currentUserSubject.next(null);
      this.isAuthenticatedSubject.next(false);
      if (this.isBrowser) {
        this.authStatusSubject.next('unauthenticated');
      }
    } finally {
      this.authLoadingSubject.next(false);
      console.debug('[AuthDebug]', {
        op: 'AuthService.checkAuthState.end',
        elapsedMs: Date.now() - startedAt
      });
    }
  }

  private async buildUserProfile(user: any | null, session: any): Promise<UserProfile> {
    const startedAt = Date.now();
    console.debug('[AuthDebug]', { op: 'AuthService.buildUserProfile.start' });
    try {
      const idToken = session.tokens?.idToken;
      const accessToken = session.tokens?.accessToken;
      const idPayload = idToken?.payload || {};
      const accessPayload = accessToken?.payload || {};

      // Extract role from Cognito groups (check both tokens)
      const role = this.extractUserRole(idPayload, accessPayload);

      // Extract groups from cognito:groups claim
      const groups = this.extractGroups(idPayload, accessPayload);

      // Prefer ID token for profile fields; fallback to access token
      const email = idPayload.email || accessPayload.email || user?.username || '';
      const givenName = idPayload.given_name || accessPayload.given_name;
      const familyName = idPayload.family_name || accessPayload.family_name;
      const companyId = idPayload['custom:companyId'] || accessPayload['custom:companyId'];
      const trainerIdsRaw = idPayload['custom:trainerIds'] || accessPayload['custom:trainerIds'];

      const profile: UserProfile = {
        id: user?.userId || idPayload.sub || accessPayload.sub || user?.username || '',
        email,
        givenName,
        familyName,
        role,
        groups,
        companyId,
        trainerIds: typeof trainerIdsRaw === 'string' ? trainerIdsRaw.split(',') : undefined,
        isActive: true
      };
      console.debug('[AuthDebug]', {
        op: 'AuthService.buildUserProfile.complete',
        userId: profile.id,
        role: profile.role,
        groups: profile.groups
      });
      return profile;
    } catch (error) {
      console.error('[AuthDebug]', {
        op: 'AuthService.buildUserProfile.error',
        error,
        elapsedMs: Date.now() - startedAt
      });
      throw error;
    } finally {
      console.debug('[AuthDebug]', {
        op: 'AuthService.buildUserProfile.end',
        elapsedMs: Date.now() - startedAt
      });
    }
  }

  private extractGroups(idPayload: any, accessPayload: any): string[] {
    const groupsClaim = idPayload?.['cognito:groups'] || accessPayload?.['cognito:groups'];
    
    if (!groupsClaim) {
      return [];
    }
    
    // Handle both array and string formats
    if (Array.isArray(groupsClaim)) {
      return groupsClaim;
    }
    
    if (typeof groupsClaim === 'string') {
      return groupsClaim.split(',').map(g => g.trim()).filter(g => g.length > 0);
    }
    
    return [];
  }

  private extractUserRole(idPayload: any, accessPayload: any): UserRole {
    const groups = this.extractGroups(idPayload, accessPayload);
    if (groups.includes('Admin')) return UserRole.ADMIN;
    if (groups.includes('Trainer')) return UserRole.TRAINER;

    // Default to CLIENT
    return UserRole.CLIENT;
  }

  getCurrentUser(): UserProfile | null {
    return this.currentUserSubject.value;
  }

  // Synchronous read for guards/auth-flow logic to avoid flicker
  isAuthenticatedSync(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  /**
   * Purpose: check if current user is in a specific Cognito group.
   * Input: groupName (string). Output: boolean.
   * Error handling: returns false when user or groups are missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private hasGroup(groupName: string): boolean {
    const groups = this.currentUserSubject.value?.groups ?? [];
    return groups.includes(groupName);
  }

  hasPlannerGroups(): boolean {
    return this.hasGroup('Admin') || this.hasGroup('Trainer');
  }

  getCurrentUserId(): string | null {
    return this.currentUserSubject.value?.id || null;
  }

  getCurrentUserRole(): UserRole | null {
    return this.currentUserSubject.value?.role || null;
  }

  getCurrentCompanyId(): string | null {
    return this.currentUserSubject.value?.companyId || null;
  }

  /**
   * Purpose: determine whether current user has only the Client group.
   * Input: none. Output: boolean.
   * Error handling: returns false when user or groups are missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  isClientOnly(): boolean {
    return this.hasGroup('Client') && !this.hasPlannerGroups();
  }

  /**
   * Purpose: validate required roles using Cognito groups as source of truth.
   * Input: roles (UserRole[]). Output: boolean.
   * Error handling: returns false when roles are missing or user lacks groups.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  hasRequiredRoles(roles: UserRole[] = []): boolean {
    if (!roles || roles.length === 0) return false;
    return roles.some(role => {
      if (role === UserRole.ADMIN) return this.hasGroup('Admin');
      if (role === UserRole.TRAINER) return this.hasGroup('Trainer');
      if (role === UserRole.CLIENT) return this.hasGroup('Client');
      return false;
    });
  }

  isAdmin(): boolean {
    return this.hasGroup('Admin');
  }

  isTrainer(): boolean {
    return this.hasGroup('Trainer');
  }

  isClient(): boolean {
    return this.hasGroup('Client');
  }

  /**
   * Purpose: expose independent tenant detection for UI and guards.
   * Input: none. Output: boolean.
   * Error handling: treats missing companyId as INDEPENDENT fallback.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  isIndependentTenant(): boolean {
    return isIndependentTenant(this.getCurrentCompanyId());
  }

  canAccessUserData(targetUserId: string): boolean {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return false;

    // Admin can access all data within their organization
    if (currentUser.role === UserRole.ADMIN) return true;

    // Users can access their own data
    if (currentUser.id === targetUserId) return true;

    // Trainers can access client data - actual authorization is validated server-side
    // Frontend allows trainers to attempt access; backend validates gym/client relationship
    if (currentUser.role === UserRole.TRAINER) {
      return true;
    }

    return false;
  }

  async signOut(): Promise<void> {
    const startedAt = Date.now();
    console.debug('[AuthDebug]', { op: 'AuthService.signOut.start', isBrowser: this.isBrowser });
    try {
      if (!this.isBrowser) { return; }
      await signOut();
      this.currentUserSubject.next(null);
      this.isAuthenticatedSubject.next(false);
      this.authStatusSubject.next('unauthenticated');
      this.clearAuthFlowState();
      console.debug('[AuthDebug]', { op: 'AuthService.signOut.success' });
    } catch (error) {
      console.error('[AuthDebug]', {
        op: 'AuthService.signOut.error',
        error,
        elapsedMs: Date.now() - startedAt
      });
      throw error;
    } finally {
      console.debug('[AuthDebug]', {
        op: 'AuthService.signOut.end',
        elapsedMs: Date.now() - startedAt
      });
    }
  }

  // Utility method to get auth session for API calls
  getAuthSession(forceRefresh: boolean = false): Observable<any> {
    if (!this.isBrowser) {
      console.debug('[AuthDebug]', { op: 'AuthService.getAuthSession.notBrowser' });
      return of(null);
    }
    const startedAt = Date.now();
    console.debug('[AuthDebug]', { op: 'AuthService.getAuthSession.start', forceRefresh });
    return from(fetchAuthSession({ forceRefresh })).pipe(
      tap(session => {
        console.debug('[AuthDebug]', {
          op: 'AuthService.getAuthSession.success',
          hasTokens: Boolean(session?.tokens),
          hasIdToken: Boolean(session?.tokens?.idToken),
          hasAccessToken: Boolean(session?.tokens?.accessToken)
        });
      }),
      catchError(error => {
        console.error('[AuthDebug]', { op: 'AuthService.getAuthSession.error', error });
        return of(null);
      }),
      finalize(() => {
        console.debug('[AuthDebug]', {
          op: 'AuthService.getAuthSession.end',
          elapsedMs: Date.now() - startedAt
        });
      })
    );
  }

  // Get JWT token for API authentication
  getIdToken(): Observable<string | null> {
    return this.getAuthSession().pipe(
      map(session => session?.tokens?.idToken?.toString() || null)
    );
  }

  getAccessToken(): Observable<string | null> {
    return this.getAuthSession().pipe(
      map(session => session?.tokens?.accessToken?.toString() || null)
    );
  }

  private setAuthFlowState(state: AuthFlowState, persist: boolean): void {
    console.debug('[AuthDebug]', {
      op: 'AuthService.setAuthFlowState.start',
      step: state.step,
      username: state.username,
      persist
    });
    this.authFlowSubject.next(state);
    if (!this.isBrowser) {
      console.debug('[AuthDebug]', { op: 'AuthService.setAuthFlowState.end', reason: 'notBrowser' });
      return;
    }
    if (!persist || !this.PERSISTED_FLOW_STEPS.includes(state.step)) {
      try {
        sessionStorage.removeItem(this.AUTH_FLOW_STORAGE_KEY);
        console.debug('[AuthDebug]', { op: 'AuthService.setAuthFlowState.storageCleared' });
      } catch (error) {
        console.debug('[AuthDebug]', { op: 'AuthService.setAuthFlowState.storageClearError', error });
      }
      console.debug('[AuthDebug]', { op: 'AuthService.setAuthFlowState.end', reason: 'notPersisted' });
      return;
    }
    try {
      sessionStorage.setItem(this.AUTH_FLOW_STORAGE_KEY, JSON.stringify(state));
      console.debug('[AuthDebug]', { op: 'AuthService.setAuthFlowState.storageSaved' });
    } catch (error) {
      console.debug('[AuthDebug]', { op: 'AuthService.setAuthFlowState.storageSaveError', error });
    }
    console.debug('[AuthDebug]', { op: 'AuthService.setAuthFlowState.end', reason: 'persisted' });
  }

  private restoreAuthFlowState(): void {
    const startedAt = Date.now();
    console.debug('[AuthDebug]', { op: 'AuthService.restoreAuthFlowState.start' });
    try {
      const stored = sessionStorage.getItem(this.AUTH_FLOW_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as AuthFlowState;
      if (!parsed?.step || !parsed?.username) return;
      if (!this.PERSISTED_FLOW_STEPS.includes(parsed.step)) return;
      this.authFlowSubject.next(parsed);
      console.debug('[AuthDebug]', {
        op: 'AuthService.restoreAuthFlowState.loaded',
        step: parsed.step,
        username: parsed.username
      });
    } catch (error) {
      // Ignore invalid storage
      console.debug('[AuthDebug]', { op: 'AuthService.restoreAuthFlowState.error', error });
    } finally {
      console.debug('[AuthDebug]', {
        op: 'AuthService.restoreAuthFlowState.end',
        elapsedMs: Date.now() - startedAt
      });
    }
  }
}
