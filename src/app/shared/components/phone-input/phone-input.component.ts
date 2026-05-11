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
import intlTelInput from 'intl-tel-input';

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
  @Input() initialCountry = 'cl';
  @Input() preferredCountries: string[] = ['cl', 'ar', 'pe', 'co', 'mx'];

  private iti?: ReturnType<typeof intlTelInput>;
  private onChange?: (val: string) => void;
  private onTouched?: () => void;
  private pendingValue?: string;

  ngAfterViewInit(): void {
    const el = this.phoneInputRef.nativeElement;

    this.iti = intlTelInput(el, {
      initialCountry: this.initialCountry,
      preferredCountries: this.preferredCountries,
      separateDialCode: true,
      loadUtilsOnInit: '/assets/intl-tel-input/utils.js',
    } as any);

    // Apply pending value written before view was ready
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
    const value = this.iti?.getNumber() ?? '';
    this.onChange?.(value);
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
    const number = this.iti.getNumber();
    if (!number) return null; // empty field — let `required` handle that
    return this.iti.isValidNumber() ? null : { invalidPhone: true };
  }
}
