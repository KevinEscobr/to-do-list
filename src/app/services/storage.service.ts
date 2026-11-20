import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  /**
   * Obtiene un valor almacenado en Capacitor Preferences por su clave.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const { value } = await Preferences.get({ key });
      if (value === null || value === undefined) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      console.warn(`[StorageService] Error al obtener la clave "${key}":`, error);
      return null;
    }
  }

  /**
   * Guarda un valor en Capacitor Preferences serializándolo a JSON.
   */
  async set(key: string, value: unknown): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await Preferences.set({ key, value: serialized });
    } catch (error) {
      console.error(`[StorageService] Error al guardar la clave "${key}":`, error);
      throw error;
    }
  }

  /**
   * Elimina un valor almacenado por su clave.
   */
  async remove(key: string): Promise<void> {
    try {
      await Preferences.remove({ key });
    } catch (error) {
      console.error(`[StorageService] Error al eliminar la clave "${key}":`, error);
      throw error;
    }
  }

  /**
   * Limpia todo el almacenamiento de Preferences.
   */
  async clear(): Promise<void> {
    try {
      await Preferences.clear();
    } catch (error) {
      console.error('[StorageService] Error al limpiar preferences:', error);
      throw error;
    }
  }

  /**
   * Obtiene la lista de todas las claves almacenadas.
   */
  async keys(): Promise<string[]> {
    try {
      const { keys } = await Preferences.keys();
      return keys;
    } catch (error) {
      console.error('[StorageService] Error al listar keys:', error);
      return [];
    }
  }
}
