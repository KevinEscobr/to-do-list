import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { AuthService } from './auth.service';
import { StorageService } from './storage.service';

describe('AuthService (Autenticación y Gestión Multi-Usuario)', () => {
  let service: AuthService;
  let mockStorage: any;
  let storedData: Record<string, any>;

  beforeEach(() => {
    storedData = {};
    mockStorage = {
      get: vi.fn(async (key: string) => storedData[key] ?? null),
      set: vi.fn(async (key: string, value: any) => {
        storedData[key] = value;
      }),
      remove: vi.fn(async (key: string) => {
        delete storedData[key];
      }),
    };

    TestBed.configureTestingModule({
      providers: [AuthService, { provide: StorageService, useValue: mockStorage }],
    });

    service = TestBed.inject(AuthService);
  });

  it('debe crearse correctamente', () => {
    expect(service).toBeTruthy();
  });

  it('debe registrar un nuevo usuario y auto-iniciar sesión', async () => {
    const user = await service.register('juanito', 'juan@test.com', 'Juan Perez', 'password123');

    expect(user).toBeDefined();
    expect(user.username).toBe('juanito');
    expect(user.email).toBe('juan@test.com');
    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentUser()?.username).toBe('juanito');
  });

  it('debe rechazar registro con correo o usuario duplicado', async () => {
    await service.register('usuario1', 'correo@test.com', 'Usuario Uno', 'pass1');

    await expect(service.register('usuario1', 'otro@test.com', 'Usuario Dos', 'pass2')).rejects.toThrow(
      'Ya existe una cuenta registrada',
    );
  });

  it('debe permitir iniciar sesión con credenciales válidas', async () => {
    await service.register('marcelo', 'marcelo@test.com', 'Marcelo Rios', 'secreto1');
    await service.logout();
    expect(service.isAuthenticated()).toBe(false);

    const loggedIn = await service.login('marcelo', 'secreto1');
    expect(loggedIn.username).toBe('marcelo');
    expect(service.isAuthenticated()).toBe(true);
  });

  it('debe rechazar inicio de sesión con contraseña errónea', async () => {
    await service.register('carlos', 'carlos@test.com', 'Carlos V', 'correcta');

    await expect(service.login('carlos', 'incorrecta')).rejects.toThrow('Contraseña incorrecta');
  });

  it('debe cerrar sesión correctamente', async () => {
    await service.register('testuser', 'test@test.com', 'Test User', 'pass123');
    expect(service.isAuthenticated()).toBe(true);

    await service.logout();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
  });
});
