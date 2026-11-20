import { TestBed } from '@angular/core/testing';
import { Preferences } from '@capacitor/preferences';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { StorageService } from './storage.service';

vi.mock('@capacitor/preferences', () => {
  return {
    Preferences: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      keys: vi.fn(),
    },
  };
});

describe('StorageService (Almacenamiento Local Avanzado con Capacitor Preferences)', () => {
  let service: StorageService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [StorageService],
    });
    service = TestBed.inject(StorageService);
  });

  it('debe crearse correctamente', () => {
    expect(service).toBeTruthy();
  });

  it('debe almacenar datos serializados en JSON con Preferences.set', async () => {
    vi.mocked(Preferences.set).mockResolvedValueOnce();

    const sampleData = { id: 1, title: 'Tarea Offline' };
    await service.set('test_key', sampleData);

    expect(Preferences.set).toHaveBeenCalledWith({
      key: 'test_key',
      value: JSON.stringify(sampleData),
    });
  });

  it('debe recuperar y deserializar datos de Preferences.get', async () => {
    const sampleData = { id: 2, title: 'Tarea Guardada' };
    vi.mocked(Preferences.get).mockResolvedValueOnce({
      value: JSON.stringify(sampleData),
    });

    const result = await service.get<typeof sampleData>('test_key');

    expect(result).toEqual(sampleData);
    expect(Preferences.get).toHaveBeenCalledWith({ key: 'test_key' });
  });

  it('debe retornar null si la clave no existe', async () => {
    vi.mocked(Preferences.get).mockResolvedValueOnce({ value: null });

    const result = await service.get('non_existent');
    expect(result).toBeNull();
  });

  it('debe eliminar una clave con Preferences.remove', async () => {
    vi.mocked(Preferences.remove).mockResolvedValueOnce();

    await service.remove('sample_key');
    expect(Preferences.remove).toHaveBeenCalledWith({ key: 'sample_key' });
  });
});
