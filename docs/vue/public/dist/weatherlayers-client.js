/*!
 * Copyright (c) 2021-2025 WeatherLayers.com
 *
 * WeatherLayers Cloud Client 2025.8.0
 *
 * A valid access token is required to use the library. Contact support@weatherlayers.com for details.
 *
 * Homepage - https://weatherlayers.com/
 * Demo - https://demo.weatherlayers.com/
 * Docs - https://docs.weatherlayers.com/
 * WeatherLayers Cloud Terms of Use - https://weatherlayers.com/terms-of-use.html
 */

export { colorRampCanvas, parsePalette } from 'cpt2js';

// TODO: fix Rollup build config to use TS instead of JS
const VERSION = "2025.8.0";
const DATETIME = "2025-09-15T08:34:52.651Z";
const CATALOG_URL = "https://catalog.weatherlayers.com";

const libraries = new Map();
function setLibrary(name, library) {
    libraries.set(name, library);
}
async function getLibrary(name) {
    if (libraries.has(name)) {
        return libraries.get(name);
    }
    try {
        switch (name) {
            case 'geotiff': return await import('geotiff');
        }
    }
    catch (e) {
        throw new Error(`Optional dependency '${name}' is missing, install it with a package manager or provide with \`setLibrary('${name}', library)\``, { cause: e });
    }
}

class Queue {
    constructor() {
        this.queue = Promise.resolve();
    }
    async run(operation) {
        const currentQueue = this.queue;
        let resolveQueue;
        this.queue = new Promise(resolve => {
            resolveQueue = resolve;
        });
        try {
            await currentQueue;
            return await operation();
        }
        finally {
            resolveQueue();
        }
    }
}

const DEFAULT_CACHE = new Map();
function maskData(data, nodata) {
    if (nodata == undefined) {
        return data;
    }
    // sea_ice_fraction:
    // - real nodata: 1.27999997138977
    // - meta nodata: 1.27999997138977095, parsed in JS as 1.279999971389771
    const maskedData = data.slice(0);
    for (let i = 0; i < maskedData.length; i++) {
        if (Math.abs(maskedData[i] - nodata) < Number.EPSILON * 2) {
            maskedData[i] = NaN;
        }
    }
    return maskedData;
}
const imageDecodeQueue = new Queue();
async function loadImage(url, options) {
    // if custom headers are provided, load the url as blob
    let blobUrl;
    if (options?.headers || options?.signal) {
        const response = await fetch(url, { headers: options.headers, signal: options.signal });
        if (!response.ok) {
            throw new Error(`URL ${url} can't be loaded. Status: ${response.status}`);
        }
        const blob = await response.blob();
        blobUrl = URL.createObjectURL(blob);
    }
    // otherwise, load the url as image, to allow for a lower CSP policy
    const image = new Image();
    try {
        await new Promise((resolve, reject) => {
            image.addEventListener('load', resolve);
            image.addEventListener('error', reject);
            image.crossOrigin = 'anonymous';
            image.src = blobUrl ?? url;
        });
    }
    catch (e) {
        throw new Error(`URL ${url} can't be loaded.`, { cause: e });
    }
    finally {
        if (blobUrl) {
            URL.revokeObjectURL(blobUrl);
        }
    }
    // decode images in a global queue to ensure only a single decode runs at a time
    // fixes "Image can't be decoded" error by avoiding multiple parallel decodes to hit a memory limit
    // see https://issues.chromium.org/issues/40676514
    try {
        await imageDecodeQueue.run(() => image.decode());
    }
    catch (e) {
        throw new Error(`Image ${url} can't be decoded.`, { cause: e });
    }
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = imageData;
    const textureData = { data, width, height };
    return textureData;
}
async function loadGeotiff(url, options) {
    const GeoTIFF = await getLibrary('geotiff');
    let geotiff;
    try {
        geotiff = await GeoTIFF.fromUrl(url, {
            allowFullFile: true,
            blockSize: Number.MAX_SAFE_INTEGER, // larger blockSize helps with errors, see https://github.com/geotiffjs/geotiff/issues/218
            fetch: (url, init) => fetch(url, { ...init, headers: { ...init?.headers, ...options?.headers } }),
        }, options?.signal);
    }
    catch (e) {
        throw new Error(`Image ${url} can't be decoded.`, { cause: e });
    }
    const geotiffImage = await geotiff.getImage(0);
    const sourceData = await geotiffImage.readRasters({ interleave: true, signal: options?.signal });
    if (!(sourceData instanceof Uint8Array || sourceData instanceof Uint8ClampedArray || sourceData instanceof Float32Array)) {
        throw new Error('Unsupported data format');
    }
    const nodata = geotiffImage.getGDALNoData();
    const data = maskData(sourceData, nodata);
    const width = geotiffImage.getWidth();
    const height = geotiffImage.getHeight();
    const textureData = { data, width, height };
    return textureData;
}
function loadCached(loadFunction) {
    return async (url, options) => {
        if (options?.cache === false) {
            return loadFunction(url);
        }
        const cache = options?.cache ?? DEFAULT_CACHE;
        const cacheKey = url + (options?.headers ? ':' + JSON.stringify(options?.headers) : '');
        const dataOrPromise = cache.get(cacheKey);
        if (dataOrPromise) {
            return dataOrPromise;
        }
        const optionsWithoutCache = { ...options, cache: undefined };
        const dataPromise = loadFunction(url, optionsWithoutCache);
        cache.set(cacheKey, dataPromise);
        dataPromise.then(data => {
            cache.set(cacheKey, data);
        });
        return dataPromise;
    };
}
const loadTextureData = loadCached(async (url, options) => {
    if (url.includes('.png') || url.includes('.webp') || url.includes('image/png') || url.includes('image/webp')) {
        return loadImage(url, options);
    }
    else if (url.includes('.tif') || url.includes('image/tif')) {
        return loadGeotiff(url, options);
    }
    else {
        throw new Error('Unsupported data format');
    }
});
const loadJson = loadCached(async (url, options) => {
    const response = await fetch(url, { headers: options?.headers });
    if (!response.ok) {
        throw new Error(`URL ${url} can't be loaded. Status: ${response.status}`);
    }
    return response.json();
});

function interpolateDatetime(start, end, weight) {
    if (!end) {
        if (weight === 0) {
            return start;
        }
        else {
            throw new Error('Invalid state');
        }
    }
    if (weight <= 0) {
        return start;
    }
    else if (weight >= 1) {
        return end;
    }
    else {
        const startDate = new Date(start);
        const endDate = new Date(end);
        const date = new Date(startDate.getTime() + (endDate.getTime() - startDate.getTime()) * weight);
        return date.toISOString();
    }
}
function getDatetimeWeight(start, end, middle) {
    if (!end) {
        if (start === middle) {
            return 0;
        }
        else {
            throw new Error('Invalid state');
        }
    }
    if (middle <= start) {
        return 0;
    }
    else if (middle >= end) {
        return 1;
    }
    else {
        const startDate = new Date(start);
        const endDate = new Date(end);
        const middleDate = new Date(middle);
        const ratio = (middleDate.getTime() - startDate.getTime()) / (endDate.getTime() - startDate.getTime());
        return ratio;
    }
}
function getClosestStartDatetime(datetimes, datetime) {
    const closestDatetime = [...datetimes].reverse().find(x => x <= datetime);
    return closestDatetime;
}
function getClosestEndDatetime(datetimes, datetime) {
    const closestDatetime = datetimes.find(x => x >= datetime);
    return closestDatetime;
}
function offsetDatetime(datetime, hour) {
    const datetimeDate = new Date(datetime);
    const updatedDatetimeDate = new Date(datetimeDate.getTime() + hour * 1000 * 60 * 60);
    return updatedDatetimeDate.toISOString();
}
function offsetDatetimeRange(datetime, startHour, endHour) {
    return [offsetDatetime(datetime, startHour), offsetDatetime(datetime, endHour)];
}
function formatDatetime(value) {
    if (!value) {
        return value;
    }
    const date = new Date(value);
    if (!date.getDate()) {
        return value;
    }
    const year = date.getUTCFullYear();
    const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
    const day = `${date.getUTCDate()}`.padStart(2, '0');
    const hour = `${date.getUTCHours()}`.padStart(2, '0');
    const minute = `${date.getUTCMinutes()}`.padStart(2, '0');
    const formattedValue = `${year}/${month}/${day} ${hour}:${minute}\xa0UTC`;
    return formattedValue;
}

const ImageType = {
    SCALAR: 'SCALAR',
    VECTOR: 'VECTOR',
};

const UnitSystem = {
    METRIC: 'METRIC',
    METRIC_KILOMETERS: 'METRIC_KILOMETERS',
    IMPERIAL: 'IMPERIAL',
    NAUTICAL: 'NAUTICAL',
};

const StacProviderRole = {
    PRODUCER: 'producer',
    PROCESSOR: 'processor'};
const StacLinkRel = {
    ITEM: 'item',
    DATA: 'data',
    SEARCH: 'search',
};
const StacAssetRole = {
    PALETTE: 'palette',
};

const DEFAULT_URL = CATALOG_URL;
const DEFAULT_DATA_FORMAT = 'byte.webp';
const DEFAULT_UNIT_SYSTEM = UnitSystem.METRIC;
const DEFAULT_ATTRIBUTION_LINK_CLASS = '';
const NOW_DATETIME = '!now';
function getStacCollectionAttribution(stacCollection, attributionLinkClass) {
    const producer = stacCollection.providers.find(x => x.roles.includes(StacProviderRole.PRODUCER));
    const processor = stacCollection.providers.find(x => x.roles.includes(StacProviderRole.PROCESSOR));
    const attribution = [
        ...(producer ? [`<a href="${producer.url}"${attributionLinkClass ? ` class="${attributionLinkClass}"` : ''}>${producer.name}</a>`] : []),
        ...(processor ? [`<a href="${processor.url}"${attributionLinkClass ? ` class="${attributionLinkClass}"` : ''}>${processor.name}</a>`] : []),
    ].join(' via ');
    return attribution;
}
function getStacCollectionUnitFormat(stacCollection, unitSystem) {
    const units = stacCollection['weatherLayers:units'];
    const unitDefinition = units.find(unitFormat => unitFormat.system === unitSystem) ?? units.find(unitFormat => unitFormat.system === DEFAULT_UNIT_SYSTEM) ?? units[0];
    const { unit, scale, offset, decimals } = unitDefinition;
    return { unit, scale, offset, decimals };
}
function serializeDatetimeISOStringRange(datetimeRange) {
    if (Array.isArray(datetimeRange) && datetimeRange.length === 2) {
        const [start, end] = datetimeRange;
        return `${start ?? '..'}/${end ?? '..'}`;
    }
    else {
        throw new Error('Invalid datetime range');
    }
}
class Client {
    constructor(config) {
        this._cache = new Map();
        this._datasetStacCollectionCache = new Map();
        this._datasetDataStacItemCache = new Map();
        this._config = config;
    }
    getConfig() {
        return { ...this._config };
    }
    setConfig(config) {
        this._config = config;
    }
    updateConfig(config) {
        this.setConfig({ ...this._config, ...config });
    }
    _getAuthenticatedUrl(path, config = {}) {
        const accessToken = config.accessToken ?? this._config.accessToken ?? null;
        const url = new URL(path);
        if (!url.searchParams.has('access_token') && accessToken != null) {
            url.searchParams.set('access_token', accessToken);
        }
        if (!url.searchParams.has('version')) {
            url.searchParams.set('version', VERSION);
        }
        return url.toString();
    }
    _cacheDatasetStacCollection(stacCollection) {
        this._datasetStacCollectionCache.set(stacCollection.id, stacCollection);
    }
    _cacheDatasetDataStacItem(dataset, stacItem) {
        if (!this._datasetDataStacItemCache.has(dataset)) {
            this._datasetDataStacItemCache.set(dataset, new Map());
        }
        this._datasetDataStacItemCache.get(dataset).set(stacItem.properties.datetime, stacItem);
    }
    async _loadStacCatalog(config = {}) {
        const url = config.url ?? this._config.url ?? DEFAULT_URL;
        const authenticatedUrl = this._getAuthenticatedUrl(`${url}/catalog`, config);
        const stacCatalog = await loadJson(authenticatedUrl, { cache: this._cache });
        return stacCatalog;
    }
    async _loadDatasetStacCollections(config = {}) {
        const stacCatalog = await this._loadStacCatalog(config);
        const link = stacCatalog.links.find(x => x.rel === StacLinkRel.DATA);
        if (!link) {
            throw new Error('STAC Catalog data link not found');
        }
        const authenticatedUrl = this._getAuthenticatedUrl(link.href, config);
        const stacCollections = (await loadJson(authenticatedUrl, { cache: this._cache })).collections;
        // cache
        for (const stacCollection of stacCollections) {
            this._cacheDatasetStacCollection(stacCollection);
        }
        return stacCollections;
    }
    async _loadDatasetStacCollection(dataset, config = {}) {
        await this._loadDatasetStacCollections(config);
        let stacCollection = this._datasetStacCollectionCache.get(dataset);
        if (!stacCollection) {
            throw new Error(`STAC Collection ${dataset} not found`);
        }
        // cache
        this._cacheDatasetStacCollection(stacCollection);
        return stacCollection;
    }
    async _loadDatasetStacCollectionPalette(dataset, config = {}) {
        const stacCollection = await this._loadDatasetStacCollection(dataset, config);
        const asset = Object.values(stacCollection.assets ?? {}).find(x => x.roles.includes(StacAssetRole.PALETTE) && x.type === 'application/json');
        if (!asset) {
            throw new Error(`STAC Collection ${dataset} palette asset not found`);
        }
        const authenticatedUrl = this._getAuthenticatedUrl(asset.href, this._config);
        const palette = await loadJson(authenticatedUrl, { cache: this._cache });
        return palette;
    }
    async _searchDatasetDataStacItems(dataset, datetimeRange, datetimeStep, config = {}) {
        const stacCatalog = await this._loadStacCatalog(config);
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
        const authenticatedUrl = this._getAuthenticatedUrl(url.toString(), config);
        const stacItems = (await loadJson(authenticatedUrl, { cache: this._cache })).features;
        // cache
        for (const stacItem of stacItems) {
            this._cacheDatasetDataStacItem(dataset, stacItem);
        }
        return stacItems;
    }
    async _loadDatasetDataStacItem(dataset, datetime, config = {}) {
        const datetimeStep = config.datetimeStep ?? this._config.datetimeStep ?? 1;
        let stacItem = this._datasetDataStacItemCache.get(dataset)?.get(datetime);
        if (!stacItem) {
            const stacItems = await this._searchDatasetDataStacItems(dataset, [datetime, datetime], datetimeStep, config);
            stacItem = stacItems[0];
        }
        if (!stacItem) {
            throw new Error(`STAC Item ${dataset}/${datetime} not found`);
        }
        return stacItem;
    }
    async _loadStacItemData(stacItem, config = {}) {
        const dataFormat = config.dataFormat ?? this._config.dataFormat ?? DEFAULT_DATA_FORMAT;
        const asset = stacItem.assets[`data.${dataFormat}`];
        if (!asset) {
            throw new Error(`STAC Item data asset not found`);
        }
        const authenticatedUrl = this._getAuthenticatedUrl(asset.href, this._config);
        const image = await loadTextureData(authenticatedUrl, { cache: this._cache, signal: config.signal });
        return {
            datetime: stacItem.properties['datetime'],
            referenceDatetime: stacItem.properties['forecast:reference_datetime'],
            horizon: stacItem.properties['forecast:horizon'],
            image,
        };
    }
    async _loadDatasetDataStacItemDataNow(dataset, config = {}) {
        const stacCollection = await this._loadDatasetStacCollection(dataset, config);
        const link = stacCollection.links.find(x => x.rel === StacLinkRel.ITEM && x.datetime === NOW_DATETIME);
        if (!link) {
            throw new Error('STAC Collection now item link not found');
        }
        const authenticatedUrl = this._getAuthenticatedUrl(link.href, this._config);
        const stacItem = await loadJson(authenticatedUrl, { cache: this._cache });
        return await this._loadStacItemData(stacItem, config);
    }
    async _loadDatasetDataStacItemData(dataset, datetime, config = {}) {
        const stacItem = await this._loadDatasetDataStacItem(dataset, datetime);
        return await this._loadStacItemData(stacItem, config);
    }
    async loadCatalog(config = {}) {
        const stacCollections = await this._loadDatasetStacCollections(config);
        const datasetIds = stacCollections.map(stacCollection => stacCollection.id);
        return datasetIds;
    }
    async loadDataset(dataset, config = {}) {
        const stacCollection = await this._loadDatasetStacCollection(dataset, config);
        const unitSystem = config.unitSystem ?? this._config.unitSystem ?? DEFAULT_UNIT_SYSTEM;
        const attributionLinkClass = config.attributionLinkClass ?? this._config.attributionLinkClass ?? DEFAULT_ATTRIBUTION_LINK_CLASS;
        return {
            title: stacCollection.title,
            unitFormat: getStacCollectionUnitFormat(stacCollection, unitSystem),
            attribution: getStacCollectionAttribution(stacCollection, attributionLinkClass),
            bounds: stacCollection.extent.spatial.bbox[0],
            datetimeRange: stacCollection.extent.temporal.interval[0],
            datetimes: stacCollection.links.filter(x => x.rel === StacLinkRel.ITEM).map(x => x.datetime).filter(x => !!x),
            palette: await this._loadDatasetStacCollectionPalette(dataset),
        };
    }
    async loadDatasetSlice(dataset, datetimeRange, config = {}) {
        const datetimeStep = config.datetimeStep ?? this._config.datetimeStep ?? 1;
        const stacItems = await this._searchDatasetDataStacItems(dataset, datetimeRange, datetimeStep, config);
        const datetimes = stacItems.map(x => x.properties.datetime);
        return { datetimes };
    }
    async loadDatasetData(dataset, datetime, config = {}) {
        const datetimeStep = config.datetimeStep ?? this._config.datetimeStep ?? 1;
        const datetimeInterpolate = config.datetimeInterpolate ?? this._config.datetimeInterpolate ?? false;
        const stacCollection = await this._loadDatasetStacCollection(dataset, config);
        if (!datetime) {
            const data = await this._loadDatasetDataStacItemDataNow(dataset, config);
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
                imageType: stacCollection['weatherLayers:imageType'],
                imageUnscale: data.image.data instanceof Uint8Array || data.image.data instanceof Uint8ClampedArray ? stacCollection['weatherLayers:imageUnscale'] : null,
                bounds: stacCollection.extent.spatial.bbox[0],
            };
        }
        let stacItems = this._datasetDataStacItemCache.has(dataset) ? Array.from(this._datasetDataStacItemCache.get(dataset).values()) : [];
        let datetimes = stacItems.map(x => x.properties.datetime).sort();
        if (!datetimes.length || datetimes[0] > datetime || datetimes[datetimes.length - 1] < datetime) {
            stacItems = await this._searchDatasetDataStacItems(dataset, [datetime, datetime], datetimeStep, config);
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
        }
        else if (closestStartDatetime) {
            startDatetime = closestStartDatetime;
            endDatetime = null;
        }
        else {
            throw new Error(`STAC Item ${dataset}/${datetime} not found`);
        }
        const [data, data2] = await Promise.all([
            this._loadDatasetDataStacItemData(dataset, startDatetime, config),
            datetimeInterpolate && endDatetime ? this._loadDatasetDataStacItemData(dataset, endDatetime, config) : null,
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
            imageType: stacCollection['weatherLayers:imageType'],
            imageUnscale: data.image.data instanceof Uint8Array || data.image.data instanceof Uint8ClampedArray ? stacCollection['weatherLayers:imageUnscale'] : null,
            bounds: stacCollection.extent.spatial.bbox[0],
        };
    }
}

export { Client, DATETIME, ImageType, UnitSystem, VERSION, formatDatetime, getClosestEndDatetime, getClosestStartDatetime, getDatetimeWeight, interpolateDatetime, loadJson, loadTextureData, offsetDatetime, offsetDatetimeRange, setLibrary };
