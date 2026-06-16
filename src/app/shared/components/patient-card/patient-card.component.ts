import { Component, computed, effect, inject, input, OnInit, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { PopoverModule } from 'primeng/popover';
import { SkeletonModule } from 'primeng/skeleton';
import { Client, ClientPack, Sale, Booking } from '@models';
import { ApiService } from '@services/api.service';
import { LanguageService } from '@services/language.service';
import { STATUS_COLOR_MAP } from '@features/admin/bookings/constants/booking-statuses';

export type PatientTab = 'planes' | 'sesiones' | 'prepago' | 'recientes';

@Component({
  selector: 'bw-patient-card',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, CheckboxModule, PopoverModule, SkeletonModule],
  templateUrl: './patient-card.component.html',
  styleUrl: './patient-card.component.scss',
})
export class PatientCardComponent implements OnInit {
  private readonly api = inject(ApiService);
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

  // ── Packs data (eager) ────────────────────────────────────────────────────────

  readonly packs        = signal<ClientPack[]>([]);
  readonly packsLoading = signal(false);
  readonly packsLoaded  = signal(false);

  // ── Sales data (lazy) ─────────────────────────────────────────────────────────

  readonly sales        = signal<Sale[]>([]);
  readonly salesLoading = signal(false);
  readonly salesLoaded  = signal(false);

  // ── Recent bookings data (lazy) ───────────────────────────────────────────────

  readonly recent        = signal<Booking[]>([]);
  readonly recentLoading = signal(false);
  readonly recentLoaded  = signal(false);

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

  // ── Computed: badge counts ────────────────────────────────────────────────────

  readonly plansCount = computed(() =>
    this.packs().filter(p => p.status === 'active').length
  );

  readonly sessionsCount = computed(() =>
    this.packs()
      .filter(p => p.status === 'active')
      .reduce((sum, p) => sum + (p.used_sessions ?? 0), 0)
  );

  readonly prepaidCount = computed(() =>
    this.salesLoaded() ? this.sales().length : null
  );

  readonly recentCount = computed(() =>
    this.recentLoaded() ? this.recent().length : null
  );

  // ── Derived: active packs for Sesiones tab ────────────────────────────────────

  readonly activePacks = computed(() =>
    this.packs().filter(p => p.status === 'active')
  );

  // ── Init ──────────────────────────────────────────────────────────────────────

  constructor() {
    // React to client changes by reloading packs
    effect(() => {
      const clientId = this.client().id;
      if (clientId) {
        this.resetData();
        this.loadPacks(clientId);
      }
    });
  }

  ngOnInit(): void {
    // packs loaded via effect in constructor
  }

  // ── Methods ───────────────────────────────────────────────────────────────────

  selectTab(tab: PatientTab): void {
    this.activeTab.set(tab);
    if (tab === 'prepago' && !this.salesLoaded()) {
      this.loadSales(this.client().id);
    }
    if (tab === 'recientes' && !this.recentLoaded()) {
      this.loadRecent(this.client().id);
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

  // ── Private loaders ───────────────────────────────────────────────────────────

  private resetData(): void {
    this.packs.set([]);
    this.packsLoaded.set(false);
    this.sales.set([]);
    this.salesLoaded.set(false);
    this.recent.set([]);
    this.recentLoaded.set(false);
    this.activeTab.set(null);
  }

  private loadPacks(clientId: number): void {
    this.packsLoading.set(true);
    this.api.getClientPacks(clientId).subscribe({
      next: data => {
        this.packs.set(data);
        this.packsLoading.set(false);
        this.packsLoaded.set(true);
      },
      error: () => {
        this.packsLoading.set(false);
        this.packsLoaded.set(true);
      },
    });
  }

  private loadSales(clientId: number): void {
    this.salesLoading.set(true);
    this.api.getSales({ client_id: clientId }).subscribe({
      next: res => {
        this.sales.set(res.data);
        this.salesLoading.set(false);
        this.salesLoaded.set(true);
      },
      error: () => {
        this.salesLoading.set(false);
        this.salesLoaded.set(true);
      },
    });
  }

  private loadRecent(clientId: number): void {
    this.recentLoading.set(true);
    this.api.getBookings({ client_id: clientId, per_page: 10 }).subscribe({
      next: res => {
        this.recent.set(res.data);
        this.recentLoading.set(false);
        this.recentLoaded.set(true);
      },
      error: () => {
        this.recentLoading.set(false);
        this.recentLoaded.set(true);
      },
    });
  }
}
