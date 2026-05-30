import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TextareaModule } from 'primeng/textarea';
import { PanelModule } from 'primeng/panel';
import { Booking } from '@models';
import { ApiService } from '@services/api.service';
import { HttpErrorService } from '@services/http-error.service';

@Component({
  selector: 'bw-reserva-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, SelectModule, DatePickerModule, TextareaModule, PanelModule],
  templateUrl: './reserva-tab.component.html',
  styleUrl: './reserva-tab.component.scss',
})
export class ReservaTabComponent {
  private readonly api       = inject(ApiService);
  private readonly httpError = inject(HttpErrorService);

  readonly booking        = input.required<Booking>();
  readonly statusId       = input<number>(0);
  readonly bookingUpdated = output<Booking>();

  // ── Form state ────────────────────────────────────────────────────────────────

  readonly selectedDate       = signal<Date>(new Date());
  readonly startHour          = signal(0);
  readonly startMinute        = signal(0);
  readonly endHour            = signal(0);
  readonly endMinute          = signal(0);
  readonly selectedProviderId = signal<number | null>(null);
  readonly notes              = signal('');
  readonly saving             = signal(false);

  // ── Options ───────────────────────────────────────────────────────────────────

  readonly hours   = Array.from({ length: 24 }, (_, i) => ({ label: i.toString().padStart(2, '0'), value: i }));
  readonly minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => ({
    label: m.toString().padStart(2, '0'), value: m,
  }));

  // ── Remote data ───────────────────────────────────────────────────────────────

  readonly providers = toSignal(this.api.getProviders(), { initialValue: [] as any[] });

  readonly providerOptions = computed(() =>
    (this.providers() ?? []).map((p: any) => ({
      label: `${p.first_name} ${p.last_name}`,
      value: p.id,
    }))
  );

  // ── Derived ───────────────────────────────────────────────────────────────────

  readonly serviceDisabled = computed(() => {
    const p = this.booking().payment;
    return !!p && Object.keys(p as object).length > 0;
  });

  readonly clientInitials = computed(() => {
    const c = this.booking().client;
    return `${c?.first_name?.[0] ?? ''}${c?.last_name?.[0] ?? ''}`.toUpperCase() || '?';
  });

  readonly whatsappHref = computed(() => {
    const phone = this.booking().client?.phone ?? '';
    return `https://wa.me/${phone.replace('+', '').replace(/\s/g, '')}`;
  });

  // ── Init ──────────────────────────────────────────────────────────────────────

  constructor() {
    effect(() => {
      const b = this.booking();
      const start = new Date(b.start_time);
      const end   = new Date(b.end_time);
      this.selectedDate.set(start);
      this.startHour.set(start.getHours());
      this.startMinute.set(start.getMinutes());
      this.endHour.set(end.getHours());
      this.endMinute.set(end.getMinutes());
      this.selectedProviderId.set(b.provider_id ?? null);
      this.notes.set(b.notes ?? '');
    });
  }

  // ── Save ──────────────────────────────────────────────────────────────────────

  save(): void {
    const b    = this.booking();
    const date = this.selectedDate();

    const start = new Date(date);
    start.setHours(this.startHour(), this.startMinute(), 0, 0);

    const end = new Date(date);
    end.setHours(this.endHour(), this.endMinute(), 0, 0);

    this.saving.set(true);
    this.api.updateBooking(b.id, {
      start_time:  start.toISOString(),
      end_time:    end.toISOString(),
      provider_id: this.selectedProviderId() ?? undefined,
      status_id:   this.statusId() || undefined,
      notes:       this.notes() || undefined,
    }).subscribe({
      next: () => {
        this.api.getBooking(b.id).subscribe({
          next: (refreshed) => {
            this.saving.set(false);
            this.bookingUpdated.emit(refreshed as unknown as Booking);
          },
          error: () => this.saving.set(false),
        });
      },
      error: (err) => {
        this.httpError.handle(err, 'guardar reserva');
        this.saving.set(false);
      },
    });
  }
}
