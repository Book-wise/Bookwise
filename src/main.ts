import { bootstrapApplication } from '@angular/platform-browser';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import localeEsCl from '@angular/common/locales/es-CL';
import { appConfig } from './app/app.config';
import { App } from './app/app';

registerLocaleData(localeEs);
registerLocaleData(localeEsCl);

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
