import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Si la verificación inicial aún no termina, esperamos brevemente
  if (!authService.isReady()) {
    await authService.initializeAuth();
  }

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.parseUrl('/login');
};
