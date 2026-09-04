import { AfterViewInit, Component, ElementRef, inject, ViewChildren, QueryList } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { LanguageService } from '@services/language.service';

@Component({
  selector: 'bw-landing',
  standalone: true,
  imports: [CommonModule, RouterLink, ButtonModule],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent implements AfterViewInit {
  readonly lang = inject(LanguageService);
  @ViewChildren('.reveal') revealEls!: QueryList<ElementRef>;

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
        'Roles admin_general / admin_local',
      ],
    },
  ];

  ngAfterViewInit(): void {
    const els = this.revealEls.toArray().map((e) => e.nativeElement as HTMLElement);
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('is-visible');
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
  }
}
