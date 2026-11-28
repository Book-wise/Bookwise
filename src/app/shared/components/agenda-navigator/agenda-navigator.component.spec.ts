import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AgendaNavigatorComponent } from './agenda-navigator.component';
import { CalendarNavigationService } from '@services/calendar-navigation.service';

/**
 * Widget de navegación del sidebar: mini-calendario del mes. Dirección del
 * artboard `design/ficha-imagenes-b2/06-side-menu-abierto.html` (comentario
 * «mes entero»): la tarjeta muestra el mes completo (6 semanas / 42 celdas),
 * no un recorte de la semana actual.
 */
describe('AgendaNavigatorComponent — mini calendario del sidebar', () => {
  let fixture: ComponentFixture<AgendaNavigatorComponent>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgendaNavigatorComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: CalendarNavigationService,
          useValue: { navigateToCalendar: vi.fn(() => Promise.resolve()) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AgendaNavigatorComponent);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  it('muestra el mes entero: 7 cabeceras y una grilla estable de 42 celdas', () => {
    const headers = el.querySelectorAll('.navigator__header');
    const cells = el.querySelectorAll('.navigator__day');
    expect(headers).toHaveLength(7);
    // 6 semanas completas: la grilla mantiene altura fija mes a mes.
    expect(cells).toHaveLength(42);
  });

  it('muestra todos los días del mes (1..N) sin huecos en el rango', () => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const days = Array.from(
      el.querySelectorAll<HTMLButtonElement>('.navigator__day:not(.navigator__day--empty)'),
    ).map((b) => Number(b.textContent!.trim()));

    expect(days).toHaveLength(daysInMonth);
    // Consecutivos y en orden: 1, 2, …, daysInMonth.
    expect(days).toEqual(Array.from({ length: daysInMonth }, (_, i) => i + 1));
  });
});
