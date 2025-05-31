import {VERSION, CATALOG_URL} from '../deck/_utils/build.js';
import {loadTextureData, loadJson} from '../deck/_utils/texture-data.js';
import type {TextureData} from '../deck/_utils/texture-data.js';
import {getDatetimeWeight, getClosestStartDatetime, getClosestEndDatetime} from '../deck/_utils/datetime.js';
import type {DatetimeISOString, DatetimeISOStringRange, OpenDatetimeISOStringRange, DurationISOString} from '../deck/_utils/datetime.js';
import type {ImageType} from '../deck/_utils/image-type.js';
import type {ImageUnscale} from '../deck/_utils/image-unscale.js';
import {UnitSystem} from '../deck/_utils/unit-system.js';
import type {UnitFormat} from '../deck/_utils/unit-format.js';
import type {Palette} from '../deck/_utils/palette.js';
import {StacProviderRole, StacAssetRole, StacLinkRel} from './stac.js';
import type {StacCatalog, StacCollections, StacCollection, StacItemCollection, StacItem} from './stac.js';

export interface ClientConfig {
  url?: string;
  accessToken?: string;
  dataFormat?: string;
  unitSystem?: UnitSystem;
  attributionLinkClass?: string;
  datetimeStep?: number;
  datetimeInterpolate?: boolean;
}

export interface Dataset {
  title: string;
  unitFormat: UnitFormat;
  attribution: string;
  datetimeRange: OpenDatetimeISOStringRange;
  datetimes: DatetimeISOString[]; // deprecated, use `loadDatasetSlice` instead
  palette: Palette;
}

export interface DatasetSlice {
  datetimes: DatetimeISOString[];
}

export interface DatasetData {
  datetime: DatetimeISOString;
  referenceDatetime: DatetimeISOString;
  horizon: DurationISOString;
  image: TextureData;
  datetime2: DatetimeISOString | null; // applicable only if `datetimeInterpolate` is enabled
  referenceDatetime2: DatetimeISOString | null; // applicable only if `datetimeInterpolate` is enabled
  horizon2: DurationISOString | null; // applicable only if `datetimeInterpolate` is enabled
  image2: TextureData | null; // applicable only if `datetimeInterpolate` is enabled
  imageWeight: number; // applicable only if `datetimeInterpolate` is enabled
  imageType: ImageType;
  imageUnscale: ImageUnscale;
  bounds: [number, number, number, number];
}

interface StacItemData {
  datetime: DatetimeISOString;
  referenceDatetime: DatetimeISOString;
  horizon: DurationISOString;
  image: TextureData;
}

const DEFAULT_URL = CATALOG_URL;
const DEFAULT_DATA_FORMAT = 'byte.png';
const DEFAULT_UNIT_SYSTEM = UnitSystem.METRIC;
const DEFAULT_ATTRIBUTION_LINK_CLASS = '';
const NOW_DATETIME = '!now';

function getStacCollectionAttribution(stacCollection: StacCollection, attributionLinkClass: string): string {
  const producer = stacCollection.providers.find(x => x.roles.includes(StacProviderRole.PRODUCER));
  const processor = stacCollection.providers.find(x => x.roles.includes(StacProviderRole.PROCESSOR));
  const attribution = [
    ...(producer ? [`<a href="${producer.url}"${attributionLinkClass ? ` class="${attributionLinkClass}"`: ''}>${producer.name}</a>`] : []),
    ...(processor ? [`<a href="${processor.url}"${attributionLinkClass ? ` class="${attributionLinkClass}"`: ''}>${processor.name}</a>`] : []),
  ].join(' via ');
  return attribution;
}

function getStacCollectionUnitFormat(stacCollection: StacCollection, unitSystem: UnitSystem): UnitFormat {
  const units = stacCollection['weatherLayers:units']!;
  const unitDefinition = units.find(unitFormat => unitFormat.system === unitSystem) ?? units.find(unitFormat => unitFormat.system === DEFAULT_UNIT_SYSTEM) ?? units[0];
  const {unit, scale, offset, decimals} = unitDefinition;
  return {unit, scale, offset, decimals};
}

function serializeDatetimeISOStringRange(datetimeRange: DatetimeISOStringRange): string {
  if (Array.isArray(datetimeRange) && datetimeRange.length === 2) {
    const [start, end] = datetimeRange;
    return `${start ?? '..'}/${end ?? '..'}`;
  } else {
    throw new Error('Invalid datetime range');
  }
}

export class Client {
  #config: ClientConfig;
  #cache = new Map<string, any>();
  #datasetStacCollectionCache = new Map<string, StacCollection>();
  #datasetDataStacItemCache = new Map<string, Map<DatetimeISOString, StacItem>>();

  constructor(config: ClientConfig) {
    this.#config = config;
  }

  getConfig(): ClientConfig {
    return {...this.#config};
  }

  setConfig(config: ClientConfig): void {
    this.#config = config;
  }

  updateConfig(config: Partial<ClientConfig>): void {
    this.setConfig({...this.#config, ...config});
  }

  #getAuthenticatedUrl(path: string, config: ClientConfig = {}): string {
    const accessToken = config.accessToken ?? this.#config.accessToken ?? null;
    const url = new URL(path);
    if (!url.searchParams.has('access_token') && accessToken != null) {
      url.searchParams.set('access_token', accessToken);
    }
    if (!url.searchParams.has('version')) {
      url.searchParams.set('version', VERSION);
    }
    return url.toString();
  }

  #cacheDatasetStacCollection(stacCollection: StacCollection): void {
    this.#datasetStacCollectionCache.set(stacCollection.id, stacCollection);
  }

  #cacheDatasetDataStacItem(dataset: string, stacItem: StacItem): void {
    if (!this.#datasetDataStacItemCache.has(dataset)) {
      this.#datasetDataStacItemCache.set(dataset, new Map());
    }
    this.#datasetDataStacItemCache.get(dataset)!.set(stacItem.properties.datetime, stacItem);
  }

  async #loadStacCatalog(config: ClientConfig = {}): Promise<StacCatalog> {
    const url = config.url ?? this.#config.url ?? DEFAULT_URL;
    const authenticatedUrl = this.#getAuthenticatedUrl(`${url}/catalog`, config);
    const stacCatalog = await loadJson(authenticatedUrl, {cache: this.#cache}) as StacCatalog;

    return stacCatalog;
  }

  async #loadDatasetStacCollections(config: ClientConfig = {}): Promise<StacCollection[]> {
    const stacCatalog = await this.#loadStacCatalog(config);
    const link = stacCatalog.links.find(x => x.rel === StacLinkRel.DATA);
    if (!link) {
      throw new Error('STAC Catalog data link not found');
    }

    const authenticatedUrl = this.#getAuthenticatedUrl(link.href, config);
    const stacCollections = (await loadJson(authenticatedUrl, {cache: this.#cache}) as StacCollections).collections;

    // cache
    for (const stacCollection of stacCollections) {
      this.#cacheDatasetStacCollection(stacCollection);
    }

    return stacCollections;
  }

  async #loadDatasetStacCollection(dataset: string, config: ClientConfig = {}): Promise<StacCollection> {
    await this.#loadDatasetStacCollections(config);
    let stacCollection = this.#datasetStacCollectionCache.get(dataset);
    if (!stacCollection) {
      throw new Error(`STAC Collection ${dataset} not found`);
    }

    // cache
    this.#cacheDatasetStacCollection(stacCollection);

    return stacCollection;
  }

  async #loadDatasetStacCollectionPalette(dataset: string, config: ClientConfig = {}): Promise<Palette> {
    const stacCollection = await this.#loadDatasetStacCollection(dataset, config);
    const asset = Object.values(stacCollection.assets ?? {}).find(x => x.roles.includes(StacAssetRole.PALETTE) && x.type === 'application/json');
    if (!asset) {
      throw new Error(`STAC Collection ${dataset} palette asset not found`);
    }

    const authenticatedUrl = this.#getAuthenticatedUrl(asset.href, this.#config);
    const palette = await loadJson(authenticatedUrl, {cache: this.#cache}) as Palette;

    return palette;
  }

  async #searchDatasetDataStacItems(dataset: string, datetimeRange: DatetimeISOStringRange, datetimeStep: number, config: ClientConfig = {}): Promise<StacItem[]> {
    const stacCatalog = await this.#loadStacCatalog(config);
    const link = stacCatalog.links.find(x => x.rel === StacLinkRel.SEARCH);
    if (!link) {
      throw new Error('STAC Catalog search link not found');
    }

    const url = new URL(link.href);
    url.searchParams.set('collections', dataset);
    url.searchParams.set('datetime', serializeDatetimeISOStringRange(datetimeRange));
    if (typeof datetimeStep === 'number' && datetimeStep > 1) {
      url.searchParams.set('datetime_step', `${datetimeStep}`);
    }
    const authenticatedUrl = this.#getAuthenticatedUrl(url.toString(), config);
    const stacItems = (await loadJson(authenticatedUrl, {cache: this.#cache}) as StacItemCollection).features;

    // cache
    for (const stacItem of stacItems) {
      this.#cacheDatasetDataStacItem(dataset, stacItem);
    }

    return stacItems;
  }

  async #loadDatasetDataStacItem(dataset: string, datetime: DatetimeISOString, config: ClientConfig = {}): Promise<StacItem> {
    const datetimeStep = config.datetimeStep ?? this.#config.datetimeStep ?? 1;
    let stacItem = this.#datasetDataStacItemCache.get(dataset)?.get(datetime);
    if (!stacItem) {
      const stacItems = await this.#searchDatasetDataStacItems(dataset, [datetime, datetime], datetimeStep, config);
      stacItem = stacItems[0];
    }
    if (!stacItem) {
      throw new Error(`STAC Item ${dataset}/${datetime} not found`);
    }

    return stacItem;
  }

  async #loadStacItemData(stacItem: StacItem, config: ClientConfig = {}): Promise<StacItemData> {
    const dataFormat = config.dataFormat ?? this.#config.dataFormat ?? DEFAULT_DATA_FORMAT;
    const asset = stacItem.assets[`data.${dataFormat}`];
    if (!asset) {
      throw new Error(`STAC Item data asset not found`);
    }

    const authenticatedUrl = this.#getAuthenticatedUrl(asset.href, this.#config);
    const image = await loadTextureData(authenticatedUrl, {cache: this.#cache});
    return {
      datetime: stacItem.properties['datetime'],
      referenceDatetime: stacItem.properties['forecast:reference_datetime']!,
      horizon: stacItem.properties['forecast:horizon']!,
      image,
    };
  }

  async #loadDatasetDataStacItemDataNow(dataset: string, config: ClientConfig = {}): Promise<StacItemData> {
    const stacCollection = await this.#loadDatasetStacCollection(dataset, config);
    const link = stacCollection.links.find(x => x.rel === StacLinkRel.ITEM && x.datetime === NOW_DATETIME);
    if (!link) {
      throw new Error('STAC Collection now item link not found');
    }

    const authenticatedUrl = this.#getAuthenticatedUrl(link.href, this.#config);
    const stacItem = await loadJson(authenticatedUrl, {cache: this.#cache}) as StacItem;

    return await this.#loadStacItemData(stacItem, config);
  }

  async #loadDatasetDataStacItemData(dataset: string, datetime: DatetimeISOString, config: ClientConfig = {}): Promise<StacItemData> {
    const stacItem = await this.#loadDatasetDataStacItem(dataset, datetime);
    return await this.#loadStacItemData(stacItem, config);
  }

  async loadCatalog(config: ClientConfig = {}): Promise<string[]> {
    const stacCollections = await this.#loadDatasetStacCollections(config);
    const datasetIds = stacCollections.map(stacCollection => stacCollection.id);
    return datasetIds;
  }

  async loadDataset(dataset: string, config: ClientConfig = {}): Promise<Dataset> {
    const stacCollection = await this.#loadDatasetStacCollection(dataset, config);

    const unitSystem = config.unitSystem ?? this.#config.unitSystem ?? DEFAULT_UNIT_SYSTEM;
    const attributionLinkClass = config.attributionLinkClass ?? this.#config.attributionLinkClass ?? DEFAULT_ATTRIBUTION_LINK_CLASS;

    return {
      title: stacCollection.title,
      unitFormat: getStacCollectionUnitFormat(stacCollection, unitSystem),
      attribution: getStacCollectionAttribution(stacCollection, attributionLinkClass),
      datetimeRange: stacCollection.extent.temporal.interval[0],
      datetimes: stacCollection.links.filter(x => x.rel === StacLinkRel.ITEM).map(x => x.datetime).filter(x => !!x) as DatetimeISOString[],
      palette: await this.#loadDatasetStacCollectionPalette(dataset),
    };
  }

  async loadDatasetSlice(dataset: string, datetimeRange: DatetimeISOStringRange, config: ClientConfig = {}): Promise<DatasetSlice> {
    const datetimeStep = config.datetimeStep ?? this.#config.datetimeStep ?? 1;
    const stacItems = await this.#searchDatasetDataStacItems(dataset, datetimeRange, datetimeStep, config);
    const datetimes = stacItems.map(x => x.properties.datetime);

    return {datetimes};
  }

  async loadDatasetData(dataset: string, datetime?: DatetimeISOString, config: ClientConfig = {}): Promise<DatasetData> {
    const datetimeStep = config.datetimeStep ?? this.#config.datetimeStep ?? 1;
    const datetimeInterpolate = config.datetimeInterpolate ?? this.#config.datetimeInterpolate ?? false;
    const stacCollection = await this.#loadDatasetStacCollection(dataset, config);

    if (!datetime) {
      const data = await this.#loadDatasetDataStacItemDataNow(dataset, config);

      return {
        datetime: data.datetime,
        referenceDatetime: data.referenceDatetime,
        horizon: data.horizon,
        image: data.image,
        datetime2: null,
        referenceDatetime2: null,
        horizon2: null,
        image2: null,
        imageWeight: 0,
        imageType: stacCollection['weatherLayers:imageType']!,
        imageUnscale: data.image.data instanceof Uint8Array || data.image.data instanceof Uint8ClampedArray ? stacCollection['weatherLayers:imageUnscale']! : null,
        bounds: stacCollection.extent.spatial.bbox[0],
      };
    }

    let stacItems = this.#datasetDataStacItemCache.has(dataset) ? Array.from(this.#datasetDataStacItemCache.get(dataset)!.values()) : [];
    let datetimes = stacItems.map(x => x.properties.datetime).sort();
    if (!datetimes.length || datetimes[0] > datetime || datetimes[datetimes.length - 1] < datetime) {
      stacItems = await this.#searchDatasetDataStacItems(dataset, [datetime, datetime], datetimeStep, config);
      datetimes = stacItems.map(x => x.properties.datetime).sort();
    }
    if (!datetimes.length) {
      throw new Error(`STAC Item ${dataset}/${datetime} not found`);
    }
    const closestStartDatetime = getClosestStartDatetime(datetimes, datetime);
    const closestEndDatetime = getClosestEndDatetime(datetimes, datetime);

    // FIXME: calling `loadDatasetData` with start, end and middle datetime, without calling `loadDatasetSlice`, returns interpolation between start and end datetimes
    // it should return middle datetime
    let startDatetime, endDatetime;
    if (datetimeInterpolate && closestStartDatetime && closestEndDatetime && closestStartDatetime !== closestEndDatetime) {
      startDatetime = closestStartDatetime;
      endDatetime = closestEndDatetime;
    } else if (closestStartDatetime) {
      startDatetime = closestStartDatetime;
      endDatetime = null;
    } else {
      throw new Error(`STAC Item ${dataset}/${datetime} not found`);
    }

    const [data, data2] = await Promise.all([
      this.#loadDatasetDataStacItemData(dataset, startDatetime, config),
      datetimeInterpolate && endDatetime ? this.#loadDatasetDataStacItemData(dataset, endDatetime, config) : null,
    ]);

    return {
      datetime: data.datetime,
      referenceDatetime: data.referenceDatetime,
      horizon: data.horizon,
      image: data.image,
      datetime2: data2 ? data2.datetime : null,
      referenceDatetime2: data2 ? data2.referenceDatetime : null,
      horizon2: data2 ? data2.horizon : null,
      image2: data2 ? data2.image : null,
      imageWeight: data2 ? getDatetimeWeight(data.datetime, data2.datetime, datetime) : 0,
      imageType: stacCollection['weatherLayers:imageType']!,
      imageUnscale: data.image.data instanceof Uint8Array || data.image.data instanceof Uint8ClampedArray ? stacCollection['weatherLayers:imageUnscale']! : null,
      bounds: stacCollection.extent.spatial.bbox[0],
    };
  }
}