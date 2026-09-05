import { Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { Business } from '@models';
import { UserAvatarComponent } from '@shared/components/user-avatar/user-avatar.component';
import { ImageCropDialogComponent } from '@shared/components/image-crop-dialog/image-crop-dialog.component';
import { BusinessesApiService } from '@services/api/businesses-api.service';
import { LanguageService } from '@services/language.service';

/**
 * Barra de identidad de UN negocio (tenant) concreto — reutilizable.
 *
 * Reutiliza `bw-user-avatar` (shape="square") para el logo/monograma y el
 * diálogo de recorte (`bw-image-crop-dialog`) para subir el logo con crop,
 * igual que el avatar del perfil. El logo se sube a ESE negocio vía
 * /businesses/{id}/logo (no al tenant activo).
 *
 * Emite `logoChanged` para que el caller refresque el estado (auth.me()).
 */
@Component({
  selector: 'bw-business-hero',
  standalone: true,
  imports: [CommonModule, ButtonModule, UserAvatarComponent, ImageCropDialogComponent],
  templateUrl: './business-hero.component.html',
  styleUrl: './business-hero.component.scss',
})
export class BusinessHeroComponent {
  private readonly businessesApi = inject(BusinessesApiService);
  private readonly messageService = inject(MessageService);
  readonly lang = inject(LanguageService);

  /** El negocio a mostrar (NOTA: puede no ser el activo). */
  readonly business = input<Business | null>(null);
  /** Si el usuario puede gestionar este negocio (admin_general o admin_local). */
  readonly canManage = input(false);
  /** Emitido tras subir/quitar el logo con éxito (para refrescar el estado). */
  readonly logoChanged = output<void>();

  readonly logoFile = signal<File | null>(null);
  readonly logoSaving = signal(false);

  /** Monograma para el caso de negocio sin logo. */
  protected monogram(): string {
    return (this.business()?.name ?? 'B').trim().charAt(0).toUpperCase();
  }

  /** Al elegir archivo, abre el diálogo de recorte (mismo flujo que el avatar). */
  onLogoInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (file) this.logoFile.set(file);
  }

  /** Dispara el picker de archivo desde el botón "Cambiar logo". */
  openLogoPicker(): void {
    const input = document.querySelector<HTMLInputElement>('.business-hero__logo-input');
    input?.click();
  }

  /** Recibe el archivo YA recortado y sube el logo de ESE negocio. */
  onLogoCropped(file: File): void {
    const biz = this.business();
    const input = document.querySelector<HTMLInputElement>('.business-hero__logo-input');
    if (input) input.value = '';
    if (!biz) return;

    this.logoSaving.set(true);
    this.businessesApi.uploadLogo(biz.id, file).subscribe({
      next: () => {
        this.logoSaving.set(false);
        this.messageService.add({
          severity: 'success',
          summary: this.lang.t('biz.logo.change'),
          detail: this.lang.t('biz.logo.success'),
          key: 'global',
          life: 4000,
        });
        this.logoChanged.emit();
      },
      error: () => {
        this.logoSaving.set(false);
        this.messageService.add({
          severity: 'error',
          summary: this.lang.t('ui.error'),
          detail: this.lang.t('biz.logo.error'),
          key: 'global',
          life: 4000,
        });
      },
    });
  }

  onRemoveLogo(): void {
    const biz = this.business();
    if (!biz) return;

    this.logoSaving.set(true);
    this.businessesApi.removeLogo(biz.id).subscribe({
      next: () => {
        this.logoSaving.set(false);
        this.messageService.add({
          severity: 'success',
          summary: this.lang.t('biz.logo.remove'),
          detail: this.lang.t('biz.logo.removed'),
          key: 'global',
          life: 4000,
        });
        this.logoChanged.emit();
      },
      error: () => {
        this.logoSaving.set(false);
        this.messageService.add({
          severity: 'error',
          summary: this.lang.t('ui.error'),
          detail: this.lang.t('biz.logo.error'),
          key: 'global',
          life: 4000,
        });
      },
    });
  }
}
