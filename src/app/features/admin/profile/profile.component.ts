import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { AuthService } from '@services/auth.service';
import { LanguageService } from '@services/language.service';
import { AuthApiService } from '@services/api/auth-api.service';
import { translateValidationMessage } from '@i18n/validation-translator';
import { ChangePasswordData } from '@models';
import { checkPasswordStrength, isPasswordStrong } from '@shared/validators/password-strength.validator';
import { PhoneInputComponent } from '@shared/components/phone-input/phone-input.component';
import { UserAvatarComponent } from '@shared/components/user-avatar/user-avatar.component';

@Component({
  selector: 'bw-profile',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, CardModule, InputTextModule, PasswordModule, ButtonModule,
    MessageModule, PhoneInputComponent, UserAvatarComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit {
  private auth = inject(AuthService);
  private authApi = inject(AuthApiService);
  private messageService = inject(MessageService);
  readonly lang = inject(LanguageService);

  loading = signal(false);

  readonly me = computed(() => this.auth.me());

  // ── Identidad del usuario autenticado (avatar + nombre + rol de sesión) ─────
  readonly userName = computed(() => this.auth.user()?.name ?? this.me()?.name ?? '');
  readonly userRoleLabel = computed(() => {
    const role = this.auth.userRole();
    if (role === 'admin') return this.lang.t('ui.role.admin');
    if (role === 'provider') return this.lang.t('ui.role.provider');
    return '';
  });

  // ── Teléfono editable (mismo widget del registro: bandera + código de país) ──
  readonly phone = signal('');
  readonly phoneSaving = signal(false);
  readonly phoneError = signal<string | null>(null);
  private readonly phoneSeeded = signal(false);

  // ── Cambio de contraseña ───────────────────────────────────────────────────
  readonly pwSaving = signal(false);
  readonly pwCurrent = signal('');
  readonly pwNew = signal('');
  readonly pwConfirm = signal('');
  readonly pwFieldErrors = signal<{ current?: string; password?: string }>({});
  readonly pwError = signal<string | null>(null);

  /** Checkpoints de fortaleza de la contraseña nueva (para la UI bajo el campo). */
  readonly pwStrengthChecks = computed(() => checkPasswordStrength(this.pwNew()));
  readonly pwStrong = computed(() => isPasswordStrong(this.pwNew()));

  /** Coincidencia en vivo entre contraseña nueva y su confirmación. */
  readonly pwMatch = computed(() =>
    this.pwNew().length > 0 && this.pwNew() === this.pwConfirm(),
  );
  readonly pwMismatch = computed(() =>
    this.pwConfirm().length > 0 && this.pwNew() !== this.pwConfirm(),
  );

  constructor() {
    // Siembra el teléfono editable apenas /auth/me está disponible (una sola vez,
    // sin pisar lo que el usuario esté editando tras un refresh del caché).
    effect(() => {
      const me = this.auth.me();
      if (me && !this.phoneSeeded()) {
        this.phoneSeeded.set(true);
        this.phone.set(me.phone ?? '');
      }
    });
  }

  ngOnInit(): void {
    // Si el guard ya cacheó /auth/me no re-peticiona; si no, lo cargamos.
    if (!this.auth.meLoaded()) {
      this.loading.set(true);
      this.auth.loadMe().subscribe({
        next: () => this.loading.set(false),
        error: () => this.loading.set(false),
      });
    }
  }

  /** PATCH /auth/me — persiste el teléfono editado (contrato backend "profile phone update"). */
  savePhone(): void {
    const phone = this.phone().trim();
    if (!phone) {
      this.phoneError.set(this.lang.t('profile.personal.phone_required'));
      return;
    }

    this.phoneError.set(null);
    this.phoneSaving.set(true);
    this.authApi.updateProfile({ phone }).subscribe({
      next: () => {
        this.phoneSaving.set(false);
        // Refresca el caché de /auth/me para que el resto de la app vea el nuevo teléfono.
        this.auth.loadMe(true).subscribe();
        this.messageService.add({
          severity: 'success',
          summary: this.lang.t('profile.personal.phone_saved_title'),
          detail: this.lang.t('profile.personal.phone_saved'),
          key: 'global',
          life: 4000,
        });
      },
      error: (err) => {
        this.phoneSaving.set(false);
        const apiErrors = err.error?.errors as Record<string, string[]> | undefined;
        const lang = this.lang.lang();
        if (apiErrors?.['phone']?.length) {
          this.phoneError.set(translateValidationMessage(apiErrors['phone'][0], lang));
        } else {
          this.phoneError.set(
            translateValidationMessage(
              err.error?.message ?? 'profile.personal.phone_error',
              lang,
            ),
          );
        }
      },
    });
  }

  /** POST /auth/password — habilita el cambio de contraseña del usuario autenticado. */
  changePassword(): void {
    const current = this.pwCurrent().trim();
    const password = this.pwNew();
    const confirm = this.pwConfirm();

    this.pwFieldErrors.set({});
    this.pwError.set(null);

    if (!current || !password || !confirm) {
      this.pwError.set(this.lang.t('profile.change_password.required'));
      return;
    }
    if (password !== confirm) {
      this.pwFieldErrors.set({ password: this.lang.t('profile.change_password.mismatch') });
      return;
    }
    if (!isPasswordStrong(password)) {
      this.pwFieldErrors.set({ password: this.lang.t('profile.change_password.weak') });
      return;
    }

    const payload: ChangePasswordData = {
      current_password: current,
      password,
      password_confirmation: confirm,
    };

    this.pwSaving.set(true);
    this.authApi.changePassword(payload).subscribe({
      next: (res) => {
        this.pwSaving.set(false);
        this.messageService.add({
          severity: 'success',
          summary: this.lang.t('profile.change_password.success_title'),
          detail: res.message ?? this.lang.t('profile.change_password.success'),
          key: 'global',
          life: 4000,
        });
        this.pwCurrent.set('');
        this.pwNew.set('');
        this.pwConfirm.set('');
      },
      error: (err) => {
        this.pwSaving.set(false);
        const apiErrors = err.error?.errors as Record<string, string[]> | undefined;
        const lang = this.lang.lang();
        if (apiErrors) {
          const map: { current?: string; password?: string } = {};
          if (apiErrors['current_password']?.length) {
            map['current'] = translateValidationMessage(apiErrors['current_password'][0], lang);
          }
          if (apiErrors['password']?.length) {
            map['password'] = translateValidationMessage(apiErrors['password'][0], lang);
          }
          this.pwFieldErrors.set(map);
          if (!Object.keys(map).length) {
            this.pwError.set(
              Object.values(apiErrors).flat().map((m) => translateValidationMessage(m, lang)).join(' '),
            );
          }
        } else {
          this.pwError.set(
            translateValidationMessage(
              err.error?.message ?? 'profile.change_password.error',
              lang,
            ),
          );
        }
      },
    });
  }
}
