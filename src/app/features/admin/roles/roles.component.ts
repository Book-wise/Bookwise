import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { RolesApiService } from '@services/api/roles-api.service';
import { ProvidersApiService } from '@services/api/providers-api.service';
import { HttpErrorService } from '@services/http-error.service';
import { LanguageService } from '@services/language.service';
import { Provider, Role } from '@models';

@Component({
  selector: 'bw-roles',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    SelectModule,
    CheckboxModule,
    ButtonModule,
    MessageModule,
  ],
  templateUrl: './roles.component.html',
  styleUrls: ['./roles.component.scss'],
})
export class RolesComponent implements OnInit {
  private rolesApi = inject(RolesApiService);
  private providersApi = inject(ProvidersApiService);
  private httpError = inject(HttpErrorService);
  readonly lang = inject(LanguageService);

  /** admin_general es único y no eliminable vía la UI. */
  readonly adminGeneralRoleName = 'admin_general';

  roles = signal<Role[]>([]);
  providers = signal<Provider[]>([]);
  loading = signal(true);
  saving = signal(false);
  error = signal<string | null>(null);

  selectedProviderId = signal<number | null>(null);
  selectedRoleNames = signal<string[]>([]);

  readonly selectedProvider = computed(() => {
    const id = this.selectedProviderId();
    return this.providers().find((p) => p.id === id) ?? null;
  });

  /** Roles que el profesional seleccionado tiene actualmente (desde GET /providers). */
  readonly currentProviderRoles = computed<Set<string>>(() => {
    const provider = this.selectedProvider();
    return new Set((provider?.roles ?? []).map((r) => r.name));
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.rolesApi.getRoles().subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.httpError.handle(err, this.lang.t('roles.title'));
      },
    });
    this.providersApi.getProviders().subscribe({
      next: (providers) => this.providers.set(providers),
      error: (err) => this.httpError.handle(err, this.lang.t('roles.title')),
    });
  }

  onProviderChange(id: number): void {
    this.selectedProviderId.set(id);
    this.error.set(null);
    this.selectedRoleNames.set([...this.currentProviderRoles()]);
  }

  isRoleChecked(name: string): boolean {
    return this.selectedRoleNames().includes(name);
  }

  /** admin_general siempre bloqueado: no se puede quitar ni reasignar vía UI. */
  isRoleLocked(name: string): boolean {
    return name === this.adminGeneralRoleName;
  }

  onRoleChange(checked: boolean, name: string): void {
    if (this.isRoleLocked(name)) return;
    this.selectedRoleNames.update((list) => {
      const next = new Set(list);
      if (checked) next.add(name);
      else next.delete(name);
      return [...next];
    });
    this.error.set(null);
  }

  roleLabel(name: string): string {
    const key = `roles.role.${name}`;
    return this.lang.has(key) ? this.lang.t(key) : name;
  }

  save(): void {
    const provider = this.selectedProvider();
    if (!provider) {
      this.error.set(this.lang.t('roles.provider_required'));
      return;
    }

    const selected = [...this.selectedRoleNames()];
    if (selected.length === 0) {
      this.error.set(this.lang.t('roles.empty_error'));
      return;
    }

    const valid = new Set(this.roles().map((r) => r.name));
    if (selected.some((name) => !valid.has(name))) {
      this.error.set(this.lang.t('roles.empty_error'));
      return;
    }

    const current = this.currentProviderRoles();
    const hasGeneral = current.has(this.adminGeneralRoleName);
    const keepsGeneral = selected.includes(this.adminGeneralRoleName);
    // admin_general no se puede remover ni reasignar por la UI.
    if (hasGeneral && !keepsGeneral) {
      this.error.set(this.lang.t('roles.admin_general_locked'));
      return;
    }
    if (!hasGeneral && keepsGeneral) {
      this.error.set(this.lang.t('roles.admin_general_locked'));
      return;
    }

    this.error.set(null);
    this.saving.set(true);
    this.rolesApi.assignProviderRoles(provider.id, selected).subscribe({
      next: ({ data }) => {
        this.saving.set(false);
        this.providers.update((list) =>
          list.map((p) => (p.id === provider.id ? { ...p, roles: data } : p)),
        );
      },
      error: (err) => {
        this.saving.set(false);
        this.httpError.handle(err, this.lang.t('roles.save'));
      },
    });
  }
}
