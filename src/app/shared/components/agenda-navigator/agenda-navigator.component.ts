import { Component, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { LanguageService } from '@services/language.service';
import { CalendarNavigationService, PendingCalendarView } from '@services/calendar-navigation.service';

const WEEK_HEADERS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

interface Cell {
  day: number | null;
  date?: Date;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function startOfWeek(d: Date): Date {
  const sinceMonday = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - sinceMonday);
}
function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

/**
 * Widget reutilizable de navegación por fecha. Muestra un mini-calendario del
 * mes y, al hacer clic en un día, navega a la agenda (admin o provider) con esa
 * fecha, usando `CalendarNavigationService` (view + gotoDate).
 */
@Component({
  selector: 'bw-agenda-navigator',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  templateUrl: './agenda-navigator.component.html',
  styleUrls: ['./agenda-navigator.component.scss'],
})
export class AgendaNavigatorComponent {
  private calNav = inject(CalendarNavigationService);
  private router = inject(Router);
  readonly lang = inject(LanguageService);

  readonly view = input<PendingCalendarView>('timeGridWeek');
  readonly locationId = input<number | null>(null);
  readonly providerId = input<number | null>(null);
  readonly statusIds = input<number[]>([]);
  /** Ruta destino: admin usa /admin/calendar, provider usa /provider. */
  readonly route = input<string[]>(['/admin', 'calendar']);

  readonly WEEK_HEADERS = WEEK_HEADERS;
  /** Orden de columnas del calendario (lunes-first) → value de getDay(). */
  readonly headerDays = [1, 2, 3, 4, 5, 6, 0];
  visibleMonth = signal<Date>(this.startOfCurrentMonth());
  /** Día seleccionado (se resalta en el widget al hacer click). */
  selectedDate = signal<Date | null>(null);

  /** Etiqueta corta de un día de la semana según `getDay()` (i18n). */
  dayHeader(dayOfWeek: number): string {
    return this.lang.t('ui.day_short.' + dayOfWeek);
  }

  readonly monthLabel = computed(() => {
    const m = this.visibleMonth();
    return `${this.lang.t('dashboard.range.month.' + (m.getMonth() + 1))} ${m.getFullYear()}`;
  });

  readonly yearLabel = computed(() => String(this.visibleMonth().getFullYear()));
  readonly monthName = computed(() =>
    this.lang.t('dashboard.range.month.' + (this.visibleMonth().getMonth() + 1)),
  );

  readonly monthGrid = computed<Cell[]>(() => {
    const month = this.visibleMonth();
    const year = month.getFullYear();
    const m = month.getMonth();
    const first = new Date(year, m, 1);
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const leading = (first.getDay() + 6) % 7; // lunes-first

    const cells: Cell[] = [];
    for (let i = 0; i < leading; i++) cells.push({ day: null });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, date: new Date(year, m, d) });
    // Rellena hasta 6 filas (42 celdas) para que la grilla mantenga una altura fija.
    while (cells.length < 42) cells.push({ day: null });
    return cells;
  });

  startOfCurrentMonth(): Date {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  }

  shiftMonth(delta: number): void {
    this.visibleMonth.set(addMonths(this.visibleMonth(), delta));
  }

  goToday(): void {
    this.visibleMonth.set(this.startOfCurrentMonth());
  }

  isToday(date: Date): boolean {
    const now = new Date();
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  }

  isSelected(date: Date): boolean {
    const sel = this.selectedDate();
    return (
      !!sel &&
      date.getFullYear() === sel.getFullYear() &&
      date.getMonth() === sel.getMonth() &&
      date.getDate() === sel.getDate()
    );
  }

  goto(date: Date): void {
    this.selectedDate.set(date);
    this.calNav.navigateToCalendar(
      this.locationId(),
      this.providerId(),
      this.statusIds(),
      this.router,
      { view: this.view(), gotoDate: isoDate(date) },
      this.route(),
    );
  }

  /** Expone startOfWeek al template (para marcar la semana actual, opcional). */
  weekStartOf(date: Date): Date {
    return startOfWeek(date);
  }
}
