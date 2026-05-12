import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  forwardRef,
  Input,
} from '@angular/core';
import {
  ControlValueAccessor,
  Validator,
  AbstractControl,
  ValidationErrors,
  NG_VALUE_ACCESSOR,
  NG_VALIDATORS,
} from '@angular/forms';
import intlTelInput, { type Iso2 } from 'intl-tel-input';

@Component({
  selector: 'bw-phone-input',
  standalone: true,
  template: `<input #phoneInput type="tel" class="iti-input" [placeholder]="placeholder" />`,
  styleUrls: ['./phone-input.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PhoneInputComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => PhoneInputComponent),
      multi: true,
    },
  ],
})
export class PhoneInputComponent implements ControlValueAccessor, Validator, AfterViewInit, OnDestroy {
  @ViewChild('phoneInput') phoneInputRef!: ElementRef<HTMLInputElement>;
  @Input() placeholder = 'Teléfono';
  @Input() initialCountry: Iso2 = 'cl';
  @Input() countryOrder: Iso2[] = ['cl', 'ar', 'pe', 'co', 'mx'];

  private iti?: ReturnType<typeof intlTelInput>;
  private onChange?: (val: string) => void;
  private onTouched?: () => void;
  private pendingValue?: string;

  ngAfterViewInit(): void {
    const el = this.phoneInputRef.nativeElement;

    this.iti = intlTelInput(el, {
      initialCountry: this.initialCountry,
      countryOrder: this.countryOrder,
      separateDialCode: true,
      showFlags: true,
      useFullscreenPopup: false,
      i18n: { searchPlaceholder: '', searchEmptyState: 'Sin resultados' },
      loadUtils: () => import('intl-tel-input/utils'),
    });

    if (this.pendingValue) {
      this.iti.setNumber(this.pendingValue);
      this.pendingValue = undefined;
    }

    el.addEventListener('input', () => this.emitChange());
    el.addEventListener('blur', () => this.onTouched?.());
    el.addEventListener('countrychange', () => this.emitChange());
  }

  ngOnDestroy(): void {
    this.iti?.destroy();
  }

  private emitChange(): void {
    try {
      const value = this.iti?.getNumber() ?? '';
      this.onChange?.(value);
    } catch {
      // utils not yet loaded
    }
  }

  // ── ControlValueAccessor ────────────────────────────────────────────────────

  writeValue(value: string): void {
    if (this.iti) {
      this.iti.setNumber(value ?? '');
    } else {
      this.pendingValue = value;
    }
  }

  registerOnChange(fn: (val: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (this.phoneInputRef?.nativeElement) {
      this.phoneInputRef.nativeElement.disabled = isDisabled;
    }
  }

  // ── Validator ───────────────────────────────────────────────────────────────

  validate(_control: AbstractControl): ValidationErrors | null {
    if (!this.iti) return null;
    try {
      const number = this.iti.getNumber();
      if (!number) return null;
      return this.iti.isValidNumber() ? null : { invalidPhone: true };
    } catch {
      return null;
    }
  }
}
