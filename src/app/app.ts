import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HikeListComponent } from "./hike-list/hike-list";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HikeListComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('mrando-front');
}
