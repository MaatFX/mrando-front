import { Component, AfterViewInit, OnDestroy, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { RoutingService } from '../services/routing';
import { Hike, HikePoint, HikeService } from '../services/hike';
import { MatCardModule } from '@angular/material/card';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatAccordion, MatExpansionModule } from '@angular/material/expansion';
import { RefugeInfoPtEau, RefugeInfoRefuge, RefugesInfoService } from '../services/refuges-info';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatListItem, MatListModule } from "@angular/material/list";
@Component({
  selector: 'app-hike-map',
  templateUrl: './hike-map.html',
  styleUrl: './hike-map.scss',
  imports: [CommonModule, MatCardModule, MatGridListModule, RouterModule, MatAccordion, MatExpansionModule, MatButtonModule, MatIcon, MatListItem, MatListModule]
})
export class HikeMapComponent implements AfterViewInit, OnDestroy, OnInit {
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
  currentHike: Hike = {} as Hike
  refuges: RefugeInfoRefuge[] = []
  ptsEau: RefugeInfoPtEau[] = []

  constructor(
    private routing: RoutingService,
    private refugesInfo: RefugesInfoService,
    private hikeService: HikeService,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
  this.route.paramMap.subscribe(params => {
    let hikeId = Number(params.get('id'));

    this.hikeService.getHikeById(hikeId).subscribe((result) => {
      this.currentHike = result
      this.currentHike.points = this.currentHike.points.sort((a, b) => a.index - b.index)
      if (this.map) {
        this.refreshRoute(true);
      }
    });
  });
}

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  initMap(): void {
    this.map = L.map('hike-map', { center: [45.9, 6.85], zoom: 9 });
    this.map.on('contextmenu', (e) => this.showContextMenu(e, this.currentHike.points.length));

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
    if (this.currentHike.points.length < 2) {
      this.clearRoute();
      return;
    }

    const result = await this.routing.getRoute(this.currentHike.points);
    const mappedPoints: HikePoint[] = result.geometry.map(([lat, lng, el]) => ({
      latitude: lat,
      longitude: lng,
      elevation: el,
      index: -1
    }));
    
    this.currentHike.distance = result.summary.distance;
    this.currentHike.positiveElevationGain = result.summary.ascent;
    this.currentHike.negativeElevationGain = result.summary.descent;
    this.refuges = []
    this.ptsEau = []

    this.drawRoute(mappedPoints, zoomOut);
    this.refreshMarkers();
    this.loadNearbyRefuges(mappedPoints);
  }

  clearRoute(): void {
    this.polyline?.remove();
    this.refreshMarkers();
    this.currentHike.distance = 0;
    this.currentHike.positiveElevationGain = 0;
    this.currentHike.negativeElevationGain = 0;
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
    this.leafletMarkers = this.currentHike.points.map((_, i) => this.createMarker(i));
  }

  createMarker(index: number): L.Marker {
    const point = this.currentHike.points[index];
    const icon =
      index === 0
        ? this.getMarkerIcon('start')
        : index === this.currentHike.points.length - 1
        ? this.getMarkerIcon('end')
        : this.getMarkerIcon('default');

    return L.marker([point.latitude, point.longitude], { draggable: true, icon })
      .addTo(this.map)
      .bindPopup(index === 0 ? 'Départ' : index === this.currentHike.points.length - 1 ? 'Arrivée' : `Point ${index + 1}`)
      .on('dragend', (e) => this.onMarkerDragEnd(e, index))
      .on('contextmenu', (e) => this.showContextMenu(e, index));
  }

  onMarkerDragEnd(e: L.DragEndEvent, index: number): void {
    const { lat, lng } = (e.target as L.Marker).getLatLng();
    this.currentHike.points[index] = { ...this.currentHike.points[index], latitude: lat, longitude: lng };
    this.refreshRoute(false);
  }

  async loadNearbyRefuges(points: HikePoint[]): Promise<void> {
    const bbox = this.refugesInfo.createBbox(points);
    const response = await this.refugesInfo.getDataFromBbox(bbox.min[1], bbox.min[0], bbox.max[1], bbox.max[0]);
    console.log(response.features.length)
    const addedCoords = new Set<string>();

    for (const data of response.features) {
      const [lng, lat] = data.geometry.coordinates;
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

          let item = {name: data.properties.nom, link: data.properties.lien}
          //console.log(item)

          if (data.properties.type.id === 23) {
            //console.log(data.properties.type.id)
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

        const typeIcon = data.properties.type.id === 23 ? 'pt_eau' : 'refuge';
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

  onAddButtonClick(coords: [number, number] | null, atEnd: boolean): void {
    if (!coords) return;
    this.addPoint(coords, atEnd);
    this.contextMenuVisible.set(false);
    this.refreshRoute(false);
  }

  onDeleteButtonClick(id: number | null): void {
    if (id === null) return;
    this.currentHike.points = this.currentHike.points.filter((_, i) => i !== id);
    this.contextMenuVisible.set(false);
    this.refreshRoute(false);
  }

  onSaveButtonClick(): void {

    for(let i = 0; i < this.currentHike.points.length; i++) {
      this.currentHike.points[i].index = i
    }

    console.log(this.currentHike.points)

    this.hikeService.updateHikeById(this.currentHike.id, this.currentHike).subscribe({
      next: (hike) => {
        this.snackBar.open('Randonnée sauvegardée avec succès ✅', 'Fermer', {
        duration: 3000,
        panelClass: ['snackbar-success']
      });
      },
      error: (err) => {
        this.snackBar.open('Erreur lors de la sauvegarde ❌', 'Fermer', {
        duration: 3000,
        panelClass: ['snackbar-error']
      });
      }
    })
}

  addPoint(coords: [number, number], atEnd: boolean): void {
    const newPoint: HikePoint = { latitude: coords[0], longitude: coords[1], elevation: 0, index: -1 };

    if (!atEnd) {
      let bestIndex = 0, bestDist = Infinity;

      for (let i = 0; i < this.currentHike.points.length - 1; i++) {
        const projection = this.refugesInfo.projectPointOnSegment(
          coords,
          [this.currentHike.points[i].latitude, this.currentHike.points[i].longitude],
          [this.currentHike.points[i + 1].latitude, this.currentHike.points[i + 1].longitude]
        );
        const dist = L.latLng(coords[0], coords[1]).distanceTo(L.latLng(projection[0], projection[1]));
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = i;
        }
      }
      this.currentHike.points.splice(bestIndex + 1, 0, newPoint);
    } else {
      this.currentHike.points.push(newPoint)
    }
    this.refreshMarkers();
  }
}