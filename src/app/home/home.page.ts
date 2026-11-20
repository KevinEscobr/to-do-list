import { CommonModule } from '@angular/common';
import { Component, inject, ChangeDetectorRef, NgZone, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonFooter,
  IonList,
  IonItem,
  IonLabel,
  IonCheckbox,
  IonButton,
  IonButtons,
  IonIcon,
  IonInput,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonSegment,
  IonSegmentButton,
  IonSearchbar,
  IonNote,
  IonMenuButton,
  IonBadge,
  IonModal,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonChip,
  AlertController,
  ToastController,
  ActionSheetController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  trashOutline,
  addOutline,
  createOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  listOutline,
  trashBinOutline,
  folderOutline,
  flagOutline,
  cameraOutline,
  imageOutline,
  locationOutline,
  cloud,
  cloudOutline,
  cloudUpload,
  cloudDone,
  cloudUploadOutline,
  cloudDoneOutline,
  cloudDownloadOutline,
  navigateOutline,
  thermometerOutline,
  closeOutline,
  openOutline,
  refreshOutline,
  personCircleOutline,
  businessOutline,
  searchOutline,
  mapOutline,
  checkbox,
  checkmarkDoneCircleOutline,
  logoAndroid,
  downloadOutline,
} from 'ionicons/icons';

import type { Task, TaskCategory, TaskPriority, TaskLocation, TaskWeather } from '../models/task.model';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { CameraService } from '../services/camera.service';
import type { LocationPreset } from '../services/location.service';
import { LocationService } from '../services/location.service';
import { TaskService } from '../services/task.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonFooter,
    IonList,
    IonItem,
    IonLabel,
    IonCheckbox,
    IonButton,
    IonButtons,
    IonIcon,
    IonInput,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
    IonSegment,
    IonSegmentButton,
    IonSearchbar,
    IonNote,
    IonMenuButton,
    IonBadge,
    IonModal,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonChip,
  ],
})
export class HomePage {
  public taskService = inject(TaskService);
  public cameraService = inject(CameraService);
  public locationService = inject(LocationService);
  public apiService = inject(ApiService);
  public authService = inject(AuthService);

  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private actionSheetCtrl = inject(ActionSheetController);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  // Filtros de búsqueda
  newTaskText: string = '';
  filter: 'all' | 'pending' | 'completed' = 'all';
  categoryFilter: 'all' | TaskCategory = 'all';
  searchTerm: string = '';

  // Referencias a los modales nativos
  @ViewChild('createModal') createModal?: IonModal;
  @ViewChild('detailModal') detailModal?: IonModal;

  // Estado del Modal de Creación Avanzada
  isCreateModalOpen: boolean = false;
  formText: string = '';
  formDescription: string = '';
  formCategory: TaskCategory = 'Personal';
  formPriority: TaskPriority = 'Media';
  formImage: string | null = null;
  formLocation: TaskLocation | null = null;
  formWeather: TaskWeather | null = null;

  // Estados de carga de periféricos
  isCapturingPhoto: boolean = false;
  isGettingLocation: boolean = false;

  // Detalle de tarea
  selectedTask: Task | null = null;
  isDetailModalOpen: boolean = false;

  // Previsualización de imagen a pantalla completa
  isImagePreviewOpen: boolean = false;
  previewImageUrl: string | null = null;

  constructor() {
    addIcons({
      trashOutline,
      addOutline,
      createOutline,
      checkmarkCircleOutline,
      closeCircleOutline,
      listOutline,
      trashBinOutline,
      folderOutline,
      flagOutline,
      cameraOutline,
      imageOutline,
      locationOutline,
      cloud,
      cloudOutline,
      cloudUpload,
      cloudDone,
      cloudUploadOutline,
      cloudDoneOutline,
      cloudDownloadOutline,
      navigateOutline,
      thermometerOutline,
      closeOutline,
      openOutline,
      refreshOutline,
      personCircleOutline,
      businessOutline,
      searchOutline,
      mapOutline,
      checkbox,
      checkmarkDoneCircleOutline,
      logoAndroid,
      downloadOutline,
    });
  }

  // --- FILTRADO Y BÚSQUEDA REACTIVA ---
  get filteredTasks(): Task[] {
    const list = this.taskService.tasks();

    return list.filter((task) => {
      // 1. Filtro por estado
      if (this.filter === 'pending' && task.completed) return false;
      if (this.filter === 'completed' && !task.completed) return false;

      // 2. Filtro por categoría
      if (this.categoryFilter !== 'all' && task.category !== this.categoryFilter) return false;

      // 3. Filtro por texto / búsqueda
      if (this.searchTerm.trim() !== '') {
        const term = this.searchTerm.toLowerCase();
        const matchesTitle = task.text.toLowerCase().includes(term);
        const matchesDesc = task.description ? task.description.toLowerCase().includes(term) : false;
        const matchesLocation = task.location?.address ? task.location.address.toLowerCase().includes(term) : false;
        if (!matchesTitle && !matchesDesc && !matchesLocation) {
          return false;
        }
      }

      return true;
    });
  }

  // --- CREACIÓN RÁPIDA DE TAREA ---
  async addTaskQuick(): Promise<void> {
    const text = this.newTaskText.trim();
    if (!text) {
      await this.showToast('Ingresa un título para la tarea rápida', 'warning');
      return;
    }

    await this.taskService.addTask({
      text,
      category: 'Personal',
      priority: 'Media',
    });

    this.newTaskText = '';
    await this.showToast('Tarea agregada exitosamente', 'success');
  }

  // --- MODAL DE CREACIÓN AVANZADA ---
  openCreateModal(): void {
    this.ngZone.run(() => {
      this.resetCreateForm();
      this.formText = this.newTaskText.trim();
      this.newTaskText = '';
      this.isCreateModalOpen = true;
      this.cdr.detectChanges();
    });
  }

  openCreateModalWithLocation(): void {
    this.openCreateModal();
    void this.captureLocation();
  }

  closeCreateModal(): void {
    this.ngZone.run(() => {
      this.isCreateModalOpen = false;
      this.resetCreateForm();
      this.cdr.detectChanges();
    });
  }

  private resetCreateForm(): void {
    this.formText = '';
    this.formDescription = '';
    this.formCategory = 'Personal';
    this.formPriority = 'Media';
    this.formImage = null;
    this.formLocation = null;
    this.formWeather = null;
    this.isGettingLocation = false;
    this.isCapturingPhoto = false;
  }

  // --- INTERACCIÓN CON PERIFÉRICOS (CÁMARA / FOTOGRAFÍA) ---
  async takePhoto(): Promise<void> {
    this.ngZone.run(() => {
      this.isCapturingPhoto = true;
      this.cdr.detectChanges();
    });
    try {
      const photo = await this.cameraService.capturePhoto();
      this.ngZone.run(() => {
        if (photo && photo.dataUrl) {
          this.formImage = photo.dataUrl;
          void this.showToast('Fotografía capturada correctamente', 'success');
        }
        this.isCapturingPhoto = false;
        this.cdr.detectChanges();
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ngZone.run(() => {
        this.isCapturingPhoto = false;
        this.cdr.detectChanges();
      });
      if (!msg.toLowerCase().includes('cancel') && !msg.toLowerCase().includes('closed')) {
        await this.showToast(`Error de cámara: ${msg}`, 'warning');
      }
    } finally {
      this.ngZone.run(() => {
        this.isCapturingPhoto = false;
        this.cdr.detectChanges();
      });
    }
  }

  removeFormImage(): void {
    this.formImage = null;
  }

  // --- INTERACCIÓN CON PERIFÉRICOS (GPS / GEOLOCALIZACIÓN Y CLIMA) ---
  async captureLocation(): Promise<void> {
    this.ngZone.run(() => {
      this.isGettingLocation = true;
      this.cdr.detectChanges();
    });

    try {
      // 1. Obtención ultra-rápida de coordenadas (< 250 ms)
      const loc = await this.locationService.getCurrentLocation(true);

      // Feedback visual instantáneo (Optimistic UI): mostramos la tarjeta de inmediato en la zona de Angular
      this.ngZone.run(() => {
        this.formLocation = {
          ...loc,
          address: loc.address || `Lat: ${loc.latitude.toFixed(4)}, Lon: ${loc.longitude.toFixed(4)}`,
        };
        this.isGettingLocation = false; // Apagar el spinner de inmediato
        this.cdr.detectChanges();
      });

      // 2. Enriquecer EN PARALELO con OpenStreetMap Nominatim y Open-Meteo
      const needGeo = !loc.address || loc.address.startsWith('Lat:');
      const [geoRes, weatherRes] = await Promise.allSettled([
        needGeo ? this.apiService.reverseGeocode(loc.latitude, loc.longitude) : Promise.resolve(null),
        this.apiService.fetchWeather(loc.latitude, loc.longitude),
      ]);

      this.ngZone.run(() => {
        if (geoRes.status === 'fulfilled' && geoRes.value) {
          const geoInfo = geoRes.value;
          this.formLocation = {
            ...this.formLocation!,
            address: geoInfo.address || this.formLocation!.address,
            city: geoInfo.city || this.formLocation!.city,
            country: geoInfo.country || this.formLocation!.country,
          };
        }

        if (weatherRes.status === 'fulfilled' && weatherRes.value) {
          this.formWeather = weatherRes.value;
        }

        this.cdr.detectChanges();
      });

      const placeName = this.formLocation?.city || this.formLocation?.address || 'Ubicación';
      await this.showToast(`📍 Ubicación y clima: ${placeName}`, 'success');
    } catch (error: unknown) {
      console.warn('[HomePage] Error al obtener GPS, aplicando estimada:', error);
      await this.useDefaultLocation();
    } finally {
      this.ngZone.run(() => {
        this.isGettingLocation = false;
        this.cdr.detectChanges();
      });
    }
  }

  async openLocationPicker(): Promise<void> {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Opciones de Ubicación',
      buttons: [
        {
          text: 'Detectar mi Ubicación GPS',
          icon: 'navigate-outline',
          handler: () => {
            void this.captureLocation();
          },
        },
        {
          text: 'Elegir Ciudad Preestablecida',
          icon: 'business-outline',
          handler: () => {
            void this.selectPresetLocation();
          },
        },
        {
          text: 'Buscar Dirección (OpenStreetMap)',
          icon: 'search-outline',
          handler: () => {
            void this.searchLocationPrompt();
          },
        },
        {
          text: 'Cancelar',
          icon: 'close-outline',
          role: 'cancel',
        },
      ],
    });
    await actionSheet.present();
  }

  async selectPresetLocation(): Promise<void> {
    const presets = this.locationService.getPresets();
    const alert = await this.alertCtrl.create({
      header: 'Selecciona una Ciudad',
      inputs: presets.map((p, idx) => ({
        type: 'radio',
        label: `${p.name} (${p.city})`,
        value: p,
        checked: idx === 0,
      })),
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Seleccionar',
          handler: (selectedPreset: LocationPreset) => {
            if (selectedPreset) {
              void this.applyPresetLocation(selectedPreset);
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async applyPresetLocation(preset: LocationPreset): Promise<void> {
    this.ngZone.run(() => {
      this.formLocation = {
        latitude: preset.latitude,
        longitude: preset.longitude,
        accuracy: 15,
        address: preset.address,
        city: preset.city,
        country: preset.country,
        timestamp: Date.now(),
      };
      this.cdr.detectChanges();
    });

    // Obtener clima en segundo plano sin demorar la respuesta de la UI
    void this.apiService.fetchWeather(preset.latitude, preset.longitude).then((weather) => {
      if (weather) {
        this.ngZone.run(() => {
          this.formWeather = weather;
          this.cdr.detectChanges();
        });
      }
    });

    await this.showToast(`📍 Ubicación seleccionada: ${preset.name}`, 'success');
  }

  async searchLocationPrompt(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Buscar Dirección',
      subHeader: 'OpenStreetMap Nominatim',
      inputs: [
        {
          name: 'query',
          type: 'text',
          placeholder: 'Ej: Providencia, Viña del Mar...',
        },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Buscar',
          handler: async (data) => {
            const query = data.query?.trim();
            if (!query) return;

            const res = await this.apiService.geocodeAddress(query);
            if (res && typeof res.latitude === 'number' && typeof res.longitude === 'number') {
              const lat = res.latitude;
              const lon = res.longitude;
              this.ngZone.run(() => {
                this.formLocation = {
                  latitude: lat,
                  longitude: lon,
                  accuracy: 20,
                  address: res.address,
                  city: res.city,
                  country: res.country,
                  timestamp: Date.now(),
                };
                this.cdr.detectChanges();
              });

              const weather = await this.apiService.fetchWeather(lat, lon);
              if (weather) {
                this.ngZone.run(() => {
                  this.formWeather = weather;
                  this.cdr.detectChanges();
                });
              }
              await this.showToast(`📍 Ubicación encontrada: ${res.city || res.address}`, 'success');
            } else {
              await this.showToast('No se encontró la dirección en OpenStreetMap', 'warning');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async useDefaultLocation(): Promise<void> {
    const defaultCoords = {
      latitude: -33.4489,
      longitude: -70.6693,
      accuracy: 15,
      timestamp: Date.now(),
    };

    this.ngZone.run(() => {
      this.formLocation = {
        ...defaultCoords,
        address: 'Santiago Centro, Región Metropolitana, Chile',
        city: 'Santiago',
        country: 'Chile',
      };
      this.isGettingLocation = false;
      this.cdr.detectChanges();
    });

    try {
      const weather = await this.apiService.fetchWeather(defaultCoords.latitude, defaultCoords.longitude);
      if (weather) {
        this.ngZone.run(() => {
          this.formWeather = weather;
          this.cdr.detectChanges();
        });
      }
    } catch {
      // Ignorar si no hay conexión
    }

    await this.showToast('Ubicación predeterminada (Santiago) aplicada', 'success');
  }

  removeFormLocation(): void {
    this.formLocation = null;
    this.formWeather = null;
  }

  async saveNewTask(): Promise<void> {
    const title = this.formText.trim();
    if (!title) {
      await this.showToast('El título de la tarea es obligatorio', 'warning');
      return;
    }

    try {
      // 1. Guardar y persistir en la base de datos local (Capacitor Preferences)
      await this.taskService.addTask({
        text: title,
        description: this.formDescription.trim() || undefined,
        category: this.formCategory,
        priority: this.formPriority,
        imageUrl: this.formImage || undefined,
        location: this.formLocation || undefined,
        weather: this.formWeather || undefined,
      });

      // 2. Cerrar el modal inmediatamente de forma automática en NgZone
      await this.ngZone.run(async () => {
        this.isCreateModalOpen = false;
        this.resetCreateForm();
        this.cdr.detectChanges();

        if (this.createModal) {
          try {
            await this.createModal.dismiss();
          } catch {
            // Ya cerrado por [isOpen]
          }
        }
      });

      // 3. Notificación de confirmación al usuario tras el cierre automático
      await this.showToast('¡Tarea guardada exitosamente!', 'success');
    } catch (error) {
      console.error('[HomePage] Error al guardar tarea:', error);
      await this.showToast('Error al guardar la tarea en el almacenamiento local', 'danger');
    }
  }

  // --- GESTIÓN DE TAREAS EXISTENTES (UPDATE, TOGGLE, DELETE) ---
  async toggleTask(task: Task): Promise<void> {
    await this.taskService.toggleTask(task.id);
  }

  viewTaskDetail(task: Task): void {
    this.selectedTask = task;
    this.isDetailModalOpen = true;
  }

  closeDetailModal(): void {
    this.ngZone.run(async () => {
      this.isDetailModalOpen = false;
      this.selectedTask = null;
      this.cdr.detectChanges();
      if (this.detailModal) {
        try {
          await this.detailModal.dismiss();
        } catch {
          // Ya cerrado por [isOpen]
        }
      }
    });
  }

  async attachLocationToSelectedTask(): Promise<void> {
    if (!this.selectedTask) return;
    const task = this.selectedTask;

    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Ubicación para esta Tarea',
      buttons: [
        {
          text: 'Detectar mi Ubicación GPS',
          icon: 'navigate-outline',
          handler: async () => {
            const loc = await this.locationService.getCurrentLocation(true);
            // Actualización inmediata para retroalimentación instantánea
            await this.taskService.updateTaskLocation(task.id, loc, undefined);
            this.ngZone.run(() => {
              this.selectedTask = this.taskService.getTaskById(task.id) || null;
              this.cdr.detectChanges();
            });

            // Enriquecer en paralelo con dirección legible y clima
            const [geoRes, weatherRes] = await Promise.allSettled([
              this.apiService.reverseGeocode(loc.latitude, loc.longitude),
              this.apiService.fetchWeather(loc.latitude, loc.longitude),
            ]);

            const geo = geoRes.status === 'fulfilled' ? geoRes.value : null;
            const weather = weatherRes.status === 'fulfilled' ? weatherRes.value : undefined;

            const finalLoc: TaskLocation = {
              ...loc,
              address: geo?.address || loc.address || `Lat: ${loc.latitude}, Lon: ${loc.longitude}`,
              city: geo?.city || loc.city,
              country: geo?.country || loc.country,
            };

            await this.taskService.updateTaskLocation(task.id, finalLoc, weather);
            this.ngZone.run(() => {
              this.selectedTask = this.taskService.getTaskById(task.id) || null;
              this.cdr.detectChanges();
            });
            await this.showToast('📍 Ubicación y clima actualizados en la tarea', 'success');
          },
        },
        {
          text: 'Elegir Ciudad Preestablecida',
          icon: 'business-outline',
          handler: () => {
            void this.selectPresetForTask(task);
          },
        },
        ...(task.location
          ? [
              {
                text: 'Quitar Ubicación',
                icon: 'trash-outline',
                role: 'destructive' as const,
                handler: async () => {
                  await this.taskService.updateTaskLocation(task.id, undefined, undefined);
                  this.selectedTask = this.taskService.getTaskById(task.id) || null;
                  await this.showToast('Ubicación removida de la tarea', 'medium');
                },
              },
            ]
          : []),
        {
          text: 'Cancelar',
          icon: 'close-outline',
          role: 'cancel',
        },
      ],
    });
    await actionSheet.present();
  }

  private async selectPresetForTask(task: Task): Promise<void> {
    const presets = this.locationService.getPresets();
    const alert = await this.alertCtrl.create({
      header: 'Selecciona una Ciudad',
      inputs: presets.map((p, idx) => ({
        type: 'radio',
        label: `${p.name} (${p.city})`,
        value: p,
        checked: idx === 0,
      })),
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Seleccionar',
          handler: async (preset: LocationPreset) => {
            if (preset) {
              const loc: TaskLocation = {
                latitude: preset.latitude,
                longitude: preset.longitude,
                accuracy: 15,
                address: preset.address,
                city: preset.city,
                country: preset.country,
                timestamp: Date.now(),
              };
              const weather = await this.apiService.fetchWeather(preset.latitude, preset.longitude);
              await this.taskService.updateTaskLocation(task.id, loc, weather);
              this.ngZone.run(() => {
                this.selectedTask = this.taskService.getTaskById(task.id) || null;
                this.cdr.detectChanges();
              });
              await this.showToast(`📍 Ubicación actualizada a ${preset.name}`, 'success');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async openEditAlert(task: Task, event?: Event): Promise<void> {
    if (event) {
      event.stopPropagation();
    }

    const alert = await this.alertCtrl.create({
      header: 'Editar Tarea',
      inputs: [
        {
          name: 'text',
          type: 'text',
          placeholder: 'Título de la tarea*',
          value: task.text,
        },
        {
          name: 'description',
          type: 'textarea',
          placeholder: 'Descripción (opcional)',
          value: task.description || '',
        },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: (data) => {
            const title = data.text?.trim();
            if (!title) {
              this.showToast('El título no puede estar vacío', 'warning');
              return false;
            }

            this.taskService.updateTask(
              task.id,
              title,
              data.description?.trim() || undefined,
              task.category,
              task.priority,
              task.imageUrl,
            );
            this.showToast('Tarea actualizada', 'success');
            return true;
          },
        },
      ],
    });

    await alert.present();
  }

  async confirmDelete(task: Task, event?: Event): Promise<void> {
    if (event) {
      event.stopPropagation();
    }

    const alert = await this.alertCtrl.create({
      header: 'Eliminar Tarea',
      message: `¿Estás seguro de eliminar "${task.text}"? Esta acción no se puede deshacer.`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => {
            this.taskService.deleteTask(task.id);
            if (this.selectedTask?.id === task.id) {
              this.closeDetailModal();
            }
            this.showToast('Tarea eliminada', 'medium');
          },
        },
      ],
    });

    await alert.present();
  }

  // --- SELECCIÓN Y ELIMINACIÓN MÚLTIPLE DE TAREAS ---
  get allFilteredSelected(): boolean {
    const list = this.filteredTasks;
    return list.length > 0 && list.every((t) => t.completed);
  }

  async toggleSelectAll(): Promise<void> {
    const shouldSelect = !this.allFilteredSelected;
    const targetIds = new Set(this.filteredTasks.map((t) => t.id));
    await this.taskService.setCompletedForIds(targetIds, shouldSelect);
  }

  async uncheckAllCompleted(): Promise<void> {
    await this.taskService.setAllCompleted(false);
    await this.showToast('Se deseleccionaron todas las tareas', 'medium');
  }

  async confirmDeleteSelected(): Promise<void> {
    const completedCount = this.taskService.completedCount();
    if (completedCount === 0) {
      await this.showToast('No hay tareas seleccionadas para eliminar', 'warning');
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Eliminar Tareas Seleccionadas',
      message: `¿Estás seguro de eliminar las ${completedCount} tareas seleccionadas? Esta acción no se puede deshacer.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar todas',
          role: 'destructive',
          handler: async () => {
            const count = await this.taskService.clearCompleted();
            await this.showToast(`Se eliminaron ${count} tareas seleccionadas`, 'success');
          },
        },
      ],
    });

    await alert.present();
  }

  async confirmClearCompleted(): Promise<void> {
    return this.confirmDeleteSelected();
  }

  // --- SINCRONIZACIÓN E IMPORTACIÓN CON API EXTERNA ---
  async triggerSync(): Promise<void> {
    try {
      const res = await this.taskService.syncPendingTasks();
      const currentUserId = this.authService.currentUserId();
      if (currentUserId) {
        await this.taskService.fetchRemoteTasks(currentUserId);
      }
      if (res.syncedTasks === 0) {
        await this.showToast('Todas tus tareas ya se encuentran sincronizadas', 'success');
      } else {
        await this.showToast(`¡${res.syncedTasks} tareas sincronizadas con éxito!`, 'success');
      }
    } catch {
      await this.showToast('Error al conectar con el servidor de sincronización', 'danger');
    }
  }

  async triggerImport(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Importar desde API Externa',
      message: '¿Cuántas tareas de prueba deseas importar desde JSONPlaceholder?',
      inputs: [
        {
          name: 'count',
          type: 'number',
          min: 1,
          max: 20,
          value: '4',
        },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Importar',
          handler: async (data) => {
            const count = parseInt(data.count, 10) || 4;
            try {
              const imported = await this.taskService.importTasksFromApi(count);
              await this.showToast(`¡Se importaron ${imported} tareas desde la API externa!`, 'success');
            } catch {
              await this.showToast('No se pudieron importar tareas. Verifica tu conexión a internet.', 'danger');
            }
          },
        },
      ],
    });

    await alert.present();
  }

  // --- VISTA PREVIA DE IMAGEN ---
  openImagePreview(imageUrl: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.previewImageUrl = imageUrl;
    this.isImagePreviewOpen = true;
  }

  closeImagePreview(): void {
    this.isImagePreviewOpen = false;
    this.previewImageUrl = null;
  }

  openMaps(loc: TaskLocation, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const query = `${loc.latitude},${loc.longitude}`;
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    try {
      const win = window.open(url, '_blank');
      if (!win) {
        window.location.href = url;
      }
    } catch {
      window.location.href = url;
    }
  }

  // --- Descarga de APK Android ---
  async downloadApk(): Promise<void> {
    await this.showToast('Iniciando descarga de TaskFlowPro.apk...', 'success');
    const link = document.createElement('a');
    link.href = '/TaskFlowPro.apk';
    link.download = 'TaskFlowPro.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // --- Helpers UI ---
  getCategoryColor(cat: TaskCategory): string {
    switch (cat) {
      case 'Trabajo':
        return 'primary';
      case 'Estudio':
        return 'warning';
      case 'Personal':
      default:
        return 'tertiary';
    }
  }

  getPriorityColor(pri: TaskPriority): string {
    switch (pri) {
      case 'Alta':
        return 'danger';
      case 'Media':
        return 'warning';
      case 'Baja':
      default:
        return 'medium';
    }
  }

  private async showToast(
    message: string,
    color: 'success' | 'warning' | 'medium' | 'danger' = 'success',
  ): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      position: 'bottom',
      color,
    });
    await toast.present();
  }
}
