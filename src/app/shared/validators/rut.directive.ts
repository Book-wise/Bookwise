import { Directive } from '@angular/core';
import { AbstractControl, NG_VALIDATORS, ValidationErrors, Validator } from '@angular/forms';
import { rutValidator } from './rut.validator';

/**
 * Template-driven wrapper around `rutValidator()`.
 * Usage: <input bwRut ...>
 * Error key: { rut: true } (same as rutValidator()).
 */
@Directive({
  selector: '[bwRut]',
  standalone: true,
  providers: [
    {
      provide: NG_VALIDATORS,
      useExisting: RutDirective,
      multi: true,
    },
  ],
})
export class RutDirective implements Validator {
  private readonly validatorFn = rutValidator();

  validate(control: AbstractControl): ValidationErrors | null {
    return this.validatorFn(control);
  }
}
