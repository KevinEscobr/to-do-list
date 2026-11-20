import { CommonModule } from '@angular/common';
import { Component, inject, signal, ChangeDetectorRef, type OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  AlertController,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonIcon,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  logInOutline,
  personAddOutline,
  lockClosedOutline,
  mailOutline,
  personOutline,
  checkmarkCircleOutline,
  serverOutline,
  refreshOutline,
  shieldCheckmarkOutline,
  alertCircleOutline,
  flashOutline,
  settingsOutline,
  wifiOutline,
  globeOutline,
  logoAndroid,
  downloadOutline,
} from 'ionicons/icons';

import { AuthService } from '../services/auth.service';
import { BackendApiService } from '../services/backend-api.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonIcon,
    IonSegment,
    IonSegmentButton,
    IonSpinner,
  ],
})
export class LoginPage implements OnInit {
  private authService = inject(AuthService);
  private backendApi = inject(BackendApiService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private cdr = inject(ChangeDetectorRef);

  mode: 'login' | 'register' = 'login';
  isLoading = signal<boolean>(false);

  // Estado de conexión en tiempo real con el servidor y la base de datos
  serverStatus = signal<{ online: boolean; database: string; checking: boolean }>({
    online: false,
    database: 'Comprobando conexión...',
    checking: true,
  });

  // Campos de formulario
  loginIdentifier: string = '';
  loginPassword: string = '';

  registerUsername: string = '';
  registerEmail: string = '';
  registerName: string = '';
  registerPassword: string = '';
  registerPasswordConfirm: string = '';

  constructor() {
    addIcons({
      logInOutline,
      personAddOutline,
      lockClosedOutline,
      mailOutline,
      personOutline,
      checkmarkCircleOutline,
      serverOutline,
      refreshOutline,
      shieldCheckmarkOutline,
      alertCircleOutline,
      flashOutline,
      settingsOutline,
      wifiOutline,
      globeOutline,
      logoAndroid,
      downloadOutline,
    });
  }

  ngOnInit(): void {
    this.checkServerHealth();
  }

  /**
   * Verifica la conexión en tiempo real con el backend y la BD MySQL.
   */
  async checkServerHealth(): Promise<void> {
    this.serverStatus.update((s) => ({ ...s, checking: true }));
    this.cdr.detectChanges();
    try {
      const health = await this.backendApi.checkHealth();
      this.serverStatus.set({
        online: health.online,
        database: health.online
          ? `${health.database} (${health.isLanFallback ? 'LAN 192.168.1.5' : 'Nube'})`
          : health.error || 'Servidor no responde',
        checking: false,
      });
    } catch {
      this.serverStatus.set({
        online: false,
        database: 'Servidor no responde',
        checking: false,
      });
    } finally {
      this.cdr.detectChanges();
    }
  }

  /**
   * Abre cuadro de diálogo para configurar o cambiar la dirección del servidor.
   */
  async openServerConfig(): Promise<void> {
    const currentUrl = this.backendApi.getBaseUrl();
    const alert = await this.alertCtrl.create({
      header: 'Servidor & Base de Datos',
      subHeader: 'Dirección actual del backend:',
      inputs: [
        {
          name: 'serverUrl',
          type: 'url',
          value: currentUrl,
          placeholder: 'https://todolist.nennge.me/api',
        },
      ],
      buttons: [
        {
          text: 'Usar LAN (192.168.1.5)',
          handler: () => {
            this.backendApi.setActiveUrl('http://192.168.1.5:3000/api');
            this.checkServerHealth();
          },
        },
        {
          text: 'Usar Nube (nennge.me)',
          handler: () => {
            this.backendApi.setActiveUrl('https://todolist.nennge.me/api');
            this.checkServerHealth();
          },
        },
        {
          text: 'Guardar y Probar',
          handler: (data) => {
            if (data?.serverUrl) {
              this.backendApi.setActiveUrl(data.serverUrl);
              this.checkServerHealth();
            }
          },
        },
      ],
    });
    await alert.present();
  }

  /**
   * Llena automáticamente los campos con la cuenta de prueba oficial.
   */
  fillDemoCredentials(): void {
    this.loginIdentifier = 'demo';
    this.loginPassword = '123456';
    this.cdr.detectChanges();
  }

  async handleLogin(): Promise<void> {
    if (!this.loginIdentifier.trim() || !this.loginPassword.trim()) {
      await this.showToast('Por favor completa todos los campos de acceso', 'warning');
      return;
    }

    this.isLoading.set(true);
    this.cdr.detectChanges();

    try {
      const user = await this.authService.login(this.loginIdentifier, this.loginPassword);
      await this.showToast(`¡Bienvenido de vuelta, ${user.name}!`, 'success');
      this.router.navigate(['/home'], { replaceUrl: true });
    } catch (error: any) {
      await this.showToast(error.message || 'Error al iniciar sesión', 'danger');
    } finally {
      this.isLoading.set(false);
      this.cdr.detectChanges();
    }
  }

  async handleRegister(): Promise<void> {
    if (
      !this.registerUsername.trim() ||
      !this.registerEmail.trim() ||
      !this.registerName.trim() ||
      !this.registerPassword.trim()
    ) {
      await this.showToast('Todos los campos son obligatorios', 'warning');
      return;
    }

    if (this.registerPassword !== this.registerPasswordConfirm) {
      await this.showToast('Las contraseñas no coinciden', 'warning');
      return;
    }

    if (this.registerPassword.length < 4) {
      await this.showToast('La contraseña debe tener al menos 4 caracteres', 'warning');
      return;
    }

    this.isLoading.set(true);
    this.cdr.detectChanges();

    try {
      const user = await this.authService.register(
        this.registerUsername,
        this.registerEmail,
        this.registerName,
        this.registerPassword,
      );
      await this.showToast(`¡Cuenta creada con éxito! Bienvenido, ${user.name}`, 'success');
      this.router.navigate(['/home'], { replaceUrl: true });
    } catch (error: any) {
      await this.showToast(error.message || 'Error al registrar la cuenta', 'danger');
    } finally {
      this.isLoading.set(false);
      this.cdr.detectChanges();
    }
  }

  async downloadApk(): Promise<void> {
    await this.showToast('Iniciando descarga de TaskFlowPro.apk...', 'success');
    const link = document.createElement('a');
    link.href = '/TaskFlowPro.apk';
    link.download = 'TaskFlowPro.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'danger' = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'bottom',
      color,
    });
    await toast.present();
  }
}
