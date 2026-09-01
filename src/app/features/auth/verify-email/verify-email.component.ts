import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { AuthApiService } from '@services/api/auth-api.service';
import { LanguageService } from '@services/language.service';
import { AuthLayoutComponent } from '@shared/components/auth-layout/auth-layout.component';

type VerifyState = 'loading' | 'success' | 'error';

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

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.state.set('error');
      return;
    }

    this.authApi.verifyEmail(token).subscribe({
      next: ({ data }) => {
        this.emailVerifiedAt.set(data.email_verified_at);
        this.state.set('success');
      },
      error: () => {
        this.state.set('error');
      },
    });
  }
}
