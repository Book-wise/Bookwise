import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap, of } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TextareaModule } from 'primeng/textarea';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { PopoverModule } from 'primeng/popover';
import { Booking } from '@models';
import { BookingStore } from '@core/stores/booking.store';
import { BookingDialogStore } from '@core/stores/booking-dialog.store';
import { PatientTab } from '@core/stores/client-detail.store';
import { ReferenceStore } from '@core/stores/reference.store';
import { ProvidersApiService } from '@services/api/providers-api.service';
import { BookingsApiService } from '@services/api/bookings-api.service';
import { ClientsApiService } from '@services/api/clients-api.service';
import { HttpErrorService } from '@services/http-error.service';
import { TimezoneService } from '@services/timezone.service';
import { MessageService } from 'primeng/api';
import { PhoneInputComponent } from '@shared/components/phone-input/phone-input.component';
import { PatientCardComponent } from '@shared/components/patient-card/patient-card.component';

@Component({
  selector: 'bw-reserva-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, SelectModule, DatePickerModule, TextareaModule, InputTextModule, CheckboxModule, PopoverModule, PhoneInputComponent, PatientCardComponent],
  templateUrl: './reserva-tab.component.html',
  styleUrl: './reserva-tab.component.scss',
})
export class ReservaTabComponent {
  private readonly providersApi  = inject(ProvidersApiService);
  private readonly bookingsApi   = inject(BookingsApiService);
  private readonly clientsApi    = inject(ClientsApiService);
  private readonly httpError      = inject(HttpErrorService);
  private readonly messageService = inject(MessageService);
  private readonly refStore       = inject(ReferenceStore);
  private readonly tzService      = inject(TimezoneService);
  readonly store          = inject(BookingStore);
  readonly dialogStore    = inject(BookingDialogStore);

  readonly statusId = input<number>(0);

  /** Re-emits the patient card sub-tab selection so the dialog can switch to the full-content patient detail. */
  readonly patientTabSelected = output<PatientTab>();

  // ── Form state ────────────────────────────────────────────────────────────────

  readonly selectedDate       = signal<Date>(new Date());
  readonly startHour          = signal(0);
  readonly startMinute        = signal(0);
  readonly endHour            = signal(0);
  readonly endMinute          = signal(0);
  readonly selectedProviderId = signal<number | null>(null);
  readonly notes              = signal('');
  readonly saving             = signal(false);

  // ── Client edit state ─────────────────────────────────────────────────────────

  readonly editingClient  = signal(false);
  readonly savingClient   = signal(false);
  readonly editFirstName  = signal('');
  readonly editLastName   = signal('');
  readonly editEmail      = signal('');
  readonly editPhone      = signal('');
  readonly reqOpen        = signal(true);
  readonly addOpen        = signal(true);
  readonly infoOpen       = signal(false);

  // ── Options ───────────────────────────────────────────────────────────────────

  readonly hours   = Array.from({ length: 24 }, (_, i) => ({ label: i.toString().padStart(2, '0'), value: i }));
  readonly minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => ({
    label: m.toString().padStart(2, '0'), value: m,
  }));

  // ── Remote data ───────────────────────────────────────────────────────────────

  readonly providers = toSignal(
    toObservable(this.dialogStore.booking).pipe(
      switchMap(b => {
        if (!b) return of([]);
        return this.providersApi.getProviders({ location_id: b.location_id ?? b.location?.id });
      }),
    ),
    { initialValue: [] as any[] }
  );

  readonly providerOptions = computed(() =>
    (this.providers() ?? []).map((p: any) => ({
      label: `${p.first_name} ${p.last_name}`,
      value: p.id,
    }))
  );

  // ── Derived ───────────────────────────────────────────────────────────────────

  readonly serviceDisabled = computed(() => {
    const booking = this.dialogStore.booking();
    if (!booking) return false;
    const p = booking.payment;
    return !!p && Object.keys(p as object).length > 0;
  });

  // ── CLT helpers ───────────────────────────────────────────────────────────────

  private cltTime(date: Date): { hour: number; minute: number } {
    return this.tzService.getTimeParts(date);
  }

  private fmtCLT(date: Date, hour: number, minute: number): string {
    return `${this.tzService.formatDateTime(date).split(' ')[0]} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  }

  // ── Init ──────────────────────────────────────────────────────────────────────

  constructor() {
    // Only populate form fields when a NEW booking is selected (id changes).
    // dialogStore.booking() is read via untracked so replaceBooking/mergeBooking
    // after save does NOT re-trigger this effect and overwrite user edits.
    effect(() => {
      const id = this.dialogStore.bookingId();
      if (id === null) return;
      const b = untracked(() => this.dialogStore.booking());
      if (!b) return;

      const start = new Date(b.start_time);
      const end   = new Date(b.end_time);
      const st = this.cltTime(start);
      const et = this.cltTime(end);

      this.selectedDate.set(start);
      this.startHour.set(st.hour);
      this.startMinute.set(st.minute);
      this.endHour.set(et.hour);
      this.endMinute.set(et.minute);
      this.selectedProviderId.set(b.provider_id ?? null);
      this.notes.set(b.notes ?? '');
    });
  }

  // ── Save ──────────────────────────────────────────────────────────────────────

  saveBookingTime(): void {
    const b    = this.dialogStore.booking();
    if (!b) return;
    const date = this.selectedDate();

    this.saving.set(true);
    this.bookingsApi.updateBooking(b.id, {
      start_time:  this.fmtCLT(date, this.startHour(), this.startMinute()),
      end_time:    this.fmtCLT(date, this.endHour(), this.endMinute()),
      provider_id: this.selectedProviderId() ?? undefined,
      status_id:   this.statusId() || undefined,
      notes:       this.notes() || undefined,
    }).subscribe({
      next: () => {
        this.bookingsApi.getBooking(b.id).subscribe({
          next: (refreshed) => {
            this.saving.set(false);
            // Dual write: dialog working copy (what the open dialog renders)
            // + calendar-canonical root store (eventsForCalendar).
            this.dialogStore.replaceBooking(refreshed);
            this.store.mergeBooking(refreshed);
            this.messageService.add({
              severity: 'success',
              summary: 'Reserva actualizada',
              detail: 'Los cambios se guardaron correctamente.',
              key: 'global',
              life: 3000,
            });
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

  // ── Client edit ───────────────────────────────────────────────────────────────

  onEditRequested(): void {
    this.startEditClient();
  }

  startEditClient(): void {
    const booking = this.dialogStore.booking();
    const c = booking?.client;
    this.editFirstName.set(c?.first_name ?? '');
    this.editLastName.set(c?.last_name ?? '');
    this.editEmail.set(c?.email ?? '');
    this.editPhone.set(c?.phone ?? '');
    this.reqOpen.set(true);
    this.addOpen.set(true);
    this.editingClient.set(true);
  }

  cancelEditClient(): void {
    this.editingClient.set(false);
  }

  savePatientData(): void {
    const booking = this.dialogStore.booking();
    const clientId = booking?.client?.id;
    if (!clientId || !booking) return;

    this.savingClient.set(true);
    this.clientsApi.updateClient(clientId, {
      first_name: this.editFirstName(),
      last_name:  this.editLastName(),
      email:      this.editEmail() || undefined,
      phone:      this.editPhone() || undefined,
    }).subscribe({
      next: () => {
        this.bookingsApi.getBooking(booking.id).subscribe({
          next: (refreshed) => {
            // Dual write: dialog working copy + calendar-canonical root store.
            this.dialogStore.replaceBooking(refreshed);
            this.store.mergeBooking(refreshed);
            this.refStore.invalidateClients();
            this.editingClient.set(false);
            this.savingClient.set(false);
            this.messageService.add({
              severity: 'success',
              summary: 'Paciente actualizado',
              detail: 'Los cambios se guardaron correctamente.',
              key: 'global',
              life: 3000,
            });
          },
          error: () => this.savingClient.set(false),
        });
      },
      error: (err) => {
        this.httpError.handle(err, 'actualizar paciente');
        this.savingClient.set(false);
      },
    });
  }
}
