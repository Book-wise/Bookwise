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
  templateUrl: './provider-layout.component.html',
  styleUrl: './provider-layout.component.scss',
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
