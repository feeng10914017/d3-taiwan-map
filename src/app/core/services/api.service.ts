import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { AssetsFileName } from '../enums/assets-file-name.enum';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  constructor(private http: HttpClient) {}

  getCountyData(): Observable<TopoJSON.Topology> {
    const url = 'assets/map-json/' + AssetsFileName.COUNTY + '.json';
    return this.http.get<TopoJSON.Topology>(url).pipe(shareReplay(1));
  }

  getTownshipData(): Observable<TopoJSON.Topology> {
    const url = 'assets/map-json/' + AssetsFileName.TOWNSHIP + '.json';
    return this.http.get<TopoJSON.Topology>(url).pipe(shareReplay(1));
  }
}
