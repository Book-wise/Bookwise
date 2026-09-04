import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { AuthService } from '@services/auth.service';
import { LanguageService } from '@services/language.service';
import { BusinessesApiService } from '@services/api/businesses-api.service';
import { Business } from '@models';

const PLAN_OPTIONS = [
  { label: 'Starter', value: 'starter' },
  { label: 'Professional', value: 'professional' },
  { label: 'Enterprise', value: 'enterprise' },
];

@Component({
  selector: 'bw-business-edit',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, ButtonModule, InputTextModule, SelectModule,
    RouterLink,
  ],
  templateUrl: './business-edit.component.html',
  styleUrls: ['./business-edit.component.scss'],
})
export class BusinessEditComponent implements OnInit {
  private auth = inject(AuthService);
  private businessesApi = inject(BusinessesApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private messageService = inject(MessageService);
  readonly lang = inject(LanguageService);

  readonly PLAN_OPTIONS = PLAN_OPTIONS;
  readonly businessId = signal<number | null>(null);

  readonly business = computed<Business | null>(() => {
    const id = this.businessId();
    if (!id) return null;
    const all = this.auth.me()?.businesses ?? [];
    return all.find((b) => b.id === id) ?? this.auth.me()?.business ?? null;
  });

  name = signal('');
  email = signal('');
  address = signal('');
  phone = signal('');
  plan = signal('starter');
  saving = signal(false);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(id)) {
      this.router.navigate(['/admin/profile']);
      return;
    }
    this.businessId.set(id);
    const biz = this.business();
    if (biz) {
      this.name.set(biz.name);
      this.email.set(biz.email ?? '');
      this.address.set(biz.address ?? '');
      this.phone.set(biz.phone ?? '');
      this.plan.set(biz.plan);
    }
  }

  save(): void {
    const biz = this.business();
    if (!biz) return;
    this.saving.set(true);
    this.businessesApi
      .updateBusiness(biz.id, {
        name: this.name(),
        email: this.email() || null,
        address: this.address() || null,
        phone: this.phone() || null,
        plan: this.plan(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.messageService.add({ severity: 'success', summary: 'Negocio', detail: 'Negocio actualizado', key: 'global', life: 3500 });
          this.router.navigate(['/admin/profile']);
        },
        error: () => {
          this.saving.set(false);
          this.messageService.add({ severity: 'error', summary: this.lang.t('ui.error'), detail: 'No se pudo actualizar el negocio', key: 'global', life: 4000 });
        },
      });
  }
}
