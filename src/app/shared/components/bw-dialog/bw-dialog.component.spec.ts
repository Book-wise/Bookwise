import { Component, signal } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { BwDialogComponent } from './bw-dialog.component';

@Component({
  standalone: true,
  imports: [BwDialogComponent],
  template: `
    <bw-dialog
      [(visible)]="open"
      header="Editar paciente"
      [footer]="showFooter() ? footerTpl : undefined"
      (dismissed)="dismissals = dismissals + 1">
      <p class="spec-body">Contenido proyectado</p>
      <ng-template #footerTpl>
        <button type="button" class="spec-save">Guardar</button>
      </ng-template>
    </bw-dialog>
  `,
})
class DialogHostComponent {
  readonly open = signal(false);
  readonly showFooter = signal(true);
  dismissals = 0;
}

describe('BwDialogComponent', () => {
  let fixture: ComponentFixture<DialogHostComponent>;
  let host: DialogHostComponent;

  const dialog = (): HTMLElement | null => fixture.nativeElement.querySelector('.p-dialog');

  const closeButton = (): HTMLElement => {
    const holder = fixture.nativeElement.querySelector('.p-dialog-close-button') as HTMLElement;
    return (holder.tagName === 'BUTTON' ? holder : holder.querySelector('button')) as HTMLElement;
  };

  const open = async (): Promise<void> => {
    host.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DialogHostComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(DialogHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    // PrimeNG bloquea el scroll del body mientras el modal está abierto y no
    // lo libera al destruir el componente.
    document.body.removeAttribute('data-p-scrollblocker-active');
    document.body.style.overflow = '';
  });

  it('keeps the dialog out of the DOM until visible is true', () => {
    expect(dialog()).toBeNull();
  });

  it('renders the header and the projected body when opened', async () => {
    await open();

    expect(dialog()).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.p-dialog-title')?.textContent).toContain(
      'Editar paciente',
    );
    expect(fixture.nativeElement.querySelector('.p-dialog-content .spec-body')?.textContent).toBe(
      'Contenido proyectado',
    );
  });

  it('renders the projected footer when a template is provided', async () => {
    await open();

    expect(fixture.nativeElement.querySelector('.p-dialog-footer .spec-save')?.textContent).toBe(
      'Guardar',
    );
  });

  it('leaves the footer out when no template is provided', async () => {
    host.showFooter.set(false);
    await open();

    expect(dialog()).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.p-dialog-footer')).toBeNull();
  });

  it('closes through the visible model and reports a user dismissal', async () => {
    await open();

    closeButton().click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(host.open()).toBe(false);
    expect(host.dismissals).toBe(1);
  });

  it('does not report a dismissal when the parent closes it', async () => {
    await open();

    host.open.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(host.dismissals).toBe(0);
  });
});
