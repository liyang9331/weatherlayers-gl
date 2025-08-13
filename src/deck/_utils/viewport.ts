import type {Viewport, WebMercatorViewport, _GlobeViewport as GlobeViewport, LayerExtension} from '@deck.gl/core';
import {ClipExtension} from '@deck.gl/extensions';
import {distance} from './geodesy.js';
import {MERCATOR_BOUNDS, wrapBounds, clipBounds, isPositionInBounds} from './bounds.js';

export function isViewportGlobe(viewport: Viewport): viewport is GlobeViewport {
  return !!viewport.resolution;
}

export function isViewportMercator(viewport: Viewport): viewport is WebMercatorViewport {
  return !isViewportGlobe(viewport);
}

// use layerFilter instead, see https://github.com/visgl/deck.gl/issues/9409#issuecomment-2666820517
export function isViewportInZoomBounds(viewport: Viewport, minZoom: number | null, maxZoom: number | null): boolean {
  if (minZoom != null && viewport.zoom < minZoom) {
    return false;
  }
  if (maxZoom != null && viewport.zoom > maxZoom) {
    return false;
  }
  return true;
}

export function getViewportGlobeCenter(viewport: GlobeViewport): [number, number] {
  return [viewport.longitude, viewport.latitude];
}

export function getViewportGlobeRadius(viewport: GlobeViewport): number {
  const viewportGlobeCenter = getViewportGlobeCenter(viewport);
  const viewportGlobeRadius = Math.max(
    distance(viewportGlobeCenter, viewport.unproject([viewport.width / 2, 0])),
    distance(viewportGlobeCenter, viewport.unproject([0, viewport.height / 2])),
    ...(viewport.width > viewport.height ? [
      distance(viewportGlobeCenter, viewport.unproject([viewport.width / 2 - viewport.height / 4 * 1, viewport.height / 2])),
      distance(viewportGlobeCenter, viewport.unproject([viewport.width / 2 - viewport.height / 2 * 1, viewport.height / 2])),
      distance(viewportGlobeCenter, viewport.unproject([viewport.width / 2 - viewport.height / 4 * 3, viewport.height / 2])),
      distance(viewportGlobeCenter, viewport.unproject([viewport.width / 2 - viewport.height, viewport.height / 2])),
    ] : [
      distance(viewportGlobeCenter, viewport.unproject([viewport.width / 2, viewport.height / 2 - viewport.width / 4 * 1])),
      distance(viewportGlobeCenter, viewport.unproject([viewport.width / 2, viewport.height / 2 - viewport.width / 2 * 1])),
      distance(viewportGlobeCenter, viewport.unproject([viewport.width / 2, viewport.height / 2 - viewport.width / 4 * 3])),
      distance(viewportGlobeCenter, viewport.unproject([viewport.width / 2, viewport.height / 2 - viewport.width])),
    ])
  );
  return viewportGlobeRadius;
}

export function getViewportBounds(viewport: WebMercatorViewport): [number, number, number, number] {
  return wrapBounds(viewport.getBounds());
}

// viewport.zoom varies by latitude, using Math.log2(viewport.scale) instead because it is multiplied by scaleAdjust
// TODO: report deck.gl bug
export function getViewportZoom(viewport: Viewport): number {
  return isViewportGlobe(viewport) ? Math.log2(viewport.scale) : viewport.zoom;
}

// see https://github.com/visgl/deck.gl/issues/9592
export function getViewportPixelOffset(viewport: Viewport, offset: number): number {
  return offset * (isViewportGlobe(viewport) ? -1 : 1);
}

// see https://github.com/visgl/deck.gl/issues/9592
export function getViewportAngle(viewport: Viewport, angle: number): number {
  return angle + (isViewportGlobe(viewport) ? 180 : 0);
}

// remove or use?
export function getViewportClipExtensions(viewport: Viewport): LayerExtension[] {
  return !isViewportGlobe(viewport) ? [new ClipExtension()] : [];
}

export function getViewportClipBounds(viewport: WebMercatorViewport, bounds: [number, number, number, number]): [number, number, number, number];
export function getViewportClipBounds(viewport: Viewport, bounds: [number, number, number, number]): [number, number, number, number] | null {
  return isViewportMercator(viewport) ? clipBounds(bounds) : null;
}

export function getViewportPositions(viewport: Viewport, positions: GeoJSON.Position[]): GeoJSON.Position[] {
  return !isViewportGlobe(viewport) ? positions.filter(position => isPositionInBounds(position, MERCATOR_BOUNDS)) : positions;
}