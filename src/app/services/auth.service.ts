import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { Amplify } from 'aws-amplify';
import { fetchAuthSession, signOut, getCurrentUser } from 'aws-amplify/auth';
import { awsExports } from '../../aws-exports';

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

  public currentUser$ = this.currentUserSubject.asObservable();
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor() {
    this.checkAuthState();
  }

  async checkAuthState(): Promise<void> {
    try {
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
    const payload = idToken?.payload;
    
    // Extract role from custom attributes or default to CLIENT
    const role = this.extractUserRole(payload);
    
    return {
      id: user.userId,
      email: payload?.email || user.username,
      givenName: payload?.given_name,
      familyName: payload?.family_name,
      role,
      companyId: payload?.['custom:companyId'],
      trainerIds: payload?.['custom:trainerIds']?.split(','),
      isActive: true
    };
  }

  private extractUserRole(payload: any): UserRole {
    // Check custom role attribute first
    const customRole = payload?.['custom:role'];
    if (customRole && Object.values(UserRole).includes(customRole)) {
      return customRole as UserRole;
    }

    // Check Cognito groups
    const groups = payload?.['cognito:groups'];
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