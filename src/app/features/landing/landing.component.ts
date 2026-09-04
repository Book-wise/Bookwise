import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LanguageService } from '@services/language.service';

@Component({
  selector: 'bw-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent {
  readonly lang = inject(LanguageService);

  readonly features = [
    {
      title: 'landing.features.1.title',
      desc: 'landing.features.1.desc',
      icon: 'pi-calendar',
      color: 'var(--bw-300)',
    },
    {
      title: 'landing.features.2.title',
      desc: 'landing.features.2.desc',
      icon: 'pi-whatsapp',
      color: 'var(--bw-success)',
    },
    {
      title: 'landing.features.3.title',
      desc: 'landing.features.3.desc',
      icon: 'pi-comments',
      color: '#7c3aed',
    },
  ];

  readonly businessTypes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

  readonly plans = [
    {
      key: 'starter',
      name: 'Starter',
      price: '14.990',
      priceNote: '/mes · CLP',
      features: [
        '1 profesional',
        'Agenda ilimitada',
        'Clientes y fichas',
        'Recordatorios por email',
      ],
    },
    {
      key: 'professional',
      name: 'Professional',
      price: '34.990',
      priceNote: '/mes · CLP',
      popular: true,
      features: [
        'Hasta 4 profesionales',
        '1-3 sucursales',
        'Caja y pagos',
        'Notificaciones',
      ],
    },
    {
      key: 'enterprise',
      name: 'Enterprise',
      price: '79.990',
      priceNote: '/mes · CLP',
      features: [
        '2+ empresas (multi-tenant)',
        'Multi-sucursal',
        'API + panel consolidado',
        'Soporte prioritario',
      ],
    },
  ];
}
