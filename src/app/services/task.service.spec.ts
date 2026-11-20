import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import type { User } from '../models/user.model';

import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { StorageService } from './storage.service';
import { TaskService } from './task.service';

describe('TaskService (Gestión Avanzada de Tareas, Almacenamiento Local y Sincronización)', () => {
  let service: TaskService;
  let mockStorage: any;
  let mockAuth: any;
  let mockApi: any;
  let storageStore: Record<string, any>;
  const currentUserSignal = signal<User | null>({
    id: 'user_alpha',
    username: 'alpha',
    email: 'alpha@test.com',
    name: 'Alpha Tester',
    createdAt: Date.now(),
  });

  beforeEach(() => {
    storageStore = {};
    mockStorage = {
      get: vi.fn(async (key: string) => storageStore[key] ?? null),
      set: vi.fn(async (key: string, val: any) => {
        storageStore[key] = val;
      }),
      remove: vi.fn(async (key: string) => {
        delete storageStore[key];
      }),
    };

    mockAuth = {
      currentUser: currentUserSignal,
      currentUserId: () => currentUserSignal()?.id || 'guest',
      isAuthenticated: () => !!currentUserSignal(),
    };

    mockApi = {
      syncBatch: vi.fn(async (tasks: any[]) => ({
        success: true,
        syncedTasks: tasks.length,
        failedTasks: 0,
        details: tasks.map((t) => ({ id: t.id, remoteId: 900 + t.id, status: 'ok' })),
      })),
      fetchExternalTasks: vi.fn(async (_count: number) => [
        { text: 'Tarea Remota 1', category: 'Trabajo', priority: 'Alta' },
        { text: 'Tarea Remota 2', category: 'Estudio', priority: 'Media' },
      ]),
    };

    TestBed.configureTestingModule({
      providers: [
        TaskService,
        { provide: StorageService, useValue: mockStorage },
        { provide: AuthService, useValue: mockAuth },
        { provide: ApiService, useValue: mockApi },
      ],
    });

    service = TestBed.inject(TaskService);
  });

  it('debe crearse correctamente', () => {
    expect(service).toBeTruthy();
  });

  it('debe agregar una tarea con imagen y datos de geolocalización', async () => {
    const newTask = await service.addTask({
      text: 'Revisar equipo en terreno',
      description: 'Tomar fotografía del medidor',
      category: 'Trabajo',
      priority: 'Alta',
      imageUrl: 'data:image/jpeg;base64,sample_photo_base64',
      location: {
        latitude: -33.45,
        longitude: -70.65,
        address: 'Plaza de Armas, Santiago',
      },
      weather: {
        temperature: 20,
        description: 'Soleado',
      },
    });

    expect(newTask).toBeDefined();
    expect(newTask.text).toBe('Revisar equipo en terreno');
    expect(newTask.imageUrl).toBe('data:image/jpeg;base64,sample_photo_base64');
    expect(newTask.location?.address).toBe('Plaza de Armas, Santiago');
    expect(newTask.weather?.temperature).toBe(20);
    expect(newTask.userId).toBe('user_alpha');
    expect(service.totalCount()).toBe(1);
    expect(mockStorage.set).toHaveBeenCalled();
  });

  it('debe alternar el estado completado de una tarea', async () => {
    const task = await service.addTask({
      text: 'Tarea para alternar',
      category: 'Personal',
      priority: 'Media',
    });

    expect(task.completed).toBe(false);
    expect(service.pendingCount()).toBe(1);

    await service.toggleTask(task.id);

    const updated = service.getTaskById(task.id);
    expect(updated?.completed).toBe(true);
    expect(service.completedCount()).toBe(1);
    expect(service.pendingCount()).toBe(0);
  });

  it('debe actualizar una tarea existente', async () => {
    const task = await service.addTask({
      text: 'Texto inicial',
      category: 'Estudio',
      priority: 'Baja',
    });

    const success = await service.updateTask(task.id, 'Texto modificado', 'Nueva descripción', 'Trabajo', 'Alta');

    expect(success).toBe(true);
    const updated = service.getTaskById(task.id);
    expect(updated?.text).toBe('Texto modificado');
    expect(updated?.category).toBe('Trabajo');
    expect(updated?.priority).toBe('Alta');
  });

  it('debe eliminar una tarea', async () => {
    const task = await service.addTask({
      text: 'Tarea para borrar',
      category: 'Personal',
      priority: 'Baja',
    });

    expect(service.totalCount()).toBe(1);
    await service.deleteTask(task.id);
    expect(service.totalCount()).toBe(0);
  });

  it('debe sincronizar tareas pendientes con el servidor web', async () => {
    await service.addTask({
      text: 'Tarea local pendiente',
      category: 'Trabajo',
      priority: 'Alta',
    });

    expect(service.pendingSyncCount()).toBe(1);

    const syncResult = await service.syncPendingTasks();

    expect(syncResult.syncedTasks).toBe(1);
    expect(service.pendingSyncCount()).toBe(0);
    expect(service.syncedCount()).toBe(1);
    expect(mockApi.syncBatch).toHaveBeenCalledTimes(1);
  });

  it('debe importar tareas desde la API externa y agregarlas a la lista', async () => {
    const count = await service.importTasksFromApi(2);

    expect(count).toBe(2);
    expect(service.totalCount()).toBe(2);
    expect(service.tasks()[0].text).toContain('Tarea Remota');
    expect(mockApi.fetchExternalTasks).toHaveBeenCalledWith(2);
  });
});
