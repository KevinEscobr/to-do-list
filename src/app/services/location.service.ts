import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import type { Position, PermissionStatus } from '@capacitor/geolocation';
import { Geolocation } from '@capacitor/geolocation';

import type { TaskLocation } from '../models/task.model';

export interface LocationPreset {
  name: string;
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  address: string;
}

export const CHILE_LOCATION_PRESETS: LocationPreset[] = [
  {
    name: 'Santiago Centro',
    latitude: -33.4489,
    longitude: -70.6693,
    city: 'Santiago',
    country: 'Chile',
    address: 'Plaza de Armas, Santiago Centro, Región Metropolitana',
  },
  {
    name: 'Providencia',
    latitude: -33.4263,
    longitude: -70.6128,
    city: 'Providencia',
    country: 'Chile',
    address: 'Av. Providencia, Santiago, Región Metropolitana',
  },
  {
    name: 'Las Condes',
    latitude: -33.4116,
    longitude: -70.5794,
    city: 'Las Condes',
    country: 'Chile',
    address: 'Apoquindo, Las Condes, Región Metropolitana',
  },
  {
    name: 'Valparaíso',
    latitude: -33.0472,
    longitude: -71.6127,
    city: 'Valparaíso',
    country: 'Chile',
    address: 'Plaza Sotomayor, Valparaíso, Chile',
  },
  {
    name: 'Viña del Mar',
    latitude: -33.0245,
    longitude: -71.5522,
    city: 'Viña del Mar',
    country: 'Chile',
    address: 'Plaza Vergara, Viña del Mar, Chile',
  },
  {
    name: 'Concepción',
    latitude: -36.827,
    longitude: -73.0503,
    city: 'Concepción',
    country: 'Chile',
    address: 'Plaza de la Independencia, Concepción, Chile',
  },
];

@Injectable({
  providedIn: 'root',
})
export class LocationService {
  /**
   * Obtiene la posición actual del dispositivo mediante Capacitor Geolocation.
   * Optimizado para máxima velocidad:
   * 1. Consulta primero la posición de red/fused (0-200ms en Android).
   * 2. Utiliza una caché de hasta 15 minutos para respuesta casi instantánea.
   * 3. Si no hay señal o demora, recurre al fallback garantizado en menos de 2.5s.
   */
  async getCurrentLocation(allowFallback: boolean = true): Promise<TaskLocation> {
    // 1. En plataformas nativas (Android/iOS), verificar permisos rápidamente
    if (Capacitor.isNativePlatform()) {
      try {
        const hasPermission = await this.checkPermissions();
        if (!hasPermission) {
          await this.requestPermissions();
        }
      } catch (permError: unknown) {
        console.warn('[LocationService] Aviso en verificación de permisos:', permError);
      }
    }

    try {
      let position: Position;

      // INTENTO 1 DE ALTA VELOCIDAD:
      // Red / Fused Location (retorna en 50-200ms en dispositivos móviles)
      // con caché amplia (15 minutos) para respuesta inmediata.
      try {
        position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 2000,
          maximumAge: 900000,
        });
      } catch (coarseError) {
        console.warn('[LocationService] Red no disponible, intentando GPS satelital con timeout corto:', coarseError);
        // INTENTO 2: Satélite con timeout corto (2.5 segundos máx)
        position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 2500,
          maximumAge: 900000,
        });
      }

      return {
        latitude: Number(position.coords.latitude.toFixed(6)),
        longitude: Number(position.coords.longitude.toFixed(6)),
        accuracy: Math.round(position.coords.accuracy),
        timestamp: position.timestamp,
      };
    } catch (error: unknown) {
      console.warn('[LocationService] Sensores no respondieron en el tiempo límite:', error);

      // Si estamos en entorno web (navegador) y Capacitor falló, probar API del navegador
      if (!Capacitor.isNativePlatform() && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        try {
          const browserPos = await new Promise<TaskLocation>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                resolve({
                  latitude: Number(pos.coords.latitude.toFixed(6)),
                  longitude: Number(pos.coords.longitude.toFixed(6)),
                  accuracy: Math.round(pos.coords.accuracy),
                  timestamp: pos.timestamp,
                });
              },
              (geoErr) => reject(geoErr),
              { enableHighAccuracy: false, timeout: 2000, maximumAge: 900000 },
            );
          });
          return browserPos;
        } catch (webErr) {
          console.warn('[LocationService] Geolocalización de navegador falló:', webErr);
        }
      }

      // Si todos los sensores fallan o demoran:
      if (allowFallback) {
        console.info('[LocationService] Aplicando ubicación por defecto instantánea');
        return this.getFallbackLocation();
      }

      const errStr = error instanceof Error ? error.message : String(error);
      throw new Error(`El servicio de geolocalización no está disponible: ${errStr}`, { cause: error });
    }
  }

  /**
   * Retorna una ubicación estimada por defecto (Santiago Centro, Chile).
   */
  getFallbackLocation(): TaskLocation {
    const preset = CHILE_LOCATION_PRESETS[0];
    return {
      latitude: preset.latitude,
      longitude: preset.longitude,
      accuracy: 25,
      address: preset.address,
      city: preset.city,
      country: preset.country,
      timestamp: Date.now(),
    };
  }

  /**
   * Retorna las ubicaciones preestablecidas de Chile para selección rápida.
   */
  getPresets(): LocationPreset[] {
    return CHILE_LOCATION_PRESETS;
  }

  /**
   * Verifica el estado de permisos de geolocalización.
   */
  async checkPermissions(): Promise<boolean> {
    try {
      const status: PermissionStatus = await Geolocation.checkPermissions();
      return status.location === 'granted' || status.coarseLocation === 'granted';
    } catch (error) {
      console.warn('[LocationService] Error al verificar permisos:', error);
      return false;
    }
  }

  /**
   * Solicita los permisos necesarios de geolocalización al usuario.
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const status: PermissionStatus = await Geolocation.requestPermissions({
        permissions: ['location'],
      });
      return status.location === 'granted' || status.coarseLocation === 'granted';
    } catch (error) {
      console.warn('[LocationService] Error al solicitar permisos:', error);
      return false;
    }
  }
}
