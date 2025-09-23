import { Component, AfterViewInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { RoutingService } from '../services/routing';
import { HikePoint } from '../services/hike';
import { MatCardModule } from '@angular/material/card';
import { MatGridListModule } from '@angular/material/grid-list';
import { RefugeInfoPtEau, RefugeInfoRefuge, RefugesInfoService } from '../services/refuges-info';

@Component({
  selector: 'app-hike-map',
  standalone: true,
  templateUrl: './hike-map.html',
  styleUrl: './hike-map.scss',
  imports: [CommonModule, MatCardModule, MatGridListModule]
})
export class HikeMapComponent implements AfterViewInit, OnDestroy {
  // UI signals
  contextMenuVisible = signal(false);
  contextMenuX = signal(0);
  contextMenuY = signal(0);
  contextMenuMarkerId = signal<number | null>(null);
  contextMenuMarkerCoordinates = signal<[number, number] | null>(null);

  // Leaflet
  private map!: L.Map;
  private polyline?: L.Polyline;
  private leafletMarkers: L.Marker[] = [];

  // Hike data
  points: HikePoint[] = [
    { latitude: 45.621093, longitude: 6.052332, elevation: 0 },
    { latitude: 45.694522, longitude: 6.352326, elevation: 0 },
    { latitude: 45.755622, longitude: 6.552326, elevation: 0 },
  ];
  positiveElevationGain = 0;
  negativeElevationGain = 0;
  distance = 0;
  refuges: RefugeInfoRefuge[] = []
  ptsEau: RefugeInfoPtEau[] = []

  constructor(
    private routing: RoutingService,
    private refugesInfo: RefugesInfoService
  ) {}

  ngAfterViewInit(): void {
    this.initMap();
    if (this.points.length > 0) {
      this.refreshRoute(true);
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  initMap(): void {
    this.map = L.map('hike-map', { center: [45.9, 6.85], zoom: 9 });
    this.map.on('contextmenu', (e) => this.showContextMenu(e, this.points.length));

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);

    // default marker icons
    L.Marker.prototype.options.icon = this.getMarkerIcon('default');
  }

  getMarkerIcon(type: 'start' | 'end' | 'default' | 'refuge' | 'pt_eau'): L.Icon {
  const urls: Record<typeof type, string> = {
    start: 'assets/marker-icon.png',
    end: 'assets/marker-icon.png',
    default: 'assets/marker-icon.png',
    refuge: 'assets/refuge.png',
    pt_eau: 'assets/robinet.png'
  };

  const isCustomSvg = type === 'refuge' || type === 'pt_eau';

  return L.icon({
    iconUrl: urls[type],
    shadowUrl: !isCustomSvg ? 'assets/marker-shadow.png' : undefined,
    iconSize: isCustomSvg ? [32, 32] : [25, 41],
    iconAnchor: isCustomSvg ? [12, 12] : [12, 41],
    popupAnchor: isCustomSvg ? [0, -12] : [1, -34],
    shadowSize: !isCustomSvg ? [41, 41] : undefined,
  });
}

  async refreshRoute(zoomOut: boolean): Promise<void> {
    if (this.points.length < 2) {
      this.clearRoute();
      return;
    }

    const result = await this.routing.getRoute(this.points);
    const mappedPoints: HikePoint[] = result.geometry.map(([lat, lng, el]) => ({
      latitude: lat,
      longitude: lng,
      elevation: el,
    }));
    
    this.distance = result.summary.distance;
    this.positiveElevationGain = result.summary.ascent;
    this.negativeElevationGain = result.summary.descent;
    this.refuges = []
    this.ptsEau = []

    this.drawRoute(mappedPoints, zoomOut);
    this.refreshMarkers();
    this.loadNearbyRefuges(mappedPoints);
  }

  clearRoute(): void {
    this.polyline?.remove();
    this.refreshMarkers();
    this.distance = 0;
    this.positiveElevationGain = 0;
    this.negativeElevationGain = 0;
    this.refuges = []
    this.ptsEau = []
  }

  drawRoute(points: HikePoint[], zoomOut: boolean): void {
    const coords = points.map((c) => [c.latitude, c.longitude]) as [number, number][];
    this.polyline?.remove();
    this.polyline = L.polyline(coords, { color: 'blue', weight: 1 }).addTo(this.map);
    if (zoomOut) this.map.fitBounds(coords);
  }

  refreshMarkers(): void {
    this.leafletMarkers.forEach((m) => m.removeFrom(this.map));
    this.leafletMarkers = this.points.map((_, i) => this.createMarker(i));
  }

  createMarker(index: number): L.Marker {
    const point = this.points[index];
    const icon =
      index === 0
        ? this.getMarkerIcon('start')
        : index === this.points.length - 1
        ? this.getMarkerIcon('end')
        : this.getMarkerIcon('default');

    return L.marker([point.latitude, point.longitude], { draggable: true, icon })
      .addTo(this.map)
      .bindPopup(index === 0 ? 'Départ' : index === this.points.length - 1 ? 'Arrivée' : `Point ${index + 1}`)
      .on('dragend', (e) => this.onMarkerDragEnd(e, index))
      .on('contextmenu', (e) => this.showContextMenu(e, index));
  }

  onMarkerDragEnd(e: L.DragEndEvent, index: number): void {
    const { lat, lng } = (e.target as L.Marker).getLatLng();
    this.points[index] = { ...this.points[index], latitude: lat, longitude: lng };
    this.refreshRoute(false);
  }

  async loadNearbyRefuges(points: HikePoint[]): Promise<void> {
    const bbox = this.refugesInfo.createBbox(points);
    const response = await this.refugesInfo.getDataFromBbox(bbox.min, bbox.max);
    const addedCoords = new Set<string>();

    for (const feature of response.features) {
      const [lng, lat] = feature.geometry.coordinates;
      let isNear = false;

      for (let i = 0; i < points.length - 1; i++) {
        const projection = this.refugesInfo.projectPointOnSegment(
          [lat, lng],
          [points[i].latitude, points[i].longitude],
          [points[i + 1].latitude, points[i + 1].longitude]
        );

        const distance = L.latLng(lat, lng).distanceTo(L.latLng(projection[0], projection[1]));
        if (distance < 1000) {
          isNear = true;

          let item = {name: feature.properties.nom, link: feature.properties.lien}

          if (feature.properties.type.id === 23) {
            this.ptsEau.push(item)
          } else {
            this.refuges.push(item)
          }
          break;
        }
      }

      if (isNear) {
        const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
        if (addedCoords.has(key)) continue;
        addedCoords.add(key);

        const typeIcon = feature.properties.type.id === 23 ? 'pt_eau' : 'refuge';
        this.leafletMarkers.push(L.marker([lat, lng], { icon: this.getMarkerIcon(typeIcon) }).addTo(this.map));
      }
    }
  }

  showContextMenu(e: L.LeafletMouseEvent, id: number): void {
    const rect = this.map.getContainer().getBoundingClientRect();
    this.contextMenuX.set(e.originalEvent.clientX - rect.left);
    this.contextMenuY.set(e.originalEvent.clientY - rect.top);
    this.contextMenuMarkerId.set(id);
    this.contextMenuMarkerCoordinates.set([e.latlng.lat, e.latlng.lng]);
    this.contextMenuVisible.set(true);

    const close = () => {
      this.contextMenuVisible.set(false);
      window.removeEventListener('click', close);
    };
    window.addEventListener('click', close);
  }

  onAddButtonClick(coords: [number, number] | null): void {
    if (!coords) return;
    this.addPoint(coords);
    this.contextMenuVisible.set(false);
    this.refreshRoute(false);
  }

  onDeleteButtonClick(id: number | null): void {
    if (id === null) return;
    this.points = this.points.filter((_, i) => i !== id);
    this.contextMenuVisible.set(false);
    this.refreshRoute(false);
  }

  addPoint(coords: [number, number]): void {
    const newPoint: HikePoint = { latitude: coords[0], longitude: coords[1], elevation: 0 };
    let bestIndex = 0, bestDist = Infinity;

    for (let i = 0; i < this.points.length - 1; i++) {
      const projection = this.refugesInfo.projectPointOnSegment(
        coords,
        [this.points[i].latitude, this.points[i].longitude],
        [this.points[i + 1].latitude, this.points[i + 1].longitude]
      );
      const dist = L.latLng(coords[0], coords[1]).distanceTo(L.latLng(projection[0], projection[1]));
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
      }
    }

    this.points.splice(bestIndex + 1, 0, newPoint);
    this.refreshMarkers();
  }
}