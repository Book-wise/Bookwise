import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { LanguageService } from '@services/language.service';
import { Quota } from '@models';

/**
 * Diálogo de bloqueo proactivo de creación (#12): se abre al tocar "Nuevo …"
 * cuando la cuota del plan ya está llena, con el uso actual y un CTA para
 * gestionar la suscripción. Es shared: sucursales, negocios y profesionales
 * pasan sus propias keys de título/detalle y su `Quota`.
 */
@Component({
  selector: 'bw-capacity-limit-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DialogModule, ButtonModule],
  templateUrl: './capacity-limit-dialog.component.html',
  styleUrl: './capacity-limit-dialog.component.scss',
})
export class CapacityLimitDialogComponent {
  private readonly router = inject(Router);
  readonly lang = inject(LanguageService);

  readonly visible = input<boolean>(false);
  readonly titleKey = input<string>('biz.account_tenant_limit_reached');
  readonly detailKey = input<string>('biz.account_tenant_limit_reached.detail');
  readonly quota = input<Quota | null>(null);
  readonly closed = output<void>();

  readonly title = computed(() => this.lang.t(this.titleKey()));
  readonly detail = computed(() => this.lang.t(this.detailKey()));
  readonly usageLabel = computed(() => {
    const q = this.quota();
    return q
      ? this.lang.t('biz.capacity_usage', { current: String(q.current), limit: String(q.limit) })
      : '';
  });

  close(): void {
    this.closed.emit();
  }

  goToUpgrade(): void {
    this.closed.emit();
    this.router.navigate(['/admin/planes/administrar']);
  }
}
