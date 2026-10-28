import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { PatientCardComponent } from '@shared/components/patient-card';
import { PatientDetailContentComponent } from '@shared/components/patient-card/patient-detail-content.component';
import { ClientDetailStore, PatientTab } from '@core/stores/client-detail.store';
import { LanguageService } from '@services/language.service';
import { AuthService } from '@services/auth.service';
import { ABILITIES } from '@shared/config/abilities.config';
import { Client } from '@models';

/**
 * Detalle de cliente de "Base de Pacientes". Reusa `bw-patient-card` (identidad,
 * notificaciones, tabs) y `bw-patient-detail-content` (contenido de cada tab),
 * con el mismo patrón keep-alive que el detalle de reserva: `activeView` decide
 * qué se muestra. Al abrir inicializa el `ClientDetailStore` con el cliente; al
 * cerrar lo resetea para que no se filtre a otra apertura.
 */
@Component({
  selector: 'bw-client-detail-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    DialogModule,
    ButtonModule,
    PatientCardComponent,
    PatientDetailContentComponent,
  ],
  templateUrl: './client-detail-dialog.component.html',
  styleUrl: './client-detail-dialog.component.scss',
})
export class ClientDetailDialogComponent {
  readonly detailStore = inject(ClientDetailStore);
  readonly lang = inject(LanguageService);
  private readonly auth = inject(AuthService);

  /** Editar requiere `clients.update` (gated también en el template). */
  readonly canEdit = computed(() => this.auth.hasPermission(ABILITIES.clientsUpdate));

  readonly visible = input<boolean>(false);
  readonly client = input<Client | null>(null);
  /** Tab con el que abre (p. ej. 'planes' desde "Ver Packs"). */
  readonly initialTab = input<PatientTab | null>(null);

  readonly closed = output<void>();
  readonly editRequested = output<Client>();

  /** Tab narrow válido (solo se usa cuando `activeView !== 'reserva'`). */
  readonly activeDetailTab = computed<PatientTab>(() => {
    const view = this.detailStore.activeView();
    return view === 'reserva' ? 'planes' : view;
  });

  constructor() {
    effect(() => {
      const isVisible = this.visible();
      const c = this.client();
      if (!isVisible || !c) return;
      this.detailStore.initialize(c);
      this.detailStore.loadPacks(c.id);
      this.detailStore.loadSales(c.id);
      this.detailStore.loadRecent(c.id);
      const tab = this.initialTab();
      if (tab) this.detailStore.selectTab(tab);
    });
  }

  onPatientTabSelected(tab: PatientTab): void {
    this.detailStore.selectTab(tab);
  }

  returnToReservation(): void {
    this.detailStore.returnToReservation();
  }

  onEdit(): void {
    const c = this.client();
    if (c) this.editRequested.emit(c);
  }

  close(): void {
    this.closed.emit();
  }

  /** `(onHide)` del p-dialog: limpia el estado del store al cerrar. */
  onDialogHide(): void {
    this.detailStore.reset();
  }
}
