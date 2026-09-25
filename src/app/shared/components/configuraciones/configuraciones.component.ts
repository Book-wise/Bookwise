import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { RouterLink } from '@angular/router';
import { Appearance, APPEARANCE_OPTIONS, ThemeService, ThemeName } from '@services/theme.service';
import { LanguageService, Language } from '@services/language.service';
import { AuthService } from '@services/auth.service';
import { UserAvatarComponent } from '@shared/components/user-avatar/user-avatar.component';

@Component({
  selector: 'bw-configuraciones',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, ButtonModule, SelectModule,
    RouterLink, UserAvatarComponent,
  ],
  templateUrl: './configuraciones.component.html',
  styleUrls: ['./configuraciones.component.scss'],
})
export class ConfiguracionesComponent {
  private auth = inject(AuthService);
  private themeService = inject(ThemeService);
  readonly lang = inject(LanguageService);

  readonly appearance = computed(() => this.themeService.appearance);
  readonly appearanceOptions = computed(() =>
    APPEARANCE_OPTIONS.map((opt) => ({ label: this.lang.t(opt.labelKey), value: opt.value })),
  );
  readonly currentTheme = computed(() => this.themeService.currentTheme);
  readonly themeOptions = this.themeService.themeOptions;

  readonly userName = computed(() => this.auth.user()?.name ?? '');
  readonly userEmail = computed(() => this.auth.user()?.email ?? '');
  readonly userRoleLabel = computed(() => {
    const role = this.auth.userRole();
    if (role === 'admin') return this.lang.t('ui.role.admin');
    if (role === 'provider') return this.lang.t('ui.role.provider');
    return '';
  });
  readonly isAdmin = computed(() => this.auth.isAdmin());
  readonly business = computed(() => this.auth.me()?.business ?? null);
  readonly businessMonogram = computed(() =>
    (this.business()?.name || 'B').trim().charAt(0).toUpperCase(),
  );

  readonly profileRoute = computed(() =>
    this.isAdmin() ? '/admin/profile' : '/provider/profile',
  );

  onThemeChange(v: ThemeName): void {
    this.themeService.setTheme(v);
  }

  onAppearanceChange(mode: Appearance): void {
    this.themeService.setAppearance(mode);
  }

  onLangChange(v: Language): void {
    this.lang.setLang(v);
  }
}
