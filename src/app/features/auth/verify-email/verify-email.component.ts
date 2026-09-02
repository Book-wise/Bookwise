import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { AuthApiService } from '@services/api/auth-api.service';
import { LanguageService } from '@services/language.service';
import { AuthLayoutComponent } from '@shared/components/auth-layout/auth-layout.component';

/** Estado de UI. Los códigos 400 del backend (`invalid_token`, `token_expired`,
 *  `token_already_used`) mapean a estados propios; `error` es el fallback genérico. */
type VerifyState = 'loading' | 'success' | 'invalid_token' | 'token_expired' | 'token_already_used' | 'error';

/** i18n key del mensaje de cada código de error 400 devuelto por PATCH /auth/verify-email. */
const VERIFY_ERROR_TEXT_KEYS: Record<string, string> = {
  invalid_token: 'auth.verify_email_invalid_token',
  token_expired: 'auth.verify_email_token_expired',
  token_already_used: 'auth.verify_email_token_already_used',
};

@Component({
  selector: 'bw-verify-email',
  standalone: true,
  imports: [CommonModule, RouterLink, ButtonModule, MessageModule, AuthLayoutComponent],
  templateUrl: './verify-email.component.html',
  styleUrls: ['./verify-email.component.scss'],
})
export class VerifyEmailComponent implements OnInit {
  private authApi = inject(AuthApiService);
  private route = inject(ActivatedRoute);
  readonly lang = inject(LanguageService);

  state = signal<VerifyState>('loading');
  emailVerifiedAt = signal<string | null>(null);

  /** Mensaje (i18n key) a mostrar en el panel de error según el estado actual. */
  readonly errorMessageKey = computed(() => VERIFY_ERROR_TEXT_KEYS[this.state()] ?? 'auth.verify_email_error');

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.state.set('error');
      return;
    }

    this.authApi.verifyEmail(token).subscribe({
      next: ({ user }) => {
        this.emailVerifiedAt.set(user.email_verified_at ?? null);
        this.state.set('success');
      },
      error: (err) => {
        const code = err?.error?.error as string | undefined;
        this.state.set(
          code === 'invalid_token' || code === 'token_expired' || code === 'token_already_used'
            ? code
            : 'error',
        );
      },
    });
  }
}
