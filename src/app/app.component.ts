import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <h1 class="bg-slate-200 text-orange-400">Welcome to {{ title }}!</h1>
    <router-outlet />
  `,
  styles: [],
})
export class AppComponent {
  title = 'D3TaiwanMap';
}
