import type {Color, LayerProps, DefaultProps, UpdateParameters} from '@deck.gl/core';
import {BitmapLayer} from '@deck.gl/layers';
import type {BitmapLayerProps, BitmapBoundingBox} from '@deck.gl/layers';
import type {Texture} from '@luma.gl/core';
import {DEFAULT_LINE_WIDTH, DEFAULT_LINE_COLOR, ensureDefaultProps} from '../../_utils/props.js';
import {ImageInterpolation} from '../../_utils/image-interpolation.js';
import {ImageType} from '../../_utils/image-type.js';
import type {ImageUnscale} from '../../_utils/image-unscale.js';
import {isViewportGlobe, isViewportInZoomBounds} from '../../_utils/viewport.js';
import {parsePalette} from '../../_utils/palette.js';
import type {Palette} from '../../_utils/palette.js';
import {createPaletteTexture} from '../../_utils/palette-texture.js';
import {createEmptyTextureCached} from '../../_utils/texture.js';
import {bitmapModule} from '../../shaderlib/bitmap-module/bitmap-module.js';
import type {BitmapModuleProps} from '../../shaderlib/bitmap-module/bitmap-module.js';
import {rasterModule} from '../../shaderlib/raster-module/raster-module.js';
import type {RasterModuleProps} from '../../shaderlib/raster-module/raster-module.js';
import {paletteModule} from '../../shaderlib/palette-module/palette-module.js';
import type {PaletteModuleProps} from '../../shaderlib/palette-module/palette-module.js';
import {contourModule} from './contour-module.js';
import type {ContourModuleProps} from './contour-module.js';
import {sourceCode as fs} from './contour-bitmap-layer.fs.glsl';

type _ContourBitmapLayerProps = BitmapLayerProps & {
  imageTexture: Texture | null;
  imageTexture2: Texture | null;
  imageSmoothing: number;
  imageInterpolation: ImageInterpolation;
  imageWeight: number;
  imageType: ImageType;
  imageUnscale: ImageUnscale;
  imageMinValue: number | null;
  imageMaxValue: number | null;
  bounds: BitmapBoundingBox;
  minZoom: number | null;
  maxZoom: number | null;

  palette: Palette | null;
  color: Color | null;

  interval: number;
  majorInterval: number;
  width: number;
}

export type ContourBitmapLayerProps = _ContourBitmapLayerProps & LayerProps;

const defaultProps: DefaultProps<ContourBitmapLayerProps> = {
  imageTexture: {type: 'object', value: null},
  imageTexture2: {type: 'object', value: null},
  imageSmoothing: {type: 'number', value: 0},
  imageInterpolation: {type: 'object', value: ImageInterpolation.CUBIC},
  imageWeight: {type: 'number', value: 0},
  imageType: {type: 'object', value: ImageType.SCALAR},
  imageUnscale: {type: 'object', value: null},
  imageMinValue: {type: 'object', value: null},
  imageMaxValue: {type: 'object', value: null},
  bounds: {type: 'array', value: [-180, -90, 180, 90], compare: true},
  minZoom: {type: 'object', value: null},
  maxZoom: {type: 'object', value: 10}, // drop rendering artifacts in high zoom levels due to a low precision

  palette: {type: 'object', value: null},
  color: {type: 'color', value: DEFAULT_LINE_COLOR},

  interval: {type: 'number', value: 0},
  majorInterval: {type: 'number', value: 0},
  width: {type: 'number', value: DEFAULT_LINE_WIDTH},
};

export class ContourBitmapLayer<ExtraPropsT extends {} = {}> extends BitmapLayer<ExtraPropsT & Required<_ContourBitmapLayerProps>> {
  static layerName = 'ContourBitmapLayer';
  static defaultProps = defaultProps;

  declare state: BitmapLayer['state'] & {
    paletteTexture?: Texture;
    paletteBounds?: [number, number];
  };

  getShaders(): any {
    const parentShaders = super.getShaders();

    return {
      ...parentShaders,
      fs,
      modules: [...parentShaders.modules, bitmapModule, rasterModule, paletteModule, contourModule],
    };
  }

  updateState(params: UpdateParameters<this>): void {
    const {palette} = params.props;

    super.updateState(params);

    if (palette !== params.oldProps.palette) {
      this._updatePalette();
    }
  }

  draw(opts: any): void {
    const {device, viewport} = this.context;
    const {model} = this.state;
    const {imageTexture, imageTexture2, imageSmoothing, imageInterpolation, imageWeight, imageType, imageUnscale, imageMinValue, imageMaxValue, bounds, _imageCoordinateSystem, transparentColor, minZoom, maxZoom, color, interval, majorInterval, width} = ensureDefaultProps(this.props, defaultProps);
    const {paletteTexture, paletteBounds} = this.state;
    if (!imageTexture) {
      return;
    }

    // viewport
    const viewportGlobe = isViewportGlobe(viewport);

    if (model && isViewportInZoomBounds(viewport, minZoom, maxZoom)) {
      model.shaderInputs.setProps({
        [bitmapModule.name]: {
          viewportGlobe, bounds, _imageCoordinateSystem, transparentColor,
        } satisfies BitmapModuleProps,
        [rasterModule.name]: {
          imageTexture: imageTexture ?? createEmptyTextureCached(device),
          imageTexture2: imageTexture2 ?? createEmptyTextureCached(device),
          imageSmoothing, imageInterpolation, imageWeight, imageType, imageUnscale, imageMinValue, imageMaxValue,
        } satisfies RasterModuleProps,
        [paletteModule.name]: {
          paletteTexture: paletteTexture ?? createEmptyTextureCached(device),
          paletteBounds, paletteColor: color,
        } satisfies PaletteModuleProps,
        [contourModule.name]: {
          interval, majorInterval, width,
        } satisfies ContourModuleProps,
      });
      
      model.setParameters({
        ...model.parameters,
        cullMode: 'back', // enable culling to avoid rendering on both sides of the globe
        depthCompare: 'always', // disable depth test to avoid conflict with Maplibre globe depth buffer, see https://github.com/visgl/deck.gl/issues/9357
        ...this.props.parameters,
      });

      this.props.image = imageTexture;
      super.draw(opts);
      this.props.image = null;
    }
  }

  private _updatePalette(): void {
    const {device} = this.context;
    const {palette} = ensureDefaultProps(this.props, defaultProps);
    if (!palette) {
      this.setState({paletteTexture: undefined, paletteBounds: undefined});
      return;
    }

    const paletteScale = parsePalette(palette);
    const {paletteBounds, paletteTexture} = createPaletteTexture(device, paletteScale);

    this.setState({paletteTexture, paletteBounds});
  }
}