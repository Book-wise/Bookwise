import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ButtonModule, CardModule],
  template: `
    <div class="login-container">
      <p-card header="Kinesilk Agenda" styleClass="login-card">
        <p class="subtitle">Sistema de gestión de agenda</p>
        
        <div class="login-buttons">
          <p-button 
            label="Entrar como Administrador" 
            icon="pi pi-user" 
            (onClick)="loginAsAdmin()"
            styleClass="p-button-lg p-button-primary w-full mb-3">
          </p-button>
          
          <p-button 
            label="Entrar como Profesional" 
            icon="pi pi-id-card" 
            (onClick)="loginAsProvider()"
            styleClass="p-button-lg p-button-secondary w-full">
          </p-button>
        </div>
        
        <p class="note">Modo desarrollo - Sin validación real</p>
      </p-card>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    
    :host ::ng-deep .login-card {
      width: 400px;
      max-width: 90vw;
    }
    
    .subtitle {
      text-align: center;
      color: #666;
      margin-bottom: 2rem;
    }
    
    .login-buttons {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    
    .w-full {
      width: 100%;
    }
    
    .mb-3 {
      margin-bottom: 1rem;
    }
    
    .note {
      text-align: center;
      font-size: 0.8rem;
      color: #999;
      margin-top: 1.5rem;
    }
  `]
})
export class LoginComponent {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  loginAsAdmin(): void {
    this.authService.setMockUser('admin');
    this.router.navigate(['/admin']);
  }

  loginAsProvider(): void {
    this.authService.setMockUser('provider');
    this.router.navigate(['/provider']);
  }
}