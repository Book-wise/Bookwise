import { Injectable, inject } from '@angular/core';
import { ApiService } from '@services/api.service';
import type { Client } from '@models';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { matchSimilarClients } from '@shared/utils/client-similarity.util';

@Injectable({ providedIn: 'root' })
export class SimilarPatientsService {
  private api = inject(ApiService);

  /** Fetch clients by search term and return those similar to the provided newClient model. */
  precheck(term: string, newClient: { email?: string; phone?: string } & Partial<{ first_name: string; last_name: string }>): Observable<Client[]> {
    return this.api.getClients({ search: term }).pipe(
      map((list) => matchSimilarClients(list, {
        first_name: newClient.first_name ?? '',
        last_name: newClient.last_name ?? '',
        email: newClient.email ?? '',
        phone: newClient.phone ?? '',
      })),
    );
  }
}
