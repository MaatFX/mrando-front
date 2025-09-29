import { Injectable } from '@angular/core';
import axios from 'axios';
import { HikePoint } from './hike';

export interface RefugeInfoResponse {
  features: any[];
}

export interface RefugeInfoRefuge {
  name: string
  link: string
}

export interface RefugeInfoPtEau {
  name: string
  link: string
}

@Injectable({
  providedIn: 'root'
})
export class RefugesInfoService {
  
  apiUrl = 'api/refuges'

  async getDataFromBbox(minLng: number, minLat: number, maxLng: number, maxLat: number): Promise<RefugeInfoResponse> {
    
    const url = `${this.apiUrl}?minLongitude=${minLng}&minLatitude=${minLat}&maxLongitude=${maxLng}&maxLatitude=${maxLat}`;

    const response = await axios.get(url);

    return response.data;
  }

  projectPointOnSegment(
    p: [number, number],
    a: [number, number],
    b: [number, number]
  ): [number, number] {
    const [px, py] = p;
    const [ax, ay] = a;
    const [bx, by] = b;

    // vecteur AB et AP
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;

    // norme au carré de AB
    const ab2 = abx * abx + aby * aby;
    if (ab2 === 0) {
      // A et B confondus -> segment de longueur 0, retourner A
      return [ax, ay];
    }

    // paramètre t (position de la projection sur la droite AB)
    let t = (apx * abx + apy * aby) / ab2;

    // clamp t dans [0, 1] pour rester dans le segment
    if (t < 0) t = 0;
    if (t > 1) t = 1;

    // coordonnées de la projection Q
    const qx = ax + t * abx;
    const qy = ay + t * aby;

    return [qx, qy];
  } 

  createBbox(points: HikePoint[]) {
    let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity;

    for (const p of points) {
      minLat = Math.min(minLat, p.latitude);
      minLng = Math.min(minLng, p.longitude);
      maxLat = Math.max(maxLat, p.latitude);
      maxLng = Math.max(maxLng, p.longitude);
    }
    return { min: [minLat, minLng], max: [maxLat, maxLng] };
  }
}
