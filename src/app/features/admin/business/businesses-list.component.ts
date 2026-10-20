import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { AuthService } from '@services/auth.service';
import { LanguageService } from '@services/language.service';
import { TenantSwitchService } from '@services/tenant-switch.service';
import { SubscriptionStore } from '@core/stores/subscription.store';
import { Business } from '@models';
import { UserAvatarComponent } from '@shared/components/user-avatar/user-avatar.component';
import { switchTenantErrorKey } from '@shared/utils/switch-tenant-error.util';
import { planLabel } from '@shared/utils/plan-label.util';

/**
 * Listado de negocios (gestión multi-tenant).
 *
 * El admin general ve TODOS los negocios donde tiene rol de negocio; el admin
 * local ve solo el suyo (fuente: me().businesses, ya filtrado por pivots).
 * Permite crear un negocio nuevo y navegar a la edición de cada uno.
 *
 * El plan NO es una propiedad por negocio: es de la CUENTA (backend
 * `resolvedPlanSlug()` desde la suscripción). Por eso se muestra una única vez
 * arriba, con el nombre real del plan actual de la cuenta.
 */
@Component({
  selector: 'bw-businesses-list',
  standalone: true,
  imports: [CommonModule, ButtonModule, CardModule, UserAvatarComponent, RouterModule],
  templateUrl: './businesses-list.component.html',
  styleUrl: './businesses-list.component.scss',
})
export class BusinessesListComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly tenantSwitch = inject(TenantSwitchService);
  private readonly messageService = inject(MessageService);
  private readonly store = inject(SubscriptionStore);
  readonly lang = inject(LanguageService);

  readonly businesses = computed(() => this.auth.me()?.businesses ?? []);
  readonly activeBusinessId = computed(() => this.auth.me()?.business?.id ?? null);
  readonly isAdminGeneral = computed(() => this.auth.isAdminGeneral());
  readonly canSwitch = computed(() => this.businesses().length > 1);

  readonly loading = signal(false);

  ngOnInit(): void {
    this.store.loadSubscription();
  }

  /** Nombre legible del plan actual de la cuenta. */
  readonly currentPlanLabel = computed(() =>
    planLabel(this.lang, this.store.subscription()?.plan?.slug ?? null),
  );

  /** Navega a la página de planes y precios. */
  goToPlans(): void {
    this.router.navigate(['/admin/planes']);
  }

  /** Navega a la edición de un negocio. */
  editBusiness(biz: Business): void {
    this.router.navigate(['/admin/negocios', biz.id]);
  }

  /** Navega a la creación de un negocio nuevo. */
  newBusiness(): void {
    this.router.navigate(['/admin/negocios/nuevo']);
  }

  /** Cambia el negocio activo (admin_general) delegando en el coordinador. */
  switchTo(biz: Business): void {
    if (biz.id === this.activeBusinessId()) return;
    this.tenantSwitch.switchTenant(biz.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.lang.t('biz.switched_to', { name: biz.name }),
          key: 'global',
          life: 3500,
        });
      },
      error: (err) =>
        this.messageService.add({
          severity: 'error',
          summary: this.lang.t('ui.error'),
          detail: this.lang.t(switchTenantErrorKey(err)),
          key: 'global',
          life: 4000,
        }),
    });
  }
}
