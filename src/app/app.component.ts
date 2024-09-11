import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TaiwanMapComponent } from './components/taiwan-map/taiwan-map.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, TaiwanMapComponent],
  template: `
    <h1 class="sticky top-0 bg-gray-50/[0.25] p-5 text-4xl shadow-lg">{{ title }}</h1>
    <app-taiwan-map class="h-full grow" />

    <router-outlet />
  `,
  styles: [],
  host: { class: 'flex flex-col min-h-dvh bg-sky-200' },
})
export class AppComponent {
  title = 'D3TaiwanMap';
}
