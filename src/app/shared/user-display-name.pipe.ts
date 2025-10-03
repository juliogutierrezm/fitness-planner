import { Pipe, PipeTransform } from '@angular/core';

interface AppUser {
  id?: string;
  email: string;
  givenName?: string;
  familyName?: string;
  role: 'client' | 'trainer' | 'admin';
  companyId?: string;
  trainerId?: string;
  createdAt?: string;
}

@Pipe({
  name: 'userDisplayName',
  standalone: true,
  pure: true
})
export class UserDisplayNamePipe implements PipeTransform {

  transform(user: AppUser | null | undefined): string {
    if (!user) {
      return 'Usuario';
    }

    // Use the same logic as in users.component.html: {{ u.givenName || '' }} {{ u.familyName || '' }}
    const givenName = user.givenName || '';
    const familyName = user.familyName || '';
    const displayName = `${givenName} ${familyName}`.trim();

    // If we have a non-empty display name, return it
    if (displayName) {
      return displayName;
    }

    // Fallback to email username (same as in users list)
    const emailUsername = user.email?.split('@')[0];
    return emailUsername || 'Usuario';
  }
}