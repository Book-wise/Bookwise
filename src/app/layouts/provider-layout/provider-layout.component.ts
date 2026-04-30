import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MenubarModule } from 'primeng/menubar';
import { ButtonModule } from 'primeng/button';
import { MenuItem } from 'primeng/api';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-provider-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, MenubarModule, ButtonModule],
  template: `
    <div class="layout">
      <p-menubar [model]="menuItems">
        <ng-template pTemplate="start">
          <span class="app-title">Kinesilk - Profesional</span>
        </ng-template>
        <ng-template pTemplate="end">
          <p-button 
            icon="pi pi-sign-out" 
            label="Salir" 
            styleClass="p-button-text"
            (onClick)="logout()">
          </p-button>
        </ng-template>
      </p-menubar>
      
      <div class="content">
        <router-outlet></router-outlet>
      </div>
    </div>
  `,
  styles: [`
    .layout {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    
    .app-title {
      font-weight: bold;
      font-size: 1.2rem;
      margin-right: 2rem;
      color: #333;
    }
    
    .content {
      flex: 1;
      padding: 1.5rem;
      background: #f8f9fa;
    }
  `]
})
export class ProviderLayoutComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  menuItems: MenuItem[] = [
    { label: 'Mi Agenda', icon: 'pi pi-calendar', routerLink: '/provider' },
    { label: 'Disponibilidad', icon: 'pi pi-clock', routerLink: '/provider/availability' },
  ];

  logout(): void {
    this.authService.logout();
  }
}