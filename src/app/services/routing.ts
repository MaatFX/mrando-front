
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
  private apiKey = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjYyNTY0MTQxMWRjNzRjODU4NmUwOGEwYWMzYzQxOWM2IiwiaCI6Im11cm11cjY0In0='; // remplace par ta clé ORS
  
  private direction_api_url = 'https://api.openrouteservice.org/v2/directions/foot-hiking';

  async getRoute(points: HikePoint[]): Promise<RouteResponse> {
    const response = await axios.post(this.direction_api_url, {
      "coordinates": points.map((hikepoint) => [hikepoint.longitude, hikepoint.latitude]),
      "elevation": true
    },
      {
        headers: {
          Authorization: "Bearer " + this.apiKey
        }
      }
    );

    // Les coordonnées sont en [longitude, latitude]
    return { geometry: this.decodePolyline(response.data.routes[0].geometry, true), summary: response.data.routes[0].summary };
  }

  decodePolyline(encodedPolyline: any, includeElevation: boolean) {
    // array that holds the points
    let points = []
    let index = 0
    const len = encodedPolyline.length
    let lat = 0
    let lng = 0
    let ele = 0
    while (index < len) {
      let b
      let shift = 0
      let result = 0
      do {
        b = encodedPolyline.charAt(index++).charCodeAt(0) - 63 // finds ascii
        // and subtract it by 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20)

      lat += ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1))
      shift = 0
      result = 0
      do {
        b = encodedPolyline.charAt(index++).charCodeAt(0) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20)
      lng += ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1))

      if (includeElevation) {
        shift = 0
        result = 0
        do {
          b = encodedPolyline.charAt(index++).charCodeAt(0) - 63
          result |= (b & 0x1f) << shift
          shift += 5
        } while (b >= 0x20)
        ele += ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1))
      }
      try {
        let location = [(lat / 1E5), (lng / 1E5)]
        if (includeElevation) location.push((ele / 100))
        points.push(location)
      } catch (e) {
        console.log(e)
      }
    }
    return points
  }
}
