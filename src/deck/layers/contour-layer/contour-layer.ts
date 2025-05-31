import {CompositeLayer, COORDINATE_SYSTEM} from '@deck.gl/core';
import type {LayerProps, DefaultProps, UpdateParameters, LayersList} from '@deck.gl/core';
import type {Texture} from '@luma.gl/core';
import type {TextureData} from '../../_utils/texture-data.js';
import {createTextureCached, createEmptyTextureCached} from '../../_utils/texture.js';
import {isRepeatBounds} from '../../_utils/bounds.js';
import {ContourBitmapLayer} from './contour-bitmap-layer.js';
import type {ContourBitmapLayerProps} from './contour-bitmap-layer.js';

type _ContourLayerProps = ContourBitmapLayerProps & {
  image: TextureData | null;
  image2: TextureData | null;
};

export type ContourLayerProps = _ContourLayerProps & LayerProps;

const defaultProps: DefaultProps<ContourLayerProps> = {
  ...ContourBitmapLayer.defaultProps,

  imageTexture: undefined,
  imageTexture2: undefined,
  image: {type: 'object', value: null}, // object instead of image to allow reading raw data
  image2: {type: 'object', value: null}, // object instead of image to allow reading raw data
};

export class ContourLayer<ExtraPropsT extends {} = {}> extends CompositeLayer<ExtraPropsT & Required<_ContourLayerProps>> {
  static layerName = 'ContourLayer';
  static defaultProps = defaultProps;

  declare state: CompositeLayer['state'] & {
    props?: ContourLayerProps;
    imageTexture?: Texture;
    imageTexture2?: Texture;
  };

  renderLayers(): LayersList {
    const {device} = this.context;
    const {props, imageTexture, imageTexture2} = this.state;
    if (!props || !imageTexture) {
      return [];
    }

    return [
      new ContourBitmapLayer(this.props, this.getSubLayerProps({
        ...{
          id: 'bitmap',
          imageTexture,
          imageTexture2,

          _imageCoordinateSystem: COORDINATE_SYSTEM.LNGLAT,
        } satisfies Partial<ContourBitmapLayerProps>,

        image: createEmptyTextureCached(device),
        image2: createEmptyTextureCached(device),
      })),
    ];
  }

  updateState(params: UpdateParameters<this>): void {
    const {image, image2, imageUnscale, bounds} = params.props;

    super.updateState(params);

    if (image && imageUnscale && !(image.data instanceof Uint8Array || image.data instanceof Uint8ClampedArray)) {
      throw new Error('imageUnscale can be applied to Uint8 data only');
    }

    if (image !== params.oldProps.image || image2 !== params.oldProps.image2) {
      const {device} = this.context;
      const {image, image2} = this.props;
  
      const imageTexture = image ? createTextureCached(device, image, isRepeatBounds(bounds as GeoJSON.BBox)) : null;
      const imageTexture2 = image2 ? createTextureCached(device, image2, isRepeatBounds(bounds as GeoJSON.BBox)) : null;
  
      this.setState({imageTexture, imageTexture2});
    }

    this.setState({props: params.props});
  }
}