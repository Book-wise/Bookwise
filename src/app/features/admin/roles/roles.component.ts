import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabsModule } from 'primeng/tabs';
import { LanguageService } from '@services/language.service';
import { RolesStore } from './roles.store';
import { RolesAssignmentComponent } from './roles-assignment.component';
import { RolePermissionsComponent } from './role-permissions.component';

/**
 * `/admin/roles` shell. Owns the `p-tabs` layout and the feature-scoped
 * `RolesStore`, and triggers the single `GET /v1/roles` load. The two panes are
 * dumb consumers of the store: "Asignación" (provider → roles) and "Permisos"
 * (role → permissions matrix).
 */
@Component({
  selector: 'bw-roles',
  standalone: true,
  imports: [CommonModule, TabsModule, RolesAssignmentComponent, RolePermissionsComponent],
  providers: [RolesStore],
  templateUrl: './roles.component.html',
  styleUrls: ['./roles.component.scss'],
})
export class RolesComponent implements OnInit {
  private readonly store = inject(RolesStore);
  readonly lang = inject(LanguageService);

  readonly activeTab = signal<string>('assignment');

  ngOnInit(): void {
    this.store.loadRoles();
  }

  onTabChange(value: string | number | undefined): void {
    if (value === undefined) return;
    this.activeTab.set(String(value));
  }
}
