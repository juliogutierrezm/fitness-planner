import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { UserType } from './auth.service';

@Injectable({ providedIn: 'root' })
export class UserInitializationService {
  private base = `${environment.apiBase}/users/initialize`;

  constructor(private http: HttpClient) {}

  initializeUser(userType: UserType): Observable<any> {
    return this.http.post(this.base, { userType });
  }
}
