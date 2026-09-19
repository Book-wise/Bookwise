import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '@services/auth.service';

/** Extracts the raw token from a `Bearer <token>` Authorization header. */
function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && value ? value : null;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // The backend ROTATES the token on every switch and revokes the old
        // one, so an in-flight request can still be carrying a token that was
        // already replaced — by this tab's own switch or by another tab.
        // Compare the token the request actually used against the PERSISTED
        // token, never the in-memory signal: with two tabs open, tab B's signal
        // still holds the old token while `localStorage` already holds the new
        // one, and comparing against the signal would log the user out.
        const requestToken = bearerToken(req.headers.get('Authorization'));
        const persistedToken = authService.getStoredToken();
        const isStaleToken =
          requestToken !== null && persistedToken !== null && requestToken !== persistedToken;

        if (isStaleToken) {
          // Recover instead of logging out: adopt the persisted (rotated) token
          // so subsequent requests use it. The failed request is not retried.
          authService.syncTokenFromStorage();
        } else {
          authService.logout();
        }
      }
      return throwError(() => error);
    })
  );
};
