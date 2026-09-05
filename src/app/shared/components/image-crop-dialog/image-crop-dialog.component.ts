import { Component, computed, effect, inject, model, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { LanguageService } from '@services/language.service';

/**
 * Diálogo de recorte circular para el avatar (usuario o logo de negocio).
 *
 * Recibe el archivo elegido, muestra un preview con recorte redondo (1:1) y
 * emite el archivo recortado listo para subir. Reutilizable: el caller decide
 * a qué endpoint sube el resultado.
 */
@Component({
  selector: 'bw-image-crop-dialog',
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule, ImageCropperComponent],
  templateUrl: './image-crop-dialog.component.html',
  styleUrl: './image-crop-dialog.component.scss',
})
export class ImageCropDialogComponent {
  private readonly lang = inject(LanguageService);

  /** Archivo original elegido por el usuario (null = diálogo cerrado). */
  readonly file = model<File | null>(null);
  /** Título del diálogo (avatar de usuario vs logo de negocio). */
  readonly titleKey = model('profile.avatar.crop_title');
  /** Evento al confirmar: el archivo ya recortado (PNG/JPEG) listo para subir. */
  readonly cropped = output<File>();

  /** Imagen en base64 para el cropper (se setea al abrir con el archivo). */
  protected readonly cropperImage = signal<string | null>(null);
  protected readonly croppedBlob = signal<Blob | null>(null);
  protected readonly loadFailed = signal(false);
  protected readonly saving = signal(false);

  protected readonly visible = computed(() => this.file() !== null);
  protected readonly canConfirm = computed(() => this.croppedBlob() !== null && !this.saving());

  constructor() {
    // Reaccionamos al VALOR del model (lo escribe el padre al abrir con un
    // archivo, o el hijo al cerrar). `subscribe()` de un `model()` solo se
    // dispara cuando el HIJO escribe (emitter de salida); si el padre setea el
    // input, el valor cambia pero el emitter no emite. Un `effect()` observa el
    // valor real en ambos sentidos.
    effect(() => {
      const file = this.file();
      if (!file) {
        this.cropperImage.set(null);
        this.croppedBlob.set(null);
        this.loadFailed.set(false);
        return;
      }
      this.loadFailed.set(false);
      const reader = new FileReader();
      reader.onload = () => this.cropperImage.set(reader.result as string);
      reader.onerror = () => this.loadFailed.set(true);
      reader.readAsDataURL(file);
    });
  }

  /** El cropper emite el resultado cada vez que cambia el encuadre. */
  protected onImageCropped(event: ImageCroppedEvent): void {
    this.croppedBlob.set(event.blob ?? null);
  }

  protected onLoadFailed(): void {
    this.loadFailed.set(true);
  }

  /** Confirma: convierte el blob recortado a File y lo emite. */
  protected confirm(): void {
    const blob = this.croppedBlob();
    const original = this.file();
    if (!blob || !original) return;

    const name = original.name.replace(/\.[^.]+$/, '') || 'image';
    const type = blob.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const ext = type === 'image/png' ? 'png' : 'jpg';
    this.cropped.emit(new File([blob], `${name}-crop.${ext}`, { type }));
    this.close();
  }

  protected close(): void {
    this.file.set(null);
  }

  protected t(key: string): string {
    return this.lang.t(key);
  }
}
