
import { Injectable } from '@angular/core';
import axios from 'axios';
import { HikePoint } from './hike';

export interface RouteResponse {
  geometry: number[][];
  summary: any
}

export interface RouteSummary {
  distance: number;
  ascent: number;
  descent: number;
}

export interface RouteResult {
  points: HikePoint[];
  summary: RouteSummary;
}

@Injectable({ providedIn: 'root' })
export class RoutingService {
  
  private routingURL = 'api/routing/route';

  async getRoute(points: HikePoint[]): Promise<RouteResponse> {
    const payload = points.map(p => ({
      latitude: p.latitude,
      longitude: p.longitude
    }));

    const response = await axios.post(this.routingURL, {
      "points": payload,
    });

    // Les coordonnées sont en [longitude, latitude]
    return { geometry: response.data.geometry, summary: response.data.summary };
  }
}
