import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Amplify } from 'aws-amplify';
import { fetchAuthSession, signOut, getCurrentUser, signInWithRedirect } from 'aws-amplify/auth';
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

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<UserProfile | null>(null);
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private readonly isBrowser: boolean;
  private initialized = false;
  
  public currentUser$ = this.currentUserSubject.asObservable();
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  async signInWithRedirect(): Promise<void> {
    try {
      if (!this.isBrowser || typeof window === 'undefined') {
        console.warn('signInWithRedirect called on server; ignoring.');
        return;
      }
      await signInWithRedirect();
    } catch (error) {
      console.error('Error signing in with redirect:', error);
    }
  }

  async checkAuthState(forceRefresh: boolean = false): Promise<void> {
    if (this.initialized && !forceRefresh) return;
    this.initialized = true;
    try {
      if (!this.isBrowser) { return; }
      const session = await fetchAuthSession({ forceRefresh });
      const tokens = session?.tokens;

      if (!tokens) {
        this.currentUserSubject.next(null);
        this.isAuthenticatedSubject.next(false);
        return;
      }

      let user: any | null = null;
      try {
        user = await getCurrentUser();
      } catch (error) {
        console.warn('Unable to load current user; falling back to token payload.', error);
      }

      const userProfile = await this.buildUserProfile(user, session);
      this.currentUserSubject.next(userProfile);
      this.isAuthenticatedSubject.next(true);
    } catch (error) {
      console.log('User not authenticated:', error);
      this.currentUserSubject.next(null);
      this.isAuthenticatedSubject.next(false);
    }
  }

  private async buildUserProfile(user: any | null, session: any): Promise<UserProfile> {
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

    return {
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

  // Synchronous read for guards/callback logic to avoid flicker
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

    // Admin can access all data
    if (currentUser.role === UserRole.ADMIN) return true;

    // Users can access their own data
    if (currentUser.id === targetUserId) return true;

    // Trainers can access their clients' data
    if (currentUser.role === UserRole.TRAINER && 
        currentUser.trainerIds?.includes(targetUserId)) {
      return true;
    }

    return false;
  }

  async signOut(): Promise<void> {
    try {
      if (!this.isBrowser) { return; }
      await signOut();
      this.currentUserSubject.next(null);
      this.isAuthenticatedSubject.next(false);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  // Utility method to get auth session for API calls
  getAuthSession(forceRefresh: boolean = false): Observable<any> {
    if (!this.isBrowser) {
      return of(null);
    }
    return from(fetchAuthSession({ forceRefresh })).pipe(
      catchError(error => {
        console.error('Error getting auth session:', error);
        return of(null);
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
}
