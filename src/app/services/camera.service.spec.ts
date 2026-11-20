import { TestBed } from '@angular/core/testing';
import { Camera } from '@capacitor/camera';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { CameraService } from './camera.service';

vi.mock('@capacitor/camera', () => {
  return {
    Camera: {
      getPhoto: vi.fn(),
      checkPermissions: vi.fn(),
      requestPermissions: vi.fn(),
    },
    CameraResultType: {
      DataUrl: 'dataUrl',
      Base64: 'base64',
      Uri: 'uri',
    },
    CameraSource: {
      Prompt: 'PROMPT',
      Camera: 'CAMERA',
      Photos: 'PHOTOS',
    },
  };
});

describe('CameraService (Pruebas Automatizadas de Periférico de Cámara)', () => {
  let service: CameraService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [CameraService],
    });
    service = TestBed.inject(CameraService);
  });

  it('debe crearse correctamente', () => {
    expect(service).toBeTruthy();
  });

  it('debe capturar una foto exitosamente retornando dataUrl y formato', async () => {
    const mockDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...';
    vi.mocked(Camera.getPhoto).mockResolvedValueOnce({
      dataUrl: mockDataUrl,
      format: 'jpeg',
    } as any);

    const result = await service.capturePhoto('camera');

    expect(result).not.toBeNull();
    expect(result?.dataUrl).toBe(mockDataUrl);
    expect(result?.format).toBe('jpeg');
    expect(result?.timestamp).toBeGreaterThan(0);
    expect(Camera.getPhoto).toHaveBeenCalledTimes(1);
  });

  it('debe retornar null cuando el usuario cancela la captura sin arrojar error no controlado', async () => {
    vi.mocked(Camera.getPhoto).mockRejectedValueOnce(new Error('User cancelled photos app'));

    const result = await service.capturePhoto('prompt');

    expect(result).toBeNull();
  });

  it('debe verificar los permisos de la cámara', async () => {
    vi.mocked(Camera.checkPermissions).mockResolvedValueOnce({
      camera: 'granted',
      photos: 'granted',
    });

    const hasPermission = await service.checkPermissions();

    expect(hasPermission).toBe(true);
    expect(Camera.checkPermissions).toHaveBeenCalledTimes(1);
  });

  it('debe solicitar permisos de la cámara al usuario', async () => {
    vi.mocked(Camera.requestPermissions).mockResolvedValueOnce({
      camera: 'granted',
      photos: 'granted',
    });

    const granted = await service.requestPermissions();

    expect(granted).toBe(true);
    expect(Camera.requestPermissions).toHaveBeenCalledWith({
      permissions: ['camera', 'photos'],
    });
  });
});
