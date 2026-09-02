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
  });
});
