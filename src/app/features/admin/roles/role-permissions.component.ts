import { Component, OnInit, computed, inject, linkedSignal, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { HttpErrorService } from '@services/http-error.service';
import { LanguageService } from '@services/language.service';
import { PermissionItem, Role } from '@models';
import { roleMeta } from './role-meta';
import { RolesStore } from './roles.store';

/**
 * "Permisos" tab: master-detail matrix. The role list on the left comes from
 * `RolesStore`; the grouped permission catalog on the right is rendered
 * dynamically (never hardcoded). Editing is not optimistic: the draft is local
 * until save, and the store patches the role from the server response.
 *
 * The matrix and its save control are gated on a non-empty catalog. When the
 * catalog errors or returns zero groups, an error/empty state with retry is
 * shown instead.
 */
@Component({
  selector: 'bw-role-permissions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CheckboxModule,
    ButtonModule,
    MessageModule,
    ConfirmDialogModule,
  ],
  providers: [ConfirmationService],
  templateUrl: './role-permissions.component.html',
  styleUrls: ['./role-permissions.component.scss'],
})
export class RolePermissionsComponent implements OnInit {
  private readonly store = inject(RolesStore);
  private readonly httpError = inject(HttpErrorService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  readonly lang = inject(LanguageService);

  /** Resolves a role's color/icon (gray + pi-user fallback). */
  protected readonly roleMeta = roleMeta;

  readonly roles = computed(() => this.store.roles());
  readonly catalog = computed(() => this.store.catalog());
  readonly catalogLoading = computed(() => this.store.catalogLoading());
  readonly catalogError = computed(() => this.store.catalogError());
  /** The matrix only renders with at least one group in the catalog. */
  readonly catalogReady = computed(() => this.catalog().length > 0);

  private readonly selectedRoleSlug = signal<string | null>(null);
  readonly saving = signal(false);

  /** Active role: the explicit selection, or the first role as a default. */
  readonly selectedRole = computed<Role | null>(() => {
    const roles = this.roles();
    const slug = this.selectedRoleSlug();
    return roles.find((r) => r.slug === slug) ?? roles[0] ?? null;
  });

  /**
   * Draft keys for the active role. Re-derived whenever the active role (or its
   * server permissions) changes; edited locally by toggles and never sent until
   * save. Dedupe happens before the request.
   */
  readonly draft = linkedSignal<Role | null, string[]>({
    source: this.selectedRole,
    computation: (role) => (role ? [...role.permissions] : []),
  });

  ngOnInit(): void {
    this.store.loadCatalog();
  }

  selectRole(role: Role): void {
    this.selectedRoleSlug.set(role.slug);
  }

  isSelected(key: string): boolean {
    return this.draft().includes(key);
  }

  togglePermission(key: string, checked: boolean): void {
    this.draft.update((keys) => {
      const next = new Set(keys);
      if (checked) next.add(key);
      else next.delete(key);
      return [...next];
    });
  }

  /** i18n key by permission key; falls back to the backend label, then the raw key. */
  permissionLabel(item: PermissionItem): string {
    const key = `roles.permission.${item.key}`;
    if (this.lang.has(key)) return this.lang.t(key);
    return item.label || item.key;
  }

  /** Resolves the role label: i18n key by slug, falling back to the backend `name`. */
  roleLabel(role: Pick<Role, 'slug' | 'name'>): string {
    const key = `roles.role.${role.slug}`;
    return this.lang.has(key) ? this.lang.t(key) : role.name;
  }

  /** i18n key by group slug; falls back to the raw group slug. */
  permissionGroupLabel(group: string): string {
    const key = `roles.permission_group.${group}`;
    return this.lang.has(key) ? this.lang.t(key) : group;
  }

  retryCatalog(): void {
    this.store.loadCatalog();
  }

  save(): void {
    const role = this.selectedRole();
    if (!role) return;

    const keys = [...new Set(this.draft())];
    if (keys.length === 0) {
      this.confirmClear(role, keys);
      return;
    }
    this.persist(role, keys);
  }

  private confirmClear(role: Role, keys: string[]): void {
    this.confirmation.confirm({
      header: this.lang.t('roles.permissions.empty_confirm_header'),
      message: this.lang.t('roles.permissions.empty_confirm_message'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.lang.t('roles.permissions.empty_confirm_accept'),
      rejectLabel: this.lang.t('common.cancel'),
      accept: () => this.persist(role, keys),
    });
  }

  private persist(role: Role, keys: string[]): void {
    this.saving.set(true);
    this.store.updateRolePermissions(role.id, keys).subscribe({
      next: () => {
        this.saving.set(false);
        this.messageService.add({
          severity: 'success',
          summary: this.lang.t('roles.permissions.saved'),
          detail: this.lang.t('roles.permissions.saved_detail'),
          life: 4000,
        });
      },
      error: (err) => {
        this.saving.set(false);
        // No optimistic state was applied: revert the draft to the unchanged
        // store role, refetch the list, then surface the actionable error.
        this.draft.set([...role.permissions]);
        this.store.loadRoles();
        this.httpError.handle(err, this.lang.t('roles.permissions.title'));
      },
    });
  }
}
