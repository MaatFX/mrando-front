import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { HikeService, Hike } from '../services/hike';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  imports: [MatCardModule, MatListModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIcon, DecimalPipe, FormsModule, CommonModule],
  template: `
  <section class="hike-list-container">
    <h2 class="hike-list-title">Liste des randonnées</h2>

    <button mat-raised-button color="primary" (click)="showForm.set(!showForm())">
      {{ showForm() ? 'Annuler' : 'Créer une randonnée' }}
    </button>

    <div *ngIf="showForm()" class="new-hike-form">
      <mat-form-field appearance="fill">
        <mat-label>Nom de la randonnée</mat-label>
        <input matInput [(ngModel)]="newHike.name">
      </mat-form-field>
      <button mat-raised-button color="primary" (click)="createHike()">Créer</button>
    </div>

    <ng-container *ngIf="loading()">Chargement...</ng-container>
    <ng-container *ngIf="error()" class="error-text">Erreur lors du chargement des randonnées.</ng-container>

    <div class="hike-column" *ngIf="!loading() && !error() && hikes().length > 0">
      <mat-card class="hike-card" *ngFor="let hike of hikes(); trackBy: trackById" (click)="onHikeCardClicked(hike.id)">
        <mat-card-header>
          <mat-card-title>{{ hike.name }}</mat-card-title>
          <button mat-icon-button color="warn" (click)="confirmDelete(hike)">
            <mat-icon>delete</mat-icon>
          </button>
        </mat-card-header>

        <mat-card-content>
          <mat-list>
            <mat-list-item>
              <span class="label">Dénivelé + :</span> {{ hike.positiveElevationGain | number:'1.0-0' }} m
            </mat-list-item>
            <mat-list-item>
              <span class="label">Dénivelé - :</span> {{ hike.negativeElevationGain | number:'1.0-0' }} m
            </mat-list-item>
            <mat-list-item>
              <span class="label">Distance :</span> {{ (hike.distance / 1000) | number:'1.0-0' }} km
            </mat-list-item>
            <mat-list-item>
              <span class="label">Durée :</span> {{ hike.duration }} min
            </mat-list-item>
          </mat-list>
        </mat-card-content>
      </mat-card>
    </div>
  </section>
  `,
  styles: [`
    .new-hike-form {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin: 16px 0;
      max-width: 400px;
      width: 100%;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HikeListComponent {
  private readonly hikeService = inject(HikeService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  private readonly hikesSignal = signal<Hike[]>([]);
  hikes = computed(() => this.hikesSignal());
  loading = signal(true);
  error = signal(false);

  showForm = signal(false);
  newHike: Partial<Hike> = {positiveElevationGain: 0, negativeElevationGain: 0, distance: 0, duration: 0};

  constructor() {
    this.loadHikes();
  }

  loadHikes() {
    this.hikeService.getHikes().subscribe({
      next: (data) => {
        this.hikesSignal.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  trackById(index: number, hike: Hike) { return hike.id; }

  confirmDelete(hike: Hike) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent);
    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.hikeService.deleteHike(hike.id).subscribe(() => {
          this.hikesSignal.update(list => list.filter(h => h.id !== hike.id));
        });
      }
    });
  }

  onHikeCardClicked(id: number) {
    this.router.navigate(['/map', id]);
  }

  createHike() {
    if (!this.newHike.name) return;

    this.hikeService.createHike(this.newHike as Hike).subscribe((hike) => {
      this.hikesSignal.update(list => [...list, hike]);
      this.showForm.set(false);
      this.newHike = {};
    });
  }
}