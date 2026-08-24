import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  Sale,
  SaleDetailResponse,
  CreateSaleRequest,
  UpdateSaleRequest,
  CreateTransactionRequest,
  CreateTransactionResponse,
  TransactionListResponse,
  DeleteTransactionResponse,
  DeleteSaleResponse,
  SendReceiptRequest,
  SendReceiptResponse,
  PaginatedResponse,
} from '@models';
import { buildHttpParams } from './build-http-params';

@Injectable({ providedIn: 'root' })
export class SalesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getSales(params?: {
    client_id?: number;
    booking_id?: number;
    client_pack_id?: number;
    payment_status?: 'paid' | 'partial' | 'unpaid';
    payment_method?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    per_page?: number;
  }): Observable<PaginatedResponse<Sale>> {
    return this.http.get<PaginatedResponse<Sale>>(`${this.baseUrl}/sales`, {
      params: params ? buildHttpParams(params) : undefined,
    });
  }

  getSale(id: number): Observable<SaleDetailResponse> {
    return this.http.get<SaleDetailResponse>(`${this.baseUrl}/sales/${id}`);
  }

  createSale(body: CreateSaleRequest): Observable<SaleDetailResponse> {
    return this.http.post<SaleDetailResponse>(`${this.baseUrl}/sales`, body);
  }

  updateSale(id: number, body: UpdateSaleRequest): Observable<SaleDetailResponse> {
    return this.http.patch<SaleDetailResponse>(`${this.baseUrl}/sales/${id}`, body);
  }

  getTransactions(saleId: number): Observable<TransactionListResponse> {
    return this.http.get<TransactionListResponse>(`${this.baseUrl}/sales/${saleId}/transactions`);
  }

  createTransaction(
    saleId: number,
    body: CreateTransactionRequest,
  ): Observable<CreateTransactionResponse> {
    return this.http.post<CreateTransactionResponse>(
      `${this.baseUrl}/sales/${saleId}/transactions`,
      body,
    );
  }

  deleteTransaction(saleId: number, transactionId: number): Observable<DeleteTransactionResponse> {
    return this.http.delete<DeleteTransactionResponse>(
      `${this.baseUrl}/sales/${saleId}/transactions/${transactionId}`,
    );
  }

  sendReceipt(saleId: number, body: SendReceiptRequest): Observable<SendReceiptResponse> {
    return this.http.post<SendReceiptResponse>(
      `${this.baseUrl}/sales/${saleId}/receipt/send`,
      body,
    );
  }

  deleteSale(saleId: number): Observable<DeleteSaleResponse> {
    return this.http.delete<DeleteSaleResponse>(
      `${this.baseUrl}/sales/${saleId}`,
    );
  }
}
