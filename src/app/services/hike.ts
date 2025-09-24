import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type Hike = {
  id: number;
  name: string;
  positiveElevationGain: number;   // dénivelé positif (m)
  negativeElevationGain: number;  // dénivelé négatif (m)
  distance: number; // km
  duration: number; // format "hh:mm"
  points: HikePoint[]
};

export type HikePoint = {
  latitude: number;
  longitude: number;
  elevation: number;
  index: number;
}

@Injectable({
  providedIn: 'root',
})
export class HikeService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'api/hikes'; // 👉 à adapter selon ton backend

  getHikes(): Observable<Hike[]> {
    return this.http.get<Hike[]>(this.apiUrl);
  }

  getHikeById(id: number): Observable<Hike> {
    return this.http.get<Hike>(this.apiUrl + `/${id}`);
  }

  updateHikeById(id: number, data: Hike): Observable<Hike> {
    return this.http.put<Hike>(`${this.apiUrl}/${id}`, data);
  }
 
  deleteHike(id: number): Observable<Hike> {
    return this.http.delete<Hike>(this.apiUrl + `/${id}`);
  }

  createHike(data: Hike): Observable<Hike> {
    return this.http.post<Hike>(this.apiUrl, data)
  }
}