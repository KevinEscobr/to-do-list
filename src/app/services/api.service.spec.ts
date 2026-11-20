import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import type { Task } from '../models/task.model';

import { ApiService } from './api.service';

describe('ApiService (Integración con Servicios Web y APIs Externas)', () => {
  let service: ApiService;
  let mockHttp: {
    get: any;
    post: any;
    put: any;
  };

  beforeEach(() => {
    mockHttp = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [ApiService, { provide: HttpClient, useValue: mockHttp }],
    });

    service = TestBed.inject(ApiService);
  });

  it('debe crearse correctamente', () => {
    expect(service).toBeTruthy();
  });

  it('debe importar tareas desde API externa transformándolas al formato de la app', async () => {
    const mockRemoteTodos = [
      { userId: 1, id: 101, title: 'Comprar insumos', completed: false },
      { userId: 1, id: 102, title: 'Preparar informe', completed: true },
    ];

    mockHttp.get.mockReturnValueOnce(of(mockRemoteTodos));

    const result = await service.fetchExternalTasks(2);

    expect(result.length).toBe(2);
    expect(result[0].text).toBe('Comprar insumos');
    expect(result[0].category).toBeDefined();
    expect(result[0].priority).toBeDefined();
    expect(result[0].description).toContain('Importada desde API remota');
  });

  it('debe sincronizar una tarea nueva enviando POST al servidor remoto', async () => {
    const task: Task = {
      id: 123456,
      userId: 'usr_demo',
      text: 'Tarea a sincronizar',
      category: 'Trabajo',
      priority: 'Alta',
      completed: false,
      createdAt: Date.now(),
    };

    mockHttp.post.mockReturnValueOnce(of({ id: 999 }));

    const res = await service.syncTask(task);

    expect(res.remoteId).toBe(999);
    expect(mockHttp.post).toHaveBeenCalledTimes(1);
  });

  it('debe actualizar una tarea remota enviando PUT cuando ya posee remoteId', async () => {
    const task: Task = {
      id: 123456,
      remoteId: 555,
      userId: 'usr_demo',
      text: 'Tarea actualizada',
      category: 'Estudio',
      priority: 'Baja',
      completed: true,
      createdAt: Date.now(),
    };

    mockHttp.put.mockReturnValueOnce(of({ id: 555 }));

    const res = await service.syncTask(task);

    expect(res.remoteId).toBe(555);
    expect(mockHttp.put).toHaveBeenCalledTimes(1);
  });

  it('debe geocodificar coordenadas inversas usando OpenStreetMap Nominatim', async () => {
    mockHttp.get.mockReturnValueOnce(
      of({
        display_name: "Av. Libertador Bernardo O'Higgins, Santiago, Chile",
        address: {
          road: 'Av. Libertador',
          city: 'Santiago',
          country: 'Chile',
        },
      }),
    );

    const geo = await service.reverseGeocode(-33.44, -70.66);

    expect(geo.address).toContain('Av. Libertador');
    expect(geo.city).toBe('Santiago');
    expect(geo.country).toBe('Chile');
  });

  it('debe consultar datos meteorológicos con la API de Open-Meteo', async () => {
    mockHttp.get.mockReturnValueOnce(
      of({
        current_weather: {
          temperature: 24.5,
          weathercode: 0,
          windspeed: 12.3,
        },
      }),
    );

    const weather = await service.fetchWeather(-33.44, -70.66);

    expect(weather).toBeDefined();
    expect(weather?.temperature).toBe(25); // Math.round(24.5)
    expect(weather?.description).toBe('Despejado');
    expect(weather?.windSpeed).toBe(12.3);
  });

  it('debe buscar coordenadas de una dirección usando Nominatim Search', async () => {
    mockHttp.get.mockReturnValueOnce(
      of([
        {
          lat: '-33.4263',
          lon: '-70.6128',
          display_name: 'Providencia, Santiago, Chile',
          address: {
            city: 'Providencia',
            country: 'Chile',
          },
        },
      ]),
    );

    const res = await service.geocodeAddress('Providencia');

    expect(res).toBeDefined();
    expect(res?.latitude).toBe(-33.4263);
    expect(res?.longitude).toBe(-70.6128);
    expect(res?.city).toBe('Providencia');
  });
});
