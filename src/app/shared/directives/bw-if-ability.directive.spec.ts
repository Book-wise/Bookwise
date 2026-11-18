import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { BwIfAbilityDirective } from './bw-if-ability.directive';
import { AuthService } from '@services/auth.service';
import { ABILITIES } from '@shared/config/abilities.config';

@Component({
  standalone: true,
  imports: [BwIfAbilityDirective],
  template: `<button *bwIfAbility="ABILITIES.locationsManage" id="target">Nueva sucursal</button>`,
})
class HostComponent {
  readonly ABILITIES = ABILITIES;
}

/**
 * Contrato de la frontera de UX (S1/S3/S5 de `odd/tasks/fase-b-rbac-cierre.md`):
 * sin el permission key, la acción no existe en el DOM; con el key, se renderiza
 * y reacciona a cambios de la matriz del tenant activo.
 */
describe('BwIfAbilityDirective', () => {
  const permissions = signal<string[]>([]);

  beforeEach(() => {
    permissions.set([]);
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        {
          provide: AuthService,
          useValue: {
            hasAllPermissions: (...keys: string[]) => keys.every((k) => permissions().includes(k)),
          },
        },
      ],
    });
  });

  function render() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('no renderiza la acción sin el permission key', () => {
    const fixture = render();

    expect(fixture.nativeElement.querySelector('#target')).toBeNull();
  });

  it('renderiza la acción cuando el usuario tiene el permission key', () => {
    permissions.set([ABILITIES.locationsManage]);
    const fixture = render();

    expect(fixture.nativeElement.querySelector('#target')).not.toBeNull();
  });

  it('reacciona cuando la matriz cambia (quita y vuelve a poner la acción)', () => {
    permissions.set([ABILITIES.locationsManage]);
    const fixture = render();
    expect(fixture.nativeElement.querySelector('#target')).not.toBeNull();

    permissions.set([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#target')).toBeNull();

    permissions.set([ABILITIES.locationsManage]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#target')).not.toBeNull();
  });
});
