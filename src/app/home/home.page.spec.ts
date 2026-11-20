import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { CameraService } from '../services/camera.service';
import { LocationService } from '../services/location.service';
import { TaskService } from '../services/task.service';

import { HomePage } from './home.page';

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;

  beforeEach(async () => {
    const mockTasksSignal = signal<any[]>([]);

    const mockTaskService = {
      tasks: mockTasksSignal,
      totalCount: signal(0),
      pendingCount: signal(0),
      completedCount: signal(0),
      syncedCount: signal(0),
      pendingSyncCount: signal(0),
      isSyncing: signal(false),
      isImporting: signal(false),
      addTask: vi.fn(),
      updateTask: vi.fn(),
      toggleTask: vi.fn(),
      deleteTask: vi.fn(),
      clearCompleted: vi.fn(),
      setCompletedForIds: vi.fn(),
      setAllCompleted: vi.fn(),
      syncPendingTasks: vi.fn().mockResolvedValue({ success: true, syncedTasks: 0, failedTasks: 0, details: [] }),
      importTasksFromApi: vi.fn().mockResolvedValue(5),
    };

    const mockCameraService = {
      capturePhoto: vi.fn().mockResolvedValue({ dataUrl: 'data:image/png;base64,abc', format: 'png', timestamp: 123 }),
    };

    const mockLocationService = {
      getCurrentLocation: vi.fn().mockResolvedValue({ latitude: -33.45, longitude: -70.66, accuracy: 10 }),
      getPresets: vi.fn().mockReturnValue([]),
    };

    const mockApiService = {
      reverseGeocode: vi.fn().mockResolvedValue({ address: 'Santiago, Chile', city: 'Santiago', country: 'Chile' }),
      fetchWeather: vi.fn().mockResolvedValue({ temperature: 22, description: 'Despejado' }),
    };

    const mockAuthService = {
      currentUser: signal({ id: 'u1', name: 'Tester', username: 'tester', email: 'test@test.com' }),
      isAuthenticated: signal(true),
      currentUserId: signal('u1'),
    };

    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: TaskService, useValue: mockTaskService },
        { provide: CameraService, useValue: mockCameraService },
        { provide: LocationService, useValue: mockLocationService },
        { provide: ApiService, useValue: mockApiService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe crearse correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('debe capturar foto para nueva tarea usando CameraService', async () => {
    await component.takePhoto();
    expect(component.formImage).toBe('data:image/png;base64,abc');
  });

  it('debe capturar ubicación GPS y enriquecer con clima y dirección', async () => {
    await component.captureLocation();
    expect(component.formLocation).toBeDefined();
    expect(component.formLocation?.address).toBe('Santiago, Chile');
    expect(component.formWeather?.temperature).toBe(22);
  });

  it('debe invocar guardado de tarea con periféricos', async () => {
    component.formText = 'Tarea de prueba completa';
    component.formCategory = 'Trabajo';
    component.formPriority = 'Alta';
    component.formImage = 'data:image/png;base64,test';
    component.formLocation = { latitude: -33, longitude: -70, address: 'Prueba' };

    await component.saveNewTask();

    expect(component.taskService.addTask).toHaveBeenCalledWith({
      text: 'Tarea de prueba completa',
      description: undefined,
      category: 'Trabajo',
      priority: 'Alta',
      imageUrl: 'data:image/png;base64,test',
      location: { latitude: -33, longitude: -70, address: 'Prueba' },
      weather: undefined,
    });
  });
});
