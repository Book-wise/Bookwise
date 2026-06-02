import { Pipe, PipeTransform } from '@angular/core';
import { formatCLP } from '@shared/config/currency.config';

@Pipe({ name: 'bwCurrency', standalone: true, pure: true })
export class BwCurrencyPipe implements PipeTransform {
  transform(value: string | number | null | undefined): string {
    return formatCLP(value);
  }
}
