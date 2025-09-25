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
  imports: [
    MatCardModule,
    MatListModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIcon,
    DecimalPipe,
    FormsModule,
    CommonModule
  ],
  selector: 'app-hike-list',
  templateUrl: "./hike-list.html",
  styleUrl: './hike-list.scss',
})
export class HikeListComponent {
  // -----------------------
  // Services injectés
  // -----------------------
  private readonly hikeService = inject(HikeService); // Service pour interagir avec les randonnées (API)
  private readonly dialog = inject(MatDialog);        // Service pour ouvrir des dialogues (confirmation suppression)
  private readonly router = inject(Router);           // Service de navigation pour passer à la carte

  // -----------------------
  // Signaux & données
  // -----------------------
  private readonly hikesSignal = signal<Hike[]>([]); // Stockage réactif des randonnées
  hikes = computed(() => this.hikesSignal());       // Signal calculé pour exposer la liste
  loading = signal(true);                            // Indique si les randonnées sont en cours de chargement
  error = signal(false);                             // Indique si une erreur est survenue

  showForm = signal(false);                          // Contrôle l'affichage du formulaire de création
  newHike: Partial<Hike> = {                        // Objet temporaire pour créer une nouvelle randonnée
    positiveElevationGain: 0,
    negativeElevationGain: 0,
    distance: 0,
    duration: 0
  };

  // -----------------------
  // Constructeur
  // -----------------------
  constructor() {
    this.loadHikes(); // Charger la liste des randonnées au démarrage
  }

  // -----------------------
  // Méthodes de chargement
  // -----------------------
  loadHikes() {
    // Récupère les randonnées depuis le service
    this.hikeService.getHikes().subscribe({
      next: (data) => {
        this.hikesSignal.set(data); // Mise à jour des randonnées
        this.loading.set(false);    // Chargement terminé
      },
      error: () => {
        this.error.set(true);       // Indique une erreur
        this.loading.set(false);    // Fin du chargement malgré l'erreur
      },
    });
  }

  // -----------------------
  // Optimisation *ngFor
  // -----------------------
  trackById(index: number, hike: Hike) { 
    return hike.id; // Permet à Angular de suivre les éléments pour améliorer les performances
  }

  // -----------------------
  // Suppression d'une randonnée
  // -----------------------
  confirmDelete(hike: Hike) {
    // Ouvre un dialogue de confirmation
    const dialogRef = this.dialog.open(ConfirmDialogComponent);

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        // Supprime la randonnée si confirmé
        this.hikeService.deleteHike(hike.id).subscribe(() => {
          // Mise à jour de la liste après suppression
          this.hikesSignal.update(list => list.filter(h => h.id !== hike.id));
        });
      }
    });
  }

  // -----------------------
  // Navigation vers la carte
  // -----------------------
  onHikeCardClicked(id: number) {
    // Redirige vers la page de la carte avec l'ID de la randonnée
    this.router.navigate(['/map', id]);
  }

  // -----------------------
  // Création d'une nouvelle randonnée
  // -----------------------
  createHike() {
    // Vérifie que le nom est renseigné
    if (!this.newHike.name) return;

    // Appelle le service pour créer la randonnée
    this.hikeService.createHike(this.newHike as Hike).subscribe((hike) => {
      // Ajoute la nouvelle randonnée à la liste existante
      this.hikesSignal.update(list => [...list, hike]);
      this.showForm.set(false); // Cache le formulaire
      this.newHike = {};        // Réinitialise le formulaire
    });
  }
}
