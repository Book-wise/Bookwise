import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ClinicalRecordTypesComponent } from './clinical-record-types.component';
import { ClinicalRecordTypesStore } from '@core/stores/clinical-record-types.store';
import { LanguageService } from '@services/language.service';

const K = {
  empty: 'settings.clinical_types.list.empty',
  new: 'settings.clinical_types.new',
  saved: 'settings.clinical_types.saved',
  unsaved: 'settings.clinical_types.unsaved',
  save: 'settings.clinical_types.save',
  discard: 'settings.clinical_types.discard',
};

describe('ClinicalRecordTypesComponent', () => {
  let fixture: ComponentFixture<ClinicalRecordTypesComponent>;
  let component: ClinicalRecordTypesComponent;
  let store: InstanceType<typeof ClinicalRecordTypesStore>;

  async function setup(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ClinicalRecordTypesComponent],
      providers: [
        provideZonelessChangeDetection(),
        ClinicalRecordTypesStore,
        { provide: LanguageService, useValue: { t: (k: string) => k } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClinicalRecordTypesComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(ClinicalRecordTypesStore);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function render(): void {
    fixture.detectChanges();
  }

  function buttonByLabel(label: string): HTMLButtonElement | null {
    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    );
    return buttons.find((b) => (b.textContent ?? '').includes(label)) ?? null;
  }

  function nameInput(): HTMLInputElement {
    return fixture.nativeElement.querySelector('.ct-editor__name') as HTMLInputElement;
  }

  function createType(): void {
    const btn = fixture.nativeElement.querySelector('.ct-new') as HTMLButtonElement;
    btn.click();
    render();
  }

  it('muestra el estado vacío y el botón de crear', async () => {
    await setup();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain(K.empty);
    expect(el.querySelector('.ct-list__empty')).toBeTruthy();
    expect(el.querySelector('.ct-new')).toBeTruthy();
    expect(buttonByLabel(K.new)).toBeTruthy();
  });

  it('al crear un tipo muestra el editor con nombre vacío y sin cambios pendientes', async () => {
    await setup();
    createType();

    expect(nameInput()).toBeTruthy();
    expect(nameInput().value).toBe('');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(K.saved);
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(K.unsaved);

    const save = buttonByLabel(K.save)!;
    const discard = buttonByLabel(K.discard)!;
    expect(save.disabled).toBe(true);
    expect(discard.disabled).toBe(true);
  });

  it('tipear el nombre activa «Cambios sin guardar» y habilita Guardar', async () => {
    await setup();
    createType();

    const input = nameInput();
    input.value = 'Láser';
    input.dispatchEvent(new Event('input'));
    render();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain(K.unsaved);
    expect(el.textContent).not.toContain(K.saved);
    expect(buttonByLabel(K.save)!.disabled).toBe(false);
    expect(buttonByLabel(K.discard)!.disabled).toBe(false);
  });

  it('«Agregar campo» suma una fila al constructor', async () => {
    await setup();
    createType();

    const add = fixture.nativeElement.querySelector('.ct-add') as HTMLButtonElement;
    add.click();
    render();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelectorAll('.ct-frow').length).toBe(1);
    expect(store.draft()?.fields.length).toBe(1);
  });

  it('«Guardar cambios» commitea y limpia el estado dirty', async () => {
    await setup();
    createType();

    const input = nameInput();
    input.value = 'Láser';
    input.dispatchEvent(new Event('input'));
    render();

    buttonByLabel(K.save)!.click();
    render();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain(K.saved);
    expect(el.textContent).not.toContain(K.unsaved);
    expect(buttonByLabel(K.save)!.disabled).toBe(true);
    expect(buttonByLabel(K.discard)!.disabled).toBe(true);
    expect(store.types()[0].name).toBe('Láser');
  });

  it('«Descartar» revierte los cambios no guardados', async () => {
    await setup();
    createType();

    const input = nameInput();
    input.value = 'Borrador';
    input.dispatchEvent(new Event('input'));
    render();

    buttonByLabel(K.discard)!.click();
    render();

    expect(nameInput().value).toBe('');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(K.saved);
    expect(store.types()[0].name).toBe('');
  });
});
