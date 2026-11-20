import { TestBed } from '@angular/core/testing';
import { Geolocation } from '@capacitor/geolocation';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { LocationService } from './location.service';

vi.mock('@capacitor/geolocation', () => {
  return {
    Geolocation: {
      getCurrentPosition: vi.fn(),
      checkPermissions: vi.fn(),
      requestPermissions: vi.fn(),
    },
  };
});

describe('LocationService (Pruebas Automatizadas de Periférico GPS/Geolocalización)', () => {
  let service: LocationService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [LocationService],
    });
    service = TestBed.inject(LocationService);
  });

  it('debe crearse correctamente', () => {
    expect(service).toBeTruthy();
  });

  it('debe obtener las coordenadas GPS del dispositivo con precisión', async () => {
    const mockPosition = {
      timestamp: 1700000000000,
      coords: {
        latitude: -33.44889,
        longitude: -70.669265,
        accuracy: 15,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
    };

    vi.mocked(Geolocation.getCurrentPosition).mockResolvedValueOnce(mockPosition as any);

    const location = await service.getCurrentLocation();

    expect(location).toBeDefined();
    expect(location.latitude).toBe(-33.44889);
    expect(location.longitude).toBe(-70.669265);
    expect(location.accuracy).toBe(15);
    expect(Geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('debe verificar permisos de geolocalización', async () => {
    vi.mocked(Geolocation.checkPermissions).mockResolvedValueOnce({
      location: 'granted',
      coarseLocation: 'granted',
    } as any);

    const granted = await service.checkPermissions();
    expect(granted).toBe(true);
  });

  it('debe solicitar permisos de GPS al usuario', async () => {
    vi.mocked(Geolocation.requestPermissions).mockResolvedValueOnce({
      location: 'granted',
      coarseLocation: 'granted',
    } as any);

    const granted = await service.requestPermissions();
    expect(granted).toBe(true);
    expect(Geolocation.requestPermissions).toHaveBeenCalledWith({
      permissions: ['location'],
    });
  });
});
