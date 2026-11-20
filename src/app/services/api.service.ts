import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';

import { environment } from '../../environments/environment';
import type { Task, CreateTaskDto, TaskLocation, TaskWeather } from '../models/task.model';

import { BackendApiService } from './backend-api.service';
import { StorageService } from './storage.service';

export interface RemoteTodo {
  userId: number;
  id: number;
  title: string;
  completed: boolean;
}

export interface SyncResult {
  success: boolean;
  syncedTasks: number;
  failedTasks: number;
  details: { id: number; remoteId?: number | string; status: 'ok' | 'error'; error?: string }[];
}

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private http = inject(HttpClient);
  private backendApi = inject(BackendApiService);
  private storage = inject(StorageService);

  // URL del servidor backend en producción (todolist.nennge.me)
  public readonly apiUrl = environment.apiUrl;

  // Endpoints estándar de APIs públicas para desarrollo y pruebas
  private readonly TODOS_API = 'https://jsonplaceholder.typicode.com/todos';
  private readonly SYNC_API = 'https://jsonplaceholder.typicode.com/posts';
  private readonly NOMINATIM_API = 'https://nominatim.openstreetmap.org/reverse';
  private readonly NOMINATIM_SEARCH_API = 'https://nominatim.openstreetmap.org/search';
  private readonly WEATHER_API = 'https://api.open-meteo.com/v1/forecast';

  // Caché en memoria para respuesta instantánea (< 10ms) en consultas repetidas o cercanas
  private geoCache = new Map<string, Partial<TaskLocation>>();
  private weatherCache = new Map<string, { data: TaskWeather; timestamp: number }>();

  /**
   * Consulta las tareas registradas en el backend MySQL para el usuario autenticado.
   */
  async fetchUserTasks(): Promise<any[]> {
    try {
      const token = await this.storage.get<string>('taskflow_auth_token');
      if (!token) return [];
      const headers = { Authorization: `Bearer ${token}` };
      return await this.backendApi.get<any[]>('tasks', headers);
    } catch (err) {
      console.warn('[ApiService] Error al consultar tareas del servidor:', err);
      return [];
    }
  }

  /**
   * Elimina una tarea individual en el backend remoto.
   */
  async deleteUserTask(remoteId: number | string): Promise<boolean> {
    try {
      const token = await this.storage.get<string>('taskflow_auth_token');
      if (!token) return false;
      const headers = { Authorization: `Bearer ${token}` };
      await this.backendApi.delete(`tasks/${remoteId}`, headers);
      return true;
    } catch (err) {
      console.warn(`[ApiService] Error al eliminar tarea remota ${remoteId}:`, err);
      return false;
    }
  }

  /**
   * Elimina en lote las tareas completadas en el backend remoto.
   */
  async clearCompletedUserTasks(): Promise<boolean> {
    try {
      const token = await this.storage.get<string>('taskflow_auth_token');
      if (!token) return false;
      const headers = { Authorization: `Bearer ${token}` };
      await this.backendApi.delete('tasks/completed', headers);
      return true;
    } catch (err) {
      console.warn('[ApiService] Error al eliminar tareas completadas en servidor:', err);
      return false;
    }
  }

  /**
   * Importa tareas desde una API externa pública (JSONPlaceholder To-Dos).
   * Transforma los datos al formato de nuestra aplicación.
   */
  async fetchExternalTasks(limit: number = 8): Promise<CreateTaskDto[]> {
    try {
      const url = `${this.TODOS_API}?_limit=${limit}`;
      const remoteTodos = await firstValueFrom(this.http.get<RemoteTodo[]>(url).pipe(timeout(5000)));

      const categories = ['Trabajo', 'Estudio', 'Personal'] as const;
      const priorities = ['Alta', 'Media', 'Baja'] as const;

      return remoteTodos.map((todo, idx) => {
        const category = categories[idx % categories.length];
        const priority = priorities[idx % priorities.length];

        return {
          text: todo.title.charAt(0).toUpperCase() + todo.title.slice(1),
          description: `Importada desde API remota (ID externo #${todo.id}).`,
          category,
          priority,
        };
      });
    } catch (error) {
      console.error('[ApiService] Error al importar tareas desde API externa:', error);
      throw new Error('No se pudo conectar con la API de tareas. Verifica tu conexión a internet.', {
        cause: error,
      });
    }
  }

  /**
   * Sincroniza una tarea individual con el servidor web remoto (fallback).
   */
  async syncTask(task: Task): Promise<{ remoteId: number | string }> {
    try {
      const payload = {
        title: task.text,
        body: JSON.stringify({
          description: task.description,
          category: task.category,
          priority: task.priority,
          completed: task.completed,
          location: task.location,
          userId: task.userId,
        }),
        userId: 1,
      };

      if (task.remoteId) {
        await firstValueFrom(this.http.put(`${this.SYNC_API}/${task.remoteId}`, payload).pipe(timeout(5000)));
        return { remoteId: task.remoteId };
      } else {
        const res = await firstValueFrom<{ id: number }>(
          this.http.post<{ id: number }>(this.SYNC_API, payload).pipe(timeout(5000)),
        );
        return { remoteId: res.id || Date.now() };
      }
    } catch (error) {
      console.error(`[ApiService] Error al sincronizar tarea ${task.id}:`, error);
      throw error;
    }
  }

  /**
   * Sincroniza un lote de tareas con el servicio remoto (con soporte de token JWT).
   */
  async syncBatch(tasks: Task[]): Promise<SyncResult> {
    try {
      const token = await this.storage.get<string>('taskflow_auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await this.backendApi.post<SyncResult>('tasks/sync', { tasks }, headers);
      if (res && typeof res.syncedTasks === 'number') {
        return res;
      }
    } catch (err) {
      console.warn(`[ApiService] Backend sync no disponible, usando fallback:`, err);
    }

    const result: SyncResult = {
      success: true,
      syncedTasks: 0,
      failedTasks: 0,
      details: [],
    };

    for (const task of tasks) {
      try {
        const syncResponse = await this.syncTask(task);
        result.syncedTasks++;
        result.details.push({
          id: task.id,
          remoteId: syncResponse.remoteId,
          status: 'ok',
        });
      } catch (err) {
        result.failedTasks++;
        result.details.push({
          id: task.id,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    result.success = result.failedTasks === 0;
    return result;
  }

  /**
   * Geocodificación inversa con OpenStreetMap Nominatim.
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<Partial<TaskLocation>> {
    const cacheKey = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
    if (this.geoCache.has(cacheKey)) {
      return this.geoCache.get(cacheKey)!;
    }

    try {
      const url = `${this.NOMINATIM_API}?format=json&lat=${latitude}&lon=${longitude}&zoom=16&addressdetails=1&email=app.taskflow.dev@gmail.com`;
      const response = await firstValueFrom<any>(
        this.http
          .get(url, {
            headers: {
              'Accept-Language': 'es',
            },
          })
          .pipe(timeout(2500)),
      );

      if (response && response.address) {
        const addr = response.address;
        const road = addr.road || addr.pedestrian || addr.footway || addr.neighbourhood || addr.suburb || '';
        const city =
          addr.city || addr.town || addr.municipality || addr.city_district || addr.village || addr.county || '';
        const country = addr.country || '';
        const formattedAddress = [road, city, country].filter(Boolean).join(', ') || response.display_name;

        const result: Partial<TaskLocation> = {
          address: formattedAddress,
          city,
          country,
        };
        this.geoCache.set(cacheKey, result);
        return result;
      }

      const fallback: Partial<TaskLocation> = {
        address: response?.display_name || `Lat: ${latitude.toFixed(4)}, Lon: ${longitude.toFixed(4)}`,
      };
      this.geoCache.set(cacheKey, fallback);
      return fallback;
    } catch (error) {
      console.warn('[ApiService] Error al geocodificar coordenadas:', error);
      const fallback: Partial<TaskLocation> = {
        address: `Lat: ${latitude.toFixed(4)}, Lon: ${longitude.toFixed(4)}`,
      };
      return fallback;
    }
  }

  /**
   * Busca coordenadas y dirección a partir de un texto.
   */
  async geocodeAddress(query: string): Promise<Partial<TaskLocation> | null> {
    const q = query.trim();
    if (!q) return null;
    try {
      const url = `${this.NOMINATIM_SEARCH_API}?format=json&q=${encodeURIComponent(q)}&limit=1&addressdetails=1&email=app.taskflow.dev@gmail.com`;
      const results = await firstValueFrom<any[]>(
        this.http
          .get<any[]>(url, {
            headers: {
              'Accept-Language': 'es',
            },
          })
          .pipe(timeout(3000)),
      );

      if (Array.isArray(results) && results.length > 0) {
        const first = results[0];
        const addr = first.address || {};
        const road = addr.road || addr.pedestrian || addr.footway || addr.neighbourhood || addr.suburb || '';
        const city =
          addr.city || addr.town || addr.municipality || addr.city_district || addr.village || addr.county || '';
        const country = addr.country || '';
        const formattedAddress = [road, city, country].filter(Boolean).join(', ') || first.display_name;

        return {
          latitude: Number(parseFloat(first.lat).toFixed(6)),
          longitude: Number(parseFloat(first.lon).toFixed(6)),
          address: formattedAddress,
          city,
          country,
        };
      }
      return null;
    } catch (error) {
      console.warn('[ApiService] Error al buscar dirección:', error);
      return null;
    }
  }

  /**
   * Datos meteorológicos en tiempo real con Open-Meteo.
   */
  async fetchWeather(latitude: number, longitude: number): Promise<TaskWeather | undefined> {
    const cacheKey = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
    const cached = this.weatherCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 600000) {
      return cached.data;
    }

    try {
      const url = `${this.WEATHER_API}?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
      const response = await firstValueFrom<any>(this.http.get(url).pipe(timeout(2500)));

      if (response && response.current_weather) {
        const cw = response.current_weather;
        const desc = this.interpretWeatherCode(cw.weathercode);

        const weather: TaskWeather = {
          temperature: Math.round(cw.temperature),
          weatherCode: cw.weathercode,
          description: desc,
          windSpeed: cw.windspeed,
        };
        this.weatherCache.set(cacheKey, { data: weather, timestamp: Date.now() });
        return weather;
      }
      return undefined;
    } catch (error) {
      console.warn('[ApiService] Error al consultar datos de clima:', error);
      return undefined;
    }
  }

  private interpretWeatherCode(code: number): string {
    if (code === 0) return 'Despejado';
    if (code >= 1 && code <= 3) return 'Parcialmente nublado';
    if (code >= 45 && code <= 48) return 'Niebla';
    if (code >= 51 && code <= 55) return 'Llovizna';
    if (code >= 61 && code <= 65) return 'Lluvia';
    if (code >= 71 && code <= 77) return 'Nieve';
    if (code >= 80 && code <= 82) return 'Chubascos';
    if (code >= 95 && code <= 99) return 'Tormenta eléctrica';
    return 'Clima variable';
  }
}
