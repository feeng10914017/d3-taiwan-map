import { isPlatformBrowser, NgIf } from '@angular/common';
import { Component, ElementRef, inject, OnDestroy, OnInit, PLATFORM_ID, ViewChild } from '@angular/core';
import * as d3 from 'd3';
import { Feature, FeatureCollection, Geometry } from 'geojson';
import { forkJoin, fromEvent, map, Subject, takeUntil, tap, throttleTime } from 'rxjs';
import * as topojson from 'topojson';
import { AssetsFileName } from '../../core/enums/assets-file-name.enum';
import { D3ClassName } from '../../core/enums/d3-class.enum';
import { LocationInfo } from '../../core/models/location-info.model';
import { ApiService } from '../../core/services/api.service';

type Geometries = FeatureCollection<Geometry, LocationInfo>;
type GeoFeature = Feature<Geometry, LocationInfo>;

@Component({
  selector: 'app-taiwan-map',
  standalone: true,
  imports: [NgIf],
  template: `
    <svg #mapSvg></svg>
    <button
      *ngIf="isZoomToCountry"
      class="absolute right-0 top-[80px] m-3 rounded px-4 py-2 shadow hover:shadow-lg"
      (click)="zoomToAllCounty()">
      Back
    </button>
  `,
  styles: ``,
  host: { class: 'relative' },
})
export class TaiwanMapComponent implements OnInit, OnDestroy {
  @ViewChild('mapSvg', { static: true }) private _mapSvg!: ElementRef<SVGSVGElement>;

  private readonly _platformId = inject(PLATFORM_ID);
  private readonly _isBrowser = isPlatformBrowser(this._platformId);
  private readonly _elementRef = inject(ElementRef);
  private readonly _apiService = inject(ApiService);
  private readonly _headerHeight = 80;

  private _width = 800;
  private _height = 600;
  private _svg!: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private _g!: d3.Selection<SVGGElement, unknown, null, undefined>;
  private _projection!: d3.GeoProjection;
  private _path!: d3.GeoPath<any, d3.GeoPermissibleObjects>;
  private _currentZoom = 1;
  private _townshipFeatures: GeoFeature[] = [];

  protected isZoomToCountry = false;

  private readonly _destroy = new Subject<null>();

  ngOnInit(): void {
    if (!this._isBrowser) return;

    this._updateContainerDimensions();
    this._initializeMap();
    this._fetchData();

    fromEvent(window, 'resize')
      .pipe(
        takeUntil(this._destroy),
        tap(() => this._updateContainerDimensions()),
        throttleTime(50),
      )
      .subscribe(() => this._updateMapSize());
  }

  ngOnDestroy(): void {
    this._destroy.next(null);
    this._destroy.complete();
  }

  /** 更新 svg 尺寸 */
  private _updateContainerDimensions(): void {
    this._width = this._elementRef.nativeElement.clientWidth;
    this._height = this._elementRef.nativeElement.clientHeight;
  }

  private _initializeMap(): void {
    this._svg = d3.select(this._mapSvg.nativeElement).attr('width', this._width).attr('height', this._height);

    this._g = this._svg.append('g');

    this._projection = d3
      .geoMercator()
      .center([121, 23.5])
      .scale(8000)
      .translate([this._width / 2, this._height / 2 + this._headerHeight]);

    this._path = d3.geoPath().projection(this._projection);
  }

  private _updateMapSize(): void {
    this._svg.attr('width', this._width).attr('height', this._height);
    this._projection.translate([this._width / 2, this._height / 2]);
    this._path = d3.geoPath().projection(this._projection);
    this._g.selectAll('path').attr('d', this._path as any);
  }

  /**
   * 取得地圖資料
   *
   * @reference 縣市數據 https://data.gov.tw/dataset/7442
   * @reference 鄉鎮市區數據 https://data.gov.tw/dataset/7441
   * @reference 村里數據 https://data.gov.tw/dataset/130549
   * @reference 格式轉換 https://mapshaper.org/
   */
  private _fetchData(): void {
    const countyFileName = AssetsFileName.COUNTY;
    const townshipFileName = AssetsFileName.TOWNSHIP;
    forkJoin([this._apiService.getCountyData(), this._apiService.getTownshipData()])
      .pipe(map((arr) => arr.map((data) => data as TopoJSON.Topology)))
      .subscribe(([countyData, townshipData]) => {
        const countyGeometries = topojson.feature(countyData, countyData.objects[countyFileName]) as Geometries;
        const townshipGeometries = topojson.feature(townshipData, townshipData.objects[townshipFileName]) as Geometries;
        countyGeometries.features.forEach((item) => (item.properties = new LocationInfo(item.properties)));
        townshipGeometries.features.forEach((item) => (item.properties = new LocationInfo(item.properties)));
        this._townshipFeatures = townshipGeometries.features;
        this._drawCounty(countyGeometries.features);
        this._drawTownship('');
      });
  }

  private _drawCounty(countyFeatures: GeoFeature[]) {
    this._g
      .selectAll<SVGPathElement, GeoFeature>(`.${D3ClassName.COUNTY}`)
      .data(countyFeatures)
      .join(
        (enter) =>
          enter
            .append('path')
            .attr('d', (d) => this._path(d))
            .attr('class', D3ClassName.COUNTY)
            .on('mouseover', (event: MouseEvent, d: GeoFeature) => this._toggleInfo(d, d.properties.COUNTYNAME))
            .on('mouseout', (event: MouseEvent, d: GeoFeature) => this._toggleInfo(d, ''))
            .on('click', (event: MouseEvent, d: GeoFeature) => this._zoomToCounty(d)),
        (update) => update,
        (exit) => exit.remove(),
      );
  }

  private _drawTownship(countyCode: string): void {
    const filteredFeatures = this._townshipFeatures.filter((feature) => feature.properties.COUNTYCODE === countyCode);

    this._g
      .selectAll<SVGPathElement, GeoFeature>(`.${D3ClassName.TOWNSHIP}`)
      .data(filteredFeatures)
      .join(
        (enter) =>
          enter
            .append('path')
            .attr('d', (d) => this._path(d))
            .attr('class', D3ClassName.TOWNSHIP)
            .style('opacity', '0')
            .style('pointer-events', 'none')
            .on('mouseover', (event: MouseEvent, d: GeoFeature) => this._toggleInfo(d, d.properties.TOWNNAME))
            .on('mouseout', (event: MouseEvent, d: GeoFeature) => this._toggleInfo(d, ''))
            .call((enter) =>
              enter
                .transition(d3.transition().duration(750))
                .style('opacity', '1')
                .end()
                .then(() =>
                  this._g
                    .selectAll<SVGPathElement, GeoFeature>(`.${D3ClassName.TOWNSHIP}`)
                    .style('pointer-events', 'auto'),
                ),
            ),
        (update) => update,
        (exit) =>
          exit
            .on('mouseover', null)
            .on('mouseout', null)
            .transition(d3.transition().duration(750))
            .style('opacity', '0')
            .style('pointer-events', 'none')
            .remove(),
      );
  }

  private _zoomToCounty(county: GeoFeature): void {
    this.isZoomToCountry = true;
    const bounds = this._path.bounds(county);
    const dx = bounds[1][0] - bounds[0][0];
    const dy = bounds[1][1] - bounds[0][1];
    const x = (bounds[0][0] + bounds[1][0]) / 2;
    const y = (bounds[0][1] + bounds[1][1]) / 2;
    const exclude_HeaderHeight = this._height - this._headerHeight;
    const scale = Math.max(1, Math.min(25, 0.9 / Math.max(dx / this._width, dy / exclude_HeaderHeight)));
    const translate = [this._width / 2 - scale * x, exclude_HeaderHeight / 2 - scale * y + this._headerHeight];

    this._currentZoom = scale;

    this._g.selectAll<SVGPathElement, GeoFeature>(`.${D3ClassName.COUNTY}`).style('pointer-events', 'none');
    this._g.transition().duration(750).attr('transform', `translate(${translate[0]},${translate[1]}) scale(${scale})`);
    this._drawTownship(county.properties.COUNTYCODE);
  }

  protected zoomToAllCounty(): void {
    this.isZoomToCountry = false;
    this._currentZoom = 1;
    this._g
      .transition()
      .duration(750)
      .attr('transform', `translate(0, 0) scale(1)`)
      .end()
      .then(() => {
        this._g.selectAll<SVGPathElement, GeoFeature>(`.${D3ClassName.COUNTY}`).style('pointer-events', 'auto');
      });
    this._drawTownship('');
  }

  private _toggleInfo(d: GeoFeature, info: string): void {
    const centroid = this._path.centroid(d);
    const fontSize = 12 / this._currentZoom;
    const [x, y] = centroid;
    this._g
      .selectAll<SVGPathElement, GeoFeature>(`.${D3ClassName.INFO_TEXT}`)
      .data([info])
      .join(
        (enter) =>
          enter
            .append('text')
            .attr('class', D3ClassName.INFO_TEXT)
            .attr('text-anchor', 'middle')
            .attr('pointer-events', 'none')
            .attr('font-size', `${fontSize}px`)
            .attr('x', String(x))
            .attr('y', String(y + fontSize / 2))
            .text(info),
        (update) =>
          update
            .attr('font-size', `${fontSize}px`)
            .attr('x', String(x))
            .attr('y', String(y + fontSize / 2))
            .text(info)
            .raise(),
        (exit) => exit.remove(),
      );
  }
}
