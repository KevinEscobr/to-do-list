import { Injectable, inject, signal } from '@angular/core';
import { CapacitorHttp } from '@capacitor/core';

import { environment } from '../../environments/environment';

import { StorageService } from './storage.service';

export interface HealthCheckResult {
  online: boolean;
  database: string;
  url: string;
  isLanFallback?: boolean;
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class BackendApiService {
  private storage = inject(StorageService);

  private readonly STORAGE_ACTIVE_URL_KEY = 'taskflow_active_backend_url';

  // URLs disponibles para conectarse a la API
  private readonly PRIMARY_URL = environment.apiUrl || 'https://todolist.nennge.me/api';
  private readonly FALLBACK_URL = environment.fallbackApiUrl || 'http://192.168.1.5:3000/api';

  // URL activa en uso
  private activeUrlSignal = signal<string>(environment.apiUrl || 'https://todolist.nennge.me/api');
  public activeUrl = this.activeUrlSignal.asReadonly();

  // Estado del servidor y base de datos
  public lastHealth = signal<HealthCheckResult>({
    online: false,
    database: 'Sin verificar',
    url: environment.apiUrl,
  });

  constructor() {
    this.restoreActiveUrl();
  }

  private async restoreActiveUrl(): Promise<void> {
    try {
      const saved = await this.storage.get<string>(this.STORAGE_ACTIVE_URL_KEY);
      if (saved && (saved.startsWith('http://') || saved.startsWith('https://'))) {
        this.activeUrlSignal.set(saved);
      }
    } catch {
      // Ignorar error al restaurar URL
    }
  }

  /**
   * Obtiene la URL base activa para las llamadas API.
   */
  getBaseUrl(): string {
    return this.activeUrlSignal();
  }

  /**
   * Establece manualmente o automáticamente una URL activa.
   */
  async setActiveUrl(url: string): Promise<void> {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    this.activeUrlSignal.set(cleanUrl);
    await this.storage.set(this.STORAGE_ACTIVE_URL_KEY, cleanUrl);
  }

  /**
   * Prueba una URL de salud específica.
   */
  private async pingUrl(baseUrl: string, timeoutMs = 6000): Promise<{ online: boolean; database: string }> {
    const cleanBase = baseUrl.trim().replace(/\/+$/, '');
    const healthUrl = `${cleanBase}/health`;

    try {
      const res = await CapacitorHttp.get({
        url: healthUrl,
        connectTimeout: timeoutMs,
        readTimeout: timeoutMs,
        headers: {
          Accept: 'application/json',
        },
      });

      if (res.status === 200 && res.data) {
        const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        if (data.status === 'ok') {
          return { online: true, database: data.database || 'MySQL 8.0 Conectado' };
        }
      }
      return { online: false, database: `HTTP ${res.status}` };
    } catch (err: any) {
      return { online: false, database: err.message || 'Error de conexión' };
    }
  }

  /**
   * Realiza un chequeo exhaustivo probando primero la URL de la nube y luego la LAN si falla.
   */
  async checkHealth(): Promise<HealthCheckResult> {
    const current = this.activeUrlSignal();
    const candidateUrls = [current, this.PRIMARY_URL, this.FALLBACK_URL].filter(
      (val, idx, arr) => arr.indexOf(val) === idx,
    );

    let lastError = 'No se pudo contactar el servidor';

    for (const url of candidateUrls) {
      const ping = await this.pingUrl(url, 5000);
      if (ping.online) {
        if (this.activeUrlSignal() !== url) {
          await this.setActiveUrl(url);
        }
        const isLan = url.includes('192.168.') || url.includes('localhost');
        const result: HealthCheckResult = {
          online: true,
          database: ping.database,
          url,
          isLanFallback: isLan,
        };
        this.lastHealth.set(result);
        return result;
      } else {
        lastError = ping.database;
      }
    }

    const failedResult: HealthCheckResult = {
      online: false,
      database: 'Servidor no responde',
      url: current,
      error: lastError,
    };
    this.lastHealth.set(failedResult);
    return failedResult;
  }

  /**
   * Prepara las cabeceras inyectando automáticamente el token JWT si está disponible en Preferences.
   */
  private async buildHeaders(customHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
    const headers = { ...customHeaders };
    if (!headers['Authorization']) {
      const token = await this.storage.get<string>('taskflow_auth_token');
      if (token && typeof token === 'string' && token.trim() !== '') {
        headers['Authorization'] = `Bearer ${token.trim()}`;
      }
    }
    return headers;
  }

  /**
   * Petición GET nativa / web.
   */
  async get<T>(path: string, headers: Record<string, string> = {}): Promise<T> {
    const baseUrl = this.getBaseUrl();
    const fullUrl = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    const requestHeaders = await this.buildHeaders(headers);

    const res = await CapacitorHttp.get({
      url: fullUrl,
      headers: {
        Accept: 'application/json',
        ...requestHeaders,
      },
      connectTimeout: 8000,
      readTimeout: 8000,
    });

    if (res.status >= 200 && res.status < 300) {
      return (typeof res.data === 'string' ? JSON.parse(res.data) : res.data) as T;
    }

    const errData = typeof res.data === 'string' ? JSON.parse(res.data || '{}') : res.data || {};
    const errorMsg = errData.error || errData.message || `Error HTTP ${res.status}`;
    const err: any = new Error(errorMsg);
    err.status = res.status;
    err.data = errData;
    throw err;
  }

  /**
   * Petición POST nativa / web.
   */
  async post<T>(path: string, body: any, headers: Record<string, string> = {}): Promise<T> {
    const baseUrl = this.getBaseUrl();
    const fullUrl = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    const requestHeaders = await this.buildHeaders(headers);

    const res = await CapacitorHttp.post({
      url: fullUrl,
      data: body,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...requestHeaders,
      },
      connectTimeout: 10000,
      readTimeout: 10000,
    });

    if (res.status >= 200 && res.status < 300) {
      return (typeof res.data === 'string' ? JSON.parse(res.data) : res.data) as T;
    }

    const errData = typeof res.data === 'string' ? JSON.parse(res.data || '{}') : res.data || {};
    const errorMsg = errData.error || errData.message || `Error HTTP ${res.status}`;
    const err: any = new Error(errorMsg);
    err.status = res.status;
    err.data = errData;
    throw err;
  }

  /**
   * Petición PUT nativa / web.
   */
  async put<T>(path: string, body: any, headers: Record<string, string> = {}): Promise<T> {
    const baseUrl = this.getBaseUrl();
    const fullUrl = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    const requestHeaders = await this.buildHeaders(headers);

    const res = await CapacitorHttp.put({
      url: fullUrl,
      data: body,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...requestHeaders,
      },
      connectTimeout: 10000,
      readTimeout: 10000,
    });

    if (res.status >= 200 && res.status < 300) {
      return (typeof res.data === 'string' ? JSON.parse(res.data) : res.data) as T;
    }

    const errData = typeof res.data === 'string' ? JSON.parse(res.data || '{}') : res.data || {};
    const errorMsg = errData.error || errData.message || `Error HTTP ${res.status}`;
    const err: any = new Error(errorMsg);
    err.status = res.status;
    err.data = errData;
    throw err;
  }

  /**
   * Petición DELETE nativa / web.
   */
  async delete<T>(path: string, headers: Record<string, string> = {}): Promise<T> {
    const baseUrl = this.getBaseUrl();
    const fullUrl = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    const requestHeaders = await this.buildHeaders(headers);

    const res = await CapacitorHttp.delete({
      url: fullUrl,
      headers: {
        Accept: 'application/json',
        ...requestHeaders,
      },
      connectTimeout: 8000,
      readTimeout: 8000,
    });

    if (res.status >= 200 && res.status < 300) {
      return (typeof res.data === 'string' ? JSON.parse(res.data) : res.data) as T;
    }

    const errData = typeof res.data === 'string' ? JSON.parse(res.data || '{}') : res.data || {};
    const errorMsg = errData.error || errData.message || `Error HTTP ${res.status}`;
    const err: any = new Error(errorMsg);
    err.status = res.status;
    err.data = errData;
    throw err;
  }
}
