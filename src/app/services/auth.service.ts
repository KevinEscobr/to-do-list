import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal, computed } from '@angular/core';

import { environment } from '../../environments/environment';
import type { User, StoredUserAccount } from '../models/user.model';

import { BackendApiService } from './backend-api.service';
import { StorageService } from './storage.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private backendApi = inject(BackendApiService);
  private storage = inject(StorageService);

  private readonly USERS_STORAGE_KEY = 'taskflow_registered_users';
  private readonly CURRENT_USER_KEY = 'taskflow_current_user_session';
  private readonly TOKEN_STORAGE_KEY = 'taskflow_auth_token';

  private readonly API_URL = environment.apiUrl;

  // Señal reactiva para el usuario autenticado
  private currentUserSignal = signal<User | null>(null);

  public currentUser = this.currentUserSignal.asReadonly();
  public isAuthenticated = computed(() => this.currentUserSignal() !== null);
  public currentUserId = computed(() => this.currentUserSignal()?.id || '');

  // Señal que indica si la sesión ya fue verificada al iniciar la app
  public isReady = signal<boolean>(false);

  constructor() {
    this.initializeAuth();
  }

  /**
   * Inicializa la autenticación cargando la sesión activa almacenada y verificando la validez del JWT.
   */
  async initializeAuth(): Promise<void> {
    try {
      const savedSession = await this.storage.get<User>(this.CURRENT_USER_KEY);
      const token = await this.storage.get<string>(this.TOKEN_STORAGE_KEY);
      if (savedSession) {
        if (token && this.isTokenExpired(token)) {
          console.warn('[AuthService] El token JWT ha expirado. Limpiando sesión...');
          await this.logout();
        } else {
          this.currentUserSignal.set(savedSession);
        }
      }
    } catch (err) {
      console.error('[AuthService] Error al inicializar autenticación:', err);
    } finally {
      this.isReady.set(true);
    }
  }

  /**
   * Registra un nuevo usuario en el sistema (servidor remoto o local).
   */
  async register(username: string, email: string, name: string, password: string): Promise<User> {
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim() || cleanUsername;
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanEmail || !cleanPassword) {
      throw new Error('Todos los campos son obligatorios.');
    }

    // 1. Intentar registrar en el backend remoto (nube o LAN)
    try {
      const res = await this.backendApi.post<{
        message: string;
        token: string;
        user: { id: string; username: string; email: string; name: string; createdAt?: number };
      }>('auth/register', {
        username: cleanUsername,
        email: cleanEmail,
        name: cleanName,
        password: cleanPassword,
      });

      if (res && res.user) {
        if (res.token) {
          await this.storage.set(this.TOKEN_STORAGE_KEY, res.token);
        }
        const fullUser: User = {
          id: String(res.user.id),
          username: res.user.username,
          email: res.user.email,
          name: res.user.name,
          avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`,
          createdAt: Number(res.user.createdAt) || Date.now(),
        };
        await this.setSession(fullUser);
        await this.cacheUserLocally(fullUser, cleanPassword);
        return fullUser;
      }
    } catch (err: any) {
      console.warn('[AuthService] Error al registrar en servidor remoto:', err);
      if (err?.status === 409 || err?.status === 400) {
        const backendMsg =
          err?.data?.error || err?.message || 'Ya existe una cuenta registrada con ese usuario o correo.';
        throw new Error(backendMsg, { cause: err });
      }
    }

    // 2. Fallback offline local
    const users = await this.getAllStoredUsers();
    if (users.some((u) => u.username === cleanUsername || u.email === cleanEmail)) {
      throw new Error('Ya existe una cuenta registrada con ese usuario o correo.');
    }

    const passwordHash = await this.hashPassword(cleanPassword);
    const newUser: StoredUserAccount = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      username: cleanUsername,
      email: cleanEmail,
      name: cleanName,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`,
      createdAt: Date.now(),
      passwordHash,
    };

    users.push(newUser);
    await this.storage.set(this.USERS_STORAGE_KEY, users);

    const sessionUser: User = {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      name: newUser.name,
      avatarUrl: newUser.avatarUrl,
      createdAt: newUser.createdAt,
    };

    await this.setSession(sessionUser);
    return sessionUser;
  }

  /**
   * Inicia sesión con usuario/correo y contraseña contra la BD del servidor o local.
   */
  async login(identifier: string, password: string): Promise<User> {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanId || !cleanPassword) {
      throw new Error('Debes ingresar usuario/correo y contraseña.');
    }

    // 1. Resolver si el identificador es un correo electrónico conocido localmente
    const localUsers = await this.getAllStoredUsers();
    const matchedByEmail = localUsers.find((u) => u.email === cleanId);
    const usernameToSend = matchedByEmail ? matchedByEmail.username : cleanId;

    // 2. Intentar autenticar contra el servidor backend (MySQL)
    try {
      // Intentar primero con el username resuelto (o el que ingresó el usuario)
      let res: any = null;
      try {
        res = await this.backendApi.post<{
          message: string;
          token: string;
          user: { id: string; username: string; email: string; name: string; createdAt?: number };
        }>('auth/login', { username: usernameToSend, password: cleanPassword });
      } catch (firstErr: any) {
        // Si falló y el usuario ingresó un email diferente a usernameToSend, intentar con cleanId
        if (usernameToSend !== cleanId && firstErr?.status === 401) {
          res = await this.backendApi.post<{
            message: string;
            token: string;
            user: { id: string; username: string; email: string; name: string; createdAt?: number };
          }>('auth/login', { username: cleanId, password: cleanPassword });
        } else {
          throw firstErr;
        }
      }

      if (res && res.user && res.token) {
        await this.storage.set(this.TOKEN_STORAGE_KEY, res.token);
        const fullUser: User = {
          id: String(res.user.id),
          username: res.user.username,
          email: res.user.email,
          name: res.user.name || res.user.username,
          avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${res.user.username}`,
          createdAt: Number(res.user.createdAt) || Date.now(),
        };
        await this.setSession(fullUser);
        await this.cacheUserLocally(fullUser, cleanPassword);
        return fullUser;
      }
    } catch (err: any) {
      console.warn('[AuthService] Error al conectar con servidor de autenticación:', err);

      // Si el servidor rechazó o no tiene al usuario, verificar si existe en la cuenta local
      const userFound = localUsers.find(
        (u) => u.username === cleanId || u.email === cleanId || u.username === usernameToSend,
      );

      if (userFound) {
        const hashToCheck = await this.hashPassword(cleanPassword);
        if (userFound.passwordHash === hashToCheck) {
          // Sesión válida en caché local
          const sessionUser: User = {
            id: userFound.id,
            username: userFound.username,
            email: userFound.email,
            name: userFound.name,
            avatarUrl: userFound.avatarUrl,
            createdAt: userFound.createdAt,
          };
          await this.setSession(sessionUser);

          // Intentar auto-registrar al usuario en MySQL en segundo plano si aún no existe en el servidor
          this.backendApi
            .post('auth/register', {
              username: userFound.username,
              email: userFound.email,
              name: userFound.name,
              password: cleanPassword,
            })
            .then(async (regRes: any) => {
              if (regRes?.token) {
                await this.storage.set(this.TOKEN_STORAGE_KEY, regRes.token);
              }
            })
            .catch(() => {});

          return sessionUser;
        } else {
          throw new Error('Contraseña incorrecta. Inténtalo de nuevo.');
        }
      }

      if (err?.status === 401 || err?.status === 400) {
        const backendMsg =
          err?.data?.error ||
          err?.message ||
          'Usuario o contraseña incorrectos. Si creaste la cuenta con nombre de usuario, prueba ingresando tu usuario en vez del correo.';
        throw new Error(backendMsg, { cause: err });
      }

      throw new Error(
        err?.data?.error ||
          err?.message ||
          'No se pudo conectar con la base de datos del servidor ni se encontró una sesión local válida.',
        { cause: err },
      );
    }

    throw new Error('Credenciales incorrectas. Verifica tus datos de acceso.');
  }

  /**
   * Cierra la sesión activa actual.
   */
  async logout(): Promise<void> {
    await this.storage.remove(this.CURRENT_USER_KEY);
    await this.storage.remove(this.TOKEN_STORAGE_KEY);
    this.currentUserSignal.set(null);
  }

  /**
   * Obtiene el token JWT actual para llamadas autenticadas a la API.
   */
  public async getToken(): Promise<string | null> {
    return this.storage.get<string>(this.TOKEN_STORAGE_KEY);
  }

  /**
   * Decodifica y verifica si un token JWT está expirado.
   */
  public isTokenExpired(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payloadJson = decodeURIComponent(
        atob(payloadBase64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      );
      const payload = JSON.parse(payloadJson);
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        return true;
      }
      return false;
    } catch {
      return true;
    }
  }

  /**
   * Obtiene los datos decodificados del token JWT activo.
   */
  public async getDecodedToken(): Promise<any | null> {
    const token = await this.getToken();
    if (!token) return null;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payloadJson = decodeURIComponent(
        atob(payloadBase64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      );
      return JSON.parse(payloadJson);
    } catch {
      return null;
    }
  }

  /**
   * Obtiene la lista de todos los usuarios registrados (sin contraseñas).
   */
  async getUsersList(): Promise<User[]> {
    const stored = await this.getAllStoredUsers();
    return stored.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      name: u.name,
      avatarUrl: u.avatarUrl,
      createdAt: u.createdAt,
    }));
  }

  private async setSession(user: User): Promise<void> {
    await this.storage.set(this.CURRENT_USER_KEY, user);
    this.currentUserSignal.set(user);
  }

  private async cacheUserLocally(user: User, password: string): Promise<void> {
    const users = await this.getAllStoredUsers();
    const passwordHash = await this.hashPassword(password);
    const existingIdx = users.findIndex((u) => u.username === user.username || u.email === user.email);
    const account: StoredUserAccount = {
      ...user,
      passwordHash,
    };
    if (existingIdx >= 0) {
      users[existingIdx] = account;
    } else {
      users.push(account);
    }
    await this.storage.set(this.USERS_STORAGE_KEY, users);
  }

  private async getAllStoredUsers(): Promise<StoredUserAccount[]> {
    const users = await this.storage.get<StoredUserAccount[]>(this.USERS_STORAGE_KEY);
    return Array.isArray(users) ? users : [];
  }

  private async hashPassword(password: string): Promise<string> {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const msgUint8 = new TextEncoder().encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `hash_${Math.abs(hash)}`;
  }
}
