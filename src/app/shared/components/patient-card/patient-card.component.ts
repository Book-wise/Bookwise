import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { PopoverModule } from 'primeng/popover';
import { SkeletonModule } from 'primeng/skeleton';
import { Client } from '@models';
import { LanguageService } from '@services/language.service';
import { ClientDetailStore } from '@core/stores/client-detail.store';
import { STATUS_COLOR_MAP } from '@features/admin/bookings/constants/booking-statuses';

export type PatientTab = 'planes' | 'sesiones' | 'prepago' | 'recientes';

@Component({
  selector: 'bw-patient-card',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, CheckboxModule, PopoverModule, SkeletonModule],
  templateUrl: './patient-card.component.html',
  styleUrl: './patient-card.component.scss',
})
export class PatientCardComponent {
  readonly detailStore = inject(ClientDetailStore);
  readonly lang = inject(LanguageService);

  // expose to template
  readonly STATUS_COLOR_MAP = STATUS_COLOR_MAP;

  // ── Inputs ───────────────────────────────────────────────────────────────────

  readonly client            = input.required<Client>();
  readonly showNotifications = input<boolean>(false);
  readonly showEdit          = input<boolean>(true);

  // ── Outputs ──────────────────────────────────────────────────────────────────

  readonly editRequested = output<void>();

  // ── Tab navigation ────────────────────────────────────────────────────────────

  readonly activeTab = signal<PatientTab | null>(null);

  // ── Notifications state ───────────────────────────────────────────────────────

  readonly notifOpen       = signal(false);
  readonly notifCitaEmail  = signal(false);
  readonly notifCitaWa     = signal(false);
  readonly reminderEmail   = signal(false);
  readonly reminderWa      = signal(false);

  // ── Computed: identity ────────────────────────────────────────────────────────

  readonly initials = computed(() => {
    const c = this.client();
    return `${c.first_name?.[0] ?? ''}${c.last_name?.[0] ?? ''}`.toUpperCase() || '?';
  });

  readonly whatsappHref = computed(() => {
    const phone = this.client().phone ?? '';
    return `https://wa.me/${phone.replace(/\D/g, '')}`;
  });

  readonly hasContactWarning = computed(() => {
    const c = this.client();
    return !c.email || !c.phone;
  });

  // ── Computed: badge counts (from store) ──────────────────────────────────────

  readonly plansCount = computed(() =>
    this.detailStore.packs().data.filter(p => p.status === 'active').length
  );

  readonly sessionsCount = computed(() =>
    this.detailStore.packs().data
      .filter(p => p.status === 'active')
      .reduce((sum, p) => sum + (p.used_sessions ?? 0), 0)
  );

  readonly prepaidCount = computed(() =>
    this.detailStore.sales().loaded ? this.detailStore.sales().data.length : null
  );

  readonly recentCount = computed(() =>
    this.detailStore.recent().loaded ? this.detailStore.recent().data.length : null
  );

  /** Total items across all tabs for mobile button badge */
  readonly totalItemsCount = computed(() => {
    const plans = this.plansCount();
    const sessions = this.sessionsCount();
    const prepaid = this.prepaidCount() ?? 0;
    const recent = this.recentCount() ?? 0;
    return plans + sessions + prepaid + recent;
  });

  // ── Derived: active packs for Sesiones tab (from store) ──────────────────────

  readonly activePacks = computed(() =>
    this.detailStore.packs().data.filter(p => p.status === 'active')
  );

  // ── Methods ───────────────────────────────────────────────────────────────────

  selectTab(tab: PatientTab): void {
    this.activeTab.set(tab);
    if (tab === 'planes' && !this.detailStore.packs().loaded) {
      this.detailStore.loadPacks(this.client().id);
    }
    if (tab === 'prepago' && !this.detailStore.sales().loaded) {
      this.detailStore.loadSales(this.client().id);
    }
    if (tab === 'recientes' && !this.detailStore.recent().loaded) {
      this.detailStore.loadRecent(this.client().id);
    }
  }

  backToTabs(): void {
    this.activeTab.set(null);
  }

  toggleNotif(): void {
    this.notifOpen.update(v => !v);
  }

  onEditClick(): void {
    this.editRequested.emit();
  }
}
