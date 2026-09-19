import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { HttpErrorService } from '@services/http-error.service';
import { LanguageService } from '@services/language.service';
import { ReferenceStore } from '@core/stores/reference.store';
import { Role } from '@models';
import { roleMeta } from './role-meta';
import { applyAdminGeneralInvariant, isAdminGeneralLocked } from './role-guards';
import { RolesStore } from './roles.store';

/**
 * Searchable provider option: carries a concatenated `label` (name + roles) so
 * the `p-select` text filter matches both, plus the raw fields for the custom
 * template.
 */
interface ProviderOption {
  id: number;
  label: string;
  name: string;
  email: string;
  roles: Role[];
}

/**
 * "Asignación" tab: assign business roles to a provider. Role identity is the
 * `slug`; `name` is display-only. The role list comes from `RolesStore`; the
 * provider list is read from `ReferenceStore` (canonical source — the store
 * patches providers from the server response after a successful assignment).
 */
@Component({
  selector: 'bw-roles-assignment',
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
  templateUrl: './roles-assignment.component.html',
  styleUrls: ['./roles-assignment.component.scss'],
})
export class RolesAssignmentComponent {
  private readonly httpError = inject(HttpErrorService);
  private readonly refStore = inject(ReferenceStore);
  private readonly store = inject(RolesStore);
  readonly lang = inject(LanguageService);

  /** Resolves a role's color/icon (gray + pi-user fallback). */
  protected readonly roleMeta = roleMeta;

  readonly roles = computed(() => this.store.roles());
  readonly loading = computed(() => this.store.rolesLoading());

  /**
   * Providers from `ReferenceStore`: the store patches `providers` with the
   * canonical server response after assigning roles, so this screen keeps no
   * local list and does not reload after saving.
   */
  readonly providers = computed(() => this.refStore.providers());

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

  saving = signal(false);
  error = signal<string | null>(null);
  selectedProviderId = signal<number | null>(null);
  selectedRoleSlugs = signal<string[]>([]);

  readonly selectedProvider = computed(() => {
    const id = this.selectedProviderId();
    return this.providers().find((p) => p.id === id) ?? null;
  });

  /** Slugs the selected provider currently holds (from GET /providers). */
  readonly currentProviderSlugs = computed<Set<string>>(() => {
    const provider = this.selectedProvider();
    return new Set((provider?.roles ?? []).map((r) => r.slug));
  });

  onProviderChange(id: number): void {
    this.selectedProviderId.set(id);
    this.error.set(null);
    this.selectedRoleSlugs.set([...this.currentProviderSlugs()]);
  }

  isRoleChecked(slug: string): boolean {
    return this.selectedRoleSlugs().includes(slug);
  }

  /**
   * `admin_general` is always locked through the shared guard: the holder cannot
   * remove it and a non-holder cannot receive it.
   */
  isRoleLocked(slug: string): boolean {
    return isAdminGeneralLocked([...this.currentProviderSlugs()], slug);
  }

  onRoleChange(checked: boolean, slug: string): void {
    if (this.isRoleLocked(slug)) return;
    this.selectedRoleSlugs.update((list) => {
      const next = new Set(list);
      if (checked) next.add(slug);
      else next.delete(slug);
      return [...next];
    });
    this.error.set(null);
  }

  /** Resolves the display label: i18n key by slug, falling back to the backend `name`. */
  roleLabel(role: Pick<Role, 'slug' | 'name'>): string {
    const key = `roles.role.${role.slug}`;
    return this.lang.has(key) ? this.lang.t(key) : role.name;
  }

  /** Resolves the card description by slug; empty when no i18n key exists. */
  roleDesc(role: Pick<Role, 'slug'>): string {
    const key = `roles.card.desc.${role.slug}`;
    return this.lang.has(key) ? this.lang.t(key) : '';
  }

  /** Role labels joined by comma (used for the selector label). */
  roleListLabel(roles: Role[]): string {
    return roles.map((r) => this.roleLabel(r)).join(', ');
  }

  private sameRoleSet(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((slug) => b.includes(slug));
  }

  save(): void {
    const provider = this.selectedProvider();
    if (!provider) {
      this.error.set(this.lang.t('roles.provider_required'));
      return;
    }

    // Duplicate slugs are never sent, even if a caller seeded the selection.
    const selected = [...new Set(this.selectedRoleSlugs())];
    if (selected.length === 0) {
      this.error.set(this.lang.t('roles.empty_error'));
      return;
    }

    const valid = new Set(this.roles().map((r) => r.slug));
    if (selected.some((slug) => !valid.has(slug))) {
      this.error.set(this.lang.t('roles.empty_error'));
      return;
    }

    const current = [...this.currentProviderSlugs()];
    // Shared invariant: abort when the proposed set would remove admin_general
    // from its holder or assign it to a non-holder.
    const enforced = applyAdminGeneralInvariant(current, selected);
    if (!this.sameRoleSet(enforced, selected)) {
      this.error.set(this.lang.t('roles.admin_general_locked'));
      return;
    }

    this.error.set(null);
    this.saving.set(true);
    this.refStore.assignProviderRoles(provider.id, selected).subscribe({
      next: () => {
        this.saving.set(false);
      },
      error: (err) => {
        this.saving.set(false);
        // The API rejected the set (422 duplicate/display name, 404): revert the
        // local selection to the current server state and refetch providers.
        this.selectedRoleSlugs.set([...this.currentProviderSlugs()]);
        this.refStore.invalidateProviders();
        this.httpError.handle(err, this.lang.t('roles.save'));
      },
    });
  }
}
