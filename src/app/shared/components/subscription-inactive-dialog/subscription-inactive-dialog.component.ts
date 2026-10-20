import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '@services/auth.service';
import { LanguageService } from '@services/language.service';
import { SubscriptionStatusService } from '@services/subscription-status.service';

/**
 * Global blocking dialog for 402 `subscription_inactive`.
 * The account owner gets a "Reactivar suscripción" CTA → facturación; everyone
 * else gets an informational message to contact the account administrator.
 */
@Component({
  selector: 'bw-subscription-inactive-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DialogModule, ButtonModule],
  templateUrl: './subscription-inactive-dialog.component.html',
  styleUrl: './subscription-inactive-dialog.component.scss',
})
export class SubscriptionInactiveDialogComponent {
  private readonly status = inject(SubscriptionStatusService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly lang = inject(LanguageService);

  readonly visible = this.status.inactive;
  readonly isOwner = computed(() => this.auth.isAdminGeneral());

  reactivate(): void {
    this.status.clear();
    this.router.navigate(['/admin/facturacion']);
  }

  dismiss(): void {
    this.status.clear();
  }
}
