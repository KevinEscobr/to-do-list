import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import {
  IonApp,
  IonRouterOutlet,
  IonMenu,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonIcon,
  IonLabel,
  IonMenuToggle,
  IonBadge,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  checkboxOutline,
  checkmarkDoneCircleOutline,
  sparklesOutline,
  cloudUploadOutline,
  cloudDownloadOutline,
  logOutOutline,
  personCircleOutline,
  syncOutline,
  logInOutline,
  logoAndroid,
  downloadOutline,
} from 'ionicons/icons';

import { AuthService } from './services/auth.service';
import { TaskService } from './services/task.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    IonApp,
    IonRouterOutlet,
    IonMenu,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonIcon,
    IonLabel,
    IonMenuToggle,
    IonBadge,
  ],
})
export class AppComponent {
  public authService = inject(AuthService);
  public taskService = inject(TaskService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  constructor() {
    addIcons({
      checkboxOutline,
      checkmarkDoneCircleOutline,
      sparklesOutline,
      cloudUploadOutline,
      cloudDownloadOutline,
      logOutOutline,
      personCircleOutline,
      syncOutline,
      logInOutline,
      logoAndroid,
      downloadOutline,
    });
  }

  async syncNow(): Promise<void> {
    try {
      const res = await this.taskService.syncPendingTasks();
      const toast = await this.toastCtrl.create({
        message: `Sincronización completada: ${res.syncedTasks} sincronizadas exitosamente.`,
        duration: 2500,
        color: res.success ? 'success' : 'warning',
        position: 'bottom',
      });
      await toast.present();
    } catch {
      const toast = await this.toastCtrl.create({
        message: 'Error al sincronizar con el servidor web.',
        duration: 2500,
        color: 'danger',
        position: 'bottom',
      });
      await toast.present();
    }
  }

  async importNow(): Promise<void> {
    try {
      const count = await this.taskService.importTasksFromApi(5);
      const toast = await this.toastCtrl.create({
        message: `¡Se importaron ${count} tareas desde la API externa!`,
        duration: 2500,
        color: 'success',
        position: 'bottom',
      });
      await toast.present();
    } catch {
      const toast = await this.toastCtrl.create({
        message: 'No fue posible importar tareas desde la API.',
        duration: 2500,
        color: 'danger',
        position: 'bottom',
      });
      await toast.present();
    }
  }

  async downloadApk(): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: 'Iniciando descarga de TaskFlowPro.apk...',
      duration: 2000,
      position: 'bottom',
      color: 'success',
    });
    await toast.present();
    const link = document.createElement('a');
    link.href = 'https://todolist.nennge.me/TaskFlowPro.apk';
    link.target = '_blank';
    link.download = 'TaskFlowPro.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async logout(): Promise<void> {
    await this.authService.logout();
    this.router.navigate(['/login'], { replaceUrl: true });
    const toast = await this.toastCtrl.create({
      message: 'Sesión cerrada correctamente',
      duration: 2000,
      position: 'bottom',
      color: 'medium',
    });
    await toast.present();
  }
}
