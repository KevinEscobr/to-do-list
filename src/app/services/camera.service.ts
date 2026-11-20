import { Injectable } from '@angular/core';
import type { Photo } from '@capacitor/camera';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export interface CapturedImage {
  dataUrl: string;
  format: string;
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class CameraService {
  /**
   * Captura una foto utilizando la cámara del dispositivo o galería con Capacitor Camera.
   * @param source Fuente de la imagen: 'camera', 'photos' o 'prompt'
   */
  async capturePhoto(source: 'camera' | 'photos' | 'prompt' = 'prompt'): Promise<CapturedImage | null> {
    try {
      const cameraSource =
        source === 'camera' ? CameraSource.Camera : source === 'photos' ? CameraSource.Photos : CameraSource.Prompt;

      const photo: Photo = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: cameraSource,
        width: 1200,
        correctOrientation: true,
        promptLabelHeader: 'Seleccionar Imagen',
        promptLabelPhoto: 'Elegir de Galería',
        promptLabelPicture: 'Tomar Foto con Cámara',
        promptLabelCancel: 'Cancelar',
      });

      if (!photo.dataUrl) {
        return null;
      }

      return {
        dataUrl: photo.dataUrl,
        format: photo.format || 'jpeg',
        timestamp: Date.now(),
      };
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      // Cuando el usuario cancela la selección o cierre el prompt
      if (errMessage.toLowerCase().includes('cancel') || errMessage.toLowerCase().includes('closed')) {
        return null;
      }
      console.warn('[CameraService] Error al capturar foto:', error);
      throw error;
    }
  }

  /**
   * Verifica los permisos de acceso a la cámara.
   */
  async checkPermissions(): Promise<boolean> {
    try {
      const permission = await Camera.checkPermissions();
      return permission.camera === 'granted' || permission.camera === 'limited';
    } catch (error) {
      console.warn('[CameraService] Error al verificar permisos:', error);
      return false;
    }
  }

  /**
   * Solicita permisos de acceso a la cámara y galería.
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const permission = await Camera.requestPermissions({
        permissions: ['camera', 'photos'],
      });
      return permission.camera === 'granted';
    } catch (error) {
      console.warn('[CameraService] Error al solicitar permisos:', error);
      return false;
    }
  }
}
