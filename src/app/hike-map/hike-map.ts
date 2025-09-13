import { Component, AfterViewInit, OnDestroy, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { RoutingService, RouteResult, RouteSummary } from '../services/routing';
import { HikePoint } from '../services/hike';

@Component({
  selector: 'app-hike-map',
  standalone: true,
  template: `<div id="hike-map" class="map-container">
     <!-- Menu contextuel -->
      @if (contextMenuVisible()) {
      <div
         [style.left.px]="contextMenuX()" 
         [style.top.px]="contextMenuY()" 
         class="context-menu">
      <button (click)="onDeleteButtonClick(contextMenuMarkerId())">Supprimer</button>
      <button (click)="onAddButtonClick(contextMenuMarkerCoordinates())">Ajouter</button>
    </div>
      }
    
  </div>
  <h1>{{ (distance / 1000) | number:'1.2-2'}} km</h1>
  <h1>{{positiveElevationGain}} m positif</h1>
  <h1>{{negativeElevationGain}} m négatif</h1>`,
  styles: [`
  .map-container {
     width: 100%; height: 800px;
      }
  .context-menu {
      position: fixed;
      background: white;
      border: 1px solid #ccc;
      z-index: 1000;
      padding: 4px;
      border-radius: 4px;
    }
    .context-menu button { cursor: pointer; }
  `],
  imports: [CommonModule]
})
export class HikeMapComponent implements AfterViewInit, OnDestroy {

  contextMenuVisible = signal(false)
  contextMenuX = signal(0)
  contextMenuY = signal(0)
  contextMenuMarkerId = signal<number | null>(null);
  contextMenuMarkerCoordinates = signal<[number, number] | null>(null);

  private map!: L.Map;
  polyline?: L.Polyline;
  private leafletMarkers: L.Marker[] = [];

  points: HikePoint[] = [
    {latitude: 45.621093, longitude: 6.052332, elevation: 0},
    {latitude: 45.694522, longitude: 6.252326, elevation: 0},
    {latitude: 45.755622, longitude: 6.252326, elevation: 0}
  ]

  positiveElevationGain = 0;
  negativeElevationGain = 0;
  distance = 0;
  
  constructor(private routing: RoutingService) {}

  ngAfterViewInit(): void {
    this.initMap();
    if (this.points.length > 0) {
          
            this.getRoute(this.points).then((result) => {
              this.distance = result.summary.distance;
              this.positiveElevationGain = result.summary.ascent;
              this.negativeElevationGain = result.summary.descent;
              this.drawRoute(result.points, true);
              this.refreshMarkers();
            })
          
    }
  }

  ngOnDestroy(): void { this.map?.remove(); }

  private initMap() {
    this.map = L.map('hike-map', { center: [45.9, 6.85], zoom: 9 });
    this.map.on('contextmenu', (e) => this.showContextMenu(e, this.points.length));

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    // corriger les icônes par défaut
    const iconRetinaUrl = 'assets/marker-icon-2x.png';
    const iconUrl = 'assets/marker-icon.png';
    const shadowUrl = 'assets/marker-shadow.png';

    L.Marker.prototype.options.icon = L.icon({
      iconRetinaUrl,
      iconUrl,
      shadowUrl,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });
  }

  private refreshMarkers() {
    if (this.leafletMarkers.length > 0) {
      this.leafletMarkers.forEach((marker) => marker.removeFrom(this.map))
      this.leafletMarkers = []
    }
    this.points.forEach((point, index) => {
      let marker = this.createDraggableMarker(index)
      this.leafletMarkers.push(marker)
    })
  }

  onAddButtonClick(coordinates: [number, number] | null) {
    this.addPoint(coordinates);
    this.contextMenuVisible.set(false);
    this.getRoute(this.points).then((result) => {
      this.drawRoute(result.points, false);
      this.distance = result.summary.distance;
      this.positiveElevationGain = result.summary.ascent;
      this.negativeElevationGain = result.summary.descent;
    });
  }

  onDeleteButtonClick(id: number | null) {
    if (id === null) return;
    this.deletePoint(id);

    if (this.points.length > 1) {
      this.getRoute(this.points).then((result) => {
        this.drawRoute(result.points, false)
        this.distance = result.summary.distance;
        this.positiveElevationGain = result.summary.ascent;
        this.negativeElevationGain = result.summary.descent;
      });
    } else {
      this.drawRoute(this.points, false);
      this.distance = 0;
      this.positiveElevationGain = 0;
      this.negativeElevationGain = 0;
    }
    this.contextMenuVisible.set(false);
  }

  deletePoint(id: number) { 
    this.points = this.points.filter((point, index) =>  {
          return (id !== index)
    })
    this.refreshMarkers();
  }

  addPoint(coordinates: [number, number] | null) {
    if (coordinates != null) {
      let point: HikePoint = {
        latitude: coordinates[0],
        longitude: coordinates[1],
        elevation: 0
      }
      
      let minimalSegmentIndex = -1;
      let minimalDistance = null;

      for (let i = 0; i < this.points.length - 1; i++) {
        let pointOnSegmentProjectionCoords = this.projectPointOnSegment(
          [coordinates[0], coordinates[1]],
          [this.points[i].latitude, this.points[i].longitude],
          [this.points[i+1].latitude, this.points[i+1].latitude]
         )

         let clickedPoint = L.latLng(coordinates[0], coordinates[1]);
         let pointOnSegment = L.latLng(pointOnSegmentProjectionCoords[0], pointOnSegmentProjectionCoords[1]);
         
         let distance = clickedPoint.distanceTo(pointOnSegment);

         if (minimalDistance == null) {
          minimalDistance = distance
          minimalSegmentIndex = i;
         } else {
          if (distance < minimalDistance) {
            minimalDistance = distance
            minimalSegmentIndex = i;
          }
         }
         //console.log("distance: " + distance)
         //console.log("minimaldistance: " + minimalDistance);
         //console.log("minimalsegmentIndex: " + minimalSegmentIndex)
      } 

      //console.log(minimalSegmentIndex);
      
      this.points.splice(minimalSegmentIndex + 1, 0, point);
      

      this.refreshMarkers();
    }
  }

  private showContextMenu(e: L.LeafletMouseEvent, id: number): void {
    this.contextMenuX.set(e.originalEvent.clientX);
    this.contextMenuY.set(e.originalEvent.clientY);
    this.contextMenuMarkerId.set(id);
    this.contextMenuMarkerCoordinates.set([e.latlng.lat, e.latlng.lng])
    this.contextMenuVisible.set(true);

    // clic ailleurs ferme le menu
    const close = () => {
      this.contextMenuVisible.set(false);
      window.removeEventListener('click', close);
    };
    window.addEventListener('click', close);
  }

  private createDraggableMarker(index: number): L.Marker {
    return L.marker([this.points[index].latitude, this.points[index].longitude], { draggable: true })
    .addTo(this.map)
    .on('dragend', (e) => this.onMarkerDragEnd(e, index))
    .on('contextmenu', (e) => this.showContextMenu(e, index));
  }

  private onMarkerDragEnd(e: L.DragEndEvent, index: number): void {
    const { lat, lng } = (e.target as L.Marker).getLatLng();
    this.updatePoint(index, [lat, lng]);
    this.getRoute(this.points).then((result) => {
      this.drawRoute(result.points, false)
      this.distance = result.summary.distance;
      this.positiveElevationGain = result.summary.ascent;
      this.negativeElevationGain = result.summary.descent;
    });
  }

  private updatePoint(index: number, newPosition: [number, number]) {
    this.points[index].latitude = newPosition[0];
    this.points[index].longitude = newPosition[1];
  }

  private async getRoute(points: HikePoint[]): Promise<RouteResult> {
    const result = await this.routing.getRoute(points);
    
    const mappedPoints: HikePoint[] = result.geometry.map(
      ([lat, lng, el]) => ({
        latitude: lat,
        longitude: lng,
        elevation: el,
      })
    );
  
    const summary: RouteSummary = {
      distance: result.summary.distance,
      ascent: result.summary.ascent,
      descent: result.summary.descent,
    };
  
    return { points: mappedPoints, summary };
  }

  private async drawRoute(points: HikePoint[], zoomOut: boolean) {

    // On met au format [latitude, longitude] pour Leaflet
    const coords: [number, number][] = points.map(
      (c: HikePoint) => [c.latitude, c.longitude]
    );

    // Tracé
    this.polyline?.remove();
    this.polyline = L.polyline(coords, { color: 'red', weight: 2 }).addTo(this.map);

    if (zoomOut) {
      // Ajuste le zoom pour voir tout le tracé
      this.map.fitBounds(coords);
    }
  }

  /** 
 * Retourne la projection du point p sur le segment [a,b].
 * Entrées et sorties sont dans le même repère.
 */
private projectPointOnSegment(
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
}