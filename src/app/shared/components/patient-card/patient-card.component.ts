import { AfterViewInit, Component, computed, HostListener, inject, input, OnDestroy, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { Client } from '@models';
import { LanguageService } from '@services/language.service';
import { ClientDetailStore, PatientTab as StorePatientTab, NotificationValues } from '@core/stores/client-detail.store';
import { STATUS_COLOR_MAP } from '@features/admin/bookings/constants/booking-statuses';
import { TimezoneService } from '@services/timezone.service';

export type PatientTab = StorePatientTab;

@Component({
  selector: 'bw-patient-card',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, CheckboxModule, TooltipModule, SkeletonModule],
  templateUrl: './patient-card.component.html',
  styleUrl: './patient-card.component.scss',
})
export class PatientCardComponent implements AfterViewInit, OnDestroy {
  readonly detailStore = inject(ClientDetailStore);
  readonly lang = inject(LanguageService);
  private readonly tz = inject(TimezoneService);

  // expose to template
  readonly STATUS_COLOR_MAP = STATUS_COLOR_MAP;

  // ── Inputs ───────────────────────────────────────────────────────────────────

  readonly client            = input.required<Client>();
  readonly showNotifications = input<boolean>(false);
  readonly showEdit          = input<boolean>(true);
  readonly dialogMode        = input<boolean>(false);

  // ── Outputs ──────────────────────────────────────────────────────────────────

  readonly editRequested = output<void>();
  readonly patientTabSelected = output<PatientTab>();

  // ── Panel state ──────────────────────────────────────────────────────────────

  readonly panelOpen = signal(false);
  readonly panelTab  = signal<PatientTab>('planes');

  // ── Viewport breakpoint ──────────────────────────────────────────────────────

  private readonly breakpointQuery = window.matchMedia('(max-width: 768px)');
  private previousMobile = this.breakpointQuery.matches;
  readonly isMobile = signal(this.previousMobile);

  ngAfterViewInit(): void {
    this.breakpointQuery.addEventListener('change', this.onBreakpointChange);
  }

  ngOnDestroy(): void {
    this.breakpointQuery.removeEventListener('change', this.onBreakpointChange);
  }

  private onBreakpointChange = (e: MediaQueryListEvent): void => {
    const changed = e.matches !== this.previousMobile;
    this.previousMobile = e.matches;
    this.isMobile.set(e.matches);

    if (changed) {
      this.panelOpen.set(false);
    }
  };

  // ── Notifications state ───────────────────────────────────────────────────────

  readonly notifOpen = signal(false);

  /** Backend flags grouped by channel — the 5-key contract, 1:1. */
  readonly emailNotificationFlags: (keyof NotificationValues)[] = [
    'email_new_booking',
    'email_booking_confirmation',
    'email_booking_cancellation',
  ];
  readonly whatsappNotificationFlags: (keyof NotificationValues)[] = [
    'whatsapp_reminder',
    'whatsapp_cancellation_confirmation',
  ];

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
      .reduce((sum, p) => sum + (p.total_sessions ?? 0), 0)
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

  /** Flattened sessions from all active packs */
  readonly allPackSessions = computed(() => {
    const sessions: {
      session_number: number;
      packName: string;
      bookingTime: string | null;
      statusLabel: string;
    }[] = [];

    for (const pack of this.activePacks()) {
      const packName = pack.service_pack?.name ?? 'Plan';
      const svc = pack.service_pack?.service?.name;
      const label = svc ? `${svc}` : packName;

      // Build sessions from pack data
      for (let i = 1; i <= pack.total_sessions; i++) {
        const isUsed = i <= pack.used_sessions;
        sessions.push({
          session_number: i,
          packName: label,
          bookingTime: null,
          statusLabel: isUsed ? 'Completada' : 'Pendiente',
        });
      }
    }

    return sessions;
  });

  // ── Methods ───────────────────────────────────────────────────────────────────

  openPanel(tab: PatientTab): void {
    if (this.dialogMode()) {
      this.detailStore.selectTab(tab);
      this.loadTabData(tab);
      this.patientTabSelected.emit(tab);
      return;
    }
    this.panelTab.set(tab);
    this.panelOpen.set(true);
    this.loadTabData(tab);
  }

  closePanel(): void {
    this.panelOpen.set(false);
  }

  switchPanelTab(tab: PatientTab): void {
    this.panelTab.set(tab);
    this.loadTabData(tab);
  }

  private loadTabData(tab: PatientTab): void {
    if ((tab === 'planes' || tab === 'sesiones') && !this.detailStore.packs().loaded) {
      this.detailStore.loadPacks(this.client().id);
    }
    if (tab === 'prepago' && !this.detailStore.sales().loaded) {
      this.detailStore.loadSales(this.client().id);
    }
    if (tab === 'recientes' && !this.detailStore.recent().loaded) {
      this.detailStore.loadRecent(this.client().id);
    }
  }

  toggleNotif(): void {
    this.notifOpen.update(v => !v);
  }

  notificationValue(key: keyof NotificationValues): boolean {
    return this.detailStore.notifications()[key];
  }

  setNotification(key: keyof NotificationValues, value: boolean): void {
    this.detailStore.setNotification(key, value);
  }

  formatBookingTime(iso: string): string {
    return this.tz.formatCardDate(iso);
  }

  onEditClick(): void {
    this.editRequested.emit();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.panelOpen()) {
      this.closePanel();
    }
  }
}
