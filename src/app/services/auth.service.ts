import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { Amplify } from 'aws-amplify';
import { fetchAuthSession, signOut, getCurrentUser, signInWithRedirect } from 'aws-amplify/auth';
import { awsExports } from '../../aws-exports';
import { isIndependentTenant } from '../shared/shared-utils';

// Configure Amplify
Amplify.configure(awsExports);

export interface UserProfile {
  id: string;
  email: string;
  givenName?: string;
  familyName?: string;
  role: UserRole;
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

  public currentUser$ = this.currentUserSubject.asObservable();
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    if (this.isBrowser) {
      this.checkAuthState();
    }
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

  async checkAuthState(): Promise<void> {
    try {
      if (!this.isBrowser) { return; }
      const user = await getCurrentUser();
      const session = await fetchAuthSession();
      
      if (user && session.tokens) {
        const userProfile = await this.buildUserProfile(user, session);
        this.currentUserSubject.next(userProfile);
        this.isAuthenticatedSubject.next(true);
      } else {
        this.currentUserSubject.next(null);
        this.isAuthenticatedSubject.next(false);
      }
    } catch (error) {
      console.log('User not authenticated:', error);
      this.currentUserSubject.next(null);
      this.isAuthenticatedSubject.next(false);
    }
  }

  private async buildUserProfile(user: any, session: any): Promise<UserProfile> {
    const idToken = session.tokens?.idToken;
    const accessToken = session.tokens?.accessToken;
    const idPayload = idToken?.payload || {};
    const accessPayload = accessToken?.payload || {};

    // Extract role from custom attributes or Cognito groups (check both tokens)
    const role = this.extractUserRole(idPayload, accessPayload);

    // Prefer ID token for profile fields; fallback to access token
    const email = idPayload.email || accessPayload.email || user.username;
    const givenName = idPayload.given_name || accessPayload.given_name;
    const familyName = idPayload.family_name || accessPayload.family_name;
    const companyId = idPayload['custom:companyId'] || accessPayload['custom:companyId'];
    const trainerIdsRaw = idPayload['custom:trainerIds'] || accessPayload['custom:trainerIds'];

    return {
      id: user.userId,
      email,
      givenName,
      familyName,
      role,
      companyId,
      trainerIds: typeof trainerIdsRaw === 'string' ? trainerIdsRaw.split(',') : undefined,
      isActive: true
    };
  }

  private extractUserRole(idPayload: any, accessPayload: any): UserRole {
    const norm = (v: any) => (typeof v === 'string' ? v.toLowerCase() : v);

    // 1) Custom role attribute on either token
    const customRole = norm(idPayload?.['custom:role'] || accessPayload?.['custom:role']);
    if (customRole === 'admin') return UserRole.ADMIN;
    if (customRole === 'trainer') return UserRole.TRAINER;

    // 2) Cognito groups claim on either token
    const groups = idPayload?.['cognito:groups'] || accessPayload?.['cognito:groups'];
    if (groups && Array.isArray(groups)) {
      if (groups.includes('Admin')) return UserRole.ADMIN;
      if (groups.includes('Trainer')) return UserRole.TRAINER;
    }

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

  getCurrentUserId(): string | null {
    return this.currentUserSubject.value?.id || null;
  }

  getCurrentUserRole(): UserRole | null {
    return this.currentUserSubject.value?.role || null;
  }

  getCurrentCompanyId(): string | null {
    return this.currentUserSubject.value?.companyId || null;
  }

  isAdmin(): boolean {
    return this.getCurrentUserRole() === UserRole.ADMIN;
  }

  isTrainer(): boolean {
    return this.getCurrentUserRole() === UserRole.TRAINER;
  }

  isClient(): boolean {
    return this.getCurrentUserRole() === UserRole.CLIENT;
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
  getAuthSession(): Observable<any> {
    if (!this.isBrowser) {
      return of(null);
    }
    return from(fetchAuthSession()).pipe(
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
}
