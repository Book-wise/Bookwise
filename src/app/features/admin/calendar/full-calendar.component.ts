import { Component, OnInit, OnDestroy, inject, signal, computed, CUSTOM_ELEMENTS_SCHEMA, ElementRef, ViewChild, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../../core/services/api.service';
import { Booking, Location, Provider } from '../../../core/models';
import { BookingDialogComponent } from '../bookings/booking-dialog.component';
import { Calendar, CalendarOptions, EventClickArg, DateSelectArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import timeGridPlugin from '@fullcalendar/timegrid';
import esLocale from '@fullcalendar/core/locales/es';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor?: string;
  borderColor?: string;
  extendedProps?: {
    booking: Booking;
  };
}

@Component({
  selector: 'app-full-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, CardModule, ButtonModule, SelectModule, TagModule, DialogModule, BookingDialogComponent],
  templateUrl: './full-calendar.component.html',
  styleUrls: ['./full-calendar.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  providers: [MessageService]
})
export class FullCalendarComponent implements OnInit, OnDestroy, AfterViewInit {
  private api = inject(ApiService);
  private messageService = inject(MessageService);
  private calendar: Calendar | null = null;

  @ViewChild('calendarContainer') calendarContainer!: ElementRef;
  @ViewChild(BookingDialogComponent) bookingDialog!: BookingDialogComponent;

  bookings = signal<Booking[]>([]);
  locations = signal<Location[]>([]);
  providers = signal<Provider[]>([]);

  selectedLocationId: number | null = null;
  selectedProviderId: number | null = null;
  selectedDate: Date | null = null;

  // Signal para detectar viewport
  isMobile = signal(false);

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, interactionPlugin, listPlugin, timeGridPlugin],
    initialView: 'dayGridMonth',
    locale: esLocale,
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
    },
    buttonText: {
      today: 'Hoy',
      month: 'Mes',
      week: 'Semana',
      day: 'Día',
      list: 'Lista'
    },
    editable: true,
    selectable: true,
    selectMirror: true,
    dayMaxEvents: true,
    weekends: true,
    events: [],
    eventClick: this.handleEventClick.bind(this),
    select: this.handleDateSelect.bind(this),
    datesSet: this.handleDatesSet.bind(this)
  };

  locationOptions = computed(() => 
    this.locations().map(l => ({ label: l.name, value: l.id }))
  );
  
  providerOptions = computed(() => 
    this.providers().map(p => ({ label: `${p.first_name} ${p.last_name}`, value: p.id }))
  );

  selectedBooking = signal<Booking | null>(null);
  showEventDialog = signal(false);

  ngOnInit(): void {
    this.checkViewport();
    this.loadLocations();
    this.loadProviders();
  }

  ngAfterViewInit(): void {
    this.initCalendar();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.checkViewport();
    // Forzar actualización del calendario
    if (this.calendar) {
      this.calendar.updateSize();
    }
  }

  private checkViewport(): void {
    this.isMobile.set(window.innerWidth < 768);
  }

  private initCalendar(): void {
    this.calendar = new Calendar(this.calendarContainer.nativeElement, {
      ...this.calendarOptions,
      eventClick: this.handleEventClick.bind(this),
      select: this.handleDateSelect.bind(this),
      datesSet: this.handleDatesSet.bind(this)
    });
    this.calendar.render();
  }

  ngOnDestroy(): void {
    if (this.calendar) {
      this.calendar.destroy();
    }
  }

  loadLocations(): void {
    this.api.getLocations().subscribe({
      next: (data) => this.locations.set(data),
      error: () => {}
    });
  }

  loadProviders(): void {
    this.api.getProviders().subscribe({
      next: (data) => this.providers.set(data),
      error: () => {}
    });
  }

  loadBookings(dateFrom: string, dateTo: string): void {
    let params: any = {
      date_from: dateFrom,
      date_to: dateTo,
      per_page: 500
    };

    if (this.selectedLocationId) params.location_id = this.selectedLocationId;
    if (this.selectedProviderId) params.provider_id = this.selectedProviderId;

    this.api.getBookings(params).subscribe({
      next: (response: any) => {
        // La API puede devolver directamente el array o un objeto con data
        const data = response.data || response;
        const bookings = Array.isArray(data) ? data : [];
        this.bookings.set(bookings);
        this.updateCalendarEvents(bookings);
      },
      error: () => {}
    });
  }

  private updateCalendarEvents(bookings: Booking[]): void {
    const events: CalendarEvent[] = bookings.map(booking => ({
      id: booking.id.toString(),
      title: `${booking.service?.name || 'Servicio'} - ${booking.client?.first_name || ''} ${booking.client?.last_name || ''}`.trim(),
      start: booking.start_time,
      end: booking.end_time,
      backgroundColor: this.getStatusColor(booking.status?.name),
      borderColor: this.getStatusColor(booking.status?.name),
      extendedProps: { booking }
    }));

    if (this.calendar) {
      this.calendar.removeAllEvents();
      this.calendar.addEventSource(events);
    }
  }

  private getStatusColor(status?: string): string {
    const colorMap: Record<string, string> = {
      'confirmed': '#22c55e',
      'pending': '#f59e0b',
      'cancelled': '#ef4444',
      'completed': '#3b82f6',
      'pending_confirmation': '#8b5cf6'
    };
    return colorMap[status?.toLowerCase() || ''] || '#6b7280';
  }

  onFilterChange(): void {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    this.loadBookings(
      firstDay.toISOString().split('T')[0],
      lastDay.toISOString().split('T')[0]
    );
  }

  private handleDatesSet(info: { start: Date; end: Date }): void {
    const start = info.start.toISOString().split('T')[0];
    const end = info.end.toISOString().split('T')[0];
    this.loadBookings(start, end);
  }

  private handleEventClick(clickInfo: EventClickArg): void {
    const event = clickInfo.event;
    const booking = event.extendedProps['booking'] as Booking;
    this.selectedBooking.set(booking);
    this.showEventDialog.set(true);
  }

  editBooking(): void {
    const booking = this.selectedBooking();
    if (!booking) return;
    
    this.showEventDialog.set(false);
    // Delay para que cierre el dialog primero
    setTimeout(() => {
      this.bookingDialog.openNew(booking);
    }, 100);
  }

  onBookingSaved(): void {
    // Recargar bookings del mes actual
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    this.loadBookings(
      firstDay.toISOString().split('T')[0],
      lastDay.toISOString().split('T')[0]
    );
  }

  onBookingCancelled(): void {
    this.onBookingSaved();
  }

  private handleDateSelect(selectInfo: DateSelectArg): void {
    this.selectedDate = selectInfo.start;
    this.bookingDialog.openNew();
  }

  closeDialog(): void {
    this.showEventDialog.set(false);
    this.selectedBooking.set(null);
  }

  getStatusSeverity(status?: string): "success" | "info" | "warn" | "danger" | "secondary" | "contrast" {
    const statusMap: Record<string, "success" | "info" | "warn" | "danger"> = {
      'confirmed': 'success',
      'pending': 'warn',
      'cancelled': 'danger',
      'completed': 'info'
    };
    return statusMap[status?.toLowerCase() || ''] || 'info';
  }
}