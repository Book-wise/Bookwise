import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { BlockedSlot, BlockConflictResponse } from '@models';
import { buildHttpParams } from './build-http-params';

@Injectable({ providedIn: 'root' })
export class BlockedSlotsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getBlockedSlots(params: {
    date_from: string;
    date_to: string;
    location_id?: number;
    provider_id?: number;
  }): Observable<{ data: BlockedSlot[] }> {
    return this.http.get<{ data: BlockedSlot[] }>(`${this.baseUrl}/blocked-slots`, {
      params: buildHttpParams(params),
    });
  }

  createBlockedSlot(body: {
    start_time: string;
    end_time: string;
    reason?: string;
    scope?: 'all';
    provider_id?: number | null;
    location_id?: number | null;
    repeat?: {
      type: string;
      interval: number;
      days?: number[];
      end_type: string;
      count?: number;
      until?: string;
    };
  }): Observable<Partial<BlockConflictResponse>> {
    return this.http.post<Partial<BlockConflictResponse>>(`${this.baseUrl}/blocked-slots`, body);
  }

  updateBlockedSlot(
    id: number,
    body: {
      start_time: string;
      end_time: string;
      reason?: string;
      provider_id?: number | null;
      location_id?: number | null;
    },
  ): Observable<BlockedSlot> {
    return this.http.patch<BlockedSlot>(`${this.baseUrl}/blocked-slots/${id}`, body);
  }

  deleteBlockedSlot(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/blocked-slots/${id}`);
  }

  deleteBlockedSlotGroup(groupId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/blocked-slots/group/${groupId}`);
  }
}
