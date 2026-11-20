import { Injectable, inject, signal, computed, effect } from '@angular/core';

import type { Task, CreateTaskDto, TaskCategory, TaskPriority, TaskLocation, TaskWeather } from '../models/task.model';

import type { SyncResult } from './api.service';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { StorageService } from './storage.service';

@Injectable({
  providedIn: 'root',
})
export class TaskService {
  private storage = inject(StorageService);
  private authService = inject(AuthService);
  private apiService = inject(ApiService);

  private readonly TASKS_STORAGE_KEY_PREFIX = 'ionic_todo_tasks_user_';

  // Estado reactivo principal
  private allUserTasksSignal = signal<Task[]>([]);
  public isSyncing = signal<boolean>(false);
  public isImporting = signal<boolean>(false);

  // Tareas del usuario activo
  public tasks = this.allUserTasksSignal.asReadonly();

  // Contadores reactivos
  public totalCount = computed(() => this.allUserTasksSignal().length);
  public pendingCount = computed(() => this.allUserTasksSignal().filter((t) => !t.completed).length);
  public completedCount = computed(() => this.allUserTasksSignal().filter((t) => t.completed).length);
  public syncedCount = computed(() => this.allUserTasksSignal().filter((t) => t.synced).length);
  public pendingSyncCount = computed(() => this.allUserTasksSignal().filter((t) => !t.synced).length);

  constructor() {
    // Escucha cambios en el usuario autenticado para recargar sus tareas correspondientes
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        this.loadTasksForUser(user.id);
      } else {
        this.allUserTasksSignal.set([]);
      }
    });
  }

  /**
   * Clave de almacenamiento dinámico según el usuario activo.
   */
  private getStorageKey(userId?: string): string {
    const uid = userId || this.authService.currentUserId() || 'guest';
    return `${this.TASKS_STORAGE_KEY_PREFIX}${uid}`;
  }

  /**
   * Carga las tareas del usuario desde Capacitor Preferences y sincroniza con el servidor.
   */
  async loadTasksForUser(userId: string): Promise<Task[]> {
    try {
      const key = this.getStorageKey(userId);
      const stored = await this.storage.get<Task[]>(key);
      const userTasks = Array.isArray(stored) ? stored : [];
      this.allUserTasksSignal.set(userTasks);

      // Sincronizar en segundo plano tareas remotas del servidor
      this.fetchRemoteTasks(userId).catch(() => {});

      return userTasks;
    } catch (err) {
      console.error(`[TaskService] Error al cargar tareas para usuario ${userId}:`, err);
      this.allUserTasksSignal.set([]);
      return [];
    }
  }

  /**
   * Consulta las tareas del usuario en el backend remoto y las fusiona con la caché local.
   */
  async fetchRemoteTasks(userId: string): Promise<void> {
    try {
      const remoteTasks = await this.apiService.fetchUserTasks();
      if (Array.isArray(remoteTasks) && remoteTasks.length > 0) {
        const currentTasks = [...this.allUserTasksSignal()];
        const existingRemoteIds = new Set(
          currentTasks.map((t) => Number(t.remoteId)).filter((id) => !isNaN(id) && id > 0),
        );

        let hasNew = false;
        for (const rt of remoteTasks) {
          if (!existingRemoteIds.has(Number(rt.id))) {
            currentTasks.push({
              id: Date.now() + Math.floor(Math.random() * 1000),
              userId,
              text: rt.text,
              description: rt.description || undefined,
              category: rt.category || 'Personal',
              priority: rt.priority || 'Media',
              completed: Boolean(rt.completed),
              createdAt: Number(rt.createdAt) || Date.now(),
              updatedAt: Number(rt.updatedAt) || undefined,
              imageUrl: rt.imageUrl,
              imageFormat: rt.imageFormat,
              location: rt.location,
              weather: rt.weather,
              synced: true,
              remoteId: Number(rt.id),
            });
            existingRemoteIds.add(Number(rt.id));
            hasNew = true;
          }
        }

        if (hasNew) {
          this.allUserTasksSignal.set(currentTasks);
          await this.persist();
        }
      }
    } catch {
      // Continuar silenciosamente en modo offline
    }
  }

  /**
   * Agrega una nueva tarea vinculada al usuario activo con soporte para periféricos (cámara, GPS).
   */
  async addTask(dto: CreateTaskDto): Promise<Task> {
    const currentUserId = this.authService.currentUserId() || 'guest';

    const newTask: Task = {
      id: Date.now(),
      userId: currentUserId,
      text: dto.text.trim(),
      description: dto.description?.trim() || undefined,
      category: dto.category || 'Personal',
      priority: dto.priority || 'Media',
      completed: false,
      createdAt: Date.now(),
      imageUrl: dto.imageUrl,
      imageFormat: dto.imageFormat,
      location: dto.location,
      weather: dto.weather,
      synced: false,
    };

    this.allUserTasksSignal.update((tasks) => [newTask, ...tasks]);
    await this.persist();
    return newTask;
  }

  /**
   * Busca una tarea por su ID.
   */
  getTaskById(id: number): Task | undefined {
    return this.allUserTasksSignal().find((t) => t.id === id);
  }

  /**
   * Actualiza los datos de una tarea existente.
   */
  async updateTask(
    id: number,
    text: string,
    description?: string,
    category?: TaskCategory,
    priority?: TaskPriority,
    imageUrl?: string,
  ): Promise<boolean> {
    let updated = false;

    this.allUserTasksSignal.update((tasks) =>
      tasks.map((t) => {
        if (t.id === id) {
          updated = true;
          return {
            ...t,
            text: text.trim(),
            description: description?.trim() || undefined,
            category: category ?? t.category,
            priority: priority ?? t.priority,
            imageUrl: imageUrl !== undefined ? imageUrl : t.imageUrl,
            updatedAt: Date.now(),
            synced: false, // Se marca como pendiente de sincronizar nuevamente
          };
        }
        return t;
      }),
    );

    if (updated) {
      await this.persist();
    }
    return updated;
  }

  /**
   * Actualiza la ubicación y el clima de una tarea existente.
   */
  async updateTaskLocation(id: number, location?: TaskLocation, weather?: TaskWeather): Promise<boolean> {
    let updated = false;

    this.allUserTasksSignal.update((tasks) =>
      tasks.map((t) => {
        if (t.id === id) {
          updated = true;
          return {
            ...t,
            location,
            weather,
            updatedAt: Date.now(),
            synced: false,
          };
        }
        return t;
      }),
    );

    if (updated) {
      await this.persist();
    }
    return updated;
  }

  /**
   * Alterna el estado completado de una tarea.
   */
  async toggleTask(id: number): Promise<void> {
    this.allUserTasksSignal.update((tasks) =>
      tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed, synced: false } : t)),
    );
    await this.persist();
  }

  /**
   * Elimina una tarea por su ID.
   */
  async deleteTask(id: number): Promise<void> {
    const taskToDelete = this.allUserTasksSignal().find((t) => t.id === id);
    this.allUserTasksSignal.update((tasks) => tasks.filter((t) => t.id !== id));
    await this.persist();

    if (taskToDelete?.remoteId) {
      this.apiService.deleteUserTask(taskToDelete.remoteId).catch(() => {});
    }
  }

  /**
   * Elimina todas las tareas marcadas como completadas.
   */
  async clearCompleted(): Promise<number> {
    const countBefore = this.completedCount();
    const completedTasks = this.allUserTasksSignal().filter((t) => t.completed);
    this.allUserTasksSignal.update((tasks) => tasks.filter((t) => !t.completed));
    await this.persist();

    if (completedTasks.some((t) => t.remoteId)) {
      this.apiService.clearCompletedUserTasks().catch(() => {});
    }
    return countBefore;
  }

  /**
   * Cambia el estado completada para un conjunto de tareas por sus IDs.
   */
  async setCompletedForIds(ids: Set<number>, completed: boolean): Promise<void> {
    this.allUserTasksSignal.update((tasks) =>
      tasks.map((t) => (ids.has(t.id) ? { ...t, completed, synced: false } : t)),
    );
    await this.persist();
  }

  /**
   * Cambia el estado completada para todas las tareas del usuario activo.
   */
  async setAllCompleted(completed: boolean): Promise<void> {
    this.allUserTasksSignal.update((tasks) => tasks.map((t) => ({ ...t, completed, synced: false })));
    await this.persist();
  }

  /**
   * Sincroniza las tareas pendientes con el servicio web / API externa.
   */
  async syncPendingTasks(): Promise<SyncResult> {
    const pendingTasks = this.allUserTasksSignal().filter((t) => !t.synced);
    if (pendingTasks.length === 0) {
      return {
        success: true,
        syncedTasks: 0,
        failedTasks: 0,
        details: [],
      };
    }

    this.isSyncing.set(true);
    try {
      const syncResult = await this.apiService.syncBatch(pendingTasks);

      // Actualizar tareas sincronizadas
      const syncedIds = new Set(syncResult.details.filter((d) => d.status === 'ok').map((d) => d.id));

      this.allUserTasksSignal.update((tasks) =>
        tasks.map((t) => {
          if (syncedIds.has(t.id)) {
            const detail = syncResult.details.find((d) => d.id === t.id);
            return {
              ...t,
              synced: true,
              remoteId: detail?.remoteId || t.remoteId,
            };
          }
          return t;
        }),
      );

      await this.persist();
      return syncResult;
    } finally {
      this.isSyncing.set(false);
    }
  }

  /**
   * Importa tareas desde la API externa para enriquecer la lista del usuario.
   */
  async importTasksFromApi(count: number = 5): Promise<number> {
    this.isImporting.set(true);
    try {
      const externalDtos = await this.apiService.fetchExternalTasks(count);
      const currentUserId = this.authService.currentUserId() || 'guest';
      const presets = [
        {
          latitude: -33.4489,
          longitude: -70.6693,
          address: 'Plaza de Armas, Santiago Centro, Región Metropolitana',
          city: 'Santiago',
          country: 'Chile',
        },
        {
          latitude: -33.4263,
          longitude: -70.6128,
          address: 'Av. Providencia, Santiago, Región Metropolitana',
          city: 'Providencia',
          country: 'Chile',
        },
        {
          latitude: -33.0472,
          longitude: -71.6127,
          address: 'Plaza Sotomayor, Valparaíso, Chile',
          city: 'Valparaíso',
          country: 'Chile',
        },
        {
          latitude: -36.827,
          longitude: -73.0503,
          address: 'Plaza de la Independencia, Concepción, Chile',
          city: 'Concepción',
          country: 'Chile',
        },
      ];

      const newTasks: Task[] = externalDtos.map((dto, index) => {
        const preset = presets[index % presets.length];
        return {
          id: Date.now() + index,
          userId: currentUserId,
          text: dto.text,
          description: dto.description,
          category: dto.category,
          priority: dto.priority,
          completed: false,
          createdAt: Date.now() + index,
          location: {
            ...preset,
            accuracy: 15,
            timestamp: Date.now(),
          },
          weather: {
            temperature: 20 + (index % 4),
            description: 'Parcialmente nublado',
            windSpeed: 12 + index,
          },
          synced: true, // Provienen de la API, ya están remotas
          remoteId: index + 100,
        };
      });

      this.allUserTasksSignal.update((tasks) => [...newTasks, ...tasks]);
      await this.persist();
      return newTasks.length;
    } finally {
      this.isImporting.set(false);
    }
  }

  /**
   * Persiste la lista reactiva de tareas en Capacitor Preferences.
   */
  private async persist(): Promise<void> {
    try {
      const key = this.getStorageKey();
      await this.storage.set(key, this.allUserTasksSignal());
    } catch (err) {
      console.error('[TaskService] Error al guardar en almacenamiento local:', err);
    }
  }
}
