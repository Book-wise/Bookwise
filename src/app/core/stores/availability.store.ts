import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { AvailabilityService, ProviderAvailabilitySlot } from '@services/availability.service';

/**
 * Store de la disponibilidad del profesional.
 *
 * Fuente de verdad única de la plantilla semanal (semana estándar). Todos los
 * componentes que muestren/editan disponibilidad (la pantalla "Mi Disponibilidad"
 * y, a futuro, el calendario) deben leer/escribir ACÁ, para que cualquier cambio
 * se vea reflejado en todas partes de forma coherente.
 *
 * Hoy el backend no persiste la plantilla (`AvailabilityService` es mock). Cuando
 * exista el endpoint real, solo hay que cambiar el service; el store y sus
 * consumidores no cambian.
 */
@Injectable({ providedIn: 'root' })
export class AvailabilityStore {
  private readonly service = inject(AvailabilityService);

  /** Plantilla semanal (día de la semana + rangos horarios + activo). */
  readonly slots = signal<ProviderAvailabilitySlot[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);

  /** Deriva la plantilla semanal desde el service (mock por ahora). */
  load(providerId: number): void {
    this.loading.set(true);
    this.service.getProviderAvailability(providerId).subscribe({
      next: (slots) => {
        this.slots.set(slots);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  /** Agrega un rango horario a la plantilla (día + horas). */
  addSlot(slot: ProviderAvailabilitySlot): void {
    this.slots.update((list) => [...list, slot]);
  }

  /** Agrega varios rangos de una (alta en masa, copiar día, etc.). */
  addSlots(slots: ProviderAvailabilitySlot[]): void {
    this.slots.update((list) => [...list, ...slots]);
  }

  /** Reemplaza la plantilla completa (por ejemplo tras copiar un día o guardar). */
  setSlots(slots: ProviderAvailabilitySlot[]): void {
    this.slots.set(slots);
  }

  /** Quita un rango de la plantilla. */
  removeSlot(slot: ProviderAvailabilitySlot): void {
    this.slots.update((list) => list.filter((s) => s !== slot));
  }

  /** Reemplaza un rango (para edición inline de horas). */
  updateSlot(slot: ProviderAvailabilitySlot): void {
    this.slots.update((list) => list.map((s) => (s === slot ? { ...slot } : s)));
  }

  /** Devuelve el observable de guardado; el consumidor maneja el ciclo (saving, toast, errores). */
  save(providerId: number): Observable<ProviderAvailabilitySlot[]> {
    return this.service.saveProviderAvailability(providerId, this.slots());
  }

  /** Horarios activos de la plantilla para un día de la semana (0=domingo). */
  slotsForDay(dayOfWeek: number): ProviderAvailabilitySlot[] {
    return this.slots().filter((s) => s.day_of_week === dayOfWeek && s.is_active);
  }
}
