import { Component } from '@angular/core';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'bw-provider-availability',
  standalone: true,
  imports: [CardModule],
  templateUrl: './provider-availability.component.html',
  styleUrls: ['./provider-availability.component.scss'],
})
export class ProviderAvailabilityComponent {}
