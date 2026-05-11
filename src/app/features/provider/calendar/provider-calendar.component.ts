import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TableModule } from 'primeng/table';
import { ApiService } from '../../../core/services/api.service';
import { HttpErrorService } from '../../../core/services/http-error.service';
import { AuthService } from '../../../core/services/auth.service';
import { Booking } from '../../../core/models';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  bookings: Booking[];
}

@Component({
  selector: 'bw-provider-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, CardModule, ButtonModule, SelectModule, DatePickerModule, TableModule],
  templateUrl: './provider-calendar.component.html',
  styleUrls: ['./provider-calendar.component.scss']
})
export class ProviderCalendarComponent implements OnInit {
  private api = inject(ApiService);
  private httpError = inject(HttpErrorService);
  private auth = inject(AuthService);
  
  currentDate = signal(new Date());
  selectedDay = signal<CalendarDay | null>(null);
  bookings = signal<Booking[]>([]);
  
  weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  
  monthYear = computed(() => this.currentDate());

  calendarDays = computed((): CalendarDay[] => {
    const date = this.currentDate();
    const year = date.getFullYear();
    const month = date.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Días del mes anterior
    const startDayOfWeek = firstDay.getDay();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push(this.createCalendarDay(d, false, today));
    }
    
    // Días del mes actual
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      days.push(this.createCalendarDay(d, true, today));
    }
    
    // Días del mes siguiente
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push(this.createCalendarDay(d, false, today));
    }
    
    return days;
  });

  private createCalendarDay(date: Date, isCurrentMonth: boolean, today: Date): CalendarDay {
    const dateStr = date.toISOString().split('T')[0];
    const dayBookings = this.bookings().filter(b => b.start_time.startsWith(dateStr));
    
    return {
      date,
      isCurrentMonth,
      isToday: date.getTime() === today.getTime(),
      bookings: dayBookings
    };
  }

  ngOnInit(): void {
    this.loadBookings();
  }

  loadBookings(): void {
    const providerId = this.auth.user()?.provider_id;
    if (!providerId) return;
    
    const date = this.currentDate();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    
    this.api.getBookings({
      provider_id: providerId,
      date_from: firstDay.toISOString().split('T')[0],
      date_to: lastDay.toISOString().split('T')[0],
      per_page: 100
    }).subscribe({
      next: (response: any) => {
        const data = response.data || response;
        const bookings = Array.isArray(data) ? data : [];
        this.bookings.set(bookings);
        // Recalcular días seleccionados
        if (this.selectedDay()) {
          this.selectDate(this.selectedDay()!);
        }
      },
      error: (err) => this.httpError.handle(err, 'cargar agenda')
    });
  }

  previousMonth(): void {
    const current = this.currentDate();
    this.currentDate.set(new Date(current.getFullYear(), current.getMonth() - 1, 1));
    this.loadBookings();
  }

  nextMonth(): void {
    const current = this.currentDate();
    this.currentDate.set(new Date(current.getFullYear(), current.getMonth() + 1, 1));
    this.loadBookings();
  }

  goToToday(): void {
    this.currentDate.set(new Date());
    this.loadBookings();
  }

  selectDate(day: CalendarDay): void {
    this.selectedDay.set(day);
  }
}