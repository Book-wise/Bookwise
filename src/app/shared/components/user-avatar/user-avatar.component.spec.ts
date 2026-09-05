import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { UserAvatarComponent } from './user-avatar.component';

describe('UserAvatarComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<UserAvatarComponent>>;
  let component: UserAvatarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserAvatarComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(UserAvatarComponent);
    component = fixture.componentInstance;
  });

  describe('initials computed', () => {
    it('returns uppercase initials from the first and last word', () => {
      fixture.componentRef.setInput('name', 'Beatriz González');
      expect(component.initials()).toBe('BG');
    });

    it('returns a single initial for a one-word name', () => {
      fixture.componentRef.setInput('name', 'Sebastian');
      expect(component.initials()).toBe('S');
    });

    it('returns "?" for an empty name', () => {
      fixture.componentRef.setInput('name', '');
      expect(component.initials()).toBe('?');
    });

    it('returns "?" for null/undefined name', () => {
      fixture.componentRef.setInput('name', null);
      expect(component.initials()).toBe('?');

      fixture.componentRef.setInput('name', undefined);
      expect(component.initials()).toBe('?');
    });

    it('trims whitespace before computing initials', () => {
      fixture.componentRef.setInput('name', '  Ana  María  ');
      expect(component.initials()).toBe('AM');
    });
  });

  describe('rendering', () => {
    it('defaults to the md size', () => {
      fixture.detectChanges();
      const el = fixture.debugElement.query(By.css('.bw-user-avatar'));
      expect(el.classes['bw-user-avatar--md']).toBe(true);
      expect(el.classes['bw-user-avatar--sm']).toBeFalsy();
      expect(el.classes['bw-user-avatar--lg']).toBeFalsy();
    });

    it('applies the size class and renders the initials', () => {
      fixture.componentRef.setInput('name', 'Juan Pérez');
      fixture.componentRef.setInput('size', 'lg');
      fixture.detectChanges();

      const el = fixture.debugElement.query(By.css('.bw-user-avatar'));
      expect(el.classes['bw-user-avatar--lg']).toBe(true);
      expect(el.nativeElement.textContent.trim()).toBe('JP');
    });

    it('renders an image when a URL is provided', () => {
      fixture.componentRef.setInput('name', 'Juan Pérez');
      fixture.componentRef.setInput('image', 'https://cdn.example.com/avatar.webp');
      fixture.detectChanges();

      const img = fixture.debugElement.query(By.css('.bw-user-avatar__img'));
      expect(img).toBeTruthy();
      expect(img.nativeElement.getAttribute('src')).toBe('https://cdn.example.com/avatar.webp');
      // The initials are not rendered when an image is shown.
      expect(fixture.debugElement.query(By.css('.bw-user-avatar')).nativeElement.textContent.trim()).toBe('');
    });

    it('falls back to initials when image URL is empty', () => {
      fixture.componentRef.setInput('name', 'Juan Pérez');
      fixture.componentRef.setInput('image', '');
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('.bw-user-avatar__img'))).toBeFalsy();
      expect(fixture.debugElement.query(By.css('.bw-user-avatar')).nativeElement.textContent.trim()).toBe('JP');
    });

    it('resolves a relative /storage path against the configured API base', () => {
      fixture.componentRef.setInput('name', 'Juan Pérez');
      fixture.componentRef.setInput('image', '/storage/user-avatars/x.webp');
      fixture.detectChanges();

      const img = fixture.debugElement.query(By.css('.bw-user-avatar__img'));
      expect(img).toBeTruthy();
      expect(img.nativeElement.getAttribute('src')).toMatch(/^http:\/\/127\.0\.0\.1:9999\/storage\/user-avatars\/x\.webp$/);
    });

    it('applies the square shape for business logos', () => {
      fixture.componentRef.setInput('name', 'Nimbus Corp');
      fixture.componentRef.setInput('shape', 'square');
      fixture.detectChanges();

      const el = fixture.debugElement.query(By.css('.bw-user-avatar'));
      expect(el.classes['bw-user-avatar--square']).toBe(true);
      // Monograma de una letra para el logo de negocio.
      expect(el.nativeElement.textContent.trim()).toBe('N');
    });

    it('keeps circle shape by default', () => {
      fixture.componentRef.setInput('name', 'Nimbus Corp');
      fixture.detectChanges();

      const el = fixture.debugElement.query(By.css('.bw-user-avatar'));
      expect(el.classes['bw-user-avatar--square']).toBeFalsy();
    });
  });
});
