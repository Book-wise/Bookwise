import { HttpParams } from '@angular/common/http';

export function buildHttpParams(obj: Record<string, any>): HttpParams {
  let params = new HttpParams();
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params = params.set(key, String(value));
    }
  });
  return params;
}
