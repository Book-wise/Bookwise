import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MenubarModule } from 'primeng/menubar';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { FormsModule } from '@angular/forms';
import { MenuItem } from 'primeng/api';
import { AuthService } from '@services/auth.service';
import { LanguageService, Language } from '@services/language.service';

@Component({
  selector: 'bw-provider-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, MenubarModule, ButtonModule, SelectModule, ToastModule, FormsModule],
  templateUrl: './provider-layout.component.html',
  styleUrl: './provider-layout.component.scss',
})
export class ProviderLayoutComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  readonly langService = inject(LanguageService);

  menuItems = computed<MenuItem[]>(() => [
    { label: this.langService.t('nav.my_schedule'), icon: 'pi pi-calendar', routerLink: '/provider' },
    { label: this.langService.t('nav.availability'), icon: 'pi pi-clock', routerLink: '/provider/availability' },
  ]);

  onLangChange(lang: Language): void {
    this.langService.setLang(lang);
  }

  logout(): void {
    this.authService.logout();
  }
}
