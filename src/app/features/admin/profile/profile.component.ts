import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { AuthService } from '@services/auth.service';
import { LanguageService } from '@services/language.service';

@Component({
  selector: 'bw-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, CardModule, InputTextModule, ButtonModule, MessageModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit {
  private auth = inject(AuthService);
  readonly lang = inject(LanguageService);

  loading = signal(false);

  readonly me = computed(() => this.auth.me());

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
}
