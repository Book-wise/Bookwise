import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { SelectModule } from 'primeng/select';
import { RadioButtonModule } from 'primeng/radiobutton';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { HttpErrorService } from '@services/http-error.service';
import { LanguageService } from '@services/language.service';
import { ReferenceStore } from '@core/stores/reference.store';
import { Role } from '@models';
import { roleMeta } from './role-meta';
import { RoleBadgeComponent } from './role-badge.component';
import {
  applyAdminGeneralSingleInvariant,
  isSingleSelectRoleLocked,
} from './role-guards';
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
 * "Asignación" tab: assign a business role to a provider. A professional holds
 * exactly ONE role, so the picker is a radio group (not a checkbox list). Role
 * identity is the `slug`; `name` is display-only. The role list comes from
 * `RolesStore`; the provider list is read from `ReferenceStore` (canonical
 * source — the store patches providers from the server response after a
 * successful assignment).
 */
@Component({
  selector: 'bw-roles-assignment',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    SelectModule,
    RadioButtonModule,
    ButtonModule,
    MessageModule,
    RoleBadgeComponent,
  ],
  templateUrl: './roles-assignment.component.html',
  styleUrls: ['./roles-assignment.component.scss'],
})
export class RolesAssignmentComponent {
  private readonly httpError = inject(HttpErrorService);
  private readonly refStore = inject(ReferenceStore);
  private readonly store = inject(RolesStore);
  readonly lang = inject(LanguageService);

  /** Resolves a role's metadata (color here; the badge component owns the icon). */
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
  /** The single role the selected provider will end up with (null = none yet). */
  selectedRoleSlug = signal<string | null>(null);

  readonly selectedProvider = computed(() => {
    const id = this.selectedProviderId();
    return this.providers().find((p) => p.id === id) ?? null;
  });

  /** Slugs the selected provider currently holds (from GET /providers). */
  readonly currentProviderSlugs = computed<string[]>(() => {
    const provider = this.selectedProvider();
    return (provider?.roles ?? []).map((r) => r.slug);
  });

  onProviderChange(id: number): void {
    this.selectedProviderId.set(id);
    this.error.set(null);
    // Seed the radio group from the current role, letting the shared guard
    // resolve the admin_general holder (locked to it) vs. everyone else.
    const current = this.currentProviderSlugs();
    this.selectedRoleSlug.set(applyAdminGeneralSingleInvariant(current, current[0] ?? null));
  }

  isRoleSelected(slug: string): boolean {
    return this.selectedRoleSlug() === slug;
  }

  /**
   * Single-select lock through the shared guard: a holder of `admin_general` is
   * locked to it (every other radio disabled) and a non-holder cannot select it.
   */
  isRoleLocked(slug: string): boolean {
    return isSingleSelectRoleLocked(this.currentProviderSlugs(), slug);
  }

  onRoleChange(slug: string): void {
    if (this.isRoleLocked(slug)) return;
    this.selectedRoleSlug.set(slug);
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

  save(): void {
    const provider = this.selectedProvider();
    if (!provider) {
      this.error.set(this.lang.t('roles.provider_required'));
      return;
    }

    const selected = this.selectedRoleSlug();
    if (!selected) {
      this.error.set(this.lang.t('roles.empty_error'));
      return;
    }

    const valid = new Set(this.roles().map((r) => r.slug));
    if (!valid.has(selected)) {
      this.error.set(this.lang.t('roles.empty_error'));
      return;
    }

    const current = this.currentProviderSlugs();
    // Shared invariant: abort when the selection would move the admin_general
    // holder away or assign admin_general to a non-holder.
    const enforced = applyAdminGeneralSingleInvariant(current, selected);
    if (enforced !== selected) {
      this.error.set(this.lang.t('roles.admin_general_locked'));
      return;
    }

    this.error.set(null);
    this.saving.set(true);
    // PATCH /providers/{id}/roles takes an array; a single role travels as a
    // one-element array.
    this.refStore.assignProviderRoles(provider.id, [selected]).subscribe({
      next: () => {
        this.saving.set(false);
      },
      error: (err) => {
        this.saving.set(false);
        // The API rejected the role (422/404): revert the local selection to the
        // current server state and refetch providers.
        const currentSlugs = this.currentProviderSlugs();
        this.selectedRoleSlug.set(
          applyAdminGeneralSingleInvariant(currentSlugs, currentSlugs[0] ?? null),
        );
        this.refStore.invalidateProviders();
        this.httpError.handle(err, this.lang.t('roles.save'));
      },
    });
  }
}
