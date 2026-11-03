import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';

import { MessageService } from 'primeng/api';
import { PacksListComponent } from './packs-list.component';
import { LanguageService } from '@services/language.service';
import { ReferenceStore } from '@core/stores/reference.store';
import { AuthService } from '@services/auth.service';
import type { Service, ServicePack } from '@models';

function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: 1,
    name: 'Kinesiología general',
    duration_minutes: 60,
    price: '25000',
    active: true,
    ...overrides,
  } as Service;
}

function makePack(overrides: Partial<ServicePack> = {}): ServicePack {
  return {
    id: 10,
    service_id: 1,
    name: 'Pack',
    total_sessions: 3,
    price: '67500',
    active: true,
    ...overrides,
  };
}

describe('PacksListComponent (Servicios y packs)', () => {
  let fixture: ComponentFixture<PacksListComponent>;
  let component: PacksListComponent;
  let store: {
    services: ReturnType<typeof signal<Service[]>>;
    packs: ReturnType<typeof signal<ServicePack[]>>;
    loaded: ReturnType<typeof signal<Record<string, boolean>>>;
    loading: ReturnType<typeof signal<Record<string, boolean>>>;
    error: ReturnType<typeof signal<Record<string, string | null>>>;
    loadServices: ReturnType<typeof vi.fn>;
    loadPacks: ReturnType<typeof vi.fn>;
  };

  const services: Service[] = [
    makeService({ id: 1, name: 'Kinesiología general', duration_minutes: 60, price: '25000' }),
    makeService({ id: 2, name: 'Rehabilitación deportiva', duration_minutes: 45, price: '32000' }),
    makeService({ id: 3, name: 'Evaluación kinésica', duration_minutes: 30, price: '18000', active: false }),
  ];

  const packs: ServicePack[] = [
    makePack({ id: 11, service_id: 1, total_sessions: 6, price: '120000' }),
    makePack({ id: 12, service_id: 1, total_sessions: 3, price: '67500' }),
    makePack({ id: 13, service_id: 2, total_sessions: 5, price: '145000' }),
  ];

  async function setup(options: { loaded?: boolean; error?: string | null } = {}): Promise<void> {
    const loaded = options.loaded ?? true;
    store = {
      services: signal<Service[]>(services),
      packs: signal<ServicePack[]>(packs),
      loaded: signal<Record<string, boolean>>({
        clients: false,
        locations: false,
        providers: false,
        services: loaded,
        packs: loaded,
        regions: false,
      }),
      loading: signal<Record<string, boolean>>({
        clients: false,
        locations: false,
        providers: false,
        services: false,
        packs: false,
        regions: false,
      }),
      error: signal<Record<string, string | null>>({
        clients: null,
        locations: null,
        providers: null,
        services: options.error ?? null,
        packs: null,
        regions: null,
      }),
      loadServices: vi.fn(),
      loadPacks: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [PacksListComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ReferenceStore, useValue: store },
        { provide: MessageService, useValue: { add: vi.fn() } },
        { provide: AuthService, useValue: { user: () => ({ id: 7, tenant_id: 3 }) } },
        LanguageService,
      ],
    }).compileComponents();

    TestBed.inject(LanguageService).setLang('es');
    fixture = TestBed.createComponent(PacksListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    localStorage.clear();
  });

  // ── Regla 1: una tarjeta por servicio ─────────────────────────────────────
  it('muestra una tarjeta por servicio con nombre y duración', async () => {
    await setup();

    const cards = fixture.nativeElement.querySelectorAll('[data-testid="service-card"]');

    expect(cards.length).toBe(3);
    expect(fixture.nativeElement.textContent).toContain('Kinesiología general');
    expect(fixture.nativeElement.textContent).toContain('60 min');
  });

  // ── Regla 2: términos del servicio correcto, ordenados ───────────────────
  it('muestra los términos de cada servicio ordenados por sesiones', async () => {
    await setup();

    const firstCard = fixture.nativeElement.querySelector('[data-testid="service-card"]');
    const terms = Array.from(firstCard.querySelectorAll('[data-testid="term"]')).map((el) =>
      (el as HTMLElement).textContent!.replace(/\s+/g, ' ').trim(),
    );

    expect(terms.length).toBe(2);
    expect(terms[0]).toContain('3 sesiones');
    expect(terms[1]).toContain('6 sesiones');
    expect(terms.join(' ')).not.toContain('145.000');
  });

  // ── Regla 3: precio por sesión ───────────────────────────────────────────
  it('muestra el precio por sesión de cada término', async () => {
    await setup();

    const text = (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');

    expect(text).toContain('$22.500 /sesión');
    expect(text).toContain('$20.000 /sesión');
  });

  // ── Regla 4: sin badge de descuento inventado ────────────────────────────
  it('no renderiza ningún badge ni porcentaje de descuento', async () => {
    await setup();

    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelectorAll('[data-testid="discount-badge"]').length).toBe(0);
    expect(el.textContent).not.toMatch(/−\d+%|-\d+%/);
  });

  // ── Regla 5: chips de estado ─────────────────────────────────────────────
  it('marca cada servicio como activo o inactivo según active', async () => {
    await setup();

    const cards = fixture.nativeElement.querySelectorAll('[data-testid="service-card"]');
    const texts = Array.from(cards).map((c) => (c as HTMLElement).textContent!.replace(/\s+/g, ' '));

    expect(texts[0]).toContain('Activo');
    expect(texts[2]).toContain('Inactivo');
  });

  // ── Regla 6: filtro de estado ────────────────────────────────────────────
  it('filtra por estado y "Todos" restaura la lista completa', async () => {
    await setup();
    const select: HTMLSelectElement = fixture.nativeElement.querySelector(
      '[data-testid="status-filter"]',
    );

    select.value = 'inactive';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll('[data-testid="service-card"]').length,
    ).toBe(1);

    select.value = 'all';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll('[data-testid="service-card"]').length,
    ).toBe(3);
  });

  it('el filtro de estado no ofrece el estado borrador (pendiente de backend)', async () => {
    await setup();

    const select: HTMLSelectElement = fixture.nativeElement.querySelector(
      '[data-testid="status-filter"]',
    );
    const labels = Array.from(select.options).map((o) => o.textContent!.trim());

    expect(labels).toEqual(['Todos', 'Activos', 'Inactivos']);
  });

  // ── Regla 7: buscador insensible a acentos ───────────────────────────────
  it('busca por nombre ignorando mayúsculas y acentos', async () => {
    await setup();
    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      '[data-testid="search-input"]',
    );

    input.value = 'kinesiologia';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('[data-testid="service-card"]');
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('Kinesiología general');
  });

  // ── Regla 8: banner de sugerencia ────────────────────────────────────────
  it('cuenta los servicios sin variaciones activas y se puede descartar', async () => {
    await setup();

    const banner = fixture.nativeElement.querySelector('[data-testid="suggestion"]');
    expect(banner).toBeTruthy();
    expect(banner.textContent.replace(/\s+/g, ' ')).toContain('1 servicio');

    fixture.nativeElement
      .querySelector('[data-testid="suggestion-dismiss"]')
      .dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="suggestion"]')).toBeNull();
  });

  it('no muestra el banner cuando todos los servicios tienen variaciones activas', async () => {
    await setup();
    store.packs.set([
      ...packs,
      makePack({ id: 14, service_id: 3, total_sessions: 1, price: '18000' }),
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="suggestion"]')).toBeNull();
  });

  // ── Regla 9: toggle de vista + persistencia ──────────────────────────────
  it('cambia entre tarjetas y lista y persiste la elección por usuario', async () => {
    await setup();

    fixture.nativeElement
      .querySelector('[data-testid="view-list"]')
      .dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="services-table"]')).toBeTruthy();
    expect(localStorage.getItem('bw:services:vista:7:3')).toBe('list');

    fixture.nativeElement
      .querySelector('[data-testid="view-cards"]')
      .dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="services-table"]')).toBeNull();
    expect(localStorage.getItem('bw:services:vista:7:3')).toBe('cards');
  });

  it('arranca en la vista guardada', async () => {
    localStorage.setItem('bw:services:vista:7:3', 'list');
    await setup();

    expect(fixture.nativeElement.querySelector('[data-testid="services-table"]')).toBeTruthy();
  });

  // ── Regla 10: sub-fila de términos en la vista lista ─────────────────────
  it('expande una sola fila a la vez y mantiene aria-expanded coherente', async () => {
    await setup();
    fixture.nativeElement
      .querySelector('[data-testid="view-list"]')
      .dispatchEvent(new Event('click'));
    fixture.detectChanges();

    const toggles = fixture.nativeElement.querySelectorAll('[data-testid="row-toggle"]');
    expect(toggles.length).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('[data-testid="terms-subrow"]').length).toBe(0);

    toggles[0].dispatchEvent(new Event('click'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="terms-subrow"]').length).toBe(1);
    expect(toggles[0].getAttribute('aria-expanded')).toBe('true');

    toggles[1].dispatchEvent(new Event('click'));
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="terms-subrow"]');
    expect(rows.length).toBe(1);
    expect((rows[0] as HTMLElement).textContent).toContain('Rehabilitación deportiva');
  });

  // ── Regla 11: read-only, sin botones muertos ─────────────────────────────
  it('no renderiza acciones de escritura mientras el backend no las soporte', async () => {
    await setup();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelectorAll('[data-testid="create-service"]').length).toBe(0);
    expect(el.querySelectorAll('[data-testid="edit-service"]').length).toBe(0);
    expect(el.textContent).toContain('consulta');
  });
  // ── Regla 12: una sola carga compartida (ReferenceStore) ─────────────────
  it('no vuelve a pedir datos si el store ya los tiene cargados', async () => {
    await setup();

    expect(store.loadServices).not.toHaveBeenCalled();
    expect(store.loadPacks).not.toHaveBeenCalled();
  });

  it('pide services y packs al store cuando todavía no están cargados', async () => {
    await setup({ loaded: false });

    expect(store.loadServices).toHaveBeenCalledTimes(1);
    expect(store.loadPacks).toHaveBeenCalledTimes(1);
  });

  it('muestra el error de carga que reporta el store', async () => {
    await setup({ error: 'boom' });

    expect(fixture.nativeElement.textContent).toContain('No se pudieron cargar los servicios');
  });
});
