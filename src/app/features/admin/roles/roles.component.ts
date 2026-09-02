import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { RolesApiService } from '@services/api/roles-api.service';
import { HttpErrorService } from '@services/http-error.service';
import { LanguageService } from '@services/language.service';
import { ReferenceStore } from '@core/stores/reference.store';
import { Role } from '@models';
import { roleMeta } from './role-meta';
import { applyAdminGeneralInvariant, isAdminGeneralLocked } from './role-guards';

/**
 * Opción del selector buscable: además del id, lleva un `label` concatenado
 * (nombre + roles) para que el filtro de p-select matchee por nombre Y rol, y
 * el `name`/`roles` para renderizar el template personalizado.
 */
interface ProviderOption {
  id: number;
  label: string;
  name: string;
  email: string;
  roles: Role[];
}

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
  private httpError = inject(HttpErrorService);
  private refStore = inject(ReferenceStore);
  readonly lang = inject(LanguageService);

  /** Resuelve color/icono de un rol (fallback gris + pi-user). */
  protected readonly roleMeta = roleMeta;

  roles = signal<Role[]>([]);
  /**
   * Providers leídos de ReferenceStore (fuente canónica): el store patcha
   * `providers` con la respuesta del server tras asignar roles (U6), por lo que
   * esta pantalla no mantiene lista local ni recarga post-guardado.
   */
  readonly providers = computed(() => this.refStore.providers());

  /**
   * Opciones del <p-select> buscable. El `label` concatena nombre + roles para
   * que el filtro por texto matchee ambos; el id numérico se mantiene como
   * `optionValue` para que onProviderChange siga recibiendo un número.
   */
  readonly providerOptions = computed<ProviderOption[]>(() =>
    this.providers().map((p) => {
      const name = `${p.first_name} ${p.last_name}`;
      const roleStr = this.roleListLabel(p.roles ?? []);
      return {
        id: p.id,
        label: roleStr ? `${name} · ${roleStr}` : name,
        name,
        email: p.email,
        roles: p.roles ?? [],
      };
    }),
  );
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
  }

  onProviderChange(id: number): void {
    this.selectedProviderId.set(id);
    this.error.set(null);
    this.selectedRoleNames.set([...this.currentProviderRoles()]);
  }

  isRoleChecked(name: string): boolean {
    return this.selectedRoleNames().includes(name);
  }

  /**
   * admin_general siempre bloqueado vía el guard compartido: el holder no puede
   * quitarlo y un no-holder no puede recibirlo (misma regla que el provider dialog).
   */
  isRoleLocked(name: string): boolean {
    return isAdminGeneralLocked([...this.currentProviderRoles()], name);
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

  roleDesc(name: string): string {
    const key = `roles.card.desc.${name}`;
    return this.lang.has(key) ? this.lang.t(key) : '';
  }

  /** Etiquetas de roles concatenadas con coma (para el label del selector). */
  roleListLabel(roles: Role[]): string {
    return roles.map((r) => this.roleLabel(r.name)).join(', ');
  }

  private sameRoleSet(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((name) => b.includes(name));
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

    const current = [...this.currentProviderRoles()];
    // Guard compartido: si la invariante de admin_general cambia el set propuesto
    // (removerlo del holder o asignarlo a un no-holder), se aborta con error.
    const enforced = applyAdminGeneralInvariant(current, selected);
    if (!this.sameRoleSet(enforced, selected)) {
      this.error.set(this.lang.t('roles.admin_general_locked'));
      return;
    }

    this.error.set(null);
    this.saving.set(true);
    // Mutación vía store: ReferenceStore PATCHea roles y setea el set canónico
    // (res.data) sobre el provider en `providers` — sin patch manual de lista.
    this.refStore.assignProviderRoles(provider.id, selected).subscribe({
      next: () => {
        this.saving.set(false);
      },
      error: (err) => {
        this.saving.set(false);
        this.httpError.handle(err, this.lang.t('roles.save'));
      },
    });
  }
}
