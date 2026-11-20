import { inject } from '@angular/core';
import type { HttpInterceptorFn } from '@angular/common/http';
import { from, switchMap } from 'rxjs';

import { StorageService } from '../services/storage.service';

/**
 * Interceptor HTTP funcional que inyecta automáticamente el token JWT
 * en la cabecera 'Authorization: Bearer <token>' para todas las llamadas
 * salientes a servicios web protegidos.
 */
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const storage = inject(StorageService);

  // Si la petición ya incluye cabecera Authorization explícita, se respeta
  if (req.headers.has('Authorization')) {
    return next(req);
  }

  // Obtener el token de Capacitor Preferences de forma reactiva
  return from(storage.get<string>('taskflow_auth_token')).pipe(
    switchMap((token) => {
      if (token && typeof token === 'string' && token.trim() !== '') {
        const cloned = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token.trim()}`,
          },
        });
        return next(cloned);
      }
      return next(req);
    }),
  );
};
