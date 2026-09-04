import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { DatePickerModule } from 'primeng/datepicker';
import { TooltipModule } from 'primeng/tooltip';
import { ToastService } from '@shared/components/toast-modal/toast.service';
import { AvailabilityStore } from '@core/stores/availability.store';
import { ProviderAvailabilitySlot } from '@services/availability.service';
import { BlockedSlotsApiService } from '@services/api/blocked-slots-api.service';
import { BookingsApiService } from '@services/api/bookings-api.service';
import { HttpErrorService } from '@services/http-error.service';
import { AuthService } from '@services/auth.service';
import { LanguageService } from '@services/language.service';
import { ReferenceStore } from '@core/stores/reference.store';
import { BlockedSlot, Booking } from '@models';

// Semana de Chile: comienza el LUNES. Los `value` siguen el índice de `Date.getDay()`
// (0=domingo…6=sábado) para matchear la plantilla, pero el ORDEN visual es lunes-first.
const DAYS_OF_WEEK = [
  { label: 'Lunes', value: 1 },
  { label: 'Martes', value: 2 },
  { label: 'Miércoles', value: 3 },
  { label: 'Jueves', value: 4 },
  { label: 'Viernes', value: 5 },
  { label: 'Sábado', value: 6 },
  { label: 'Domingo', value: 0 },
];
// Encabezados de columna del calendario (lunes-first, orden visual).
const WEEK_HEADERS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];
// Etiqueta corta de un DÍA según `Date.getDay()` (0=domingo…6=sábado).
const DAY_SHORT = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

interface TimeWindow {
  start: string;
  end: string;
}
/** Segmento de un día en la vista previa: disponible, reservado o bloqueado. */
interface DaySegment {
  type: 'available' | 'booked' | 'blocked';
  start: string;
  end: string;
}
interface MonthCell {
  day: number | null;
  date?: Date;
}

@Component({
  selector: 'bw-provider-availability',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, ButtonModule, SelectModule,
    ToggleSwitchModule, DialogModule, SkeletonModule, DatePickerModule, TooltipModule,
  ],
  templateUrl: './provider-availability.component.html',
  styleUrls: ['./provider-availability.component.scss'],
})
export class ProviderAvailabilityComponent implements OnInit {
  private toast = inject(ToastService);
  private httpError = inject(HttpErrorService);
  private blockedSlotsApi = inject(BlockedSlotsApiService);
  private bookingsApi = inject(BookingsApiService);
  private auth = inject(AuthService);
  private store = inject(AvailabilityStore);
  readonly lang = inject(LanguageService);
  /** Orden de columnas del mes (lunes-first) → value de getDay(). */
  readonly MONTH_HEADER_DAYS = [1, 2, 3, 4, 5, 6, 0];

  readonly locations = inject(ReferenceStore).locations;
  DAYS_OF_WEEK = DAYS_OF_WEEK;
  WEEK_HEADERS = WEEK_HEADERS;

  // ── Estado desde el store (fuente de verdad de la semana estándar) ──────────
  readonly slots = this.store.slots;
  readonly loading = this.store.loading;
  readonly saving = this.store.saving;

  private providerId: number | null = null;
  private defaultLocationId = 1;

  // ── Vista previa ────────────────────────────────────────────────────────────
  /** Modo de la vista previa: navegación por semanas o calendario de meses. */
  previewMode = signal<'weeks' | 'months'>('weeks');
  visibleMonth = signal<Date>(startOfCurrentMonth());
  visibleWeekStart = signal<Date>(startOfWeek(new Date()));
  rangeStart = signal<Date | null>(null);
  rangeEnd = signal<Date | null>(null);
  /** Bloqueos reales del profesional dentro del periodo visible (mes o rango). */
  periodBlocks = signal<BlockedSlot[]>([]);
  /** Reservas reales del profesional dentro del periodo visible. */
  periodBookings = signal<Booking[]>([]);
  periodLoading = signal(false);
  /** Datos del rango (separados del mes/semana visible para no chocar). */
  rangeBlocks = signal<BlockedSlot[]>([]);
  rangeBookings = signal<Booking[]>([]);
  rangeLoading = signal(false);

  ngOnInit(): void {
    const providerId = this.auth.user()?.provider_id;
    if (!providerId) {
      this.loading.set(false);
      return;
    }
    this.providerId = providerId;
    this.defaultLocationId = this.locations()[0]?.id ?? 1;
    this.store.load(providerId);
    this.fetchBlocksForMonth();
  }

  // ── Editor de la semana estándar ───────────────────────────────────────────

  getSlotsForDay(dayOfWeek: number): ProviderAvailabilitySlot[] {
    return this.slots().filter((s) => s.day_of_week === dayOfWeek);
  }

  /** Alta rápida en un día: si no hay horarios usa 09–18, si no continúa después del último. */
  quickAdd(dayOfWeek: number): void {
    const active = this.getSlotsForDay(dayOfWeek).filter((s) => s.is_active);
    let start = '09:00';
    let end = '18:00';

    if (active.length > 0) {
      const lastEnd = Math.max(...active.map((s) => toMin(s.end_time)));
      if (lastEnd >= 23 * 60) {
        this.toast.error('Error', 'No hay más espacio para agregar horarios este día');
        return;
      }
      start = fmtMin(lastEnd);
      end = fmtMin(Math.min(lastEnd + 60, 24 * 60));
    }

    if (
      this.getSlotsForDay(dayOfWeek).some(
        (s) => s.start_time === start && s.end_time === end,
      )
    ) {
      this.toast.error('Error', 'Ya existe un horario similar para este día');
      return;
    }

    this.store.addSlot({
      provider_id: this.providerId ?? 0,
      location_id: this.defaultLocationId,
      day_of_week: dayOfWeek,
      start_time: start,
      end_time: end,
      is_active: true,
    });
  }

  /** Copia los horarios de un día al resto de la semana (reemplaza lo existente). */
  copyDay(dayOfWeek: number): void {
    const source = this.getSlotsForDay(dayOfWeek);
    if (!source.length) {
      this.toast.error('Error', 'Este día no tiene horarios para copiar');
      return;
    }
    const targets = DAYS_OF_WEEK.filter((d) => d.value !== dayOfWeek).map((d) => d.value);
    const kept = this.slots().filter(
      (s) => s.day_of_week === dayOfWeek || !targets.includes(s.day_of_week),
    );

    for (const d of targets) {
      for (const src of source) {
        kept.push({
          ...src,
          provider_id: this.providerId ?? 0,
          location_id: this.defaultLocationId,
          day_of_week: d,
        });
      }
    }

    this.store.setSlots(kept);
    this.toast.success('Copiado', `El día se copió a ${targets.length} días`);
  }

  updateSlotTime(slot: ProviderAvailabilitySlot, field: 'start_time' | 'end_time', value: string): void {
    this.store.updateSlot({ ...slot, [field]: value });
  }

  setSlotActive(slot: ProviderAvailabilitySlot, active: boolean): void {
    this.store.updateSlot({ ...slot, is_active: active });
  }

  removeSlot(slot: ProviderAvailabilitySlot): void {
    this.store.removeSlot(slot);
  }

  saveAvailability(): void {
    if (!this.providerId) return;
    this.saving.set(true);
    this.store.save(this.providerId).subscribe({
      next: (saved) => {
        this.store.setSlots(saved);
        this.saving.set(false);
        this.toast.success('Guardado', 'Tu disponibilidad ha sido actualizada');
      },
      error: (err) => {
        this.saving.set(false);
        this.httpError.handle(err, 'guardar disponibilidad');
      },
    });
  }

  // ── Vista previa: helpers ───────────────────────────────────────────────────

  isToday(date: Date): boolean {
    const now = new Date();
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  }

  windowsForDate(date: Date): TimeWindow[] {
    const dayOfWeek = date.getDay();
    let windows: TimeWindow[] = this.slots()
      .filter((s) => s.day_of_week === dayOfWeek && s.is_active)
      .map((s) => ({ start: s.start_time, end: s.end_time }));

    for (const block of this.blockRangesForDate(date)) {
      windows = subtractWindows(windows, block.start, block.end);
    }
    return windows;
  }

  hasBlock(date: Date): boolean {
    return this.blockRangesForDate(date).length > 0;
  }

  /** Rangos bloqueados de un día (para pintarlos con el rayado del calendario). */
  blocksForDate(date: Date): TimeWindow[] {
    return this.blockRangesForDate(date);
  }

  /** Rangos ocupados por reservas de un día. */
  private bookingRangesForDate(date: Date, bookings: Booking[] = this.periodBookings()): TimeWindow[] {
    const key = isoDate(date);
    const ranges: TimeWindow[] = [];
    for (const b of bookings) {
      const bs = new Date(b.start_time);
      const be = new Date(b.end_time);
      if (Number.isNaN(bs.getTime()) || Number.isNaN(be.getTime())) continue;
      const startKey = isoDate(bs);
      const endKey = isoDate(be);
      if (startKey === endKey) {
        if (startKey === key) ranges.push({ start: hhmm(bs), end: hhmm(be) });
      } else {
        if (startKey === key) ranges.push({ start: hhmm(bs), end: '24:00' });
        if (endKey === key) ranges.push({ start: '00:00', end: hhmm(be) });
      }
    }
    return ranges;
  }

  /**
   * Secuencia del día: disponibles (verde) + reservas (azul) + bloqueos (rayado),
   * ordenados por hora. Así se ve el día completo como en la agenda.
   */
  daySegments(date: Date): DaySegment[] {
    return this.buildSegments(date, this.periodBlocks(), this.periodBookings());
  }

  /** Secuencia del día dentro del rango elegido. */
  rangeSegments(date: Date): DaySegment[] {
    return this.buildSegments(date, this.rangeBlocks(), this.rangeBookings());
  }

  private buildSegments(date: Date, blocks: BlockedSlot[], bookings: Booking[]): DaySegment[] {
    const dayOfWeek = date.getDay();
    const template: TimeWindow[] = this.slots()
      .filter((s) => s.day_of_week === dayOfWeek && s.is_active)
      .map((s) => ({ start: s.start_time, end: s.end_time }));

    const busy: DaySegment[] = [
      ...this.bookingRangesForDate(date, bookings).map((r) => ({ type: 'booked' as const, start: r.start, end: r.end })),
      ...this.blockRangesForDate(date, blocks).map((r) => ({ type: 'blocked' as const, start: r.start, end: r.end })),
    ];

    // Disponibles = plantilla − (reservas + bloqueos)
    let available: DaySegment[] = template.map((w) => ({ type: 'available' as const, start: w.start, end: w.end }));
    for (const b of busy) {
      available = available.flatMap((seg) => splitByBusy(seg, b));
    }

    return [...available, ...busy].sort((a, b) => toMin(a.start) - toMin(b.start));
  }

  // ── Mes ────────────────────────────────────────────────────────────────────

  readonly monthLabel = computed<string>(() => monthLabel(this.visibleMonth()));

  readonly monthGrid = computed<MonthCell[]>(() => {
    const month = this.visibleMonth();
    const year = month.getFullYear();
    const m = month.getMonth();
    const first = new Date(year, m, 1);
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const leading = (first.getDay() + 6) % 7; // lunes-first

    const cells: MonthCell[] = [];
    for (let i = 0; i < leading; i++) cells.push({ day: null });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, date: new Date(year, m, d) });
    return cells;
  });

  shiftMonth(delta: number): void {
    const next = addMonths(this.visibleMonth(), delta);
    this.visibleMonth.set(next);
    // Asegura que la semana visible caiga dentro del nuevo mes (la del día 1).
    this.visibleWeekStart.set(firstWeekStartOfMonth(next));
    this.fetchBlocksForMonth();
  }
  goToday(): void {
    const now = new Date();
    this.visibleMonth.set(startOfCurrentMonth());
    this.visibleWeekStart.set(startOfWeek(now));
    this.fetchBlocksForMonth();
  }

  // ── Navegación por semanas del mes ─────────────────────────────────────────

  readonly weekLabel = computed<string>(() => {
    const start = this.visibleWeekStart();
    const end = addDays(start, 6);
    return `${start.getDate()} ${fullMonthName(start)} - ${end.getDate()} ${fullMonthName(end)}`;
  });

  readonly weekDays = computed<Date[]>(() =>
    Array.from({ length: 7 }, (_, i) => addDays(this.visibleWeekStart(), i)),
  );

  shiftWeek(delta: number): void {
    const ws = addDays(this.visibleWeekStart(), delta * 7);
    this.visibleWeekStart.set(ws);
    // El mes visible sigue a la semana (sin "devolverte" al mes actual).
    this.visibleMonth.set(monthAnchorOfWeek(ws));
    this.fetchBlocksForMonth();
  }

  goThisWeek(): void {
    const ws = startOfWeek(new Date());
    this.visibleWeekStart.set(ws);
    this.visibleMonth.set(monthAnchorOfWeek(ws));
    this.fetchBlocksForMonth();
  }

  /** Lunes..Domingo visibles del mes (para saltar a una semana concreta). */
  readonly monthWeeks = computed<{ start: Date; label: string }[]>(() => {
    const month = this.visibleMonth();
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const weeks: { start: Date; label: string }[] = [];
    let cursor = addDays(startOfWeek(first), 7); // primera semana que cae dentro del mes
    const firstWeekStart = startOfWeek(first);
    if (firstWeekStart <= last) cursor = firstWeekStart;

    while (cursor <= last) {
      weeks.push({ start: cursor, label: weekChipLabel(cursor) });
      cursor = addDays(cursor, 7);
    }
    return weeks;
  });

  gotoWeek(start: Date): void {
    const ws = startOfWeek(start);
    this.visibleWeekStart.set(ws);
    this.visibleMonth.set(monthAnchorOfWeek(ws));
    this.fetchBlocksForMonth();
  }

  /** Expone el helper `startOfWeek` al template. */
  weekStartOf(date: Date): Date {
    return startOfWeek(date);
  }

  /** "ago" para etiquetas cortas de rango. */
  shortMonth(date: Date): string {
    return MONTH_NAMES[date.getMonth()].slice(0, 3).toLowerCase();
  }

  /** ¿La semana visible es la semana actual? (para marcar "Hoy" en azul). */
  isThisWeek(): boolean {
    return startOfWeek(new Date()).getTime() === this.visibleWeekStart().getTime();
  }

  /** ¿El mes visible es el mes actual? (para marcar "Hoy" en azul). */
  isThisMonth(): boolean {
    const now = new Date();
    const m = this.visibleMonth();
    return m.getFullYear() === now.getFullYear() && m.getMonth() === now.getMonth();
  }

  /** Etiqueta corta de un día según `getDay()` (0=domingo…6=sábado). */
  dayShort(date: Date): string {
    return this.lang.t('ui.day_short.' + date.getDay());
  }

  // ── Rango de fechas ────────────────────────────────────────────────────────

  readonly rangeDays = computed<Date[]>(() => {
    const start = this.rangeStart();
    const end = this.rangeEnd();
    if (!start || !end) return [];
    const days: Date[] = [];
    let cursor = start;
    while (cursor <= end && days.length <= 120) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return days;
  });

  onRangeChange(): void {
    this.fetchRange();
  }

  /** Limpia el rango y vuelve al estado por defecto (sin resultados). */
  clearRange(): void {
    this.rangeStart.set(null);
    this.rangeEnd.set(null);
    this.rangeBlocks.set([]);
    this.rangeBookings.set([]);
    this.rangeLoading.set(false);
  }

  confirmRangeApply(): void {
    // Por ahora es una vista previa: la persistencia requiere un endpoint real.
    this.toast.info('Vista previa', 'La confirmación por rango se guardará cuando exista el endpoint de disponibilidad');
  }

  // ── Bloques del periodo ────────────────────────────────────────────────────

  private blockRangesForDate(date: Date, blocks: BlockedSlot[] = this.periodBlocks()): TimeWindow[] {
    const key = isoDate(date);
    const ranges: TimeWindow[] = [];
    for (const b of blocks) {
      const bs = new Date(b.start_time);
      const be = new Date(b.end_time);
      if (Number.isNaN(bs.getTime()) || Number.isNaN(be.getTime())) continue;
      const startKey = isoDate(bs);
      const endKey = isoDate(be);
      if (startKey === endKey) {
        if (startKey === key) ranges.push({ start: hhmm(bs), end: hhmm(be) });
      } else {
        if (startKey === key) ranges.push({ start: hhmm(bs), end: '24:00' });
        if (endKey === key) ranges.push({ start: '00:00', end: hhmm(be) });
      }
    }
    return ranges;
  }

  private fetchBlocksForMonth(): void {
    const month = this.visibleMonth();
    this.fetchBlocks(
      new Date(month.getFullYear(), month.getMonth(), 1),
      new Date(month.getFullYear(), month.getMonth() + 1, 0),
    );
  }

  private fetchBlocks(from: Date, to: Date): void {
    const providerId = this.providerId;
    if (!providerId) {
      this.periodBlocks.set([]);
      this.periodBookings.set([]);
      return;
    }
    this.periodLoading.set(true);
    const blocks$ = this.blockedSlotsApi.getBlockedSlots({
      date_from: isoDate(from),
      date_to: isoDate(to),
      provider_id: providerId,
    });
    const bookings$ = this.bookingsApi.getBookings({
      provider_id: providerId,
      date_from: isoDate(from),
      date_to: isoDate(to),
      per_page: 200,
    });

    // Ambas peticiones: pintamos en la vista previa los bloqueos Y las reservas.
    forkJoin([blocks$, bookings$]).subscribe({
      next: ([blocks, bookings]) => {
        this.periodBlocks.set(blocks?.data ?? []);
        const bData = bookings?.data;
        this.periodBookings.set(Array.isArray(bData) ? bData : []);
        this.periodLoading.set(false);
      },
      error: (err) => {
        this.periodBlocks.set([]);
        this.periodBookings.set([]);
        this.periodLoading.set(false);
        this.httpError.handle(err, 'cargar disponibilidad del periodo');
      },
    });
  }

  private fetchRange(): void {
    const start = this.rangeStart();
    const end = this.rangeEnd();
    const providerId = this.providerId;
    if (!start || !end || !providerId) {
      this.rangeBlocks.set([]);
      this.rangeBookings.set([]);
      return;
    }

    this.rangeLoading.set(true);
    const blocks$ = this.blockedSlotsApi.getBlockedSlots({
      date_from: isoDate(start),
      date_to: isoDate(end),
      provider_id: providerId,
    });
    const bookings$ = this.bookingsApi.getBookings({
      provider_id: providerId,
      date_from: isoDate(start),
      date_to: isoDate(end),
      per_page: 200,
    });

    forkJoin([blocks$, bookings$]).subscribe({
      next: ([blocks, bookings]) => {
        this.rangeBlocks.set(blocks?.data ?? []);
        const bData = bookings?.data;
        this.rangeBookings.set(Array.isArray(bData) ? bData : []);
        this.rangeLoading.set(false);
      },
      error: () => {
        this.rangeBlocks.set([]);
        this.rangeBookings.set([]);
        this.rangeLoading.set(false);
      },
    });
  }
}

// ── Helpers puros ──────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function hhmm(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function toMin(v: string): number {
  const [h, m] = v.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
function fmtMin(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}
function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0=domingo…6=sábado
  const sinceMonday = (day + 6) % 7; // días desde el lunes
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - sinceMonday);
}
function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}
function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}
/** Mes al que "pertenece" una semana según su jueves (regla ISO, consistente con el dashboard). */
function monthAnchorOfWeek(weekStart: Date): Date {
  const thu = addDays(weekStart, 3);
  return new Date(thu.getFullYear(), thu.getMonth(), 1);
}
/** Domingo de la semana que contiene el día 1 del mes (semana visible al cambiar de mes). */
function firstWeekStartOfMonth(monthStart: Date): Date {
  return startOfWeek(monthStart);
}
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
function monthLabel(d: Date): string {
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtShortDate(d: Date): string {
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3).toLowerCase()}`;
}
function monthShort(d: Date): string {
  return MONTH_NAMES[d.getMonth()].slice(0, 3).toLowerCase();
}
function fullMonthName(d: Date): string {
  return MONTH_NAMES[d.getMonth()];
}
/** Número de la semana dentro del mes que contiene `date` (lunes-first, desde la semana del día 1). */
function weekNumberInMonth(date: Date): number {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstWeek = startOfWeek(monthStart);
  const curWeek = startOfWeek(date);
  return Math.round((curWeek.getTime() - firstWeek.getTime()) / (7 * 86400000)) + 1;
}
/**
 * Etiqueta de una semana, número + rango de fechas para que se entienda a la vez.
 * Si cruza de mes, muestra la doble referencia, p. ej. "Sem 5/1 · 28 sep–4 oct".
 */
function weekChipLabel(ws: Date): string {
  const we = addDays(ws, 6);
  const sameMonth = ws.getMonth() === we.getMonth() && ws.getFullYear() === we.getFullYear();

  if (sameMonth) {
    return `Semana ${weekNumberInMonth(ws)} · ${ws.getDate()}–${we.getDate()} ${monthShort(we)}`;
  }

  return `Sem ${weekNumberInMonth(ws)}/${weekNumberInMonth(we)} · ${ws.getDate()} ${monthShort(ws)}–${we.getDate()} ${monthShort(we)}`;
}
function subtractWindows(windows: TimeWindow[], blockStart: string, blockEnd: string): TimeWindow[] {
  const bs = toMin(blockStart);
  const be = toMin(blockEnd);
  const out: TimeWindow[] = [];
  for (const w of windows) {
    const ws = toMin(w.start);
    const we = toMin(w.end);
    if (be <= ws || bs >= we) {
      out.push(w);
      continue;
    }
    if (bs > ws) out.push({ start: fmtMin(ws), end: fmtMin(bs) });
    if (be < we) out.push({ start: fmtMin(be), end: fmtMin(we) });
  }
  return out;
}

/** Divide un segmento "available" por un intervalo ocupado (reserva/bloqueo). */
function splitByBusy(seg: DaySegment, busy: DaySegment): DaySegment[] {
  const ss = toMin(seg.start);
  const se = toMin(seg.end);
  const bs = toMin(busy.start);
  const be = toMin(busy.end);
  if (be <= ss || bs >= se) return [seg];

  const out: DaySegment[] = [];
  if (bs > ss) out.push({ type: 'available', start: fmtMin(ss), end: fmtMin(bs) });
  if (be < se) out.push({ type: 'available', start: fmtMin(be), end: fmtMin(se) });
  return out;
}
