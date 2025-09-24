import { Routes } from '@angular/router';
import { HikeMapComponent } from './hike-map/hike-map';
import { HikeListComponent } from './hike-list/hike-list';

export const routes: Routes = [
    { path: 'map/:id', component: HikeMapComponent },
  { path: 'list', component: HikeListComponent },
  { path: '', redirectTo: 'list', pathMatch: 'full' } // page par défaut
];
