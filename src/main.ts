import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent }        from './app/app.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, {
  ...appConfig,
  providers: [
    provideHttpClient(withInterceptorsFromDi()),
    ...appConfig.providers ?? []
  ]
})
.catch(err => console.error(err));
