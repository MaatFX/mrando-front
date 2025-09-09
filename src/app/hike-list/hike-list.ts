import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { HikeService, Hike } from '../services/hike';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIcon } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-hike-list',
  imports: [MatCardModule, MatListModule, MatIcon],
  template: `
  <section class="hike-list-container">
    <h2 class="hike-list-title">Liste des randonnées</h2>

    @if (loading()) {
      <p>Chargement...</p>
    } @else if (error()) {
      <p class="error-text">Erreur lors du chargement des randonnées.</p>
    } @else if (hikes().length === 0) {
      <p>Aucune randonnée disponible.</p>
    } @else {
      <div class="hike-column">
        @for (hike of hikes(); track hike.name) {
          <mat-card class="hike-card" appearance="outlined">
            <mat-card-header>
              <mat-card-title>{{ hike.name }}</mat-card-title>
              <button mat-icon-button color="warn" (click)="confirmDelete(hike)">
                <mat-icon>delete</mat-icon>
              </button>
            </mat-card-header>

            <mat-card-content>
              <mat-list>
                <mat-list-item>
                  <span class="label">Dénivelé + :</span> {{ hike.positiveElevationGain }} m
                </mat-list-item>
                <mat-list-item>
                  <span class="label">Dénivelé - :</span> {{ hike.negativeElevationGain }} m
                </mat-list-item>
                <mat-list-item>
                  <span class="label">Distance :</span> {{ hike.distance }} km
                </mat-list-item>
                <mat-list-item>
                  <span class="label">Durée :</span> {{ hike.duration }} min
                </mat-list-item>
              </mat-list>
            </mat-card-content>
          </mat-card>
        }
      </div>
    }
  </section>
`,
styles: [`
  .hike-list-container {
    display: flex;
    flex-direction: column;
    align-items: center; /* centre le contenu horizontalement */
    padding: 16px;
  }

  .hike-list-title {
    font-size: 1.25rem;
    font-weight: bold;
    margin-bottom: 16px;
  }

  .error-text {
    color: red;
  }

  /* Colonne verticale avec cartes centrées */
  .hike-column {
    display: flex;
    flex-direction: column; /* empile les cartes verticalement */
    gap: 16px; /* espace entre les cartes */
    width: 100%;
    max-width: 500px; /* largeur maximale pour la colonne */
    align-items: center; /* centre les cartes horizontalement */
  }

  .hike-card {
    width: 100%; /* chaque carte prend toute la largeur disponible */
  }

  .label {
    font-weight: 500;
  }

  /* Style du bouton supprimer à droite du titre */
  mat-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  button[mat-icon-button] {
    margin-left: 8px;
  }
`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HikeListComponent {
  private readonly hikeService = inject(HikeService);
  private readonly dialog = inject(MatDialog);

  private readonly hikesSignal = signal<Hike[]>([])
  hikes = computed(() => this.hikesSignal());
  loading = signal(true);
  error = signal(false);

  constructor() {
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
}