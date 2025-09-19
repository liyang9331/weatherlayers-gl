/*!
 * Copyright (c) 2021-2025 WeatherLayers.com
 *
 * WeatherLayers GL 2025.8.0
 *
 * Package and source code is dual-licensed, the choice of license is MPL-2.0 or our License Terms of Use. Contact support@weatherlayers.com for details.
 *
 * Homepage - https://weatherlayers.com/
 * Demo - https://demo.weatherlayers.com/
 * Docs - https://docs.weatherlayers.com/
 * WeatherLayers GL License Terms of Use - https://weatherlayers.com/license-terms-of-use.html
 */

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('@deck.gl/core'), require('@deck.gl/layers'), require('@deck.gl/extensions'), require('@luma.gl/engine')) :
  typeof define === 'function' && define.amd ? define(['exports', '@deck.gl/core', '@deck.gl/layers', '@deck.gl/extensions', '@luma.gl/engine'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.WeatherLayers = {}, global.deck, global.deck, global.deck, global.luma));
})(this, (function (exports, core, layers, extensions, engine) { 'use strict';

  // TODO: fix Rollup build config to use TS instead of JS
  const VERSION$1 = "2025.8.0";
  const DATETIME = "2025-09-15T08:34:52.655Z";

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

  // see https://developers.arcgis.com/javascript/latest/api-reference/esri-renderers-VectorFieldRenderer.html#flowRepresentation
  const DirectionType = {
      INWARD: 'INWARD',
      OUTWARD: 'OUTWARD',
  };

  const DirectionFormat = {
      VALUE: 'VALUE',
      CARDINAL: 'CARDINAL',
      CARDINAL2: 'CARDINAL2',
      CARDINAL3: 'CARDINAL3',
  };

  const CARDINALS = {
      [DirectionFormat.CARDINAL]: ['N', 'E', 'S', 'W'],
      [DirectionFormat.CARDINAL2]: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
      [DirectionFormat.CARDINAL3]: ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'],
  };
  function formatValue(value, unitFormat) {
      if (!unitFormat) {
          return `${Math.round(value)}`;
      }
      const { scale = 1, offset = 0, decimals = 0 } = unitFormat;
      const formattedValue = scale * value + offset;
      const roundedFormattedValue = decimals ? Math.round(formattedValue * 10 ** decimals) / 10 ** decimals : Math.round(formattedValue);
      return `${roundedFormattedValue}`;
  }
  function formatUnit(unitFormat) {
      const formattedUnit = unitFormat.unit.replace('^2', '²').replace('^3', '³');
      return formattedUnit;
  }
  function formatValueWithUnit(value, unitFormat) {
      const formattedValue = formatValue(value, unitFormat);
      const formattedUnit = formatUnit(unitFormat);
      return `${formattedValue}\xa0${formattedUnit}`;
  }
  function formatDirection(direction, directionType, directionFormat) {
      if (directionType === DirectionType.OUTWARD) {
          direction += 180;
      }
      if (directionFormat === DirectionFormat.VALUE) {
          return `${Math.round(direction % 360)}°`;
      }
      else if (directionFormat === DirectionFormat.CARDINAL || directionFormat === DirectionFormat.CARDINAL2 || directionFormat === DirectionFormat.CARDINAL3) {
          const cardinals = CARDINALS[directionFormat];
          const cardinalDelta = 360 / cardinals.length;
          const index = Math.floor(((direction % 360) + (cardinalDelta / 2)) / cardinalDelta) % cardinals.length;
          return cardinals[index];
      }
      else {
          throw new Error('Invalid state');
      }
  }

  const DEFAULT_LINE_WIDTH = 1;
  const DEFAULT_LINE_COLOR = [255, 255, 255];
  const DEFAULT_TEXT_FONT_FAMILY = '"Helvetica Neue", Arial, Helvetica, sans-serif';
  const DEFAULT_TEXT_SIZE = 12;
  const DEFAULT_TEXT_COLOR = [255, 255, 255];
  const DEFAULT_TEXT_OUTLINE_WIDTH = 1;
  const DEFAULT_TEXT_OUTLINE_COLOR = [13, 13, 13];
  const DEFAULT_TEXT_FORMAT_FUNCTION = formatValue;
  const DEFAULT_ICON_SIZE$1 = 40;
  const DEFAULT_ICON_COLOR = [255, 255, 255];
  // prefer default values over provided undefined values
  // see https://github.com/visgl/deck.gl/blob/24dd30dbf32e10a40df9c57f1a5e85923f1ce785/modules/core/src/lifecycle/create-props.ts#L50
  // TODO: report deck.gl bug
  function ensureDefaultProps(props, defaultProps) {
      const propsInstance = {};
      for (const key in props) {
          if (props[key] === undefined && key in defaultProps) {
              const defaultProp = defaultProps[key];
              if (defaultProp) {
                  if ('value' in defaultProp) {
                      if (defaultProp.value) {
                          propsInstance[key] = defaultProp.value;
                      }
                  }
                  else {
                      propsInstance[key] = defaultProp;
                  }
              }
          }
      }
      return Object.freeze({ ...props, ...propsInstance });
  }

  const DEFAULT_FPS = 30;
  class Animation {
      constructor(config) {
          this._running = false;
          this._raf = undefined;
          this._lastFrameTime = 0;
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
      get running() {
          return this._running;
      }
      toggle(running = !this._running) {
          if (running) {
              this.start();
          }
          else {
              this.stop();
          }
      }
      start() {
          if (this._running) {
              return;
          }
          this._running = true;
          this._raf = window.requestAnimationFrame(() => this.step());
      }
      stop() {
          if (!this._running) {
              return;
          }
          this._running = false;
          if (this._raf) {
              window.cancelAnimationFrame(this._raf);
              this._raf = undefined;
          }
      }
      step() {
          const fps = this._config.fps ?? DEFAULT_FPS;
          const fpsInterval = 1000 / fps;
          const now = Date.now();
          const elapsed = now - this._lastFrameTime;
          if (elapsed > fpsInterval) {
              this._lastFrameTime = now - (elapsed % fpsInterval);
              this._config.onUpdate();
          }
          if (this._running) {
              this._raf = window.requestAnimationFrame(() => this.step());
          }
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

  const ImageInterpolation = {
      NEAREST: 'NEAREST',
      LINEAR: 'LINEAR',
      CUBIC: 'CUBIC',
  };

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

  /*!
  * Copyright (c) 2022 WeatherLayers.com
  *
  * This Source Code Form is subject to the terms of the Mozilla Public
  * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/.
  */
  function getDefaultExportFromCjs(x) {
    return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
  }
  var limit;
  var hasRequiredLimit;
  function requireLimit() {
    if (hasRequiredLimit) return limit;
    hasRequiredLimit = 1;
    limit = (x, min = 0, max = 1) => {
      return x < min ? min : x > max ? max : x;
    };
    return limit;
  }
  var clip_rgb;
  var hasRequiredClip_rgb;
  function requireClip_rgb() {
    if (hasRequiredClip_rgb) return clip_rgb;
    hasRequiredClip_rgb = 1;
    const limit = requireLimit();
    clip_rgb = rgb => {
      rgb._clipped = false;
      rgb._unclipped = rgb.slice(0);
      for (let i = 0; i <= 3; i++) {
        if (i < 3) {
          if (rgb[i] < 0 || rgb[i] > 255) rgb._clipped = true;
          rgb[i] = limit(rgb[i], 0, 255);
        } else if (i === 3) {
          rgb[i] = limit(rgb[i], 0, 1);
        }
      }
      return rgb;
    };
    return clip_rgb;
  }
  var type;
  var hasRequiredType;
  function requireType() {
    if (hasRequiredType) return type;
    hasRequiredType = 1;
    // ported from jQuery's $.type
    const classToType = {};
    for (let name of ['Boolean', 'Number', 'String', 'Function', 'Array', 'Date', 'RegExp', 'Undefined', 'Null']) {
      classToType[`[object ${name}]`] = name.toLowerCase();
    }
    type = function (obj) {
      return classToType[Object.prototype.toString.call(obj)] || "object";
    };
    return type;
  }
  var unpack;
  var hasRequiredUnpack;
  function requireUnpack() {
    if (hasRequiredUnpack) return unpack;
    hasRequiredUnpack = 1;
    const type = requireType();
    unpack = (args, keyOrder = null) => {
      // if called with more than 3 arguments, we return the arguments
      if (args.length >= 3) return Array.prototype.slice.call(args);
      // with less than 3 args we check if first arg is object
      // and use the keyOrder string to extract and sort properties
      if (type(args[0]) == 'object' && keyOrder) {
        return keyOrder.split('').filter(k => args[0][k] !== undefined).map(k => args[0][k]);
      }
      // otherwise we just return the first argument
      // (which we suppose is an array of args)
      return args[0];
    };
    return unpack;
  }
  var last;
  var hasRequiredLast;
  function requireLast() {
    if (hasRequiredLast) return last;
    hasRequiredLast = 1;
    const type = requireType();
    last = args => {
      if (args.length < 2) return null;
      const l = args.length - 1;
      if (type(args[l]) == 'string') return args[l].toLowerCase();
      return null;
    };
    return last;
  }
  var utils;
  var hasRequiredUtils;
  function requireUtils() {
    if (hasRequiredUtils) return utils;
    hasRequiredUtils = 1;
    const PI = Math.PI;
    utils = {
      clip_rgb: requireClip_rgb(),
      limit: requireLimit(),
      type: requireType(),
      unpack: requireUnpack(),
      last: requireLast(),
      PI: PI,
      TWOPI: PI * 2,
      PITHIRD: PI / 3,
      DEG2RAD: PI / 180,
      RAD2DEG: 180 / PI
    };
    return utils;
  }
  var input;
  var hasRequiredInput;
  function requireInput() {
    if (hasRequiredInput) return input;
    hasRequiredInput = 1;
    input = {
      format: {},
      autodetect: []
    };
    return input;
  }
  var Color_1;
  var hasRequiredColor;
  function requireColor() {
    if (hasRequiredColor) return Color_1;
    hasRequiredColor = 1;
    const {
      last,
      clip_rgb,
      type
    } = requireUtils();
    const _input = requireInput();
    class Color {
      constructor(...args) {
        const me = this;
        if (type(args[0]) === 'object' && args[0].constructor && args[0].constructor === this.constructor) {
          // the argument is already a Color instance
          return args[0];
        }

        // last argument could be the mode
        let mode = last(args);
        let autodetect = false;
        if (!mode) {
          autodetect = true;
          if (!_input.sorted) {
            _input.autodetect = _input.autodetect.sort((a, b) => b.p - a.p);
            _input.sorted = true;
          }
          // auto-detect format
          for (let chk of _input.autodetect) {
            mode = chk.test(...args);
            if (mode) break;
          }
        }
        if (_input.format[mode]) {
          const rgb = _input.format[mode].apply(null, autodetect ? args : args.slice(0, -1));
          me._rgb = clip_rgb(rgb);
        } else {
          throw new Error('unknown format: ' + args);
        }

        // add alpha channel
        if (me._rgb.length === 3) me._rgb.push(1);
      }
      toString() {
        if (type(this.hex) == 'function') return this.hex();
        return `[${this._rgb.join(',')}]`;
      }
    }
    Color_1 = Color;
    return Color_1;
  }
  var chroma_1;
  var hasRequiredChroma;
  function requireChroma() {
    if (hasRequiredChroma) return chroma_1;
    hasRequiredChroma = 1;
    const chroma = (...args) => {
      return new chroma.Color(...args);
    };
    chroma.Color = requireColor();
    chroma.version = '@@version';
    chroma_1 = chroma;
    return chroma_1;
  }
  var chromaExports = requireChroma();
  var chroma = /*@__PURE__*/getDefaultExportFromCjs(chromaExports);
  var css = {};
  var hsl2css_1;
  var hasRequiredHsl2css;
  function requireHsl2css() {
    if (hasRequiredHsl2css) return hsl2css_1;
    hasRequiredHsl2css = 1;
    const {
      unpack,
      last
    } = requireUtils();
    const rnd = a => Math.round(a * 100) / 100;

    /*
     * supported arguments:
     * - hsl2css(h,s,l)
     * - hsl2css(h,s,l,a)
     * - hsl2css([h,s,l], mode)
     * - hsl2css([h,s,l,a], mode)
     * - hsl2css({h,s,l,a}, mode)
     */
    const hsl2css = (...args) => {
      const hsla = unpack(args, 'hsla');
      let mode = last(args) || 'lsa';
      hsla[0] = rnd(hsla[0] || 0);
      hsla[1] = rnd(hsla[1] * 100) + '%';
      hsla[2] = rnd(hsla[2] * 100) + '%';
      if (mode === 'hsla' || hsla.length > 3 && hsla[3] < 1) {
        hsla[3] = hsla.length > 3 ? hsla[3] : 1;
        mode = 'hsla';
      } else {
        hsla.length = 3;
      }
      return `${mode}(${hsla.join(',')})`;
    };
    hsl2css_1 = hsl2css;
    return hsl2css_1;
  }
  var rgb2hsl_1;
  var hasRequiredRgb2hsl;
  function requireRgb2hsl() {
    if (hasRequiredRgb2hsl) return rgb2hsl_1;
    hasRequiredRgb2hsl = 1;
    const {
      unpack
    } = requireUtils();

    /*
     * supported arguments:
     * - rgb2hsl(r,g,b)
     * - rgb2hsl(r,g,b,a)
     * - rgb2hsl([r,g,b])
     * - rgb2hsl([r,g,b,a])
     * - rgb2hsl({r,g,b,a})
     */
    const rgb2hsl = (...args) => {
      args = unpack(args, 'rgba');
      let [r, g, b] = args;
      r /= 255;
      g /= 255;
      b /= 255;
      const min = Math.min(r, g, b);
      const max = Math.max(r, g, b);
      const l = (max + min) / 2;
      let s, h;
      if (max === min) {
        s = 0;
        h = Number.NaN;
      } else {
        s = l < 0.5 ? (max - min) / (max + min) : (max - min) / (2 - max - min);
      }
      if (r == max) h = (g - b) / (max - min);else if (g == max) h = 2 + (b - r) / (max - min);else if (b == max) h = 4 + (r - g) / (max - min);
      h *= 60;
      if (h < 0) h += 360;
      if (args.length > 3 && args[3] !== undefined) return [h, s, l, args[3]];
      return [h, s, l];
    };
    rgb2hsl_1 = rgb2hsl;
    return rgb2hsl_1;
  }
  var rgb2css_1;
  var hasRequiredRgb2css;
  function requireRgb2css() {
    if (hasRequiredRgb2css) return rgb2css_1;
    hasRequiredRgb2css = 1;
    const {
      unpack,
      last
    } = requireUtils();
    const hsl2css = requireHsl2css();
    const rgb2hsl = requireRgb2hsl();
    const {
      round
    } = Math;

    /*
     * supported arguments:
     * - rgb2css(r,g,b)
     * - rgb2css(r,g,b,a)
     * - rgb2css([r,g,b], mode)
     * - rgb2css([r,g,b,a], mode)
     * - rgb2css({r,g,b,a}, mode)
     */
    const rgb2css = (...args) => {
      const rgba = unpack(args, 'rgba');
      let mode = last(args) || 'rgb';
      if (mode.substr(0, 3) == 'hsl') {
        return hsl2css(rgb2hsl(rgba), mode);
      }
      rgba[0] = round(rgba[0]);
      rgba[1] = round(rgba[1]);
      rgba[2] = round(rgba[2]);
      if (mode === 'rgba' || rgba.length > 3 && rgba[3] < 1) {
        rgba[3] = rgba.length > 3 ? rgba[3] : 1;
        mode = 'rgba';
      }
      return `${mode}(${rgba.slice(0, mode === 'rgb' ? 3 : 4).join(',')})`;
    };
    rgb2css_1 = rgb2css;
    return rgb2css_1;
  }
  var hsl2rgb_1;
  var hasRequiredHsl2rgb;
  function requireHsl2rgb() {
    if (hasRequiredHsl2rgb) return hsl2rgb_1;
    hasRequiredHsl2rgb = 1;
    const {
      unpack
    } = requireUtils();
    const {
      round
    } = Math;
    const hsl2rgb = (...args) => {
      args = unpack(args, 'hsl');
      const [h, s, l] = args;
      let r, g, b;
      if (s === 0) {
        r = g = b = l * 255;
      } else {
        const t3 = [0, 0, 0];
        const c = [0, 0, 0];
        const t2 = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const t1 = 2 * l - t2;
        const h_ = h / 360;
        t3[0] = h_ + 1 / 3;
        t3[1] = h_;
        t3[2] = h_ - 1 / 3;
        for (let i = 0; i < 3; i++) {
          if (t3[i] < 0) t3[i] += 1;
          if (t3[i] > 1) t3[i] -= 1;
          if (6 * t3[i] < 1) c[i] = t1 + (t2 - t1) * 6 * t3[i];else if (2 * t3[i] < 1) c[i] = t2;else if (3 * t3[i] < 2) c[i] = t1 + (t2 - t1) * (2 / 3 - t3[i]) * 6;else c[i] = t1;
        }
        [r, g, b] = [round(c[0] * 255), round(c[1] * 255), round(c[2] * 255)];
      }
      if (args.length > 3) {
        // keep alpha channel
        return [r, g, b, args[3]];
      }
      return [r, g, b, 1];
    };
    hsl2rgb_1 = hsl2rgb;
    return hsl2rgb_1;
  }
  var css2rgb_1;
  var hasRequiredCss2rgb;
  function requireCss2rgb() {
    if (hasRequiredCss2rgb) return css2rgb_1;
    hasRequiredCss2rgb = 1;
    const hsl2rgb = requireHsl2rgb();
    const input = requireInput();
    const RE_RGB = /^rgb\(\s*(-?\d+),\s*(-?\d+)\s*,\s*(-?\d+)\s*\)$/;
    const RE_RGBA = /^rgba\(\s*(-?\d+),\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*([01]|[01]?\.\d+)\)$/;
    const RE_RGB_PCT = /^rgb\(\s*(-?\d+(?:\.\d+)?)%,\s*(-?\d+(?:\.\d+)?)%\s*,\s*(-?\d+(?:\.\d+)?)%\s*\)$/;
    const RE_RGBA_PCT = /^rgba\(\s*(-?\d+(?:\.\d+)?)%,\s*(-?\d+(?:\.\d+)?)%\s*,\s*(-?\d+(?:\.\d+)?)%\s*,\s*([01]|[01]?\.\d+)\)$/;
    const RE_HSL = /^hsl\(\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)%\s*,\s*(-?\d+(?:\.\d+)?)%\s*\)$/;
    const RE_HSLA = /^hsla\(\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)%\s*,\s*(-?\d+(?:\.\d+)?)%\s*,\s*([01]|[01]?\.\d+)\)$/;
    const {
      round
    } = Math;
    const css2rgb = css => {
      css = css.toLowerCase().trim();
      let m;
      if (input.format.named) {
        try {
          return input.format.named(css);
        } catch (e) {
          // eslint-disable-next-line
        }
      }

      // rgb(250,20,0)
      if (m = css.match(RE_RGB)) {
        const rgb = m.slice(1, 4);
        for (let i = 0; i < 3; i++) {
          rgb[i] = +rgb[i];
        }
        rgb[3] = 1; // default alpha
        return rgb;
      }

      // rgba(250,20,0,0.4)
      if (m = css.match(RE_RGBA)) {
        const rgb = m.slice(1, 5);
        for (let i = 0; i < 4; i++) {
          rgb[i] = +rgb[i];
        }
        return rgb;
      }

      // rgb(100%,0%,0%)
      if (m = css.match(RE_RGB_PCT)) {
        const rgb = m.slice(1, 4);
        for (let i = 0; i < 3; i++) {
          rgb[i] = round(rgb[i] * 2.55);
        }
        rgb[3] = 1; // default alpha
        return rgb;
      }

      // rgba(100%,0%,0%,0.4)
      if (m = css.match(RE_RGBA_PCT)) {
        const rgb = m.slice(1, 5);
        for (let i = 0; i < 3; i++) {
          rgb[i] = round(rgb[i] * 2.55);
        }
        rgb[3] = +rgb[3];
        return rgb;
      }

      // hsl(0,100%,50%)
      if (m = css.match(RE_HSL)) {
        const hsl = m.slice(1, 4);
        hsl[1] *= 0.01;
        hsl[2] *= 0.01;
        const rgb = hsl2rgb(hsl);
        rgb[3] = 1;
        return rgb;
      }

      // hsla(0,100%,50%,0.5)
      if (m = css.match(RE_HSLA)) {
        const hsl = m.slice(1, 4);
        hsl[1] *= 0.01;
        hsl[2] *= 0.01;
        const rgb = hsl2rgb(hsl);
        rgb[3] = +m[4]; // default alpha = 1
        return rgb;
      }
    };
    css2rgb.test = s => {
      return RE_RGB.test(s) || RE_RGBA.test(s) || RE_RGB_PCT.test(s) || RE_RGBA_PCT.test(s) || RE_HSL.test(s) || RE_HSLA.test(s);
    };
    css2rgb_1 = css2rgb;
    return css2rgb_1;
  }
  var hasRequiredCss;
  function requireCss() {
    if (hasRequiredCss) return css;
    hasRequiredCss = 1;
    const chroma = requireChroma();
    const Color = requireColor();
    const input = requireInput();
    const {
      type
    } = requireUtils();
    const rgb2css = requireRgb2css();
    const css2rgb = requireCss2rgb();
    Color.prototype.css = function (mode) {
      return rgb2css(this._rgb, mode);
    };
    chroma.css = (...args) => new Color(...args, 'css');
    input.format.css = css2rgb;
    input.autodetect.push({
      p: 5,
      test: (h, ...rest) => {
        if (!rest.length && type(h) === 'string' && css2rgb.test(h)) {
          return 'css';
        }
      }
    });
    return css;
  }
  requireCss();
  var hex = {};
  var rgb2hex_1;
  var hasRequiredRgb2hex;
  function requireRgb2hex() {
    if (hasRequiredRgb2hex) return rgb2hex_1;
    hasRequiredRgb2hex = 1;
    const {
      unpack,
      last
    } = requireUtils();
    const {
      round
    } = Math;
    const rgb2hex = (...args) => {
      let [r, g, b, a] = unpack(args, 'rgba');
      let mode = last(args) || 'auto';
      if (a === undefined) a = 1;
      if (mode === 'auto') {
        mode = a < 1 ? 'rgba' : 'rgb';
      }
      r = round(r);
      g = round(g);
      b = round(b);
      const u = r << 16 | g << 8 | b;
      let str = "000000" + u.toString(16); //#.toUpperCase();
      str = str.substr(str.length - 6);
      let hxa = '0' + round(a * 255).toString(16);
      hxa = hxa.substr(hxa.length - 2);
      switch (mode.toLowerCase()) {
        case 'rgba':
          return `#${str}${hxa}`;
        case 'argb':
          return `#${hxa}${str}`;
        default:
          return `#${str}`;
      }
    };
    rgb2hex_1 = rgb2hex;
    return rgb2hex_1;
  }
  var hex2rgb_1;
  var hasRequiredHex2rgb;
  function requireHex2rgb() {
    if (hasRequiredHex2rgb) return hex2rgb_1;
    hasRequiredHex2rgb = 1;
    const RE_HEX = /^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    const RE_HEXA = /^#?([A-Fa-f0-9]{8}|[A-Fa-f0-9]{4})$/;
    const hex2rgb = hex => {
      if (hex.match(RE_HEX)) {
        // remove optional leading #
        if (hex.length === 4 || hex.length === 7) {
          hex = hex.substr(1);
        }
        // expand short-notation to full six-digit
        if (hex.length === 3) {
          hex = hex.split('');
          hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        const u = parseInt(hex, 16);
        const r = u >> 16;
        const g = u >> 8 & 0xFF;
        const b = u & 0xFF;
        return [r, g, b, 1];
      }

      // match rgba hex format, eg #FF000077
      if (hex.match(RE_HEXA)) {
        if (hex.length === 5 || hex.length === 9) {
          // remove optional leading #
          hex = hex.substr(1);
        }
        // expand short-notation to full eight-digit
        if (hex.length === 4) {
          hex = hex.split('');
          hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
        }
        const u = parseInt(hex, 16);
        const r = u >> 24 & 0xFF;
        const g = u >> 16 & 0xFF;
        const b = u >> 8 & 0xFF;
        const a = Math.round((u & 0xFF) / 0xFF * 100) / 100;
        return [r, g, b, a];
      }

      // we used to check for css colors here
      // if _input.css? and rgb = _input.css hex
      //     return rgb

      throw new Error(`unknown hex color: ${hex}`);
    };
    hex2rgb_1 = hex2rgb;
    return hex2rgb_1;
  }
  var hasRequiredHex;
  function requireHex() {
    if (hasRequiredHex) return hex;
    hasRequiredHex = 1;
    const chroma = requireChroma();
    const Color = requireColor();
    const {
      type
    } = requireUtils();
    const input = requireInput();
    const rgb2hex = requireRgb2hex();
    Color.prototype.hex = function (mode) {
      return rgb2hex(this._rgb, mode);
    };
    chroma.hex = (...args) => new Color(...args, 'hex');
    input.format.hex = requireHex2rgb();
    input.autodetect.push({
      p: 4,
      test: (h, ...rest) => {
        if (!rest.length && type(h) === 'string' && [3, 4, 5, 6, 7, 8, 9].indexOf(h.length) >= 0) {
          return 'hex';
        }
      }
    });
    return hex;
  }
  requireHex();
  var hsl = {};
  var hasRequiredHsl$1;
  function requireHsl$1() {
    if (hasRequiredHsl$1) return hsl;
    hasRequiredHsl$1 = 1;
    const {
      unpack,
      type
    } = requireUtils();
    const chroma = requireChroma();
    const Color = requireColor();
    const input = requireInput();
    const rgb2hsl = requireRgb2hsl();
    Color.prototype.hsl = function () {
      return rgb2hsl(this._rgb);
    };
    chroma.hsl = (...args) => new Color(...args, 'hsl');
    input.format.hsl = requireHsl2rgb();
    input.autodetect.push({
      p: 2,
      test: (...args) => {
        args = unpack(args, 'hsl');
        if (type(args) === 'array' && args.length === 3) {
          return 'hsl';
        }
      }
    });
    return hsl;
  }
  requireHsl$1();
  var hsv = {};
  var rgb2hsv;
  var hasRequiredRgb2hsv;
  function requireRgb2hsv() {
    if (hasRequiredRgb2hsv) return rgb2hsv;
    hasRequiredRgb2hsv = 1;
    const {
      unpack
    } = requireUtils();
    const {
      min,
      max
    } = Math;

    /*
     * supported arguments:
     * - rgb2hsv(r,g,b)
     * - rgb2hsv([r,g,b])
     * - rgb2hsv({r,g,b})
     */
    const rgb2hsl = (...args) => {
      args = unpack(args, 'rgb');
      let [r, g, b] = args;
      const min_ = min(r, g, b);
      const max_ = max(r, g, b);
      const delta = max_ - min_;
      let h, s, v;
      v = max_ / 255.0;
      if (max_ === 0) {
        h = Number.NaN;
        s = 0;
      } else {
        s = delta / max_;
        if (r === max_) h = (g - b) / delta;
        if (g === max_) h = 2 + (b - r) / delta;
        if (b === max_) h = 4 + (r - g) / delta;
        h *= 60;
        if (h < 0) h += 360;
      }
      return [h, s, v];
    };
    rgb2hsv = rgb2hsl;
    return rgb2hsv;
  }
  var hsv2rgb_1;
  var hasRequiredHsv2rgb;
  function requireHsv2rgb() {
    if (hasRequiredHsv2rgb) return hsv2rgb_1;
    hasRequiredHsv2rgb = 1;
    const {
      unpack
    } = requireUtils();
    const {
      floor
    } = Math;
    const hsv2rgb = (...args) => {
      args = unpack(args, 'hsv');
      let [h, s, v] = args;
      let r, g, b;
      v *= 255;
      if (s === 0) {
        r = g = b = v;
      } else {
        if (h === 360) h = 0;
        if (h > 360) h -= 360;
        if (h < 0) h += 360;
        h /= 60;
        const i = floor(h);
        const f = h - i;
        const p = v * (1 - s);
        const q = v * (1 - s * f);
        const t = v * (1 - s * (1 - f));
        switch (i) {
          case 0:
            [r, g, b] = [v, t, p];
            break;
          case 1:
            [r, g, b] = [q, v, p];
            break;
          case 2:
            [r, g, b] = [p, v, t];
            break;
          case 3:
            [r, g, b] = [p, q, v];
            break;
          case 4:
            [r, g, b] = [t, p, v];
            break;
          case 5:
            [r, g, b] = [v, p, q];
            break;
        }
      }
      return [r, g, b, args.length > 3 ? args[3] : 1];
    };
    hsv2rgb_1 = hsv2rgb;
    return hsv2rgb_1;
  }
  var hasRequiredHsv$1;
  function requireHsv$1() {
    if (hasRequiredHsv$1) return hsv;
    hasRequiredHsv$1 = 1;
    const {
      unpack,
      type
    } = requireUtils();
    const chroma = requireChroma();
    const Color = requireColor();
    const input = requireInput();
    const rgb2hsv = requireRgb2hsv();
    Color.prototype.hsv = function () {
      return rgb2hsv(this._rgb);
    };
    chroma.hsv = (...args) => new Color(...args, 'hsv');
    input.format.hsv = requireHsv2rgb();
    input.autodetect.push({
      p: 2,
      test: (...args) => {
        args = unpack(args, 'hsv');
        if (type(args) === 'array' && args.length === 3) {
          return 'hsv';
        }
      }
    });
    return hsv;
  }
  requireHsv$1();
  var named = {};

  /**
  	X11 color names

  	http://www.w3.org/TR/css3-color/#svg-color
  */

  var w3cx11_1;
  var hasRequiredW3cx11;
  function requireW3cx11() {
    if (hasRequiredW3cx11) return w3cx11_1;
    hasRequiredW3cx11 = 1;
    const w3cx11 = {
      aliceblue: '#f0f8ff',
      antiquewhite: '#faebd7',
      aqua: '#00ffff',
      aquamarine: '#7fffd4',
      azure: '#f0ffff',
      beige: '#f5f5dc',
      bisque: '#ffe4c4',
      black: '#000000',
      blanchedalmond: '#ffebcd',
      blue: '#0000ff',
      blueviolet: '#8a2be2',
      brown: '#a52a2a',
      burlywood: '#deb887',
      cadetblue: '#5f9ea0',
      chartreuse: '#7fff00',
      chocolate: '#d2691e',
      coral: '#ff7f50',
      cornflower: '#6495ed',
      cornflowerblue: '#6495ed',
      cornsilk: '#fff8dc',
      crimson: '#dc143c',
      cyan: '#00ffff',
      darkblue: '#00008b',
      darkcyan: '#008b8b',
      darkgoldenrod: '#b8860b',
      darkgray: '#a9a9a9',
      darkgreen: '#006400',
      darkgrey: '#a9a9a9',
      darkkhaki: '#bdb76b',
      darkmagenta: '#8b008b',
      darkolivegreen: '#556b2f',
      darkorange: '#ff8c00',
      darkorchid: '#9932cc',
      darkred: '#8b0000',
      darksalmon: '#e9967a',
      darkseagreen: '#8fbc8f',
      darkslateblue: '#483d8b',
      darkslategray: '#2f4f4f',
      darkslategrey: '#2f4f4f',
      darkturquoise: '#00ced1',
      darkviolet: '#9400d3',
      deeppink: '#ff1493',
      deepskyblue: '#00bfff',
      dimgray: '#696969',
      dimgrey: '#696969',
      dodgerblue: '#1e90ff',
      firebrick: '#b22222',
      floralwhite: '#fffaf0',
      forestgreen: '#228b22',
      fuchsia: '#ff00ff',
      gainsboro: '#dcdcdc',
      ghostwhite: '#f8f8ff',
      gold: '#ffd700',
      goldenrod: '#daa520',
      gray: '#808080',
      green: '#008000',
      greenyellow: '#adff2f',
      grey: '#808080',
      honeydew: '#f0fff0',
      hotpink: '#ff69b4',
      indianred: '#cd5c5c',
      indigo: '#4b0082',
      ivory: '#fffff0',
      khaki: '#f0e68c',
      laserlemon: '#ffff54',
      lavender: '#e6e6fa',
      lavenderblush: '#fff0f5',
      lawngreen: '#7cfc00',
      lemonchiffon: '#fffacd',
      lightblue: '#add8e6',
      lightcoral: '#f08080',
      lightcyan: '#e0ffff',
      lightgoldenrod: '#fafad2',
      lightgoldenrodyellow: '#fafad2',
      lightgray: '#d3d3d3',
      lightgreen: '#90ee90',
      lightgrey: '#d3d3d3',
      lightpink: '#ffb6c1',
      lightsalmon: '#ffa07a',
      lightseagreen: '#20b2aa',
      lightskyblue: '#87cefa',
      lightslategray: '#778899',
      lightslategrey: '#778899',
      lightsteelblue: '#b0c4de',
      lightyellow: '#ffffe0',
      lime: '#00ff00',
      limegreen: '#32cd32',
      linen: '#faf0e6',
      magenta: '#ff00ff',
      maroon: '#800000',
      maroon2: '#7f0000',
      maroon3: '#b03060',
      mediumaquamarine: '#66cdaa',
      mediumblue: '#0000cd',
      mediumorchid: '#ba55d3',
      mediumpurple: '#9370db',
      mediumseagreen: '#3cb371',
      mediumslateblue: '#7b68ee',
      mediumspringgreen: '#00fa9a',
      mediumturquoise: '#48d1cc',
      mediumvioletred: '#c71585',
      midnightblue: '#191970',
      mintcream: '#f5fffa',
      mistyrose: '#ffe4e1',
      moccasin: '#ffe4b5',
      navajowhite: '#ffdead',
      navy: '#000080',
      oldlace: '#fdf5e6',
      olive: '#808000',
      olivedrab: '#6b8e23',
      orange: '#ffa500',
      orangered: '#ff4500',
      orchid: '#da70d6',
      palegoldenrod: '#eee8aa',
      palegreen: '#98fb98',
      paleturquoise: '#afeeee',
      palevioletred: '#db7093',
      papayawhip: '#ffefd5',
      peachpuff: '#ffdab9',
      peru: '#cd853f',
      pink: '#ffc0cb',
      plum: '#dda0dd',
      powderblue: '#b0e0e6',
      purple: '#800080',
      purple2: '#7f007f',
      purple3: '#a020f0',
      rebeccapurple: '#663399',
      red: '#ff0000',
      rosybrown: '#bc8f8f',
      royalblue: '#4169e1',
      saddlebrown: '#8b4513',
      salmon: '#fa8072',
      sandybrown: '#f4a460',
      seagreen: '#2e8b57',
      seashell: '#fff5ee',
      sienna: '#a0522d',
      silver: '#c0c0c0',
      skyblue: '#87ceeb',
      slateblue: '#6a5acd',
      slategray: '#708090',
      slategrey: '#708090',
      snow: '#fffafa',
      springgreen: '#00ff7f',
      steelblue: '#4682b4',
      tan: '#d2b48c',
      teal: '#008080',
      thistle: '#d8bfd8',
      tomato: '#ff6347',
      turquoise: '#40e0d0',
      violet: '#ee82ee',
      wheat: '#f5deb3',
      white: '#ffffff',
      whitesmoke: '#f5f5f5',
      yellow: '#ffff00',
      yellowgreen: '#9acd32'
    };
    w3cx11_1 = w3cx11;
    return w3cx11_1;
  }
  var hasRequiredNamed;
  function requireNamed() {
    if (hasRequiredNamed) return named;
    hasRequiredNamed = 1;
    const Color = requireColor();
    const input = requireInput();
    const {
      type
    } = requireUtils();
    const w3cx11 = requireW3cx11();
    const hex2rgb = requireHex2rgb();
    const rgb2hex = requireRgb2hex();
    Color.prototype.name = function () {
      const hex = rgb2hex(this._rgb, 'rgb');
      for (let n of Object.keys(w3cx11)) {
        if (w3cx11[n] === hex) return n.toLowerCase();
      }
      return hex;
    };
    input.format.named = name => {
      name = name.toLowerCase();
      if (w3cx11[name]) return hex2rgb(w3cx11[name]);
      throw new Error('unknown color name: ' + name);
    };
    input.autodetect.push({
      p: 5,
      test: (h, ...rest) => {
        if (!rest.length && type(h) === 'string' && w3cx11[h.toLowerCase()]) {
          return 'named';
        }
      }
    });
    return named;
  }
  requireNamed();
  var rgb = {};
  var hasRequiredRgb$1;
  function requireRgb$1() {
    if (hasRequiredRgb$1) return rgb;
    hasRequiredRgb$1 = 1;
    const chroma = requireChroma();
    const Color = requireColor();
    const input = requireInput();
    const {
      unpack,
      type
    } = requireUtils();
    const {
      round
    } = Math;
    Color.prototype.rgb = function (rnd = true) {
      if (rnd === false) return this._rgb.slice(0, 3);
      return this._rgb.slice(0, 3).map(round);
    };
    Color.prototype.rgba = function (rnd = true) {
      return this._rgb.slice(0, 4).map((v, i) => {
        return i < 3 ? rnd === false ? v : round(v) : v;
      });
    };
    chroma.rgb = (...args) => new Color(...args, 'rgb');
    input.format.rgb = (...args) => {
      const rgba = unpack(args, 'rgba');
      if (rgba[3] === undefined) rgba[3] = 1;
      return rgba;
    };
    input.autodetect.push({
      p: 3,
      test: (...args) => {
        args = unpack(args, 'rgba');
        if (type(args) === 'array' && (args.length === 3 || args.length === 4 && type(args[3]) == 'number' && args[3] >= 0 && args[3] <= 1)) {
          return 'rgb';
        }
      }
    });
    return rgb;
  }
  requireRgb$1();
  var alpha = {};
  var hasRequiredAlpha;
  function requireAlpha() {
    if (hasRequiredAlpha) return alpha;
    hasRequiredAlpha = 1;
    const Color = requireColor();
    const {
      type
    } = requireUtils();
    Color.prototype.alpha = function (a, mutate = false) {
      if (a !== undefined && type(a) === 'number') {
        if (mutate) {
          this._rgb[3] = a;
          return this;
        }
        return new Color([this._rgb[0], this._rgb[1], this._rgb[2], a], 'rgb');
      }
      return this._rgb[3];
    };
    return alpha;
  }
  requireAlpha();
  var _hsx;
  var hasRequired_hsx;
  function require_hsx() {
    if (hasRequired_hsx) return _hsx;
    hasRequired_hsx = 1;
    const Color = requireColor();
    _hsx = (col1, col2, f, m) => {
      let xyz0, xyz1;
      if (m === 'hsl') {
        xyz0 = col1.hsl();
        xyz1 = col2.hsl();
      } else if (m === 'hsv') {
        xyz0 = col1.hsv();
        xyz1 = col2.hsv();
      } else if (m === 'hcg') {
        xyz0 = col1.hcg();
        xyz1 = col2.hcg();
      } else if (m === 'hsi') {
        xyz0 = col1.hsi();
        xyz1 = col2.hsi();
      } else if (m === 'lch' || m === 'hcl') {
        m = 'hcl';
        xyz0 = col1.hcl();
        xyz1 = col2.hcl();
      } else if (m === 'oklch') {
        xyz0 = col1.oklch().reverse();
        xyz1 = col2.oklch().reverse();
      }
      let hue0, hue1, sat0, sat1, lbv0, lbv1;
      if (m.substr(0, 1) === 'h' || m === 'oklch') {
        [hue0, sat0, lbv0] = xyz0;
        [hue1, sat1, lbv1] = xyz1;
      }
      let sat, hue, lbv, dh;
      if (!isNaN(hue0) && !isNaN(hue1)) {
        // both colors have hue
        if (hue1 > hue0 && hue1 - hue0 > 180) {
          dh = hue1 - (hue0 + 360);
        } else if (hue1 < hue0 && hue0 - hue1 > 180) {
          dh = hue1 + 360 - hue0;
        } else {
          dh = hue1 - hue0;
        }
        hue = hue0 + f * dh;
      } else if (!isNaN(hue0)) {
        hue = hue0;
        if ((lbv1 == 1 || lbv1 == 0) && m != 'hsv') sat = sat0;
      } else if (!isNaN(hue1)) {
        hue = hue1;
        if ((lbv0 == 1 || lbv0 == 0) && m != 'hsv') sat = sat1;
      } else {
        hue = Number.NaN;
      }
      if (sat === undefined) sat = sat0 + f * (sat1 - sat0);
      lbv = lbv0 + f * (lbv1 - lbv0);
      return m === 'oklch' ? new Color([lbv, sat, hue], m) : new Color([hue, sat, lbv], m);
    };
    return _hsx;
  }
  var interpolator;
  var hasRequiredInterpolator;
  function requireInterpolator() {
    if (hasRequiredInterpolator) return interpolator;
    hasRequiredInterpolator = 1;
    interpolator = {};
    return interpolator;
  }
  var hsl_1;
  var hasRequiredHsl;
  function requireHsl() {
    if (hasRequiredHsl) return hsl_1;
    hasRequiredHsl = 1;
    requireHsl$1();
    const interpolate_hsx = require_hsx();
    const hsl = (col1, col2, f) => {
      return interpolate_hsx(col1, col2, f, 'hsl');
    };

    // register interpolator
    requireInterpolator().hsl = hsl;
    hsl_1 = hsl;
    return hsl_1;
  }
  requireHsl();
  var hsv_1;
  var hasRequiredHsv;
  function requireHsv() {
    if (hasRequiredHsv) return hsv_1;
    hasRequiredHsv = 1;
    requireHsv$1();
    const interpolate_hsx = require_hsx();
    const hsv = (col1, col2, f) => {
      return interpolate_hsx(col1, col2, f, 'hsv');
    };

    // register interpolator
    requireInterpolator().hsv = hsv;
    hsv_1 = hsv;
    return hsv_1;
  }
  requireHsv();
  var rgb_1;
  var hasRequiredRgb;
  function requireRgb() {
    if (hasRequiredRgb) return rgb_1;
    hasRequiredRgb = 1;
    const Color = requireColor();
    const rgb = (col1, col2, f) => {
      const xyz0 = col1._rgb;
      const xyz1 = col2._rgb;
      return new Color(xyz0[0] + f * (xyz1[0] - xyz0[0]), xyz0[1] + f * (xyz1[1] - xyz0[1]), xyz0[2] + f * (xyz1[2] - xyz0[2]), 'rgb');
    };

    // register interpolator
    requireInterpolator().rgb = rgb;
    rgb_1 = rgb;
    return rgb_1;
  }
  requireRgb();
  var mix$1;
  var hasRequiredMix;
  function requireMix() {
    if (hasRequiredMix) return mix$1;
    hasRequiredMix = 1;
    const Color = requireColor();
    const {
      type
    } = requireUtils();
    const interpolator = requireInterpolator();
    mix$1 = (col1, col2, f = 0.5, ...rest) => {
      let mode = rest[0] || 'lrgb';
      if (!interpolator[mode] && !rest.length) {
        // fall back to the first supported mode
        mode = Object.keys(interpolator)[0];
      }
      if (!interpolator[mode]) {
        throw new Error(`interpolation mode ${mode} is not defined`);
      }
      if (type(col1) !== 'object') col1 = new Color(col1);
      if (type(col2) !== 'object') col2 = new Color(col2);
      return interpolator[mode](col1, col2, f).alpha(col1.alpha() + f * (col2.alpha() - col1.alpha()));
    };
    return mix$1;
  }
  var mixExports = requireMix();
  var mix$2 = /*@__PURE__*/getDefaultExportFromCjs(mixExports);
  var scale$1;
  var hasRequiredScale;
  function requireScale() {
    if (hasRequiredScale) return scale$1;
    hasRequiredScale = 1;
    // minimal multi-purpose interface

    // @requires utils color analyze

    const chroma = requireChroma();
    const {
      type
    } = requireUtils();
    const {
      pow
    } = Math;
    scale$1 = function (colors) {
      // constructor
      let _mode = 'rgb';
      let _nacol = chroma('#ccc');
      let _spread = 0;
      // const _fixed = false;
      let _domain = [0, 1];
      let _pos = [];
      let _padding = [0, 0];
      let _classes = false;
      let _colors = [];
      let _out = false;
      let _min = 0;
      let _max = 1;
      let _correctLightness = false;
      let _colorCache = {};
      let _useCache = true;
      let _gamma = 1;

      // private methods

      const setColors = function (colors) {
        colors = colors || ['#fff', '#000'];
        if (colors && type(colors) === 'string' && chroma.brewer && chroma.brewer[colors.toLowerCase()]) {
          colors = chroma.brewer[colors.toLowerCase()];
        }
        if (type(colors) === 'array') {
          // handle single color
          if (colors.length === 1) {
            colors = [colors[0], colors[0]];
          }
          // make a copy of the colors
          colors = colors.slice(0);
          // convert to chroma classes
          for (let c = 0; c < colors.length; c++) {
            colors[c] = chroma(colors[c]);
          }
          // auto-fill color position
          _pos.length = 0;
          for (let c = 0; c < colors.length; c++) {
            _pos.push(c / (colors.length - 1));
          }
        }
        resetCache();
        return _colors = colors;
      };
      const getClass = function (value) {
        if (_classes != null) {
          const n = _classes.length - 1;
          let i = 0;
          while (i < n && value >= _classes[i]) {
            i++;
          }
          return i - 1;
        }
        return 0;
      };
      let tMapLightness = t => t;
      let tMapDomain = t => t;

      // const classifyValue = function(value) {
      //     let val = value;
      //     if (_classes.length > 2) {
      //         const n = _classes.length-1;
      //         const i = getClass(value);
      //         const minc = _classes[0] + ((_classes[1]-_classes[0]) * (0 + (_spread * 0.5)));  // center of 1st class
      //         const maxc = _classes[n-1] + ((_classes[n]-_classes[n-1]) * (1 - (_spread * 0.5)));  // center of last class
      //         val = _min + ((((_classes[i] + ((_classes[i+1] - _classes[i]) * 0.5)) - minc) / (maxc-minc)) * (_max - _min));
      //     }
      //     return val;
      // };

      const getColor = function (val, bypassMap) {
        let col, t;
        if (bypassMap == null) {
          bypassMap = false;
        }
        if (isNaN(val) || val === null) {
          return _nacol;
        }
        if (!bypassMap) {
          if (_classes && _classes.length > 2) {
            // find the class
            const c = getClass(val);
            t = c / (_classes.length - 2);
          } else if (_max !== _min) {
            // just interpolate between min/max
            t = (val - _min) / (_max - _min);
          } else {
            t = 1;
          }
        } else {
          t = val;
        }

        // domain map
        t = tMapDomain(t);
        if (!bypassMap) {
          t = tMapLightness(t); // lightness correction
        }
        if (_gamma !== 1) {
          t = pow(t, _gamma);
        }
        t = _padding[0] + t * (1 - _padding[0] - _padding[1]);
        t = Math.min(1, Math.max(0, t));
        const k = Math.floor(t * 10000);
        if (_useCache && _colorCache[k]) {
          col = _colorCache[k];
        } else {
          if (type(_colors) === 'array') {
            //for i in [0.._pos.length-1]
            for (let i = 0; i < _pos.length; i++) {
              const p = _pos[i];
              if (t <= p) {
                col = _colors[i];
                break;
              }
              if (t >= p && i === _pos.length - 1) {
                col = _colors[i];
                break;
              }
              if (t > p && t < _pos[i + 1]) {
                t = (t - p) / (_pos[i + 1] - p);
                col = chroma.interpolate(_colors[i], _colors[i + 1], t, _mode);
                break;
              }
            }
          } else if (type(_colors) === 'function') {
            col = _colors(t);
          }
          if (_useCache) {
            _colorCache[k] = col;
          }
        }
        return col;
      };
      var resetCache = () => _colorCache = {};
      setColors(colors);

      // public interface

      const f = function (v) {
        const c = chroma(getColor(v));
        if (_out && c[_out]) {
          return c[_out]();
        } else {
          return c;
        }
      };
      f.classes = function (classes) {
        if (classes != null) {
          if (type(classes) === 'array') {
            _classes = classes;
            _domain = [classes[0], classes[classes.length - 1]];
          } else {
            const d = chroma.analyze(_domain);
            if (classes === 0) {
              _classes = [d.min, d.max];
            } else {
              _classes = chroma.limits(d, 'e', classes);
            }
          }
          return f;
        }
        return _classes;
      };
      f.domain = function (domain) {
        if (!arguments.length) {
          return _domain;
        }
        _min = domain[0];
        _max = domain[domain.length - 1];
        _pos = [];
        const k = _colors.length;
        if (domain.length === k && _min !== _max) {
          // update positions
          for (let d of Array.from(domain)) {
            _pos.push((d - _min) / (_max - _min));
          }
        } else {
          for (let c = 0; c < k; c++) {
            _pos.push(c / (k - 1));
          }
          if (domain.length > 2) {
            // set domain map
            const tOut = domain.map((d, i) => i / (domain.length - 1));
            const tBreaks = domain.map(d => (d - _min) / (_max - _min));
            if (!tBreaks.every((val, i) => tOut[i] === val)) {
              tMapDomain = t => {
                if (t <= 0 || t >= 1) return t;
                let i = 0;
                while (t >= tBreaks[i + 1]) i++;
                const f = (t - tBreaks[i]) / (tBreaks[i + 1] - tBreaks[i]);
                const out = tOut[i] + f * (tOut[i + 1] - tOut[i]);
                return out;
              };
            }
          }
        }
        _domain = [_min, _max];
        return f;
      };
      f.mode = function (_m) {
        if (!arguments.length) {
          return _mode;
        }
        _mode = _m;
        resetCache();
        return f;
      };
      f.range = function (colors, _pos) {
        setColors(colors);
        return f;
      };
      f.out = function (_o) {
        _out = _o;
        return f;
      };
      f.spread = function (val) {
        if (!arguments.length) {
          return _spread;
        }
        _spread = val;
        return f;
      };
      f.correctLightness = function (v) {
        if (v == null) {
          v = true;
        }
        _correctLightness = v;
        resetCache();
        if (_correctLightness) {
          tMapLightness = function (t) {
            const L0 = getColor(0, true).lab()[0];
            const L1 = getColor(1, true).lab()[0];
            const pol = L0 > L1;
            let L_actual = getColor(t, true).lab()[0];
            const L_ideal = L0 + (L1 - L0) * t;
            let L_diff = L_actual - L_ideal;
            let t0 = 0;
            let t1 = 1;
            let max_iter = 20;
            while (Math.abs(L_diff) > 1e-2 && max_iter-- > 0) {
              (function () {
                if (pol) {
                  L_diff *= -1;
                }
                if (L_diff < 0) {
                  t0 = t;
                  t += (t1 - t) * 0.5;
                } else {
                  t1 = t;
                  t += (t0 - t) * 0.5;
                }
                L_actual = getColor(t, true).lab()[0];
                return L_diff = L_actual - L_ideal;
              })();
            }
            return t;
          };
        } else {
          tMapLightness = t => t;
        }
        return f;
      };
      f.padding = function (p) {
        if (p != null) {
          if (type(p) === 'number') {
            p = [p, p];
          }
          _padding = p;
          return f;
        } else {
          return _padding;
        }
      };
      f.colors = function (numColors, out) {
        // If no arguments are given, return the original colors that were provided
        if (arguments.length < 2) {
          out = 'hex';
        }
        let result = [];
        if (arguments.length === 0) {
          result = _colors.slice(0);
        } else if (numColors === 1) {
          result = [f(0.5)];
        } else if (numColors > 1) {
          const dm = _domain[0];
          const dd = _domain[1] - dm;
          result = __range__(0, numColors).map(i => f(dm + i / (numColors - 1) * dd));
        } else {
          // returns all colors based on the defined classes
          colors = [];
          let samples = [];
          if (_classes && _classes.length > 2) {
            for (let i = 1, end = _classes.length, asc = 1 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
              samples.push((_classes[i - 1] + _classes[i]) * 0.5);
            }
          } else {
            samples = _domain;
          }
          result = samples.map(v => f(v));
        }
        if (chroma[out]) {
          result = result.map(c => c[out]());
        }
        return result;
      };
      f.cache = function (c) {
        if (c != null) {
          _useCache = c;
          return f;
        } else {
          return _useCache;
        }
      };
      f.gamma = function (g) {
        if (g != null) {
          _gamma = g;
          return f;
        } else {
          return _gamma;
        }
      };
      f.nodata = function (d) {
        if (d != null) {
          _nacol = chroma(d);
          return f;
        } else {
          return _nacol;
        }
      };
      return f;
    };
    function __range__(left, right, inclusive) {
      let range = [];
      let ascending = left < right;
      let end = right;
      for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
        range.push(i);
      }
      return range;
    }
    return scale$1;
  }
  var scaleExports = requireScale();
  var scale = /*@__PURE__*/getDefaultExportFromCjs(scaleExports);

  /*
   * Copyright (c) 2022 WeatherLayers.com
   *
   * This Source Code Form is subject to the terms of the Mozilla Public
   * License, v. 2.0. If a copy of the MPL was not distributed with this
   * file, You can obtain one at http://mozilla.org/MPL/2.0/.
   */
  // custom lightweight Chroma.js bundle
  // see https://github.com/gka/chroma.js/blob/main/index.js
  chroma.mix = chroma.interpolate = mix$2;
  chroma.scale = scale;
  const LINE_SEPARATOR_REGEX = /[ ,\t:]+/g;
  const COLOR_SEPARATOR_REGEX = /[\-\/]/g;
  function isLineComment(line) {
    return line.startsWith('#');
  }
  function isGmt4Text(lines) {
    return lines.some(line => {
      if (!isLineComment(line)) {
        if (line.split(LINE_SEPARATOR_REGEX).length >= 8) {
          return true;
        }
      }
      return false;
    });
  }
  function isGmt5Text(lines) {
    return lines.some(line => {
      if (!isLineComment(line)) {
        if (line.match(/\d+\-\d+\-\d+/) || line.match(/\d+\/\d+\/\d+/)) {
          return true;
        }
      }
      return false;
    });
  }
  function getMode(lines) {
    const modeLine = lines.find(line => isLineComment(line) && line.includes('COLOR_MODEL = '));
    if (modeLine) {
      const match = modeLine.match(/COLOR_MODEL = ([a-zA-Z]+)/);
      if (match) {
        return match[1].toLowerCase();
      }
    }
    return undefined;
  }
  function splitColor(color) {
    const colorArray = color.split(COLOR_SEPARATOR_REGEX);
    return colorArray.length === 1 ? colorArray[0] : colorArray;
  }
  function parsePaletteTextInternal(paletteText) {
    const lines = paletteText.trim().split('\n');
    const isGmt4 = isGmt4Text(lines);
    const isGmt5 = isGmt5Text(lines);
    const mode = getMode(lines);
    const paletteLines = lines.filter(x => !!x && !x.startsWith('#'));
    const paletteArray = [];
    for (let paletteLine of paletteLines) {
      const fields = paletteLine.split(LINE_SEPARATOR_REGEX);
      if (isGmt4) {
        if (fields.length === 8 || fields.length === 9) {
          paletteArray.push([fields[0], [fields[1], fields[2], fields[3]]]);
          paletteArray.push([fields[4], [fields[5], fields[6], fields[7]]]);
        } else if (fields.length === 4 || fields.length === 5) {
          paletteArray.push([fields[0], [fields[1], fields[2], fields[3]]]);
        } else ;
      } else if (isGmt5) {
        if (fields.length === 4 || fields.length === 5) {
          paletteArray.push([fields[0], splitColor(fields[1])]);
          paletteArray.push([fields[2], splitColor(fields[3])]);
        } else if (fields.length === 2 || fields.length === 3) {
          paletteArray.push([fields[0], splitColor(fields[1])]);
        } else ;
      } else {
        if (fields.length === 5) {
          paletteArray.push([fields[0], [fields[1], fields[2], fields[3], fields[4]]]);
        } else if (fields.length === 4) {
          paletteArray.push([fields[0], [fields[1], fields[2], fields[3]]]);
        } else if (fields.length === 2) {
          paletteArray.push([fields[0], fields[1]]);
        } else ;
      }
    }
    return {
      paletteArray,
      mode
    };
  }

  /*
   * Copyright (c) 2022 WeatherLayers.com
   *
   * This Source Code Form is subject to the terms of the Mozilla Public
   * License, v. 2.0. If a copy of the MPL was not distributed with this
   * file, You can obtain one at http://mozilla.org/MPL/2.0/.
   */
  const DEFAULT_MODE = 'rgb';
  function parseValue(value, bounds) {
    if (typeof value === 'string') {
      if (value[value.length - 1] === '%') {
        const percentage = parseFloat(value) / 100;
        if (percentage < 0 || percentage > 1) {
          throw new Error(`Invalid value for a percentage ${value}`);
        }
        return bounds[0] + (bounds[1] - bounds[0]) * percentage;
      } else if (value === 'N') {
        return null; // GMT nodata
      } else if (value === 'B') {
        return undefined; // GMT background (value < min), not supported yet, ignore
      } else if (value === 'F') {
        return undefined; // GMT foreground (value > max), not supported yet, ignore
      } else if (value === 'nv') {
        return null; // GDAL nodata
      } else if (value === 'default') {
        return undefined; // GRASS default (value < min || value > max), not supported yet, ignore
      } else if (value === 'null') {
        return null; // PostGIS nodata
      } else if (value === 'nodata') {
        return null; // PostGIS nodata
      } else {
        return parseFloat(value);
      }
    } else if (typeof value === 'number') {
      return value;
    } else {
      throw new Error('Invalid state');
    }
  }
  function parseColor(color, mode) {
    if (Array.isArray(color)) {
      if (color.length === 4) {
        // color with alpha
        return {
          [mode[0]]: parseFloat(color[0].toString()),
          [mode[1]]: parseFloat(color[1].toString()),
          [mode[2]]: parseFloat(color[2].toString()),
          a: parseFloat(color[3].toString()) / 255
        };
      } else if (color.length === 3) {
        // color
        return {
          [mode[0]]: parseFloat(color[0].toString()),
          [mode[1]]: parseFloat(color[1].toString()),
          [mode[2]]: parseFloat(color[2].toString())
        };
      } else {
        throw new Error(`Invalid color ${color}`);
      }
    } else if (typeof color === 'string' || typeof color === 'number') {
      if (color.toString().match(/^\d+$/) || typeof color === 'number') {
        // grayscale color
        return {
          [mode[0]]: parseFloat(color.toString()),
          [mode[1]]: parseFloat(color.toString()),
          [mode[2]]: parseFloat(color.toString())
        };
      } else {
        // color name
        return color;
      }
    } else {
      throw new Error(`Invalid color ${color}`);
    }
  }
  function parsePaletteArray(paletteArray, {
    bounds = [0, 1],
    mode = DEFAULT_MODE
  } = {}) {
    const colors = [];
    const domain = [];
    let nodata;
    for (let [value, color] of paletteArray) {
      const parsedValue = parseValue(value, bounds);
      const parsedColor = parseColor(color, mode);
      if (parsedValue != null) {
        colors.push(parsedColor);
        domain.push(parsedValue);
      } else if (parsedValue === null) {
        nodata = parsedColor;
      } else ;
    }
    let palette = chroma.scale(colors).domain(domain).mode(mode);
    if (typeof nodata !== 'undefined') {
      palette = palette.nodata(nodata);
    }
    return palette;
  }
  function parsePaletteText(paletteText, {
    bounds = [0, 1]
  } = {}) {
    const {
      paletteArray,
      mode
    } = parsePaletteTextInternal(paletteText);
    return parsePaletteArray(paletteArray, {
      bounds,
      mode
    });
  }
  function parsePalette(palette, {
    bounds = [0, 1]
  } = {}) {
    if (typeof palette === 'string') {
      return parsePaletteText(palette, {
        bounds
      });
    } else if (Array.isArray(palette)) {
      return parsePaletteArray(palette, {
        bounds
      });
    } else {
      throw new Error('Invalid format');
    }
  }
  function colorRampCanvas(scale, {
    width = 256,
    height = 1
  } = {}) {
    const colors = scale.colors(width, 'css');
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.style.imageRendering = '-moz-crisp-edges';
    canvas.style.imageRendering = 'pixelated';
    const ctx = canvas.getContext('2d');
    for (let i = 0; i < width; i++) {
      ctx.fillStyle = colors[i];
      ctx.fillRect(i, 0, 1, height);
    }
    return canvas;
  }

  const Placement = {
      BOTTOM: 'BOTTOM',
      TOP: 'TOP',
      RIGHT: 'RIGHT',
      LEFT: 'LEFT',
  };

  function getProjectFunction(width, height, bounds) {
      const origin = [bounds[0], bounds[3]]; // top-left
      const lngResolution = (bounds[2] - bounds[0]) / width;
      const latResolution = (bounds[3] - bounds[1]) / height;
      return position => {
          const [lng, lat] = position;
          const x = (lng - origin[0]) / lngResolution;
          const y = (origin[1] - lat) / latResolution;
          const point = [x, y];
          return point;
      };
  }

  function frac(x) {
      return x % 1;
  }
  function add(x, y) {
      return x.map((_, i) => x[i] + y[i]);
  }
  function mul(x, y) {
      return x.map((_, i) => x[i] * y);
  }
  function dot(x, y) {
      return x.map((_, i) => x[i] * y[i]).reduce((m, n) => m + n);
  }
  function mixOne(x, y, a) {
      // skip interpolation for equal values to avoid precision loss
      // fixes hasPixelValue to always return true irrespectively on imageWeight when both pixel[3] === 255
      if (x === y) {
          return x;
      }
      return x * (1 - a) + y * a;
  }
  function mix(x, y, a) {
      return x.map((_, i) => mixOne(x[i], y[i], a));
  }

  function hasPixelValue(pixel, imageUnscale) {
      if (imageUnscale) {
          // pixel[3] === 255 causes incorrect nodata pixels in Safari, because Canvas.getImageData returns different data from the original image, with lower values
          // - this happened in 2023.10.2, fixed in 2023.10.3, reverted in 2024.1.0, it's not happening anymore, why?
          // anything smaller causes interpolated nodata edges with linear interpolation
          // pixel[3] >= 255 because sometimes the original value is slightly larger (255.00000000000003)
          return pixel[3] >= 255;
      }
      else {
          return !isNaN(pixel[0]);
      }
  }
  function getPixelScalarValue(pixel, imageType, imageUnscale) {
      if (imageType === ImageType.VECTOR) {
          return 0;
      }
      else {
          if (imageUnscale) {
              return mixOne(imageUnscale[0], imageUnscale[1], pixel[0] / 255);
          }
          else {
              return pixel[0];
          }
      }
  }
  function getPixelVectorValue(pixel, imageType, imageUnscale) {
      if (imageType === ImageType.VECTOR) {
          if (imageUnscale) {
              return [
                  mixOne(imageUnscale[0], imageUnscale[1], pixel[0] / 255),
                  mixOne(imageUnscale[0], imageUnscale[1], pixel[1] / 255)
              ];
          }
          else {
              return [pixel[0], pixel[1]];
          }
      }
      else {
          return [NaN, NaN];
      }
  }
  function getPixelMagnitudeValue(pixel, imageType, imageUnscale) {
      if (imageType === ImageType.VECTOR) {
          const value = getPixelVectorValue(pixel, imageType, imageUnscale);
          return Math.hypot(value[0], value[1]);
      }
      else {
          return getPixelScalarValue(pixel, imageType, imageUnscale);
      }
  }
  function getPixelDirectionValue(pixel, imageType, imageUnscale) {
      if (imageType === ImageType.VECTOR) {
          const value = getPixelVectorValue(pixel, imageType, imageUnscale);
          return ((360 - (Math.atan2(value[1], value[0]) / Math.PI * 180 + 180)) - 270) % 360;
      }
      else {
          return NaN;
      }
  }

  function getPixel(image, imageDownscaleResolution, iuvX, iuvY, offsetX, offsetY) {
      const { data, width, height } = image;
      const bandsCount = data.length / (width * height);
      const uvX = (iuvX + offsetX + 0.5) / imageDownscaleResolution[0];
      const uvY = (iuvY + offsetY + 0.5) / imageDownscaleResolution[1];
      const x = Math.max(0, Math.min(width - 1, Math.floor(uvX * width)));
      const y = Math.max(0, Math.min(height - 1, Math.floor(uvY * height)));
      return new Array(bandsCount).fill(undefined).map((_, band) => {
          return data[(x + y * width) * bandsCount + band];
      });
  }
  // cubic B-spline
  const BS_A = [3, -6, 0, 4].map(x => x / 6);
  const BS_B = [-1, 6, -12, 8].map(x => x / 6);
  function powers(x) {
      return [x * x * x, x * x, x, 1];
  }
  function spline(c0, c1, c2, c3, a) {
      const color = add(add(add(mul(c0, dot(BS_B, powers(a + 1.))), mul(c1, dot(BS_A, powers(a)))), mul(c2, dot(BS_A, powers(1. - a)))), mul(c3, dot(BS_B, powers(2. - a))));
      // fix precision loss in alpha channel
      color[3] = (c0[3] > 0 && c1[3] > 0 && c2[3] > 0 && c3[3] > 0) ? Math.max(Math.max(Math.max(c0[3], c1[3]), c2[3]), c3[3]) : 0;
      return color;
  }
  /**
   * see https://www.shadertoy.com/view/XsSXDy
   */
  function getPixelCubic(image, imageDownscaleResolution, uvX, uvY) {
      const tuvX = uvX * imageDownscaleResolution[0] - 0.5;
      const tuvY = uvY * imageDownscaleResolution[1] - 0.5;
      const iuvX = Math.floor(tuvX);
      const iuvY = Math.floor(tuvY);
      const fuvX = frac(tuvX);
      const fuvY = frac(tuvY);
      return spline(spline(getPixel(image, imageDownscaleResolution, iuvX, iuvY, -1, -1), getPixel(image, imageDownscaleResolution, iuvX, iuvY, 0, -1), getPixel(image, imageDownscaleResolution, iuvX, iuvY, 1, -1), getPixel(image, imageDownscaleResolution, iuvX, iuvY, 2, -1), fuvX), spline(getPixel(image, imageDownscaleResolution, iuvX, iuvY, -1, 0), getPixel(image, imageDownscaleResolution, iuvX, iuvY, 0, 0), getPixel(image, imageDownscaleResolution, iuvX, iuvY, 1, 0), getPixel(image, imageDownscaleResolution, iuvX, iuvY, 2, 0), fuvX), spline(getPixel(image, imageDownscaleResolution, iuvX, iuvY, -1, 1), getPixel(image, imageDownscaleResolution, iuvX, iuvY, 0, 1), getPixel(image, imageDownscaleResolution, iuvX, iuvY, 1, 1), getPixel(image, imageDownscaleResolution, iuvX, iuvY, 2, 1), fuvX), spline(getPixel(image, imageDownscaleResolution, iuvX, iuvY, -1, 2), getPixel(image, imageDownscaleResolution, iuvX, iuvY, 0, 2), getPixel(image, imageDownscaleResolution, iuvX, iuvY, 1, 2), getPixel(image, imageDownscaleResolution, iuvX, iuvY, 2, 2), fuvX), fuvY);
  }
  /**
   * see https://gamedev.stackexchange.com/questions/101953/low-quality-bilinear-sampling-in-webgl-opengl-directx
   */
  function getPixelLinear(image, imageDownscaleResolution, uvX, uvY) {
      const tuvX = uvX * imageDownscaleResolution[0] - 0.5;
      const tuvY = uvY * imageDownscaleResolution[1] - 0.5;
      const iuvX = Math.floor(tuvX);
      const iuvY = Math.floor(tuvY);
      const fuvX = frac(tuvX);
      const fuvY = frac(tuvY);
      return mix(mix(getPixel(image, imageDownscaleResolution, iuvX, iuvY, 0, 0), getPixel(image, imageDownscaleResolution, iuvX, iuvY, 1, 0), fuvX), mix(getPixel(image, imageDownscaleResolution, iuvX, iuvY, 0, 1), getPixel(image, imageDownscaleResolution, iuvX, iuvY, 1, 1), fuvX), fuvY);
  }
  function getPixelNearest(image, imageDownscaleResolution, uvX, uvY) {
      const tuvX = uvX * imageDownscaleResolution[0] - 0.5;
      const tuvY = uvY * imageDownscaleResolution[1] - 0.5;
      const iuvX = Math.round(tuvX); // nearest
      const iuvY = Math.round(tuvY); // nearest
      return getPixel(image, imageDownscaleResolution, iuvX, iuvY, 0, 0);
  }
  function getPixelFilter(image, imageDownscaleResolution, imageInterpolation, uvX, uvY) {
      if (imageInterpolation === ImageInterpolation.CUBIC) {
          return getPixelCubic(image, imageDownscaleResolution, uvX, uvY);
      }
      else if (imageInterpolation === ImageInterpolation.LINEAR) {
          return getPixelLinear(image, imageDownscaleResolution, uvX, uvY);
      }
      else {
          return getPixelNearest(image, imageDownscaleResolution, uvX, uvY);
      }
  }
  function getPixelInterpolate(image, image2, imageDownscaleResolution, imageInterpolation, imageWeight, isRepeatBounds, uvX, uvY) {
      // offset
      // test case: gfswave/significant_wave_height, Gibraltar (36, -5.5)
      const uvWithOffsetX = isRepeatBounds ?
          uvX + 0.5 / imageDownscaleResolution[0] :
          mixOne(0 + 0.5 / imageDownscaleResolution[0], 1 - 0.5 / imageDownscaleResolution[0], uvX);
      const uvWithOffsetY = mixOne(0 + 0.5 / imageDownscaleResolution[1], 1 - 0.5 / imageDownscaleResolution[1], uvY);
      if (image2 && imageWeight > 0) {
          const pixel = getPixelFilter(image, imageDownscaleResolution, imageInterpolation, uvWithOffsetX, uvWithOffsetY);
          const pixel2 = getPixelFilter(image2, imageDownscaleResolution, imageInterpolation, uvWithOffsetX, uvWithOffsetY);
          return mix(pixel, pixel2, imageWeight);
      }
      else {
          return getPixelFilter(image, imageDownscaleResolution, imageInterpolation, uvWithOffsetX, uvWithOffsetY);
      }
  }
  function getImageDownscaleResolution(width, height, imageSmoothing) {
      const imageDownscaleResolutionFactor = 1 + Math.max(0, imageSmoothing);
      return [width / imageDownscaleResolutionFactor, height / imageDownscaleResolutionFactor];
  }

  const MIN_LNG = -180;
  const MAX_LNG = 180;
  const MIN_LAT = -85.051129;
  const MAX_LAT = 85.051129;
  /**
   * see https://stackoverflow.com/a/4467559/1823988
   */
  function mod(x, y) {
      return ((x % y) + y) % y;
  }
  function wrapLongitude(lng, minLng) {
      let wrappedLng = mod(lng + 180, 360) - 180;
      if (typeof minLng === 'number' && wrappedLng < minLng) {
          wrappedLng += 360;
      }
      return wrappedLng;
  }
  function wrapBounds(bounds) {
      // wrap longitude
      const minLng = bounds[2] - bounds[0] < 360 ? wrapLongitude(bounds[0]) : MIN_LNG;
      const maxLng = bounds[2] - bounds[0] < 360 ? wrapLongitude(bounds[2], minLng) : MAX_LNG;
      // clip latitude
      const minLat = Math.max(bounds[1], MIN_LAT);
      const maxLat = Math.min(bounds[3], MAX_LAT);
      return [minLng, minLat, maxLng, maxLat];
  }
  function isRepeatBounds(bounds) {
      return bounds[2] - bounds[0] === 360;
  }
  function isPositionInBounds(position, bounds) {
      return ((position[0] >= bounds[0] && position[0] <= bounds[2]) &&
          (position[1] >= bounds[1] && position[1] <= bounds[3]));
  }

  function createRasterPoint(position, properties) {
      return { type: 'Feature', geometry: { type: 'Point', coordinates: position }, properties };
  }
  function getRasterPoints(imageProperties, bounds, positions) {
      const { image, image2, imageSmoothing, imageInterpolation, imageWeight, imageType, imageUnscale, imageMinValue, imageMaxValue } = imageProperties;
      const { width, height } = image;
      const project = getProjectFunction(width, height, bounds);
      // smooth by downscaling resolution
      const imageDownscaleResolution = getImageDownscaleResolution(width, height, imageSmoothing);
      const isRepeatBoundsCache = isRepeatBounds(bounds);
      const rasterPoints = positions.map(position => {
          if (!isPositionInBounds(position, bounds)) {
              // drop position out of bounds
              return createRasterPoint(position, { value: NaN });
          }
          const point = project(position);
          const uvX = point[0] / width;
          const uvY = point[1] / height;
          const pixel = getPixelInterpolate(image, image2, imageDownscaleResolution, imageInterpolation, imageWeight, isRepeatBoundsCache, uvX, uvY);
          if (!hasPixelValue(pixel, imageUnscale)) {
              // drop nodata
              return createRasterPoint(position, { value: NaN });
          }
          const value = getPixelMagnitudeValue(pixel, imageType, imageUnscale);
          if ((typeof imageMinValue === 'number' && !isNaN(imageMinValue) && value < imageMinValue) ||
              (typeof imageMaxValue === 'number' && !isNaN(imageMaxValue) && value > imageMaxValue)) {
              // drop value out of bounds
              return createRasterPoint(position, { value: NaN });
          }
          if (imageType === ImageType.VECTOR) {
              const direction = getPixelDirectionValue(pixel, imageType, imageUnscale);
              return createRasterPoint(position, { value, direction });
          }
          else {
              return createRasterPoint(position, { value });
          }
      });
      return { type: 'FeatureCollection', features: rasterPoints };
  }
  function getRasterMagnitudeData(imageProperties, bounds) {
      const { image, image2, imageSmoothing, imageInterpolation, imageWeight, imageType, imageUnscale, imageMinValue, imageMaxValue } = imageProperties;
      const { width, height } = image;
      // interpolation for entire data is slow, fallback to NEAREST interpolation + blur in worker
      // CPU speed (image 1440x721):
      // - NEAREST - 100 ms
      // - LINEAR - 600 ms
      // - CUBIC - 6 s
      // TODO: move getRasterMagnitudeData to GPU
      const effectiveImageInterpolation = imageInterpolation !== ImageInterpolation.NEAREST ? ImageInterpolation.NEAREST : imageInterpolation;
      // smooth by downscaling resolution
      const imageDownscaleResolution = getImageDownscaleResolution(width, height, imageSmoothing);
      const isRepeatBoundsCache = isRepeatBounds(bounds);
      const magnitudeData = new Float32Array(width * height);
      for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
              const i = x + y * width;
              const uvX = x / width;
              const uvY = y / height;
              const pixel = getPixelInterpolate(image, image2, imageDownscaleResolution, effectiveImageInterpolation, imageWeight, isRepeatBoundsCache, uvX, uvY);
              if (!hasPixelValue(pixel, imageUnscale)) {
                  // drop nodata
                  magnitudeData[i] = NaN;
                  continue;
              }
              const value = getPixelMagnitudeValue(pixel, imageType, imageUnscale);
              if ((typeof imageMinValue === 'number' && !isNaN(imageMinValue) && value < imageMinValue) ||
                  (typeof imageMaxValue === 'number' && !isNaN(imageMaxValue) && value > imageMaxValue)) {
                  // drop value out of bounds
                  magnitudeData[i] = NaN;
                  continue;
              }
              magnitudeData[i] = value;
          }
      }
      return { data: magnitudeData, width, height };
  }

  const repeatCache = new WeakMap();
  const clampCache = new WeakMap();
  function getTextureProps(device, image, repeat) {
      const { data, width, height } = image;
      const bandsCount = data.length / (width * height);
      let format;
      if (data instanceof Uint8Array || data instanceof Uint8ClampedArray) {
          if (bandsCount === 4) {
              format = 'rgba8unorm';
          }
          else if (bandsCount === 2) {
              format = 'rg8unorm'; // TODO: deck.gl 9 verify
          }
          else if (bandsCount === 1) {
              format = 'r8unorm';
          }
          else {
              throw new Error('Unsupported data format');
          }
      }
      else if (data instanceof Float32Array) {
          if (!device.features.has('float32-renderable-webgl')) {
              throw new Error('Float textures are required');
          }
          if (bandsCount === 2) {
              format = 'rg32float';
          }
          else if (bandsCount === 1) {
              format = 'r32float';
          }
          else {
              throw new Error('Unsupported data format');
          }
      }
      else {
          throw new Error('Unsupported data format');
      }
      return {
          data,
          width,
          height,
          format,
          mipmaps: false,
          sampler: {
              // custom interpolation in pixel.glsl
              magFilter: 'nearest',
              minFilter: 'nearest',
              addressModeU: repeat ? 'repeat' : 'clamp-to-edge',
              addressModeV: 'clamp-to-edge',
              lodMaxClamp: 0,
          },
      };
  }
  function createTextureCached(device, image, repeat = false) {
      const cache = repeat ? repeatCache : clampCache;
      const cache2 = cache.get(device) ?? (() => {
          const cache2 = new WeakMap();
          cache.set(device, cache2);
          return cache2;
      })();
      const texture = cache2.get(image) ?? (() => {
          const textureProps = getTextureProps(device, image, repeat);
          const texture = device.createTexture(textureProps);
          cache2.set(image, texture);
          return texture;
      })();
      return texture;
  }
  // empty texture required instead of null
  let emptyTexture = null;
  function createEmptyTextureCached(device) {
      if (!emptyTexture) {
          emptyTexture = device.createTexture({ data: new Uint8Array(4), width: 1, height: 1, mipmaps: false });
      }
      return emptyTexture;
  }

  const DEFAULT_RADIUS$1 = 6371e3;
  function equals(position1, position2) {
    if (Math.abs(position1[0] - position2[0]) > Number.EPSILON) return false;
    if (Math.abs(position1[1] - position2[1]) > Number.EPSILON) return false;
    return true;
  }
  function toRadians(value) {
    return value / 180 * Math.PI;
  }
  function toDegrees(value) {
    return value / Math.PI * 180;
  }
  function wrap360(value) {
    return (value + 360) % 360;
  }

  /**
   * Returns the distance along the surface of the earth from start point to destination point.
   *
   * Uses haversine formula: a = sin²(Δφ/2) + cosφ1·cosφ2 · sin²(Δλ/2); d = 2 · atan2(√a, √(a-1)).
   *
   * @param   {GeoJSON.Position} start - Longitude/latitude of start point.
   * @param   {GeoJSON.Position} destination - Longitude/latitude of destination point.
   * @param   {number} [radius] - Radius of earth (defaults to mean radius in metres).
   * @returns {number} Distance between start point and destination point, in same units as radius.
   *
   * @example
   *   const p1 = [0.119, 52.205];
   *   const p2 = [2.351, 48.857];
   *   const d = distance(p1, p2);         // 404.3×10³ m
   *   const m = distanceTo(p1, p2, 3959); // 251.2 miles
   */
  function distance$1(start, destination, radius = DEFAULT_RADIUS$1) {
    // a = sin²(Δφ/2) + cos(φ1)⋅cos(φ2)⋅sin²(Δλ/2)
    // δ = 2·atan2(√(a), √(1−a))
    // see mathforum.org/library/drmath/view/51879.html for derivation
    const R = radius;
    const φ1 = toRadians(start[1]),
      λ1 = toRadians(start[0]);
    const φ2 = toRadians(destination[1]),
      λ2 = toRadians(destination[0]);
    const Δφ = φ2 - φ1;
    const Δλ = λ2 - λ1;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d;
  }
  /**
   * Returns the initial bearing from start point to destination point.
   *
   * @param   {GeoJSON.Position} start - Longitude/latitude of start point.
   * @param   {GeoJSON.Position} destination - Longitude/latitude of destination point.
   * @returns {number} Initial bearing in degrees from north (0°..360°).
   *
   * @example
   *   const p1 = [0.119, 52.205];
   *   const p2 = [2.351, 48.857];
   *   const b1 = initialBearing(p1, p2); // 156.2°
   */
  function initialBearing(start, destination) {
    if (equals(start, destination)) return NaN; // coincident points
    // tanθ = sinΔλ⋅cosφ2 / cosφ1⋅sinφ2 − sinφ1⋅cosφ2⋅cosΔλ
    // see mathforum.org/library/drmath/view/55417.html for derivation
    const φ1 = toRadians(start[1]);
    const φ2 = toRadians(destination[1]);
    const Δλ = toRadians(destination[0] - start[0]);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const θ = Math.atan2(y, x);
    const bearing = toDegrees(θ);
    return wrap360(bearing);
  }
  /**
   * Returns the destination point from start point having travelled the given distance on the
   * given initial bearing (bearing normally varies around path followed).
   *
   * @param   {GeoJSON.Position} start - Longitude/latitude of start point.
   * @param   {number} distance - Distance travelled, in same units as earth radius (default: metres).
   * @param   {number} bearing - Initial bearing in degrees from north.
   * @param   {number} [radius] - Radius of earth (defaults to mean radius in metres).
   * @returns {GeoJSON.Position} Destination point.
   *
   * @example
   *   const p1 = [-0.00147, 51.47788];
   *   const p2 = destinationPoint(p1, 7794, 300.7); // [0.0983, 51.5136]
   */
  function destinationPoint$1(start, distance, bearing, radius = DEFAULT_RADIUS$1) {
    // sinφ2 = sinφ1⋅cosδ + cosφ1⋅sinδ⋅cosθ
    // tanΔλ = sinθ⋅sinδ⋅cosφ1 / cosδ−sinφ1⋅sinφ2
    // see mathforum.org/library/drmath/view/52049.html for derivation
    const δ = distance / radius; // angular distance in radians
    const θ = toRadians(bearing);
    const φ1 = toRadians(start[1]),
      λ1 = toRadians(start[0]);
    const sinφ2 = Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ);
    const φ2 = Math.asin(sinφ2);
    const y = Math.sin(θ) * Math.sin(δ) * Math.cos(φ1);
    const x = Math.cos(δ) - Math.sin(φ1) * sinφ2;
    const λ2 = λ1 + Math.atan2(y, x);
    const lat = toDegrees(φ2);
    const lon = toDegrees(λ2);
    return [lon, lat];
  }

  // radius used by deck.gl, see https://github.com/visgl/deck.gl/blob/master/modules/core/src/viewports/globe-viewport.js#L10
  const DEFAULT_RADIUS = 6370972;
  function distance(start, destination) {
      return distance$1(start, destination, DEFAULT_RADIUS);
  }
  function destinationPoint(start, distance, bearing) {
      return destinationPoint$1(start, distance, bearing, DEFAULT_RADIUS);
  }

  function isViewportGlobe(viewport) {
      return !!viewport.resolution;
  }
  function isViewportMercator(viewport) {
      return !isViewportGlobe(viewport);
  }
  // use layerFilter instead, see https://github.com/visgl/deck.gl/issues/9409#issuecomment-2666820517
  function isViewportInZoomBounds(viewport, minZoom, maxZoom) {
      if (minZoom != null && viewport.zoom < minZoom) {
          return false;
      }
      if (maxZoom != null && viewport.zoom > maxZoom) {
          return false;
      }
      return true;
  }
  function getViewportGlobeCenter(viewport) {
      return [viewport.longitude, viewport.latitude];
  }
  function getViewportGlobeRadius(viewport) {
      const viewportGlobeCenter = getViewportGlobeCenter(viewport);
      const viewportGlobeRadius = Math.max(distance(viewportGlobeCenter, viewport.unproject([viewport.width / 2, 0])), distance(viewportGlobeCenter, viewport.unproject([0, viewport.height / 2])), ...(viewport.width > viewport.height ? [
          distance(viewportGlobeCenter, viewport.unproject([viewport.width / 2 - viewport.height / 4 * 1, viewport.height / 2])),
          distance(viewportGlobeCenter, viewport.unproject([viewport.width / 2 - viewport.height / 2 * 1, viewport.height / 2])),
          distance(viewportGlobeCenter, viewport.unproject([viewport.width / 2 - viewport.height / 4 * 3, viewport.height / 2])),
          distance(viewportGlobeCenter, viewport.unproject([viewport.width / 2 - viewport.height, viewport.height / 2])),
      ] : [
          distance(viewportGlobeCenter, viewport.unproject([viewport.width / 2, viewport.height / 2 - viewport.width / 4 * 1])),
          distance(viewportGlobeCenter, viewport.unproject([viewport.width / 2, viewport.height / 2 - viewport.width / 2 * 1])),
          distance(viewportGlobeCenter, viewport.unproject([viewport.width / 2, viewport.height / 2 - viewport.width / 4 * 3])),
          distance(viewportGlobeCenter, viewport.unproject([viewport.width / 2, viewport.height / 2 - viewport.width])),
      ]));
      return viewportGlobeRadius;
  }
  function getViewportBounds(viewport) {
      return wrapBounds(viewport.getBounds());
  }
  // viewport.zoom varies by latitude, using Math.log2(viewport.scale) instead because it is multiplied by scaleAdjust
  // TODO: report deck.gl bug
  function getViewportZoom(viewport) {
      return isViewportGlobe(viewport) ? Math.log2(viewport.scale) : viewport.zoom;
  }
  // see https://github.com/visgl/deck.gl/issues/9592
  function getViewportPixelOffset(viewport, offset) {
      return offset * (isViewportGlobe(viewport) ? -1 : 1);
  }
  // see https://github.com/visgl/deck.gl/issues/9592
  function getViewportAngle(viewport, angle) {
      return angle + (isViewportGlobe(viewport) ? 180 : 0);
  }

  function createPaletteTexture(device, paletteScale) {
      const paletteDomain = paletteScale.domain();
      const paletteBounds = [paletteDomain[0], paletteDomain[paletteDomain.length - 1]];
      const paletteCanvas = colorRampCanvas(paletteScale);
      const paletteTexture = device.createTexture({
          data: paletteCanvas,
          sampler: {
              magFilter: 'linear',
              minFilter: 'linear',
              addressModeU: 'clamp-to-edge',
              addressModeV: 'clamp-to-edge',
          },
      });
      return { paletteBounds, paletteTexture };
  }

  function deckColorToGl(color) {
      return [color[0] / 255, color[1] / 255, color[2] / 255, (color[3] ?? 255) / 255];
  }
  function paletteColorToGl(color) {
      return [color[0], color[1], color[2], color[3] * 255];
  }

  // eslint-disable
      const sourceCode$7 = "uniform bitmap2Uniforms{vec4 bounds;bool isRepeatBounds;float coordinateConversion;vec4 transparentColor;}bitmap2;const float _TILE_SIZE=512.;const float _PI=3.1415926536;const float _WORLD_SCALE=_TILE_SIZE/_PI/2.;vec2 lnglat_to_mercator(vec2 lnglat){float x=lnglat.x;float y=clamp(lnglat.y,-89.9,89.9);return vec2(radians(x)+_PI,_PI+log(tan(_PI*0.25+radians(y)*0.5)))*_WORLD_SCALE;}vec2 mercator_to_lnglat(vec2 xy){xy/=_WORLD_SCALE;return degrees(vec2(xy.x-_PI,atan(exp(xy.y-_PI))*2.-_PI*0.5));}vec4 apply_opacity(vec3 color,float alpha){return mix(bitmap2.transparentColor,vec4(color,1.),alpha);}vec2 getUV(vec2 pos){return vec2((pos.x-bitmap2.bounds[0])/(bitmap2.bounds[2]-bitmap2.bounds[0]),(pos.y-bitmap2.bounds[3])/(bitmap2.bounds[1]-bitmap2.bounds[3]));}vec2 getUVWithCoordinateConversion(vec2 texCoord,vec2 texPos){vec2 uv=texCoord;if(bitmap2.coordinateConversion<-0.5){vec2 lnglat=mercator_to_lnglat(texPos);uv=getUV(lnglat);}else if(bitmap2.coordinateConversion>0.5){vec2 commonPos=lnglat_to_mercator(texPos);uv=getUV(commonPos);}return uv;}";
      const tokens$4 = {};

  function isRectangularBounds(bounds) {
      return Number.isFinite(bounds[0]);
  }
  // copied from https://github.com/visgl/math.gl/blob/master/modules/web-mercator/src/web-mercator-utils.ts
  const PI = Math.PI;
  const PI_4 = PI / 4;
  const DEGREES_TO_RADIANS = PI / 180;
  const TILE_SIZE = 512;
  function lngLatToWorld(lngLat) {
      const [lng, lat] = lngLat;
      const lambda2 = lng * DEGREES_TO_RADIANS;
      const phi2 = lat * DEGREES_TO_RADIANS;
      const x = (TILE_SIZE * (lambda2 + PI)) / (2 * PI);
      const y = (TILE_SIZE * (PI + Math.log(Math.tan(PI_4 + phi2 * 0.5)))) / (2 * PI);
      return [x, y];
  }
  // copied from https://github.com/visgl/deck.gl/blob/master/modules/layers/src/bitmap-layer/bitmap-layer.ts
  function _getCoordinateUniforms(props = {}) {
      const { LNGLAT, CARTESIAN, DEFAULT } = core.COORDINATE_SYSTEM;
      let { viewportGlobe, bounds, _imageCoordinateSystem: imageCoordinateSystem } = props;
      if (!isRectangularBounds(bounds)) {
          throw new Error('_imageCoordinateSystem only supports rectangular bounds');
      }
      if (imageCoordinateSystem !== DEFAULT) {
          // The default behavior (linearly interpolated tex coords)
          const defaultImageCoordinateSystem = viewportGlobe ? LNGLAT : CARTESIAN;
          imageCoordinateSystem = imageCoordinateSystem === LNGLAT ? LNGLAT : CARTESIAN;
          if (imageCoordinateSystem === LNGLAT && defaultImageCoordinateSystem === CARTESIAN) {
              // LNGLAT in Mercator, e.g. display LNGLAT-encoded image in WebMercator projection
              return { coordinateConversion: -1, bounds };
          }
          if (imageCoordinateSystem === CARTESIAN && defaultImageCoordinateSystem === LNGLAT) {
              // Mercator in LNGLAT, e.g. display WebMercator encoded image in Globe projection
              const bottomLeft = lngLatToWorld([bounds[0], bounds[1]]);
              const topRight = lngLatToWorld([bounds[2], bounds[3]]);
              return {
                  coordinateConversion: 1,
                  bounds: [bottomLeft[0], bottomLeft[1], topRight[0], topRight[1]]
              };
          }
      }
      return { coordinateConversion: 0, bounds }; // bounds are used by particle layer in globe
  }
  function getUniforms$4(props = {}) {
      const { bounds, coordinateConversion } = _getCoordinateUniforms(props);
      return {
          [tokens$4.bounds]: bounds,
          [tokens$4.isRepeatBounds]: isRepeatBounds(bounds) ? 1 : 0,
          [tokens$4.coordinateConversion]: coordinateConversion,
          [tokens$4.transparentColor]: props.transparentColor ? deckColorToGl(props.transparentColor) : [0, 0, 0, 0],
      };
  }
  const bitmapModule = {
      name: 'bitmap2',
      vs: sourceCode$7,
      fs: sourceCode$7,
      uniformTypes: {
          [tokens$4.bounds]: 'vec4<f32>',
          [tokens$4.isRepeatBounds]: 'f32',
          [tokens$4.coordinateConversion]: 'f32',
          [tokens$4.transparentColor]: 'vec4<f32>',
      },
      getUniforms: getUniforms$4,
  };

  // eslint-disable
      const sourceCode$6 = "uniform sampler2D imageTexture;uniform sampler2D imageTexture2;uniform rasterUniforms{vec2 imageResolution;float imageSmoothing;float imageInterpolation;float imageWeight;float imageType;vec2 imageUnscale;float imageMinValue;float imageMaxValue;float borderEnabled;float borderWidth;vec4 borderColor;float gridEnabled;float gridSize;vec4 gridColor;}raster;";
      const tokens$3 = {"imageTexture":"imageTexture","imageTexture2":"imageTexture2"};

  function getUniforms$3(props = {}) {
      return {
          [tokens$3.imageTexture]: props.imageTexture,
          [tokens$3.imageTexture2]: props.imageTexture2,
          [tokens$3.imageResolution]: props.imageTexture ? [props.imageTexture.width, props.imageTexture.height] : [0, 0],
          [tokens$3.imageSmoothing]: props.imageSmoothing ?? 0,
          [tokens$3.imageInterpolation]: Object.values(ImageInterpolation).indexOf(props.imageInterpolation ?? ImageInterpolation.NEAREST),
          [tokens$3.imageWeight]: props.imageTexture2 !== props.imageTexture && props.imageWeight ? props.imageWeight : 0,
          [tokens$3.imageType]: Object.values(ImageType).indexOf(props.imageType ?? ImageType.SCALAR),
          [tokens$3.imageUnscale]: props.imageUnscale ?? [0, 0],
          [tokens$3.imageMinValue]: props.imageMinValue ?? Number.MIN_SAFE_INTEGER,
          [tokens$3.imageMaxValue]: props.imageMaxValue ?? Number.MAX_SAFE_INTEGER,
          [tokens$3.borderEnabled]: props.borderEnabled ? 1 : 0,
          [tokens$3.borderWidth]: props.borderWidth ?? 0,
          [tokens$3.borderColor]: props.borderColor ? deckColorToGl(props.borderColor) : [0, 0, 0, 0],
          [tokens$3.gridEnabled]: props.gridEnabled ? 1 : 0,
          [tokens$3.gridSize]: props.gridSize ?? 0,
          [tokens$3.gridColor]: props.gridColor ? deckColorToGl(props.gridColor) : [0, 0, 0, 0],
      };
  }
  const rasterModule = {
      name: 'raster',
      vs: sourceCode$6,
      fs: sourceCode$6,
      uniformTypes: {
          [tokens$3.imageResolution]: 'vec2<f32>',
          [tokens$3.imageSmoothing]: 'f32',
          [tokens$3.imageInterpolation]: 'f32',
          [tokens$3.imageWeight]: 'f32',
          [tokens$3.imageType]: 'f32',
          [tokens$3.imageUnscale]: 'vec2<f32>',
          [tokens$3.imageMinValue]: 'f32',
          [tokens$3.imageMaxValue]: 'f32',
          [tokens$3.borderEnabled]: 'f32',
          [tokens$3.borderWidth]: 'f32',
          [tokens$3.borderColor]: 'vec4<f32>',
          [tokens$3.gridEnabled]: 'f32',
          [tokens$3.gridSize]: 'f32',
          [tokens$3.gridColor]: 'vec4<f32>',
      },
      getUniforms: getUniforms$3,
  };

  // eslint-disable
      const sourceCode$5 = "uniform sampler2D paletteTexture;uniform paletteUniforms{vec2 paletteBounds;vec4 paletteColor;}palette;float getPaletteValue(float min,float max,float value){return(value-min)/(max-min);}vec4 applyPalette(sampler2D paletteTexture,vec2 paletteBounds,vec4 paletteColor,float value){if(paletteBounds[0]<paletteBounds[1]){float paletteValue=getPaletteValue(paletteBounds[0],paletteBounds[1],value);return texture(paletteTexture,vec2(paletteValue,0.));}else{return paletteColor;}}";
      const tokens$2 = {"paletteTexture":"paletteTexture"};

  function getUniforms$2(props = {}) {
      return {
          [tokens$2.paletteTexture]: props.paletteTexture,
          [tokens$2.paletteBounds]: props.paletteBounds ?? [0, 0],
          [tokens$2.paletteColor]: props.paletteColor ? deckColorToGl(props.paletteColor) : [0, 0, 0, 0],
      };
  }
  const paletteModule = {
      name: 'palette',
      vs: sourceCode$5,
      fs: sourceCode$5,
      uniformTypes: {
          [tokens$2.paletteBounds]: 'vec2<f32>',
          [tokens$2.paletteColor]: 'vec4<f32>',
      },
      getUniforms: getUniforms$2,
  };

  // eslint-disable
      const sourceCode$4 = "#version 300 es\n#define SHADER_NAME  raster-bitmap-layer-fragment-shader\n#ifdef GL_ES\nprecision highp float;\n#endif\nvec4 getPixel(sampler2D image,vec2 imageDownscaleResolution,vec2 iuv,vec2 offset){vec2 uv=(iuv+offset+0.5)/imageDownscaleResolution;return texture(image,uv);}const vec4 BS_A=vec4(3.,-6.,0.,4.)/6.;const vec4 BS_B=vec4(-1.,6.,-12.,8.)/6.;vec4 powers(float x){return vec4(x*x*x,x*x,x,1.);}vec4 spline(vec4 c0,vec4 c1,vec4 c2,vec4 c3,float a){vec4 color=c0*dot(BS_B,powers(a+1.))+c1*dot(BS_A,powers(a))+c2*dot(BS_A,powers(1.-a))+c3*dot(BS_B,powers(2.-a));color.a=(c0.a>0.&&c1.a>0.&&c2.a>0.&&c3.a>0.)?max(max(max(c0.a,c1.a),c2.a),c3.a):0.;return color;}vec4 getPixelCubic(sampler2D image,vec2 imageDownscaleResolution,vec2 uv){vec2 tuv=uv*imageDownscaleResolution-0.5;vec2 iuv=floor(tuv);vec2 fuv=fract(tuv);return spline(spline(getPixel(image,imageDownscaleResolution,iuv,vec2(-1,-1)),getPixel(image,imageDownscaleResolution,iuv,vec2(0,-1)),getPixel(image,imageDownscaleResolution,iuv,vec2(1,-1)),getPixel(image,imageDownscaleResolution,iuv,vec2(2,-1)),fuv.x),spline(getPixel(image,imageDownscaleResolution,iuv,vec2(-1,0)),getPixel(image,imageDownscaleResolution,iuv,vec2(0,0)),getPixel(image,imageDownscaleResolution,iuv,vec2(1,0)),getPixel(image,imageDownscaleResolution,iuv,vec2(2,0)),fuv.x),spline(getPixel(image,imageDownscaleResolution,iuv,vec2(-1,1)),getPixel(image,imageDownscaleResolution,iuv,vec2(0,1)),getPixel(image,imageDownscaleResolution,iuv,vec2(1,1)),getPixel(image,imageDownscaleResolution,iuv,vec2(2,1)),fuv.x),spline(getPixel(image,imageDownscaleResolution,iuv,vec2(-1,2)),getPixel(image,imageDownscaleResolution,iuv,vec2(0,2)),getPixel(image,imageDownscaleResolution,iuv,vec2(1,2)),getPixel(image,imageDownscaleResolution,iuv,vec2(2,2)),fuv.x),fuv.y);}vec4 getPixelLinear(sampler2D image,vec2 imageDownscaleResolution,vec2 uv){vec2 tuv=uv*imageDownscaleResolution-0.5;vec2 iuv=floor(tuv);vec2 fuv=fract(tuv);return mix(mix(getPixel(image,imageDownscaleResolution,iuv,vec2(0,0)),getPixel(image,imageDownscaleResolution,iuv,vec2(1,0)),fuv.x),mix(getPixel(image,imageDownscaleResolution,iuv,vec2(0,1)),getPixel(image,imageDownscaleResolution,iuv,vec2(1,1)),fuv.x),fuv.y);}vec4 getPixelNearest(sampler2D image,vec2 imageDownscaleResolution,vec2 uv){vec2 tuv=uv*imageDownscaleResolution-0.5;vec2 iuv=floor(tuv+0.5);return getPixel(image,imageDownscaleResolution,iuv,vec2(0,0));}vec4 getPixelFilter(sampler2D image,vec2 imageDownscaleResolution,float imageInterpolation,vec2 uv){if(imageInterpolation==2.){return getPixelCubic(image,imageDownscaleResolution,uv);}if(imageInterpolation==1.){return getPixelLinear(image,imageDownscaleResolution,uv);}else{return getPixelNearest(image,imageDownscaleResolution,uv);}}vec4 getPixelInterpolate(sampler2D image,sampler2D image2,vec2 imageDownscaleResolution,float imageInterpolation,float imageWeight,bool isRepeatBounds,vec2 uv){vec2 uvWithOffset;uvWithOffset.x=isRepeatBounds?uv.x+0.5/imageDownscaleResolution.x:mix(0.+0.5/imageDownscaleResolution.x,1.-0.5/imageDownscaleResolution.x,uv.x);uvWithOffset.y=mix(0.+0.5/imageDownscaleResolution.y,1.-0.5/imageDownscaleResolution.y,uv.y);if(imageWeight>0.){vec4 pixel=getPixelFilter(image,imageDownscaleResolution,imageInterpolation,uvWithOffset);vec4 pixel2=getPixelFilter(image2,imageDownscaleResolution,imageInterpolation,uvWithOffset);return mix(pixel,pixel2,imageWeight);}else{return getPixelFilter(image,imageDownscaleResolution,imageInterpolation,uvWithOffset);}}vec4 getPixelSmoothInterpolate(sampler2D image,sampler2D image2,vec2 imageResolution,float imageSmoothing,float imageInterpolation,float imageWeight,bool isRepeatBounds,vec2 uv){float imageDownscaleResolutionFactor=1.+max(0.,imageSmoothing);vec2 imageDownscaleResolution=imageResolution/imageDownscaleResolutionFactor;return getPixelInterpolate(image,image2,imageDownscaleResolution,imageInterpolation,imageWeight,isRepeatBounds,uv);}float atan2(float y,float x){return x==0.?sign(y)*_PI/2.:atan(y,x);}bool isNaN(float value){uint valueUint=floatBitsToUint(value);return(valueUint&0x7fffffffu)>0x7f800000u;}bool hasPixelValue(vec4 pixel,vec2 imageUnscale){if(imageUnscale[0]<imageUnscale[1]){return pixel.a>=1.;}else{return!isNaN(pixel.x);}}float getPixelScalarValue(vec4 pixel,float imageType,vec2 imageUnscale){if(imageType==1.){return 0.;}else{if(imageUnscale[0]<imageUnscale[1]){return mix(imageUnscale[0],imageUnscale[1],pixel.x);}else{return pixel.x;}}}vec2 getPixelVectorValue(vec4 pixel,float imageType,vec2 imageUnscale){if(imageType==1.){if(imageUnscale[0]<imageUnscale[1]){return mix(vec2(imageUnscale[0]),vec2(imageUnscale[1]),pixel.xy);}else{return pixel.xy;}}else{return vec2(0.);}}float getPixelMagnitudeValue(vec4 pixel,float imageType,vec2 imageUnscale){if(imageType==1.){vec2 value=getPixelVectorValue(pixel,imageType,imageUnscale);return length(value);}else{return getPixelScalarValue(pixel,imageType,imageUnscale);}}float getPixelDirectionValue(vec4 pixel,float imageType,vec2 imageUnscale){if(imageType==1.){vec2 value=getPixelVectorValue(pixel,imageType,imageUnscale);return mod((360.-(atan2(value.y,value.x)/_PI*180.+180.))-270.,360.)/360.;}else{return 0.;}}in vec2 vTexCoord;in vec2 vTexPos;out vec4 fragColor;void main(void){vec2 uv=getUVWithCoordinateConversion(vTexCoord,vTexPos);vec4 pixel=getPixelSmoothInterpolate(imageTexture,imageTexture2,raster.imageResolution,raster.imageSmoothing,raster.imageInterpolation,raster.imageWeight,bitmap2.isRepeatBounds,uv);if(!hasPixelValue(pixel,raster.imageUnscale)){discard;}float value=getPixelMagnitudeValue(pixel,raster.imageType,raster.imageUnscale);if((!isNaN(raster.imageMinValue)&&value<raster.imageMinValue)||(!isNaN(raster.imageMaxValue)&&value>raster.imageMaxValue)){discard;}vec4 targetColor=applyPalette(paletteTexture,palette.paletteBounds,palette.paletteColor,value);fragColor=apply_opacity(targetColor.rgb,targetColor.a*layer.opacity);if(bool(raster.borderEnabled)){vec2 pixelSize=vec2(length(dFdx(uv)),length(dFdy(uv)));vec2 borderWidth=raster.borderWidth/2.*pixelSize;if((uv.x<borderWidth.x||uv.x>1.-borderWidth.x)||(uv.y<borderWidth.y||uv.y>1.-borderWidth.y)){fragColor=apply_opacity(raster.borderColor.rgb,raster.borderColor.a*layer.opacity*2.);}}if(bool(raster.gridEnabled)){float imageDownscaleResolutionFactor=1.+max(0.,raster.imageSmoothing);vec2 imageDownscaleResolution=raster.imageResolution/imageDownscaleResolutionFactor;vec2 uvWithOffset;uvWithOffset.x=bitmap2.isRepeatBounds?uv.x+0.5/imageDownscaleResolution.x:mix(0.+0.5/imageDownscaleResolution.x,1.-0.5/imageDownscaleResolution.x,uv.x);uvWithOffset.y=mix(0.+0.5/imageDownscaleResolution.y,1.-0.5/imageDownscaleResolution.y,uv.y);vec2 tuv=uvWithOffset*imageDownscaleResolution-0.5;vec2 fuv=fract(tuv);vec2 pixelSize=vec2(length(dFdx(uv)),length(dFdy(uv)));vec2 gridSize=raster.gridSize/2.*pixelSize*raster.imageResolution;if((fuv.x<gridSize.x||fuv.x>1.-gridSize.x)&&(fuv.y<gridSize.y||fuv.y>1.-gridSize.y)){fragColor=apply_opacity(raster.gridColor.rgb,raster.gridColor.a*layer.opacity*2.);}}geometry.uv=uv;DECKGL_FILTER_COLOR(fragColor,geometry);if(bool(picking.isActive)&&!bool(picking.isAttribute)){float paletteValue=getPaletteValue(palette.paletteBounds[0],palette.paletteBounds[1],value);float directionValue=getPixelDirectionValue(pixel,raster.imageType,raster.imageUnscale);fragColor=vec4(paletteValue,directionValue,0,1);}}";

  const defaultProps$b = {
      imageTexture: { type: 'object', value: null },
      imageTexture2: { type: 'object', value: null },
      imageSmoothing: { type: 'number', value: 0 },
      imageInterpolation: { type: 'object', value: ImageInterpolation.CUBIC },
      imageWeight: { type: 'number', value: 0 },
      imageType: { type: 'object', value: ImageType.SCALAR },
      imageUnscale: { type: 'array', value: null },
      imageMinValue: { type: 'object', value: null },
      imageMaxValue: { type: 'object', value: null },
      bounds: { type: 'array', value: [-180, -90, 180, 90], compare: true },
      minZoom: { type: 'object', value: null },
      maxZoom: { type: 'object', value: null },
      palette: { type: 'object', value: null },
      borderEnabled: { type: 'boolean', value: false },
      borderWidth: { type: 'number', value: DEFAULT_LINE_WIDTH },
      borderColor: { type: 'color', value: DEFAULT_LINE_COLOR },
      gridEnabled: { type: 'boolean', value: false },
      gridSize: { type: 'number', value: DEFAULT_LINE_WIDTH },
      gridColor: { type: 'color', value: DEFAULT_LINE_COLOR },
  };
  class RasterBitmapLayer extends layers.BitmapLayer {
      getShaders() {
          const parentShaders = super.getShaders();
          return {
              ...parentShaders,
              fs: sourceCode$4,
              modules: [...parentShaders.modules, bitmapModule, rasterModule, paletteModule],
          };
      }
      updateState(params) {
          const { palette } = params.props;
          super.updateState(params);
          if (palette !== params.oldProps.palette) {
              this._updatePalette();
          }
      }
      draw(opts) {
          const { device, viewport } = this.context;
          const { model } = this.state;
          const { imageTexture, imageTexture2, imageSmoothing, imageInterpolation, imageWeight, imageType, imageUnscale, imageMinValue, imageMaxValue, bounds, _imageCoordinateSystem, transparentColor, minZoom, maxZoom, borderEnabled, borderWidth, borderColor, gridEnabled, gridSize, gridColor } = ensureDefaultProps(this.props, defaultProps$b);
          const { paletteTexture, paletteBounds } = this.state;
          if (!imageTexture) {
              return;
          }
          // viewport
          const viewportGlobe = isViewportGlobe(viewport);
          if (model && isViewportInZoomBounds(viewport, minZoom, maxZoom)) {
              model.shaderInputs.setProps({
                  [bitmapModule.name]: {
                      viewportGlobe, bounds, _imageCoordinateSystem, transparentColor,
                  },
                  [rasterModule.name]: {
                      imageTexture: imageTexture ?? createEmptyTextureCached(device),
                      imageTexture2: imageTexture2 ?? createEmptyTextureCached(device),
                      imageSmoothing, imageInterpolation, imageWeight, imageType, imageUnscale, imageMinValue, imageMaxValue,
                      borderEnabled, borderWidth, borderColor,
                      gridEnabled, gridSize, gridColor,
                  },
                  [paletteModule.name]: {
                      paletteTexture: paletteTexture ?? createEmptyTextureCached(device),
                      paletteBounds,
                  },
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
      _updatePalette() {
          const { device } = this.context;
          const { palette } = ensureDefaultProps(this.props, defaultProps$b);
          if (!palette) {
              this.setState({ paletteTexture: undefined, paletteBounds: undefined });
              return;
          }
          const paletteScale = parsePalette(palette);
          const { paletteBounds, paletteTexture } = createPaletteTexture(device, paletteScale);
          this.setState({ paletteTexture, paletteBounds });
      }
      _getRasterMagnitudeValue(color, paletteBounds) {
          return paletteBounds[0] + color[0] / 255 * (paletteBounds[1] - paletteBounds[0]);
      }
      _getRasterDirectionValue(color) {
          const { imageType } = ensureDefaultProps(this.props, defaultProps$b);
          if (imageType === ImageType.VECTOR) {
              return color[1] / 255 * 360;
          }
          else {
              return NaN;
          }
      }
      getPickingInfo(params) {
          const info = super.getPickingInfo(params);
          const { imageType } = ensureDefaultProps(this.props, defaultProps$b);
          const { paletteBounds } = this.state;
          if (!info.color) {
              return info;
          }
          let rasterPointProperties;
          const value = this._getRasterMagnitudeValue(info.color, paletteBounds ?? [0, 0]);
          if (imageType === ImageType.VECTOR) {
              const direction = this._getRasterDirectionValue(info.color);
              rasterPointProperties = { value, direction };
          }
          else {
              rasterPointProperties = { value };
          }
          info.raster = rasterPointProperties;
          return info;
      }
  }
  RasterBitmapLayer.layerName = 'RasterBitmapLayer';
  RasterBitmapLayer.defaultProps = defaultProps$b;

  const defaultProps$a = {
      ...RasterBitmapLayer.defaultProps,
      imageTexture: undefined,
      imageTexture2: undefined,
      image: { type: 'object', value: null }, // object instead of image to allow reading raw data
      image2: { type: 'object', value: null }, // object instead of image to allow reading raw data
      bounds: { type: 'array', value: [-180, -90, 180, 90], compare: true },
  };
  class RasterLayer extends core.CompositeLayer {
      renderLayers() {
          const { device } = this.context;
          const { props, imageTexture, imageTexture2 } = this.state;
          if (!props || !imageTexture) {
              return [];
          }
          return [
              new RasterBitmapLayer(this.props, this.getSubLayerProps({
                  ...{
                      id: 'bitmap',
                      imageTexture,
                      imageTexture2,
                      _imageCoordinateSystem: core.COORDINATE_SYSTEM.LNGLAT,
                  },
                  image: createEmptyTextureCached(device),
                  image2: createEmptyTextureCached(device),
              })),
          ];
      }
      updateState(params) {
          const { image, image2, imageUnscale, bounds } = params.props;
          super.updateState(params);
          if (image && imageUnscale && !(image.data instanceof Uint8Array || image.data instanceof Uint8ClampedArray)) {
              throw new Error('imageUnscale can be applied to Uint8 data only');
          }
          if (image !== params.oldProps.image || image2 !== params.oldProps.image2) {
              const { device } = this.context;
              const { image, image2 } = this.props;
              const imageTexture = image ? createTextureCached(device, image, isRepeatBounds(bounds)) : null;
              const imageTexture2 = image2 ? createTextureCached(device, image2, isRepeatBounds(bounds)) : null;
              this.setState({ imageTexture, imageTexture2 });
          }
          this.setState({ props: params.props });
      }
  }
  RasterLayer.layerName = 'RasterLayer';
  RasterLayer.defaultProps = defaultProps$a;

  // eslint-disable
      const sourceCode$3 = "uniform contourUniforms{float interval;float majorInterval;float width;}contour;";
      const tokens$1 = {};

  function getUniforms$1(props = {}) {
      return {
          [tokens$1.interval]: props.interval,
          [tokens$1.majorInterval]: props.majorInterval,
          [tokens$1.width]: props.width,
      };
  }
  const contourModule = {
      name: 'contour',
      vs: sourceCode$3,
      fs: sourceCode$3,
      uniformTypes: {
          [tokens$1.interval]: 'f32',
          [tokens$1.majorInterval]: 'f32',
          [tokens$1.width]: 'f32',
      },
      getUniforms: getUniforms$1,
  };

  // eslint-disable
      const sourceCode$2 = "#version 300 es\n#define SHADER_NAME  contour-bitmap-layer-fragment-shader\n#ifdef GL_ES\nprecision highp float;\n#endif\nvec4 getPixel(sampler2D image,vec2 imageDownscaleResolution,vec2 iuv,vec2 offset){vec2 uv=(iuv+offset+0.5)/imageDownscaleResolution;return texture(image,uv);}const vec4 BS_A=vec4(3.,-6.,0.,4.)/6.;const vec4 BS_B=vec4(-1.,6.,-12.,8.)/6.;vec4 powers(float x){return vec4(x*x*x,x*x,x,1.);}vec4 spline(vec4 c0,vec4 c1,vec4 c2,vec4 c3,float a){vec4 color=c0*dot(BS_B,powers(a+1.))+c1*dot(BS_A,powers(a))+c2*dot(BS_A,powers(1.-a))+c3*dot(BS_B,powers(2.-a));color.a=(c0.a>0.&&c1.a>0.&&c2.a>0.&&c3.a>0.)?max(max(max(c0.a,c1.a),c2.a),c3.a):0.;return color;}vec4 getPixelCubic(sampler2D image,vec2 imageDownscaleResolution,vec2 uv){vec2 tuv=uv*imageDownscaleResolution-0.5;vec2 iuv=floor(tuv);vec2 fuv=fract(tuv);return spline(spline(getPixel(image,imageDownscaleResolution,iuv,vec2(-1,-1)),getPixel(image,imageDownscaleResolution,iuv,vec2(0,-1)),getPixel(image,imageDownscaleResolution,iuv,vec2(1,-1)),getPixel(image,imageDownscaleResolution,iuv,vec2(2,-1)),fuv.x),spline(getPixel(image,imageDownscaleResolution,iuv,vec2(-1,0)),getPixel(image,imageDownscaleResolution,iuv,vec2(0,0)),getPixel(image,imageDownscaleResolution,iuv,vec2(1,0)),getPixel(image,imageDownscaleResolution,iuv,vec2(2,0)),fuv.x),spline(getPixel(image,imageDownscaleResolution,iuv,vec2(-1,1)),getPixel(image,imageDownscaleResolution,iuv,vec2(0,1)),getPixel(image,imageDownscaleResolution,iuv,vec2(1,1)),getPixel(image,imageDownscaleResolution,iuv,vec2(2,1)),fuv.x),spline(getPixel(image,imageDownscaleResolution,iuv,vec2(-1,2)),getPixel(image,imageDownscaleResolution,iuv,vec2(0,2)),getPixel(image,imageDownscaleResolution,iuv,vec2(1,2)),getPixel(image,imageDownscaleResolution,iuv,vec2(2,2)),fuv.x),fuv.y);}vec4 getPixelLinear(sampler2D image,vec2 imageDownscaleResolution,vec2 uv){vec2 tuv=uv*imageDownscaleResolution-0.5;vec2 iuv=floor(tuv);vec2 fuv=fract(tuv);return mix(mix(getPixel(image,imageDownscaleResolution,iuv,vec2(0,0)),getPixel(image,imageDownscaleResolution,iuv,vec2(1,0)),fuv.x),mix(getPixel(image,imageDownscaleResolution,iuv,vec2(0,1)),getPixel(image,imageDownscaleResolution,iuv,vec2(1,1)),fuv.x),fuv.y);}vec4 getPixelNearest(sampler2D image,vec2 imageDownscaleResolution,vec2 uv){vec2 tuv=uv*imageDownscaleResolution-0.5;vec2 iuv=floor(tuv+0.5);return getPixel(image,imageDownscaleResolution,iuv,vec2(0,0));}vec4 getPixelFilter(sampler2D image,vec2 imageDownscaleResolution,float imageInterpolation,vec2 uv){if(imageInterpolation==2.){return getPixelCubic(image,imageDownscaleResolution,uv);}if(imageInterpolation==1.){return getPixelLinear(image,imageDownscaleResolution,uv);}else{return getPixelNearest(image,imageDownscaleResolution,uv);}}vec4 getPixelInterpolate(sampler2D image,sampler2D image2,vec2 imageDownscaleResolution,float imageInterpolation,float imageWeight,bool isRepeatBounds,vec2 uv){vec2 uvWithOffset;uvWithOffset.x=isRepeatBounds?uv.x+0.5/imageDownscaleResolution.x:mix(0.+0.5/imageDownscaleResolution.x,1.-0.5/imageDownscaleResolution.x,uv.x);uvWithOffset.y=mix(0.+0.5/imageDownscaleResolution.y,1.-0.5/imageDownscaleResolution.y,uv.y);if(imageWeight>0.){vec4 pixel=getPixelFilter(image,imageDownscaleResolution,imageInterpolation,uvWithOffset);vec4 pixel2=getPixelFilter(image2,imageDownscaleResolution,imageInterpolation,uvWithOffset);return mix(pixel,pixel2,imageWeight);}else{return getPixelFilter(image,imageDownscaleResolution,imageInterpolation,uvWithOffset);}}vec4 getPixelSmoothInterpolate(sampler2D image,sampler2D image2,vec2 imageResolution,float imageSmoothing,float imageInterpolation,float imageWeight,bool isRepeatBounds,vec2 uv){float imageDownscaleResolutionFactor=1.+max(0.,imageSmoothing);vec2 imageDownscaleResolution=imageResolution/imageDownscaleResolutionFactor;return getPixelInterpolate(image,image2,imageDownscaleResolution,imageInterpolation,imageWeight,isRepeatBounds,uv);}float atan2(float y,float x){return x==0.?sign(y)*_PI/2.:atan(y,x);}bool isNaN(float value){uint valueUint=floatBitsToUint(value);return(valueUint&0x7fffffffu)>0x7f800000u;}bool hasPixelValue(vec4 pixel,vec2 imageUnscale){if(imageUnscale[0]<imageUnscale[1]){return pixel.a>=1.;}else{return!isNaN(pixel.x);}}float getPixelScalarValue(vec4 pixel,float imageType,vec2 imageUnscale){if(imageType==1.){return 0.;}else{if(imageUnscale[0]<imageUnscale[1]){return mix(imageUnscale[0],imageUnscale[1],pixel.x);}else{return pixel.x;}}}vec2 getPixelVectorValue(vec4 pixel,float imageType,vec2 imageUnscale){if(imageType==1.){if(imageUnscale[0]<imageUnscale[1]){return mix(vec2(imageUnscale[0]),vec2(imageUnscale[1]),pixel.xy);}else{return pixel.xy;}}else{return vec2(0.);}}float getPixelMagnitudeValue(vec4 pixel,float imageType,vec2 imageUnscale){if(imageType==1.){vec2 value=getPixelVectorValue(pixel,imageType,imageUnscale);return length(value);}else{return getPixelScalarValue(pixel,imageType,imageUnscale);}}float getPixelDirectionValue(vec4 pixel,float imageType,vec2 imageUnscale){if(imageType==1.){vec2 value=getPixelVectorValue(pixel,imageType,imageUnscale);return mod((360.-(atan2(value.y,value.x)/_PI*180.+180.))-270.,360.)/360.;}else{return 0.;}}in vec2 vTexCoord;in vec2 vTexPos;out vec4 fragColor;void main(void){vec2 uv=getUVWithCoordinateConversion(vTexCoord,vTexPos);vec4 pixel=getPixelSmoothInterpolate(imageTexture,imageTexture2,raster.imageResolution,raster.imageSmoothing,raster.imageInterpolation,raster.imageWeight,bitmap2.isRepeatBounds,uv);if(!hasPixelValue(pixel,raster.imageUnscale)){discard;}float value=getPixelMagnitudeValue(pixel,raster.imageType,raster.imageUnscale);if((!isNaN(raster.imageMinValue)&&value<raster.imageMinValue)||(!isNaN(raster.imageMaxValue)&&value>raster.imageMaxValue)){discard;}float majorIntervalRatio=contour.majorInterval>contour.interval?floor(contour.majorInterval/contour.interval):1.;float contourValue=value/contour.interval;float contourMajor=(step(fract(contourValue/majorIntervalRatio),0.1)+1.)/2.;float contourWidth=contour.width*contourMajor;float factor=abs(fract(contourValue+0.5)-0.5);float dFactor=length(vec2(dFdx(contourValue),dFdy(contourValue)));float contourOpacity=1.-clamp((factor/dFactor)+0.5-contourWidth,0.,1.);if(dFactor==0.){contourOpacity=0.;}float contourOpacityMajor=contourOpacity*contourMajor;vec4 targetColor=applyPalette(paletteTexture,palette.paletteBounds,palette.paletteColor,value);fragColor=vec4(targetColor.rgb,targetColor.a*contourOpacityMajor*layer.opacity);geometry.uv=uv;DECKGL_FILTER_COLOR(fragColor,geometry);}";

  const defaultProps$9 = {
      imageTexture: { type: 'object', value: null },
      imageTexture2: { type: 'object', value: null },
      imageSmoothing: { type: 'number', value: 0 },
      imageInterpolation: { type: 'object', value: ImageInterpolation.CUBIC },
      imageWeight: { type: 'number', value: 0 },
      imageType: { type: 'object', value: ImageType.SCALAR },
      imageUnscale: { type: 'object', value: null },
      imageMinValue: { type: 'object', value: null },
      imageMaxValue: { type: 'object', value: null },
      bounds: { type: 'array', value: [-180, -90, 180, 90], compare: true },
      minZoom: { type: 'object', value: null },
      maxZoom: { type: 'object', value: 10 }, // drop rendering artifacts in high zoom levels due to a low precision
      palette: { type: 'object', value: null },
      color: { type: 'color', value: DEFAULT_LINE_COLOR },
      interval: { type: 'number', value: 0 },
      majorInterval: { type: 'number', value: 0 },
      width: { type: 'number', value: DEFAULT_LINE_WIDTH },
  };
  class ContourBitmapLayer extends layers.BitmapLayer {
      getShaders() {
          const parentShaders = super.getShaders();
          return {
              ...parentShaders,
              fs: sourceCode$2,
              modules: [...parentShaders.modules, bitmapModule, rasterModule, paletteModule, contourModule],
          };
      }
      updateState(params) {
          const { palette } = params.props;
          super.updateState(params);
          if (palette !== params.oldProps.palette) {
              this._updatePalette();
          }
      }
      draw(opts) {
          const { device, viewport } = this.context;
          const { model } = this.state;
          const { imageTexture, imageTexture2, imageSmoothing, imageInterpolation, imageWeight, imageType, imageUnscale, imageMinValue, imageMaxValue, bounds, _imageCoordinateSystem, transparentColor, minZoom, maxZoom, color, interval, majorInterval, width } = ensureDefaultProps(this.props, defaultProps$9);
          const { paletteTexture, paletteBounds } = this.state;
          if (!imageTexture) {
              return;
          }
          // viewport
          const viewportGlobe = isViewportGlobe(viewport);
          if (model && isViewportInZoomBounds(viewport, minZoom, maxZoom)) {
              model.shaderInputs.setProps({
                  [bitmapModule.name]: {
                      viewportGlobe, bounds, _imageCoordinateSystem, transparentColor,
                  },
                  [rasterModule.name]: {
                      imageTexture: imageTexture ?? createEmptyTextureCached(device),
                      imageTexture2: imageTexture2 ?? createEmptyTextureCached(device),
                      imageSmoothing, imageInterpolation, imageWeight, imageType, imageUnscale, imageMinValue, imageMaxValue,
                  },
                  [paletteModule.name]: {
                      paletteTexture: paletteTexture ?? createEmptyTextureCached(device),
                      paletteBounds, paletteColor: color,
                  },
                  [contourModule.name]: {
                      interval, majorInterval, width,
                  },
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
      _updatePalette() {
          const { device } = this.context;
          const { palette } = ensureDefaultProps(this.props, defaultProps$9);
          if (!palette) {
              this.setState({ paletteTexture: undefined, paletteBounds: undefined });
              return;
          }
          const paletteScale = parsePalette(palette);
          const { paletteBounds, paletteTexture } = createPaletteTexture(device, paletteScale);
          this.setState({ paletteTexture, paletteBounds });
      }
  }
  ContourBitmapLayer.layerName = 'ContourBitmapLayer';
  ContourBitmapLayer.defaultProps = defaultProps$9;

  const defaultProps$8 = {
      ...ContourBitmapLayer.defaultProps,
      imageTexture: undefined,
      imageTexture2: undefined,
      image: { type: 'object', value: null }, // object instead of image to allow reading raw data
      image2: { type: 'object', value: null }, // object instead of image to allow reading raw data
  };
  class ContourLayer extends core.CompositeLayer {
      renderLayers() {
          const { device } = this.context;
          const { props, imageTexture, imageTexture2 } = this.state;
          if (!props || !imageTexture) {
              return [];
          }
          return [
              new ContourBitmapLayer(this.props, this.getSubLayerProps({
                  ...{
                      id: 'bitmap',
                      imageTexture,
                      imageTexture2,
                      _imageCoordinateSystem: core.COORDINATE_SYSTEM.LNGLAT,
                  },
                  image: createEmptyTextureCached(device),
                  image2: createEmptyTextureCached(device),
              })),
          ];
      }
      updateState(params) {
          const { image, image2, imageUnscale, bounds } = params.props;
          super.updateState(params);
          if (image && imageUnscale && !(image.data instanceof Uint8Array || image.data instanceof Uint8ClampedArray)) {
              throw new Error('imageUnscale can be applied to Uint8 data only');
          }
          if (image !== params.oldProps.image || image2 !== params.oldProps.image2) {
              const { device } = this.context;
              const { image, image2 } = this.props;
              const imageTexture = image ? createTextureCached(device, image, isRepeatBounds(bounds)) : null;
              const imageTexture2 = image2 ? createTextureCached(device, image2, isRepeatBounds(bounds)) : null;
              this.setState({ imageTexture, imageTexture2 });
          }
          this.setState({ props: params.props });
      }
  }
  ContourLayer.layerName = 'ContourLayer';
  ContourLayer.defaultProps = defaultProps$8;

  const CHARACTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  function randomString(length = 20) {
      return new Array(length).fill(undefined).map(() => CHARACTERS.charAt(Math.floor(Math.random() * CHARACTERS.length))).join('');
  }

  /**
   * @license
   * Copyright 2019 Google LLC
   * SPDX-License-Identifier: Apache-2.0
   */
  const proxyMarker = Symbol("Comlink.proxy");
  const createEndpoint = Symbol("Comlink.endpoint");
  const releaseProxy = Symbol("Comlink.releaseProxy");
  const finalizer = Symbol("Comlink.finalizer");
  const throwMarker = Symbol("Comlink.thrown");
  const isObject = val => typeof val === "object" && val !== null || typeof val === "function";
  /**
   * Internal transfer handle to handle objects marked to proxy.
   */
  const proxyTransferHandler = {
    canHandle: val => isObject(val) && val[proxyMarker],
    serialize(obj) {
      const {
        port1,
        port2
      } = new MessageChannel();
      expose(obj, port1);
      return [port2, [port2]];
    },
    deserialize(port) {
      port.start();
      return wrap(port);
    }
  };
  /**
   * Internal transfer handler to handle thrown exceptions.
   */
  const throwTransferHandler = {
    canHandle: value => isObject(value) && throwMarker in value,
    serialize({
      value
    }) {
      let serialized;
      if (value instanceof Error) {
        serialized = {
          isError: true,
          value: {
            message: value.message,
            name: value.name,
            stack: value.stack
          }
        };
      } else {
        serialized = {
          isError: false,
          value
        };
      }
      return [serialized, []];
    },
    deserialize(serialized) {
      if (serialized.isError) {
        throw Object.assign(new Error(serialized.value.message), serialized.value);
      }
      throw serialized.value;
    }
  };
  /**
   * Allows customizing the serialization of certain values.
   */
  const transferHandlers = new Map([["proxy", proxyTransferHandler], ["throw", throwTransferHandler]]);
  function isAllowedOrigin(allowedOrigins, origin) {
    for (const allowedOrigin of allowedOrigins) {
      if (origin === allowedOrigin || allowedOrigin === "*") {
        return true;
      }
      if (allowedOrigin instanceof RegExp && allowedOrigin.test(origin)) {
        return true;
      }
    }
    return false;
  }
  function expose(obj, ep = globalThis, allowedOrigins = ["*"]) {
    ep.addEventListener("message", function callback(ev) {
      if (!ev || !ev.data) {
        return;
      }
      if (!isAllowedOrigin(allowedOrigins, ev.origin)) {
        console.warn(`Invalid origin '${ev.origin}' for comlink proxy`);
        return;
      }
      const {
        id,
        type,
        path
      } = Object.assign({
        path: []
      }, ev.data);
      const argumentList = (ev.data.argumentList || []).map(fromWireValue);
      let returnValue;
      try {
        const parent = path.slice(0, -1).reduce((obj, prop) => obj[prop], obj);
        const rawValue = path.reduce((obj, prop) => obj[prop], obj);
        switch (type) {
          case "GET" /* MessageType.GET */:
            {
              returnValue = rawValue;
            }
            break;
          case "SET" /* MessageType.SET */:
            {
              parent[path.slice(-1)[0]] = fromWireValue(ev.data.value);
              returnValue = true;
            }
            break;
          case "APPLY" /* MessageType.APPLY */:
            {
              returnValue = rawValue.apply(parent, argumentList);
            }
            break;
          case "CONSTRUCT" /* MessageType.CONSTRUCT */:
            {
              const value = new rawValue(...argumentList);
              returnValue = proxy(value);
            }
            break;
          case "ENDPOINT" /* MessageType.ENDPOINT */:
            {
              const {
                port1,
                port2
              } = new MessageChannel();
              expose(obj, port2);
              returnValue = transfer(port1, [port1]);
            }
            break;
          case "RELEASE" /* MessageType.RELEASE */:
            {
              returnValue = undefined;
            }
            break;
          default:
            return;
        }
      } catch (value) {
        returnValue = {
          value,
          [throwMarker]: 0
        };
      }
      Promise.resolve(returnValue).catch(value => {
        return {
          value,
          [throwMarker]: 0
        };
      }).then(returnValue => {
        const [wireValue, transferables] = toWireValue(returnValue);
        ep.postMessage(Object.assign(Object.assign({}, wireValue), {
          id
        }), transferables);
        if (type === "RELEASE" /* MessageType.RELEASE */) {
          // detach and deactive after sending release response above.
          ep.removeEventListener("message", callback);
          closeEndPoint(ep);
          if (finalizer in obj && typeof obj[finalizer] === "function") {
            obj[finalizer]();
          }
        }
      }).catch(error => {
        // Send Serialization Error To Caller
        const [wireValue, transferables] = toWireValue({
          value: new TypeError("Unserializable return value"),
          [throwMarker]: 0
        });
        ep.postMessage(Object.assign(Object.assign({}, wireValue), {
          id
        }), transferables);
      });
    });
    if (ep.start) {
      ep.start();
    }
  }
  function isMessagePort(endpoint) {
    return endpoint.constructor.name === "MessagePort";
  }
  function closeEndPoint(endpoint) {
    if (isMessagePort(endpoint)) endpoint.close();
  }
  function wrap(ep, target) {
    const pendingListeners = new Map();
    ep.addEventListener("message", function handleMessage(ev) {
      const {
        data
      } = ev;
      if (!data || !data.id) {
        return;
      }
      const resolver = pendingListeners.get(data.id);
      if (!resolver) {
        return;
      }
      try {
        resolver(data);
      } finally {
        pendingListeners.delete(data.id);
      }
    });
    return createProxy(ep, pendingListeners, [], target);
  }
  function throwIfProxyReleased(isReleased) {
    if (isReleased) {
      throw new Error("Proxy has been released and is not useable");
    }
  }
  function releaseEndpoint(ep) {
    return requestResponseMessage(ep, new Map(), {
      type: "RELEASE" /* MessageType.RELEASE */
    }).then(() => {
      closeEndPoint(ep);
    });
  }
  const proxyCounter = new WeakMap();
  const proxyFinalizers = "FinalizationRegistry" in globalThis && new FinalizationRegistry(ep => {
    const newCount = (proxyCounter.get(ep) || 0) - 1;
    proxyCounter.set(ep, newCount);
    if (newCount === 0) {
      releaseEndpoint(ep);
    }
  });
  function registerProxy(proxy, ep) {
    const newCount = (proxyCounter.get(ep) || 0) + 1;
    proxyCounter.set(ep, newCount);
    if (proxyFinalizers) {
      proxyFinalizers.register(proxy, ep, proxy);
    }
  }
  function unregisterProxy(proxy) {
    if (proxyFinalizers) {
      proxyFinalizers.unregister(proxy);
    }
  }
  function createProxy(ep, pendingListeners, path = [], target = function () {}) {
    let isProxyReleased = false;
    const proxy = new Proxy(target, {
      get(_target, prop) {
        throwIfProxyReleased(isProxyReleased);
        if (prop === releaseProxy) {
          return () => {
            unregisterProxy(proxy);
            releaseEndpoint(ep);
            pendingListeners.clear();
            isProxyReleased = true;
          };
        }
        if (prop === "then") {
          if (path.length === 0) {
            return {
              then: () => proxy
            };
          }
          const r = requestResponseMessage(ep, pendingListeners, {
            type: "GET" /* MessageType.GET */,
            path: path.map(p => p.toString())
          }).then(fromWireValue);
          return r.then.bind(r);
        }
        return createProxy(ep, pendingListeners, [...path, prop]);
      },
      set(_target, prop, rawValue) {
        throwIfProxyReleased(isProxyReleased);
        // FIXME: ES6 Proxy Handler `set` methods are supposed to return a
        // boolean. To show good will, we return true asynchronously ¯\_(ツ)_/¯
        const [value, transferables] = toWireValue(rawValue);
        return requestResponseMessage(ep, pendingListeners, {
          type: "SET" /* MessageType.SET */,
          path: [...path, prop].map(p => p.toString()),
          value
        }, transferables).then(fromWireValue);
      },
      apply(_target, _thisArg, rawArgumentList) {
        throwIfProxyReleased(isProxyReleased);
        const last = path[path.length - 1];
        if (last === createEndpoint) {
          return requestResponseMessage(ep, pendingListeners, {
            type: "ENDPOINT" /* MessageType.ENDPOINT */
          }).then(fromWireValue);
        }
        // We just pretend that `bind()` didn’t happen.
        if (last === "bind") {
          return createProxy(ep, pendingListeners, path.slice(0, -1));
        }
        const [argumentList, transferables] = processArguments(rawArgumentList);
        return requestResponseMessage(ep, pendingListeners, {
          type: "APPLY" /* MessageType.APPLY */,
          path: path.map(p => p.toString()),
          argumentList
        }, transferables).then(fromWireValue);
      },
      construct(_target, rawArgumentList) {
        throwIfProxyReleased(isProxyReleased);
        const [argumentList, transferables] = processArguments(rawArgumentList);
        return requestResponseMessage(ep, pendingListeners, {
          type: "CONSTRUCT" /* MessageType.CONSTRUCT */,
          path: path.map(p => p.toString()),
          argumentList
        }, transferables).then(fromWireValue);
      }
    });
    registerProxy(proxy, ep);
    return proxy;
  }
  function myFlat(arr) {
    return Array.prototype.concat.apply([], arr);
  }
  function processArguments(argumentList) {
    const processed = argumentList.map(toWireValue);
    return [processed.map(v => v[0]), myFlat(processed.map(v => v[1]))];
  }
  const transferCache = new WeakMap();
  function transfer(obj, transfers) {
    transferCache.set(obj, transfers);
    return obj;
  }
  function proxy(obj) {
    return Object.assign(obj, {
      [proxyMarker]: true
    });
  }
  function toWireValue(value) {
    for (const [name, handler] of transferHandlers) {
      if (handler.canHandle(value)) {
        const [serializedValue, transferables] = handler.serialize(value);
        return [{
          type: "HANDLER" /* WireValueType.HANDLER */,
          name,
          value: serializedValue
        }, transferables];
      }
    }
    return [{
      type: "RAW" /* WireValueType.RAW */,
      value
    }, transferCache.get(value) || []];
  }
  function fromWireValue(value) {
    switch (value.type) {
      case "HANDLER" /* WireValueType.HANDLER */:
        return transferHandlers.get(value.name).deserialize(value.value);
      case "RAW" /* WireValueType.RAW */:
        return value.value;
    }
  }
  function requestResponseMessage(ep, pendingListeners, msg, transfers) {
    return new Promise(resolve => {
      const id = generateUUID();
      pendingListeners.set(id, resolve);
      if (ep.start) {
        ep.start();
      }
      ep.postMessage(Object.assign({
        id
      }, msg), transfers);
    });
  }
  function generateUUID() {
    return new Array(4).fill(0).map(() => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(16)).join("-");
  }

  /* global Blob, BlobBuilder, Worker */

  // unify worker interface
  const browserWorkerPolyFill = function (workerObj) {
    // node only supports on/off
    workerObj.on = workerObj.addEventListener;
    workerObj.off = workerObj.removeEventListener;
    return workerObj;
  };
  const createObjectURL = function (str) {
    try {
      return URL.createObjectURL(new Blob([str], {
        type: 'application/javascript'
      }));
    } catch (e) {
      const blob = new BlobBuilder();
      blob.append(str);
      return URL.createObjectURL(blob.getBlob());
    }
  };
  const factory = function (code) {
    return function () {
      const objectUrl = createObjectURL(code);
      const worker = browserWorkerPolyFill(new Worker(objectUrl));
      worker.objURL = objectUrl;
      const terminate = worker.terminate;
      worker.on = worker.addEventListener;
      worker.off = worker.removeEventListener;
      worker.terminate = function () {
        URL.revokeObjectURL(objectUrl);
        return terminate.call(this);
      };
      return worker;
    };
  };
  const transform = function (code) {
    return `var browserWorkerPolyFill = ${browserWorkerPolyFill.toString()};\n` + 'browserWorkerPolyFill(self);\n' + code;
  };

  const getWorkerString = function (fn) {
    return fn.toString().replace(/^function.+?{/, '').slice(0, -1);
  };

  /* rollup-plugin-worker-factory start for worker!F:\project\高分辨率集合预报\weatherlayers-gl\src\deck\layers\high-low-layer\high-low-point-worker.js */
  const workerCode = transform(getWorkerString(function () {

    /**
     * @license
     * Copyright 2019 Google LLC
     * SPDX-License-Identifier: Apache-2.0
     */
    const proxyMarker = Symbol("Comlink.proxy");
    const createEndpoint = Symbol("Comlink.endpoint");
    const releaseProxy = Symbol("Comlink.releaseProxy");
    const finalizer = Symbol("Comlink.finalizer");
    const throwMarker = Symbol("Comlink.thrown");
    const isObject = val => typeof val === "object" && val !== null || typeof val === "function";
    /**
     * Internal transfer handle to handle objects marked to proxy.
     */
    const proxyTransferHandler = {
      canHandle: val => isObject(val) && val[proxyMarker],
      serialize(obj) {
        const {
          port1,
          port2
        } = new MessageChannel();
        expose(obj, port1);
        return [port2, [port2]];
      },
      deserialize(port) {
        port.start();
        return wrap(port);
      }
    };
    /**
     * Internal transfer handler to handle thrown exceptions.
     */
    const throwTransferHandler = {
      canHandle: value => isObject(value) && throwMarker in value,
      serialize({
        value
      }) {
        let serialized;
        if (value instanceof Error) {
          serialized = {
            isError: true,
            value: {
              message: value.message,
              name: value.name,
              stack: value.stack
            }
          };
        } else {
          serialized = {
            isError: false,
            value
          };
        }
        return [serialized, []];
      },
      deserialize(serialized) {
        if (serialized.isError) {
          throw Object.assign(new Error(serialized.value.message), serialized.value);
        }
        throw serialized.value;
      }
    };
    /**
     * Allows customizing the serialization of certain values.
     */
    const transferHandlers = new Map([["proxy", proxyTransferHandler], ["throw", throwTransferHandler]]);
    function isAllowedOrigin(allowedOrigins, origin) {
      for (const allowedOrigin of allowedOrigins) {
        if (origin === allowedOrigin || allowedOrigin === "*") {
          return true;
        }
        if (allowedOrigin instanceof RegExp && allowedOrigin.test(origin)) {
          return true;
        }
      }
      return false;
    }
    function expose(obj, ep = globalThis, allowedOrigins = ["*"]) {
      ep.addEventListener("message", function callback(ev) {
        if (!ev || !ev.data) {
          return;
        }
        if (!isAllowedOrigin(allowedOrigins, ev.origin)) {
          console.warn(`Invalid origin '${ev.origin}' for comlink proxy`);
          return;
        }
        const {
          id,
          type,
          path
        } = Object.assign({
          path: []
        }, ev.data);
        const argumentList = (ev.data.argumentList || []).map(fromWireValue);
        let returnValue;
        try {
          const parent = path.slice(0, -1).reduce((obj, prop) => obj[prop], obj);
          const rawValue = path.reduce((obj, prop) => obj[prop], obj);
          switch (type) {
            case "GET" /* MessageType.GET */:
              {
                returnValue = rawValue;
              }
              break;
            case "SET" /* MessageType.SET */:
              {
                parent[path.slice(-1)[0]] = fromWireValue(ev.data.value);
                returnValue = true;
              }
              break;
            case "APPLY" /* MessageType.APPLY */:
              {
                returnValue = rawValue.apply(parent, argumentList);
              }
              break;
            case "CONSTRUCT" /* MessageType.CONSTRUCT */:
              {
                const value = new rawValue(...argumentList);
                returnValue = proxy(value);
              }
              break;
            case "ENDPOINT" /* MessageType.ENDPOINT */:
              {
                const {
                  port1,
                  port2
                } = new MessageChannel();
                expose(obj, port2);
                returnValue = transfer(port1, [port1]);
              }
              break;
            case "RELEASE" /* MessageType.RELEASE */:
              {
                returnValue = undefined;
              }
              break;
            default:
              return;
          }
        } catch (value) {
          returnValue = {
            value,
            [throwMarker]: 0
          };
        }
        Promise.resolve(returnValue).catch(value => {
          return {
            value,
            [throwMarker]: 0
          };
        }).then(returnValue => {
          const [wireValue, transferables] = toWireValue(returnValue);
          ep.postMessage(Object.assign(Object.assign({}, wireValue), {
            id
          }), transferables);
          if (type === "RELEASE" /* MessageType.RELEASE */) {
            // detach and deactive after sending release response above.
            ep.removeEventListener("message", callback);
            closeEndPoint(ep);
            if (finalizer in obj && typeof obj[finalizer] === "function") {
              obj[finalizer]();
            }
          }
        }).catch(error => {
          // Send Serialization Error To Caller
          const [wireValue, transferables] = toWireValue({
            value: new TypeError("Unserializable return value"),
            [throwMarker]: 0
          });
          ep.postMessage(Object.assign(Object.assign({}, wireValue), {
            id
          }), transferables);
        });
      });
      if (ep.start) {
        ep.start();
      }
    }
    function isMessagePort(endpoint) {
      return endpoint.constructor.name === "MessagePort";
    }
    function closeEndPoint(endpoint) {
      if (isMessagePort(endpoint)) endpoint.close();
    }
    function wrap(ep, target) {
      const pendingListeners = new Map();
      ep.addEventListener("message", function handleMessage(ev) {
        const {
          data
        } = ev;
        if (!data || !data.id) {
          return;
        }
        const resolver = pendingListeners.get(data.id);
        if (!resolver) {
          return;
        }
        try {
          resolver(data);
        } finally {
          pendingListeners.delete(data.id);
        }
      });
      return createProxy(ep, pendingListeners, [], target);
    }
    function throwIfProxyReleased(isReleased) {
      if (isReleased) {
        throw new Error("Proxy has been released and is not useable");
      }
    }
    function releaseEndpoint(ep) {
      return requestResponseMessage(ep, new Map(), {
        type: "RELEASE" /* MessageType.RELEASE */
      }).then(() => {
        closeEndPoint(ep);
      });
    }
    const proxyCounter = new WeakMap();
    const proxyFinalizers = "FinalizationRegistry" in globalThis && new FinalizationRegistry(ep => {
      const newCount = (proxyCounter.get(ep) || 0) - 1;
      proxyCounter.set(ep, newCount);
      if (newCount === 0) {
        releaseEndpoint(ep);
      }
    });
    function registerProxy(proxy, ep) {
      const newCount = (proxyCounter.get(ep) || 0) + 1;
      proxyCounter.set(ep, newCount);
      if (proxyFinalizers) {
        proxyFinalizers.register(proxy, ep, proxy);
      }
    }
    function unregisterProxy(proxy) {
      if (proxyFinalizers) {
        proxyFinalizers.unregister(proxy);
      }
    }
    function createProxy(ep, pendingListeners, path = [], target = function () {}) {
      let isProxyReleased = false;
      const proxy = new Proxy(target, {
        get(_target, prop) {
          throwIfProxyReleased(isProxyReleased);
          if (prop === releaseProxy) {
            return () => {
              unregisterProxy(proxy);
              releaseEndpoint(ep);
              pendingListeners.clear();
              isProxyReleased = true;
            };
          }
          if (prop === "then") {
            if (path.length === 0) {
              return {
                then: () => proxy
              };
            }
            const r = requestResponseMessage(ep, pendingListeners, {
              type: "GET" /* MessageType.GET */,
              path: path.map(p => p.toString())
            }).then(fromWireValue);
            return r.then.bind(r);
          }
          return createProxy(ep, pendingListeners, [...path, prop]);
        },
        set(_target, prop, rawValue) {
          throwIfProxyReleased(isProxyReleased);
          // FIXME: ES6 Proxy Handler `set` methods are supposed to return a
          // boolean. To show good will, we return true asynchronously ¯\_(ツ)_/¯
          const [value, transferables] = toWireValue(rawValue);
          return requestResponseMessage(ep, pendingListeners, {
            type: "SET" /* MessageType.SET */,
            path: [...path, prop].map(p => p.toString()),
            value
          }, transferables).then(fromWireValue);
        },
        apply(_target, _thisArg, rawArgumentList) {
          throwIfProxyReleased(isProxyReleased);
          const last = path[path.length - 1];
          if (last === createEndpoint) {
            return requestResponseMessage(ep, pendingListeners, {
              type: "ENDPOINT" /* MessageType.ENDPOINT */
            }).then(fromWireValue);
          }
          // We just pretend that `bind()` didn’t happen.
          if (last === "bind") {
            return createProxy(ep, pendingListeners, path.slice(0, -1));
          }
          const [argumentList, transferables] = processArguments(rawArgumentList);
          return requestResponseMessage(ep, pendingListeners, {
            type: "APPLY" /* MessageType.APPLY */,
            path: path.map(p => p.toString()),
            argumentList
          }, transferables).then(fromWireValue);
        },
        construct(_target, rawArgumentList) {
          throwIfProxyReleased(isProxyReleased);
          const [argumentList, transferables] = processArguments(rawArgumentList);
          return requestResponseMessage(ep, pendingListeners, {
            type: "CONSTRUCT" /* MessageType.CONSTRUCT */,
            path: path.map(p => p.toString()),
            argumentList
          }, transferables).then(fromWireValue);
        }
      });
      registerProxy(proxy, ep);
      return proxy;
    }
    function myFlat(arr) {
      return Array.prototype.concat.apply([], arr);
    }
    function processArguments(argumentList) {
      const processed = argumentList.map(toWireValue);
      return [processed.map(v => v[0]), myFlat(processed.map(v => v[1]))];
    }
    const transferCache = new WeakMap();
    function transfer(obj, transfers) {
      transferCache.set(obj, transfers);
      return obj;
    }
    function proxy(obj) {
      return Object.assign(obj, {
        [proxyMarker]: true
      });
    }
    function toWireValue(value) {
      for (const [name, handler] of transferHandlers) {
        if (handler.canHandle(value)) {
          const [serializedValue, transferables] = handler.serialize(value);
          return [{
            type: "HANDLER" /* WireValueType.HANDLER */,
            name,
            value: serializedValue
          }, transferables];
        }
      }
      return [{
        type: "RAW" /* WireValueType.RAW */,
        value
      }, transferCache.get(value) || []];
    }
    function fromWireValue(value) {
      switch (value.type) {
        case "HANDLER" /* WireValueType.HANDLER */:
          return transferHandlers.get(value.name).deserialize(value.value);
        case "RAW" /* WireValueType.RAW */:
          return value.value;
      }
    }
    function requestResponseMessage(ep, pendingListeners, msg, transfers) {
      return new Promise(resolve => {
        const id = generateUUID();
        pendingListeners.set(id, resolve);
        if (ep.start) {
          ep.start();
        }
        ep.postMessage(Object.assign({
          id
        }, msg), transfers);
      });
    }
    function generateUUID() {
      return new Array(4).fill(0).map(() => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(16)).join("-");
    }

    /**
     * box blur, average of 3x3 pixels
     * see https://en.wikipedia.org/wiki/Box_blur
     * see screenshot at https://gis.stackexchange.com/questions/386050/algorithm-to-find-low-high-atmospheric-pressure-systems-in-gridded-raster-data
     */
    function blur(data, width, height) {
      const result = new Float32Array(data.length);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = x + y * width;
          if (x >= 1 && x <= width - 2 && y >= 1 && y <= height - 2) {
            const values = [data[x - 1 + (y - 1) * width], data[x + (y - 1) * width], data[x + 1 + (y - 1) * width], data[x - 1 + y * width], data[x + y * width], data[x + 1 + y * width], data[x - 1 + (y + 1) * width], data[x + (y + 1) * width], data[x + 1 + (y - 1) * width]];
            result[i] = values.reduce((acc, curr) => acc + curr, 0) / values.length;
          } else {
            result[i] = data[i];
          }
        }
      }
      return result;
    }
    const DEFAULT_RADIUS$1 = 6371e3;
    function toRadians(value) {
      return value / 180 * Math.PI;
    }

    /**
     * Returns the distance along the surface of the earth from start point to destination point.
     *
     * Uses haversine formula: a = sin²(Δφ/2) + cosφ1·cosφ2 · sin²(Δλ/2); d = 2 · atan2(√a, √(a-1)).
     *
     * @param   {GeoJSON.Position} start - Longitude/latitude of start point.
     * @param   {GeoJSON.Position} destination - Longitude/latitude of destination point.
     * @param   {number} [radius] - Radius of earth (defaults to mean radius in metres).
     * @returns {number} Distance between start point and destination point, in same units as radius.
     *
     * @example
     *   const p1 = [0.119, 52.205];
     *   const p2 = [2.351, 48.857];
     *   const d = distance(p1, p2);         // 404.3×10³ m
     *   const m = distanceTo(p1, p2, 3959); // 251.2 miles
     */
    function distance$1(start, destination, radius = DEFAULT_RADIUS$1) {
      // a = sin²(Δφ/2) + cos(φ1)⋅cos(φ2)⋅sin²(Δλ/2)
      // δ = 2·atan2(√(a), √(1−a))
      // see mathforum.org/library/drmath/view/51879.html for derivation
      const R = radius;
      const φ1 = toRadians(start[1]),
        λ1 = toRadians(start[0]);
      const φ2 = toRadians(destination[1]),
        λ2 = toRadians(destination[0]);
      const Δφ = φ2 - φ1;
      const Δλ = λ2 - λ1;
      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const d = R * c;
      return d;
    }

    // radius used by deck.gl, see https://github.com/visgl/deck.gl/blob/master/modules/core/src/viewports/globe-viewport.js#L10
    const DEFAULT_RADIUS = 6370972;
    function distance(start, destination) {
      return distance$1(start, destination, DEFAULT_RADIUS);
    }
    const ImageInterpolation = {
      NEAREST: 'NEAREST',
      LINEAR: 'LINEAR',
      CUBIC: 'CUBIC'
    };
    const ImageType = {
      VECTOR: 'VECTOR'
    };
    function getUnprojectFunction(width, height, bounds) {
      const origin = [bounds[0], bounds[3]]; // top-left
      const lngResolution = (bounds[2] - bounds[0]) / width;
      const latResolution = (bounds[3] - bounds[1]) / height;
      return point => {
        const [x, y] = point;
        const lng = origin[0] + x * lngResolution;
        const lat = origin[1] - y * latResolution;
        const position = [lng, lat];
        return position;
      };
    }
    function frac(x) {
      return x % 1;
    }
    function add(x, y) {
      return x.map((_, i) => x[i] + y[i]);
    }
    function mul(x, y) {
      return x.map((_, i) => x[i] * y);
    }
    function dot(x, y) {
      return x.map((_, i) => x[i] * y[i]).reduce((m, n) => m + n);
    }
    function mixOne(x, y, a) {
      // skip interpolation for equal values to avoid precision loss
      // fixes hasPixelValue to always return true irrespectively on imageWeight when both pixel[3] === 255
      if (x === y) {
        return x;
      }
      return x * (1 - a) + y * a;
    }
    function mix(x, y, a) {
      return x.map((_, i) => mixOne(x[i], y[i], a));
    }
    function hasPixelValue(pixel, imageUnscale) {
      if (imageUnscale) {
        // pixel[3] === 255 causes incorrect nodata pixels in Safari, because Canvas.getImageData returns different data from the original image, with lower values
        // - this happened in 2023.10.2, fixed in 2023.10.3, reverted in 2024.1.0, it's not happening anymore, why?
        // anything smaller causes interpolated nodata edges with linear interpolation
        // pixel[3] >= 255 because sometimes the original value is slightly larger (255.00000000000003)
        return pixel[3] >= 255;
      } else {
        return !isNaN(pixel[0]);
      }
    }
    function getPixelScalarValue(pixel, imageType, imageUnscale) {
      if (imageType === ImageType.VECTOR) {
        return 0;
      } else {
        if (imageUnscale) {
          return mixOne(imageUnscale[0], imageUnscale[1], pixel[0] / 255);
        } else {
          return pixel[0];
        }
      }
    }
    function getPixelVectorValue(pixel, imageType, imageUnscale) {
      if (imageType === ImageType.VECTOR) {
        if (imageUnscale) {
          return [mixOne(imageUnscale[0], imageUnscale[1], pixel[0] / 255), mixOne(imageUnscale[0], imageUnscale[1], pixel[1] / 255)];
        } else {
          return [pixel[0], pixel[1]];
        }
      } else {
        return [NaN, NaN];
      }
    }
    function getPixelMagnitudeValue(pixel, imageType, imageUnscale) {
      if (imageType === ImageType.VECTOR) {
        const value = getPixelVectorValue(pixel, imageType, imageUnscale);
        return Math.hypot(value[0], value[1]);
      } else {
        return getPixelScalarValue(pixel, imageType, imageUnscale);
      }
    }
    function getPixel(image, imageDownscaleResolution, iuvX, iuvY, offsetX, offsetY) {
      const {
        data,
        width,
        height
      } = image;
      const bandsCount = data.length / (width * height);
      const uvX = (iuvX + offsetX + 0.5) / imageDownscaleResolution[0];
      const uvY = (iuvY + offsetY + 0.5) / imageDownscaleResolution[1];
      const x = Math.max(0, Math.min(width - 1, Math.floor(uvX * width)));
      const y = Math.max(0, Math.min(height - 1, Math.floor(uvY * height)));
      return new Array(bandsCount).fill(undefined).map((_, band) => {
        return data[(x + y * width) * bandsCount + band];
      });
    }
    // cubic B-spline
    const BS_A = [3, -6, 0, 4].map(x => x / 6);
    const BS_B = [-1, 6, -12, 8].map(x => x / 6);
    function powers(x) {
      return [x * x * x, x * x, x, 1];
    }
    function spline(c0, c1, c2, c3, a) {
      const color = add(add(add(mul(c0, dot(BS_B, powers(a + 1.))), mul(c1, dot(BS_A, powers(a)))), mul(c2, dot(BS_A, powers(1. - a)))), mul(c3, dot(BS_B, powers(2. - a))));
      // fix precision loss in alpha channel
      color[3] = c0[3] > 0 && c1[3] > 0 && c2[3] > 0 && c3[3] > 0 ? Math.max(Math.max(Math.max(c0[3], c1[3]), c2[3]), c3[3]) : 0;
      return color;
    }
    /**
     * see https://www.shadertoy.com/view/XsSXDy
     */
    function getPixelCubic(image, imageDownscaleResolution, uvX, uvY) {
      const tuvX = uvX * imageDownscaleResolution[0] - 0.5;
      const tuvY = uvY * imageDownscaleResolution[1] - 0.5;
      const iuvX = Math.floor(tuvX);
      const iuvY = Math.floor(tuvY);
      const fuvX = frac(tuvX);
      const fuvY = frac(tuvY);
      return spline(spline(getPixel(image, imageDownscaleResolution, iuvX, iuvY, -1, -1), getPixel(image, imageDownscaleResolution, iuvX, iuvY, 0, -1), getPixel(image, imageDownscaleResolution, iuvX, iuvY, 1, -1), getPixel(image, imageDownscaleResolution, iuvX, iuvY, 2, -1), fuvX), spline(getPixel(image, imageDownscaleResolution, iuvX, iuvY, -1, 0), getPixel(image, imageDownscaleResolution, iuvX, iuvY, 0, 0), getPixel(image, imageDownscaleResolution, iuvX, iuvY, 1, 0), getPixel(image, imageDownscaleResolution, iuvX, iuvY, 2, 0), fuvX), spline(getPixel(image, imageDownscaleResolution, iuvX, iuvY, -1, 1), getPixel(image, imageDownscaleResolution, iuvX, iuvY, 0, 1), getPixel(image, imageDownscaleResolution, iuvX, iuvY, 1, 1), getPixel(image, imageDownscaleResolution, iuvX, iuvY, 2, 1), fuvX), spline(getPixel(image, imageDownscaleResolution, iuvX, iuvY, -1, 2), getPixel(image, imageDownscaleResolution, iuvX, iuvY, 0, 2), getPixel(image, imageDownscaleResolution, iuvX, iuvY, 1, 2), getPixel(image, imageDownscaleResolution, iuvX, iuvY, 2, 2), fuvX), fuvY);
    }
    /**
     * see https://gamedev.stackexchange.com/questions/101953/low-quality-bilinear-sampling-in-webgl-opengl-directx
     */
    function getPixelLinear(image, imageDownscaleResolution, uvX, uvY) {
      const tuvX = uvX * imageDownscaleResolution[0] - 0.5;
      const tuvY = uvY * imageDownscaleResolution[1] - 0.5;
      const iuvX = Math.floor(tuvX);
      const iuvY = Math.floor(tuvY);
      const fuvX = frac(tuvX);
      const fuvY = frac(tuvY);
      return mix(mix(getPixel(image, imageDownscaleResolution, iuvX, iuvY, 0, 0), getPixel(image, imageDownscaleResolution, iuvX, iuvY, 1, 0), fuvX), mix(getPixel(image, imageDownscaleResolution, iuvX, iuvY, 0, 1), getPixel(image, imageDownscaleResolution, iuvX, iuvY, 1, 1), fuvX), fuvY);
    }
    function getPixelNearest(image, imageDownscaleResolution, uvX, uvY) {
      const tuvX = uvX * imageDownscaleResolution[0] - 0.5;
      const tuvY = uvY * imageDownscaleResolution[1] - 0.5;
      const iuvX = Math.round(tuvX); // nearest
      const iuvY = Math.round(tuvY); // nearest
      return getPixel(image, imageDownscaleResolution, iuvX, iuvY, 0, 0);
    }
    function getPixelFilter(image, imageDownscaleResolution, imageInterpolation, uvX, uvY) {
      if (imageInterpolation === ImageInterpolation.CUBIC) {
        return getPixelCubic(image, imageDownscaleResolution, uvX, uvY);
      } else if (imageInterpolation === ImageInterpolation.LINEAR) {
        return getPixelLinear(image, imageDownscaleResolution, uvX, uvY);
      } else {
        return getPixelNearest(image, imageDownscaleResolution, uvX, uvY);
      }
    }
    function getPixelInterpolate(image, image2, imageDownscaleResolution, imageInterpolation, imageWeight, isRepeatBounds, uvX, uvY) {
      // offset
      // test case: gfswave/significant_wave_height, Gibraltar (36, -5.5)
      const uvWithOffsetX = isRepeatBounds ? uvX + 0.5 / imageDownscaleResolution[0] : mixOne(0 + 0.5 / imageDownscaleResolution[0], 1 - 0.5 / imageDownscaleResolution[0], uvX);
      const uvWithOffsetY = mixOne(0 + 0.5 / imageDownscaleResolution[1], 1 - 0.5 / imageDownscaleResolution[1], uvY);
      if (image2 && imageWeight > 0) {
        const pixel = getPixelFilter(image, imageDownscaleResolution, imageInterpolation, uvWithOffsetX, uvWithOffsetY);
        const pixel2 = getPixelFilter(image2, imageDownscaleResolution, imageInterpolation, uvWithOffsetX, uvWithOffsetY);
        return mix(pixel, pixel2, imageWeight);
      } else {
        return getPixelFilter(image, imageDownscaleResolution, imageInterpolation, uvWithOffsetX, uvWithOffsetY);
      }
    }
    function getImageDownscaleResolution(width, height, imageSmoothing) {
      const imageDownscaleResolutionFactor = 1 + Math.max(0, imageSmoothing);
      return [width / imageDownscaleResolutionFactor, height / imageDownscaleResolutionFactor];
    }
    function isRepeatBounds(bounds) {
      return bounds[2] - bounds[0] === 360;
    }
    function getRasterMagnitudeData(imageProperties, bounds) {
      const {
        image,
        image2,
        imageSmoothing,
        imageInterpolation,
        imageWeight,
        imageType,
        imageUnscale,
        imageMinValue,
        imageMaxValue
      } = imageProperties;
      const {
        width,
        height
      } = image;
      // interpolation for entire data is slow, fallback to NEAREST interpolation + blur in worker
      // CPU speed (image 1440x721):
      // - NEAREST - 100 ms
      // - LINEAR - 600 ms
      // - CUBIC - 6 s
      // TODO: move getRasterMagnitudeData to GPU
      const effectiveImageInterpolation = imageInterpolation !== ImageInterpolation.NEAREST ? ImageInterpolation.NEAREST : imageInterpolation;
      // smooth by downscaling resolution
      const imageDownscaleResolution = getImageDownscaleResolution(width, height, imageSmoothing);
      const isRepeatBoundsCache = isRepeatBounds(bounds);
      const magnitudeData = new Float32Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = x + y * width;
          const uvX = x / width;
          const uvY = y / height;
          const pixel = getPixelInterpolate(image, image2, imageDownscaleResolution, effectiveImageInterpolation, imageWeight, isRepeatBoundsCache, uvX, uvY);
          if (!hasPixelValue(pixel, imageUnscale)) {
            // drop nodata
            magnitudeData[i] = NaN;
            continue;
          }
          const value = getPixelMagnitudeValue(pixel, imageType, imageUnscale);
          if (typeof imageMinValue === 'number' && !isNaN(imageMinValue) && value < imageMinValue || typeof imageMaxValue === 'number' && !isNaN(imageMaxValue) && value > imageMaxValue) {
            // drop value out of bounds
            magnitudeData[i] = NaN;
            continue;
          }
          magnitudeData[i] = value;
        }
      }
      return {
        data: magnitudeData,
        width,
        height
      };
    }

    /**
     * inspired by https://sourceforge.net/p/wxmap2/svn/473/tree//trunk/app/src/opengrads/extensions/mf/ftn_clhilo.F
     */
    function getHighLowPointData(floatData, bounds, radius) {
      let {
        data,
        width,
        height
      } = floatData;
      const radiusKm = radius * 1000;
      const unproject = getUnprojectFunction(width, height, bounds);
      // blur noisy data, TODO: replace by imageInterpolation on GPU
      data = blur(data, width, height);
      // find highs and lows
      let highs = [];
      let lows = [];
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const i = x + y * width;
          const value = data[i];
          if (!isNaN(value) && value >= data[x + 1 + y * width] && value >= data[x + 1 + (y + 1) * width] && value >= data[x + (y + 1) * width] && value >= data[x - 1 + (y + 1) * width] && value > data[x - 1 + y * width] && value > data[x - 1 + (y - 1) * width] && value > data[x + (y - 1) * width] && value > data[x + 1 + (y - 1) * width]) {
            const point = [x, y];
            const position = unproject(point);
            highs.push({
              position,
              value
            });
          }
          if (!isNaN(value) && value <= data[x + 1 + y * width] && value <= data[x + 1 + (y + 1) * width] && value <= data[x + (y + 1) * width] && value <= data[x - 1 + (y + 1) * width] && value < data[x - 1 + y * width] && value < data[x - 1 + (y - 1) * width] && value < data[x + (y - 1) * width] && value < data[x + 1 + (y - 1) * width]) {
            const point = [x, y];
            const position = unproject(point);
            lows.push({
              position,
              value
            });
          }
        }
      }
      highs = highs.sort((a, b) => b.value - a.value);
      lows = lows.sort((a, b) => a.value - b.value);
      // remove proximate highs
      const filteredHighs = [...highs];
      for (let i = 0; i < filteredHighs.length; i++) {
        const high = filteredHighs[i];
        if (high) {
          for (let j = i + 1; j < filteredHighs.length; j++) {
            const high2 = filteredHighs[j];
            if (high2 && distance(high.position, high2.position) < radiusKm) {
              filteredHighs[j] = undefined;
            }
          }
        }
      }
      highs = filteredHighs.filter(x => !!x);
      // remove proximate lows
      const filteredLows = [...lows];
      for (let i = 0; i < filteredLows.length; i++) {
        const low = filteredLows[i];
        if (low) {
          for (let j = i + 1; j < filteredLows.length; j++) {
            const low2 = filteredLows[j];
            if (low2 && distance(low.position, low2.position) < radiusKm) {
              filteredLows[j] = undefined;
            }
          }
        }
      }
      lows = filteredLows.filter(x => !!x);
      const highLowPointData = new Float32Array([highs.length, ...highs.map(x => [...x.position, x.value]).flat(), lows.length, ...lows.map(x => [...x.position, x.value]).flat()]);
      return highLowPointData;
    }
    function getHighLowPointDataMain(imageProperties, bounds, radius) {
      const magnitudeData = getRasterMagnitudeData(imageProperties, bounds);
      const highLowPointData = getHighLowPointData(magnitudeData, bounds, radius);
      return highLowPointData;
    }

    // TODO: fix Rollup build config to use TS instead of JS

    /** @typedef {import('../../_utils/texture-data.js').TextureDataArray} TextureDataArray */
    /** @typedef {import('../../_utils/image-interpolation.js').ImageInterpolation} ImageInterpolation */
    /** @typedef {import('../../_utils/image-type.js').ImageType} ImageType */
    /** @typedef {import('../../_utils/image-unscale.js').ImageUnscale} ImageUnscale */

    expose({
      /**
       * @param {TextureDataArray} data
       * @param {number} width
       * @param {number} height
       * @param {TextureDataArray | null} data2
       * @param {number | null} width2
       * @param {number | null} height2
       * @param {number} imageSmoothing
       * @param {ImageInterpolation} imageInterpolation
       * @param {number} imageWeight
       * @param {ImageType} imageType
       * @param {ImageUnscale} imageUnscale
       * @param {number | null} imageMinValue
       * @param {number | null} imageMaxValue
       * @param {GeoJSON.BBox} bounds
       * @param {number} radius
       * @returns {Float32Array}
       */
      getHighLowPointData(data, width, height, data2, width2, height2, imageSmoothing, imageInterpolation, imageWeight, imageType, imageUnscale, imageMinValue, imageMaxValue, bounds, radius) {
        const image = {
          data,
          width,
          height
        };
        const image2 = data2 ? {
          data: data2,
          width: width2,
          height: height2
        } : null;
        const imageProperties = {
          image,
          image2,
          imageSmoothing,
          imageInterpolation,
          imageWeight,
          imageType,
          imageUnscale,
          imageMinValue,
          imageMaxValue
        };
        const highLowPointData = getHighLowPointDataMain(imageProperties, bounds, radius);
        return transfer(highLowPointData, [highLowPointData.buffer]);
      }
    });
  }));
  var createHighLowPointWorker = factory(workerCode);
  /* rollup-plugin-worker-factory end for worker!F:\project\高分辨率集合预报\weatherlayers-gl\src\deck\layers\high-low-layer\high-low-point-worker.js */

  const HighLowType = {
      LOW: 'L',
      HIGH: 'H',
  };
  const highLowPointWorkerProxy = wrap(createHighLowPointWorker());
  function createHighLowPoint(position, properties) {
      return { type: 'Feature', geometry: { type: 'Point', coordinates: position }, properties };
  }
  function getHighLowPointsFromData(highLowPointData) {
      let i = 0;
      const highLowPoints = [];
      const highCount = highLowPointData[i++];
      for (let j = 0; j < highCount; j++) {
          const position = [highLowPointData[i++], highLowPointData[i++]];
          const value = highLowPointData[i++];
          highLowPoints.push(createHighLowPoint(position, { type: HighLowType.HIGH, value }));
      }
      const lowCount = highLowPointData[i++];
      for (let j = 0; j < lowCount; j++) {
          const position = [highLowPointData[i++], highLowPointData[i++]];
          const value = highLowPointData[i++];
          highLowPoints.push(createHighLowPoint(position, { type: HighLowType.LOW, value }));
      }
      return highLowPoints;
  }
  async function getHighLowPoints(imageProperties, bounds, radius) {
      const { image, image2, imageSmoothing, imageInterpolation, imageWeight, imageType, imageUnscale, imageMinValue, imageMaxValue } = imageProperties;
      const { data, width, height } = image;
      const { data: data2 = null, width: width2 = null, height: height2 = null } = image2 || {};
      const dataCopy = data.slice(0);
      const data2Copy = data2 ? data2.slice(0) : null;
      const highLowPointData = await highLowPointWorkerProxy.getHighLowPointData(transfer(dataCopy, [dataCopy.buffer]), width, height, data2Copy ? transfer(data2Copy, [data2Copy.buffer]) : null, width2, height2, imageSmoothing, imageInterpolation, imageWeight, imageType, imageUnscale, imageMinValue, imageMaxValue, bounds, radius);
      const highLowPoints = getHighLowPointsFromData(highLowPointData);
      return { type: 'FeatureCollection', features: highLowPoints };
  }

  const HIGH_LOW_LABEL_COLLISION_GROUP = 'high-low-label';
  function getHighLowPointCollisionPriority(highLowPoint, minValue, maxValue) {
      if (highLowPoint.properties.type === HighLowType.HIGH) {
          return Math.round((highLowPoint.properties.value - maxValue) / maxValue * 100);
      }
      else {
          return Math.round((minValue - highLowPoint.properties.value) / minValue * 100);
      }
  }
  const defaultProps$7 = {
      image: { type: 'object', value: null }, // object instead of image to allow reading raw data
      image2: { type: 'object', value: null }, // object instead of image to allow reading raw data
      imageSmoothing: { type: 'number', value: 0 },
      imageInterpolation: { type: 'object', value: ImageInterpolation.CUBIC },
      imageWeight: { type: 'number', value: 0 },
      imageType: { type: 'object', value: ImageType.SCALAR },
      imageUnscale: { type: 'array', value: null },
      imageMinValue: { type: 'object', value: null },
      imageMaxValue: { type: 'object', value: null },
      bounds: { type: 'array', value: [-180, -90, 180, 90], compare: true },
      minZoom: { type: 'object', value: null },
      maxZoom: { type: 'object', value: null },
      radius: { type: 'number', value: 0 },
      unitFormat: { type: 'object', value: null },
      textFormatFunction: { type: 'function', value: DEFAULT_TEXT_FORMAT_FUNCTION },
      textFontFamily: { type: 'object', value: DEFAULT_TEXT_FONT_FAMILY },
      textSize: { type: 'number', value: DEFAULT_TEXT_SIZE },
      textColor: { type: 'color', value: DEFAULT_TEXT_COLOR },
      textOutlineWidth: { type: 'number', value: DEFAULT_TEXT_OUTLINE_WIDTH },
      textOutlineColor: { type: 'color', value: DEFAULT_TEXT_OUTLINE_COLOR },
      palette: { type: 'object', value: null },
  };
  class HighLowCompositeLayer extends core.CompositeLayer {
      renderLayers() {
          const { viewport } = this.context;
          const { props, visiblePoints, minValue, maxValue } = this.state;
          if (!props || !visiblePoints || typeof minValue !== 'number' || typeof maxValue !== 'number') {
              return [];
          }
          const { unitFormat, textFormatFunction, textFontFamily, textSize, textColor, textOutlineWidth, textOutlineColor } = ensureDefaultProps(props, defaultProps$7);
          const { paletteScale } = this.state;
          return [
              new layers.TextLayer(this.getSubLayerProps({
                  id: 'type',
                  data: visiblePoints,
                  getPixelOffset: [0, -getViewportPixelOffset(viewport, (textSize * 1.2) / 2)],
                  getPosition: d => d.geometry.coordinates,
                  getText: d => d.properties.type,
                  getSize: textSize * 1.2,
                  getColor: d => paletteScale ? paletteColorToGl(paletteScale(d.properties.value).rgba()) : textColor,
                  getAngle: getViewportAngle(viewport, 0),
                  outlineWidth: textOutlineWidth,
                  outlineColor: textOutlineColor,
                  fontFamily: textFontFamily,
                  fontSettings: { sdf: true },
                  billboard: false,
                  extensions: [new extensions.CollisionFilterExtension()],
                  collisionEnabled: true,
                  collisionGroup: HIGH_LOW_LABEL_COLLISION_GROUP,
                  collisionTestProps: { sizeScale: 5 },
                  getCollisionPriority: (d) => getHighLowPointCollisionPriority(d, minValue, maxValue),
                  parameters: {
                      cullMode: 'front', // enable culling to avoid rendering on both sides of the globe; front-face culling because it seems deck.gl uses a wrong winding order and setting frontFace: 'cw' throws "GL_INVALID_ENUM: Enum 0x0000 is currently not supported."
                      depthCompare: 'always', // disable depth test to avoid conflict with Maplibre globe depth buffer, see https://github.com/visgl/deck.gl/issues/9357
                      ...this.props.parameters,
                  },
              })),
              new layers.TextLayer(this.getSubLayerProps({
                  id: 'value',
                  data: visiblePoints,
                  getPixelOffset: [0, getViewportPixelOffset(viewport, (textSize * 1.2) / 2)],
                  getPosition: d => d.geometry.coordinates,
                  getText: d => textFormatFunction(d.properties.value, unitFormat),
                  getSize: textSize,
                  getColor: d => paletteScale ? paletteColorToGl(paletteScale(d.properties.value).rgba()) : textColor,
                  getAngle: getViewportAngle(viewport, 0),
                  outlineWidth: textOutlineWidth,
                  outlineColor: textOutlineColor,
                  fontFamily: textFontFamily,
                  fontSettings: { sdf: true },
                  billboard: false,
                  extensions: [new extensions.CollisionFilterExtension()],
                  collisionEnabled: true,
                  collisionGroup: HIGH_LOW_LABEL_COLLISION_GROUP,
                  collisionTestProps: { sizeScale: 5 },
                  getCollisionPriority: (d) => getHighLowPointCollisionPriority(d, minValue, maxValue),
                  parameters: {
                      cullMode: 'front', // enable culling to avoid rendering on both sides of the globe; front-face culling because it seems deck.gl uses a wrong winding order and setting frontFace: 'cw' throws "GL_INVALID_ENUM: Enum 0x0000 is currently not supported."
                      depthCompare: 'always', // disable depth test to avoid conflict with Maplibre globe depth buffer, see https://github.com/visgl/deck.gl/issues/9357
                      ...this.props.parameters,
                  },
              })),
          ];
      }
      shouldUpdateState(params) {
          return super.shouldUpdateState(params) || params.changeFlags.viewportChanged;
      }
      updateState(params) {
          const { image, image2, imageSmoothing, imageInterpolation, imageWeight, imageType, imageUnscale, imageMinValue, imageMaxValue, minZoom, maxZoom, radius, unitFormat, textFormatFunction, textFontFamily, textSize, textColor, textOutlineWidth, textOutlineColor, palette, visible } = params.props;
          super.updateState(params);
          if (!radius || !visible) {
              this.setState({
                  points: undefined,
                  visiblePoints: undefined,
                  minValue: undefined,
                  maxValue: undefined,
              });
              return;
          }
          if (image !== params.oldProps.image ||
              image2 !== params.oldProps.image2 ||
              imageSmoothing !== params.oldProps.imageSmoothing ||
              imageInterpolation !== params.oldProps.imageInterpolation ||
              imageWeight !== params.oldProps.imageWeight ||
              imageType !== params.oldProps.imageType ||
              imageUnscale !== params.oldProps.imageUnscale ||
              imageMinValue !== params.oldProps.imageMinValue ||
              imageMaxValue !== params.oldProps.imageMaxValue ||
              radius !== params.oldProps.radius ||
              visible !== params.oldProps.visible) {
              this._updateFeatures();
          }
          if (minZoom !== params.oldProps.minZoom ||
              maxZoom !== params.oldProps.maxZoom ||
              params.changeFlags.viewportChanged) {
              this._updateVisibleFeatures();
          }
          if (palette !== params.oldProps.palette) {
              this._updatePalette();
          }
          if (unitFormat !== params.oldProps.unitFormat ||
              textFormatFunction !== params.oldProps.textFormatFunction ||
              textFontFamily !== params.oldProps.textFontFamily ||
              textSize !== params.oldProps.textSize ||
              textColor !== params.oldProps.textColor ||
              textOutlineWidth !== params.oldProps.textOutlineWidth ||
              textOutlineColor !== params.oldProps.textOutlineColor) {
              this._redrawVisibleFeatures();
          }
          this.setState({ props: params.props });
      }
      async _updateFeatures() {
          const { image, image2, imageSmoothing, imageInterpolation, imageType, imageUnscale, imageMinValue, imageMaxValue, imageWeight, bounds, radius } = ensureDefaultProps(this.props, defaultProps$7);
          if (!image) {
              return;
          }
          const requestId = randomString();
          this.state.requestId = requestId;
          const imageProperties = { image, image2, imageSmoothing, imageInterpolation, imageWeight, imageType, imageUnscale, imageMinValue, imageMaxValue };
          const points = (await getHighLowPoints(imageProperties, bounds, radius)).features;
          // discard displaying obsolete points
          if (this.state.requestId !== requestId) {
              return;
          }
          const values = points.map(highLowPoint => highLowPoint.properties.value);
          const minValue = Math.min(...values);
          const maxValue = Math.max(...values);
          this.setState({ points, minValue, maxValue });
          this._updateVisibleFeatures();
      }
      _updateVisibleFeatures() {
          const { viewport } = this.context;
          const { minZoom, maxZoom } = ensureDefaultProps(this.props, defaultProps$7);
          const { points } = this.state;
          if (!points) {
              return;
          }
          let visiblePoints;
          if (isViewportInZoomBounds(viewport, minZoom, maxZoom)) {
              visiblePoints = points;
          }
          else {
              visiblePoints = [];
          }
          this.setState({ visiblePoints });
      }
      _updatePalette() {
          const { palette } = ensureDefaultProps(this.props, defaultProps$7);
          if (!palette) {
              this.setState({ paletteScale: undefined });
              this._redrawVisibleFeatures();
              return;
          }
          const paletteScale = parsePalette(palette);
          this.setState({ paletteScale });
          this._redrawVisibleFeatures();
      }
      _redrawVisibleFeatures() {
          this.setState({ visiblePoints: Array.isArray(this.state.visiblePoints) ? Array.from(this.state.visiblePoints) : this.state.visiblePoints });
      }
  }
  HighLowCompositeLayer.layerName = 'HighLowCompositeLayer';
  HighLowCompositeLayer.defaultProps = defaultProps$7;

  const defaultProps$6 = {
      ...HighLowCompositeLayer.defaultProps,
  };
  class HighLowLayer extends core.CompositeLayer {
      renderLayers() {
          const { props } = this.state;
          if (!props) {
              return [];
          }
          return [
              new HighLowCompositeLayer(this.props, this.getSubLayerProps({
                  id: 'composite',
              })),
          ];
      }
      updateState(params) {
          const { image, imageUnscale } = params.props;
          super.updateState(params);
          if (image && imageUnscale && !(image.data instanceof Uint8Array || image.data instanceof Uint8ClampedArray)) {
              throw new Error('imageUnscale can be applied to Uint8 data only');
          }
          this.setState({ props: params.props });
      }
  }
  HighLowLayer.layerName = 'HighLowLayer';
  HighLowLayer.defaultProps = defaultProps$6;

  var img$2 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGoAAAAqCAYAAABbec77AAAFsmlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4KPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNS41LjAiPgogPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIgogICAgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIgogICAgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIgogICAgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIgogICAgeG1sbnM6ZXhpZj0iaHR0cDovL25zLmFkb2JlLmNvbS9leGlmLzEuMC8iCiAgICB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyIKICAgIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIgogICAgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIKICAgeG1wOkNyZWF0ZURhdGU9IjIwMjMtMDMtMTBUMTQ6NDI6NTYrMDEwMCIKICAgeG1wOk1vZGlmeURhdGU9IjIwMjMtMDMtMjVUMDk6MDY6NTgrMDE6MDAiCiAgIHhtcDpNZXRhZGF0YURhdGU9IjIwMjMtMDMtMjVUMDk6MDY6NTgrMDE6MDAiCiAgIHBob3Rvc2hvcDpEYXRlQ3JlYXRlZD0iMjAyMy0wMy0xMFQxNDo0Mjo1NiswMTAwIgogICBwaG90b3Nob3A6Q29sb3JNb2RlPSIzIgogICBwaG90b3Nob3A6SUNDUHJvZmlsZT0ic1JHQiBJRUM2MTk2Ni0yLjEi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";

  var COLD = {
  	x: 2,
  	y: 2,
  	width: 50,
  	height: 38,
  	anchorY: 35,
  	mask: true
  };
  var WARM = {
  	x: 54,
  	y: 2,
  	width: 50,
  	height: 38,
  	anchorY: 35,
  	mask: true
  };
  var iconMapping = {
  	COLD: COLD,
  	WARM: WARM
  };

  const FrontType = {
      COLD: 'COLD',
      WARM: 'WARM',
      OCCLUDED: 'OCCLUDED',
      STATIONARY: 'STATIONARY',
  };
  // icon anchor needs to be in the non-transparent part of the icon, to workaround for CollisionFilterExtension flickering
  // see https://github.com/visgl/deck.gl/pull/7679
  // ->
  // icon height = 35
  // icon padding bottom = 3 (found experimentally, works best for rotated icons)
  // total icon height = 38
  const iconStyle = { iconAtlas: img$2, iconMapping };

  // from https://jsitor.com/osoTOcSoig
  function findLastIndex(array, callback) {
      for (let i = array.length - 1; i >= 0; i--) {
          if (callback.call(array, array[i], i, array))
              return i;
      }
      return -1;
  }

  const ICON_MIN_DISTANCE = 5000;
  const ICON_FACTOR = 3;
  // see https://github.com/visgl/deck.gl/blob/master/examples/website/collision-filter/calculateLabels.js
  function getFrontLine(d, path) {
      const positions = path;
      const distances = positions.slice(0, -1).map((_, i) => distance(positions[i], positions[i + 1]));
      const cummulativeDistances = distances.reduce((prev, curr) => [...prev, prev[prev.length - 1] + curr], [0]);
      const totalDistance = cummulativeDistances[cummulativeDistances.length - 1];
      // add icons to minimize overlaps, alternate icon type
      // depth = 1 -> |                 0                 1                 |
      // depth = 2 -> |     0     1     0     1     0     1     0     1     |
      // depth = 3 -> | 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 |
      let icons = [];
      for (let depth = 1, deltaDistance = totalDistance / ICON_FACTOR; deltaDistance > ICON_MIN_DISTANCE; depth++, deltaDistance /= ICON_FACTOR) {
          const iconCountAtDepth = ICON_FACTOR ** depth;
          for (let i = 1; i < iconCountAtDepth; i++) {
              // skip already added icons
              if (depth > 1 && i % ICON_FACTOR === 0) {
                  continue;
              }
              const distance = i * deltaDistance;
              const positionStartIndex = findLastIndex(cummulativeDistances, x => x <= distance);
              if (positionStartIndex === -1 || positionStartIndex === positions.length - 1) {
                  // both overflows are handled by `i % ICON_FACTOR === 0` above
                  throw new Error('Invalid state');
              }
              const positionEndIndex = positionStartIndex + 1;
              const positionStart = positions[positionStartIndex];
              const positionEnd = positions[positionEndIndex];
              const cummulativeDistance = cummulativeDistances[positionStartIndex];
              const bearing = initialBearing(positionStart, positionEnd);
              const position = destinationPoint(positionStart, distance - cummulativeDistance, bearing);
              const direction = 90 - bearing;
              const priority = 100 - depth; // top levels have highest priority
              icons.push({ distance, position, direction, priority });
          }
      }
      icons = icons.sort((a, b) => a.distance - b.distance);
      const alternatingIcons = icons.map((icon, i) => ({ d, ...icon, alternate: i % 2 === 0 }));
      const line = { d, startPosition: path[0], endPosition: path[path.length - 1], icons: alternatingIcons };
      return line;
  }

  const DEFAULT_WIDTH$2 = 2;
  const DEFAULT_COLD_COLOR = [0, 0, 255];
  const DEFAULT_WARM_COLOR = [255, 0, 0];
  const DEFAULT_OCCLUDED_COLOR = [148, 0, 211];
  const DEFAULT_ICON_SIZE = 15;
  const FRONT_ICON_COLLISION_GROUP = 'front-icon';
  const defaultProps$5 = {
      data: { type: 'array', value: [] },
      minZoom: { type: 'object', value: null },
      maxZoom: { type: 'object', value: null },
      getType: { type: 'function', value: null },
      getPath: { type: 'function', value: null },
      width: { type: 'number', value: DEFAULT_WIDTH$2 },
      coldColor: { type: 'color', value: DEFAULT_COLD_COLOR },
      warmColor: { type: 'color', value: DEFAULT_WARM_COLOR },
      occludedColor: { type: 'color', value: DEFAULT_OCCLUDED_COLOR },
      iconSize: { type: 'number', value: DEFAULT_ICON_SIZE },
      _debug: { type: 'boolean', value: false },
  };
  class FrontCompositeLayer extends core.CompositeLayer {
      renderLayers() {
          const { viewport } = this.context;
          const { props, visibleFrontLines, visibleDebugFrontPoints } = this.state;
          if (!props || !visibleFrontLines || !visibleDebugFrontPoints) {
              return [];
          }
          const { getType, getPath, width, coldColor, warmColor, occludedColor, iconSize, _debug: debug } = ensureDefaultProps(props, defaultProps$5);
          if (!getType || !getPath) {
              return [];
          }
          const { iconStyle, iconAtlasTexture } = this.state;
          if (!iconStyle || !iconAtlasTexture) {
              return [];
          }
          const FrontTypeToColor = {
              [FrontType.COLD]: coldColor,
              [FrontType.WARM]: warmColor,
              [FrontType.OCCLUDED]: occludedColor,
              [FrontType.STATIONARY]: coldColor,
          };
          // render front line from front points instead of the original path, to workaround for front points detaching from the front line when over-zooming
          return [
              new layers.PathLayer(this.getSubLayerProps({
                  id: 'path',
                  data: visibleFrontLines,
                  getPath: d => [d.startPosition, ...d.icons.map(point => point.position), d.endPosition],
                  getColor: d => FrontTypeToColor[getType(d.d)],
                  getWidth: width,
                  widthUnits: 'pixels',
              })),
              new layers.PathLayer(this.getSubLayerProps({
                  id: 'path-stationary-warm',
                  data: visibleFrontLines.filter(d => getType(d.d) === FrontType.STATIONARY),
                  getPath: d => [d.startPosition, ...d.icons.map(point => point.position), d.endPosition],
                  getColor: warmColor,
                  getWidth: width,
                  widthUnits: 'pixels',
                  extensions: [new extensions.PathStyleExtension({ dash: true, highPrecisionDash: true })],
                  getDashArray: [DEFAULT_ICON_SIZE * 3, DEFAULT_ICON_SIZE * 3],
              })),
              new layers.IconLayer(this.getSubLayerProps({
                  id: 'icon',
                  data: visibleFrontLines.flatMap(d => d.icons),
                  getPosition: d => d.position,
                  getIcon: d => getType(d.d) === FrontType.OCCLUDED || getType(d.d) === FrontType.STATIONARY
                      ? (d.alternate
                          ? FrontType.COLD
                          : FrontType.WARM)
                      : getType(d.d),
                  getSize: iconSize,
                  getColor: d => getType(d.d) === FrontType.STATIONARY
                      ? (d.alternate
                          ? FrontTypeToColor[FrontType.COLD]
                          : FrontTypeToColor[FrontType.WARM])
                      : FrontTypeToColor[getType(d.d)],
                  getAngle: d => getType(d.d) === FrontType.STATIONARY
                      ? (d.alternate
                          ? getViewportAngle(viewport, d.direction)
                          : getViewportAngle(viewport, d.direction + 180))
                      : getViewportAngle(viewport, d.direction),
                  iconAtlas: iconAtlasTexture,
                  iconMapping: iconStyle.iconMapping,
                  billboard: false,
                  extensions: [new extensions.CollisionFilterExtension()],
                  collisionEnabled: true,
                  collisionGroup: FRONT_ICON_COLLISION_GROUP,
                  collisionTestProps: { sizeScale: 5 },
                  getCollisionPriority: (d) => d.priority,
              })),
              ...(debug ? [
                  new layers.TextLayer(this.getSubLayerProps({
                      id: 'text',
                      data: visibleDebugFrontPoints,
                      getPosition: d => d.position,
                      getText: d => `${d.index}`,
                      getSize: DEFAULT_TEXT_SIZE,
                      getColor: DEFAULT_TEXT_COLOR,
                      getAngle: getViewportAngle(viewport, 0),
                      outlineWidth: DEFAULT_TEXT_OUTLINE_WIDTH,
                      outlineColor: DEFAULT_TEXT_OUTLINE_COLOR,
                      fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                      fontSettings: { sdf: true },
                      billboard: false,
                  })),
              ] : []),
          ];
      }
      shouldUpdateState(params) {
          return super.shouldUpdateState(params) || params.changeFlags.viewportChanged;
      }
      updateState(params) {
          const { data, getType, getPath, minZoom, maxZoom } = params.props;
          super.updateState(params);
          if (!data || !getType || !getPath) {
              this.setState({
                  features: undefined,
                  debugFeatures: undefined,
                  visibleFeatures: undefined,
                  visibleDebugFeatures: undefined,
              });
              return;
          }
          if (!this.state.iconStyle) {
              this._updateIconStyle();
          }
          if (data !== params.oldProps.data ||
              getPath !== params.oldProps.getPath) {
              this._updateFeatures();
          }
          if (minZoom !== params.oldProps.minZoom ||
              maxZoom !== params.oldProps.maxZoom ||
              params.changeFlags.viewportChanged) {
              this._updateVisibleFeatures();
          }
          this.setState({ props: params.props });
      }
      async _updateIconStyle() {
          const { device } = this.context;
          this.setState({ iconStyle });
          const iconAtlasTexture = createTextureCached(device, await loadTextureData(iconStyle.iconAtlas));
          this.setState({ iconAtlasTexture });
      }
      _updateFeatures() {
          const { data, getPath } = ensureDefaultProps(this.props, defaultProps$5);
          if (!getPath) {
              return;
          }
          const frontLines = data.map(d => getFrontLine(d, getPath(d)));
          const debugFrontPoints = data.flatMap(d => getPath(d).map((position, index) => ({ d, position, index })));
          this.setState({ frontLines, debugFrontPoints });
          this._updateVisibleFeatures();
      }
      _updateVisibleFeatures() {
          const { viewport } = this.context;
          const { minZoom, maxZoom } = ensureDefaultProps(this.props, defaultProps$5);
          const { frontLines, debugFrontPoints } = this.state;
          if (!frontLines || !debugFrontPoints) {
              return;
          }
          let visibleFrontLines;
          let visibleDebugFrontPoints;
          if (isViewportInZoomBounds(viewport, minZoom, maxZoom)) {
              visibleFrontLines = frontLines;
              visibleDebugFrontPoints = debugFrontPoints;
          }
          else {
              visibleFrontLines = [];
              visibleDebugFrontPoints = [];
          }
          this.setState({ visibleFrontLines, visibleDebugFrontPoints });
      }
  }
  FrontCompositeLayer.layerName = 'FrontCompositeLayer';
  FrontCompositeLayer.defaultProps = defaultProps$5;

  const defaultProps$4 = {
      ...FrontCompositeLayer.defaultProps,
  };
  class FrontLayer extends core.CompositeLayer {
      renderLayers() {
          return [
              new FrontCompositeLayer(this.props, this.getSubLayerProps({
                  id: 'composite',
              })),
          ];
      }
  }
  FrontLayer.layerName = 'FrontLayer';
  FrontLayer.defaultProps = defaultProps$4;

  const D2R = Math.PI / 180;
  const R2D = 180 / Math.PI;
  // 900913 properties;
  const A = 6378137.0;
  const MAXEXTENT = 20037508.342789244;
  const SPHERICAL_MERCATOR_SRS = '900913'; // https://epsg.io/900913, https://epsg.io/3857
  const WGS84 = 'WGS84'; // https://epsg.io/4326

  const cache = {};
  function isFloat(n) {
    return Number(n) === n && n % 1 !== 0;
  }
  class SphericalMercator {
    #size;
    #expansion;
    #Bc;
    #Cc;
    #zc;
    #Ac;
    constructor(options = {}) {
      this.#size = options.size || 256;
      this.#expansion = options.antimeridian ? 2 : 1;
      if (!cache[this.#size]) {
        let size = this.#size;
        const c = cache[this.#size] = {};
        c.Bc = [];
        c.Cc = [];
        c.zc = [];
        c.Ac = [];
        for (let d = 0; d < 30; d++) {
          c.Bc.push(size / 360);
          c.Cc.push(size / (2 * Math.PI));
          c.zc.push(size / 2);
          c.Ac.push(size);
          size *= 2;
        }
      }
      this.#Bc = cache[this.#size].Bc;
      this.#Cc = cache[this.#size].Cc;
      this.#zc = cache[this.#size].zc;
      this.#Ac = cache[this.#size].Ac;
    }
    px(ll, zoom) {
      if (isFloat(zoom)) {
        const size = this.#size * Math.pow(2, zoom);
        const d = size / 2;
        const bc = size / 360;
        const cc = size / (2 * Math.PI);
        const ac = size;
        const f = Math.min(Math.max(Math.sin(D2R * ll[1]), -0.9999), 0.9999);
        let x = d + ll[0] * bc;
        let y = d + 0.5 * Math.log((1 + f) / (1 - f)) * -cc;
        x > ac * this.#expansion && (x = ac * this.#expansion);
        y > ac && (y = ac);
        //(x < 0) && (x = 0);
        //(y < 0) && (y = 0);
        return [x, y];
      } else {
        const d = this.#zc[zoom];
        const f = Math.min(Math.max(Math.sin(D2R * ll[1]), -0.9999), 0.9999);
        let x = Math.round(d + ll[0] * this.#Bc[zoom]);
        let y = Math.round(d + 0.5 * Math.log((1 + f) / (1 - f)) * -this.#Cc[zoom]);
        x > this.#Ac[zoom] * this.#expansion && (x = this.#Ac[zoom] * this.#expansion);
        y > this.#Ac[zoom] && (y = this.#Ac[zoom]);
        //(x < 0) && (x = 0);
        //(y < 0) && (y = 0);
        return [x, y];
      }
    }
    ll(px, zoom) {
      if (isFloat(zoom)) {
        const size = this.#size * Math.pow(2, zoom);
        const bc = size / 360;
        const cc = size / (2 * Math.PI);
        const zc = size / 2;
        const g = (px[1] - zc) / -cc;
        const lon = (px[0] - zc) / bc;
        const lat = R2D * (2 * Math.atan(Math.exp(g)) - 0.5 * Math.PI);
        return [lon, lat];
      } else {
        const g = (px[1] - this.#zc[zoom]) / -this.#Cc[zoom];
        const lon = (px[0] - this.#zc[zoom]) / this.#Bc[zoom];
        const lat = R2D * (2 * Math.atan(Math.exp(g)) - 0.5 * Math.PI);
        return [lon, lat];
      }
    }
    convert(bbox, to) {
      if (to === SPHERICAL_MERCATOR_SRS) {
        return [...this.forward(bbox.slice(0, 2)), ...this.forward(bbox.slice(2, 4))];
      } else {
        return [...this.inverse(bbox.slice(0, 2)), ...this.inverse(bbox.slice(2, 4))];
      }
    }
    inverse(xy) {
      return [xy[0] * R2D / A, (Math.PI * 0.5 - 2.0 * Math.atan(Math.exp(-xy[1] / A))) * R2D];
    }
    forward(ll) {
      const xy = [A * ll[0] * D2R, A * Math.log(Math.tan(Math.PI * 0.25 + 0.5 * ll[1] * D2R))];
      // if xy value is beyond maxextent (e.g. poles), return maxextent.
      xy[0] > MAXEXTENT && (xy[0] = MAXEXTENT);
      xy[0] < -MAXEXTENT && (xy[0] = -MAXEXTENT);
      xy[1] > MAXEXTENT && (xy[1] = MAXEXTENT);
      xy[1] < -MAXEXTENT && (xy[1] = -MAXEXTENT);
      return xy;
    }
    bbox(x, y, zoom, tmsStyle, srs) {
      // Convert xyz into bbox with srs WGS84
      if (tmsStyle) {
        y = Math.pow(2, zoom) - 1 - y;
      }
      // Use +y to make sure it's a number to avoid inadvertent concatenation.
      const ll = [x * this.#size, (+y + 1) * this.#size]; // lower left
      // Use +x to make sure it's a number to avoid inadvertent concatenation.
      const ur = [(+x + 1) * this.#size, y * this.#size]; // upper right
      const bbox = [...this.ll(ll, zoom), ...this.ll(ur, zoom)];
      // If web mercator requested reproject to 900913.
      if (srs === SPHERICAL_MERCATOR_SRS) return this.convert(bbox, SPHERICAL_MERCATOR_SRS);
      return bbox;
    }
    xyz(bbox, zoom, tmsStyle, srs) {
      // If web mercator provided reproject to WGS84.
      const box = srs === SPHERICAL_MERCATOR_SRS ? this.convert(bbox, WGS84) : bbox;
      const ll = [box[0], box[1]]; // lower left
      const ur = [box[2], box[3]]; // upper right
      const px_ll = this.px(ll, zoom);
      const px_ur = this.px(ur, zoom);
      // Y = 0 for XYZ is the top hence minY uses px_ur[1].
      const x = [Math.floor(px_ll[0] / this.#size), Math.floor((px_ur[0] - 1) / this.#size)];
      const y = [Math.floor(px_ur[1] / this.#size), Math.floor((px_ll[1] - 1) / this.#size)];
      const bounds = {
        minX: Math.min.apply(Math, x) < 0 ? 0 : Math.min.apply(Math, x),
        minY: Math.min.apply(Math, y) < 0 ? 0 : Math.min.apply(Math, y),
        maxX: Math.max.apply(Math, x),
        maxY: Math.max.apply(Math, y)
      };
      if (tmsStyle) {
        const tms = {
          minY: Math.pow(2, zoom) - 1 - bounds.maxY,
          maxY: Math.pow(2, zoom) - 1 - bounds.minY
        };
        bounds.minY = tms.minY;
        bounds.maxY = tms.maxY;
      }
      return bounds;
    }
  }

  function icomesh(order = 4, uvMap = false) {
    if (order > 10) throw new Error(`Max order is 10, but given ${order}.`);

    // set up an icosahedron (12 vertices / 20 triangles)
    const f = (1 + Math.sqrt(5)) / 2;
    const T = Math.pow(4, order);
    const numVertices = 10 * T + 2;
    const numDuplicates = !uvMap ? 0 : order === 0 ? 3 : Math.pow(2, order) * 3 + 9;
    const vertices = new Float32Array((numVertices + numDuplicates) * 3);
    vertices.set(Float32Array.of(-1, f, 0, 1, f, 0, -1, -f, 0, 1, -f, 0, 0, -1, f, 0, 1, f, 0, -1, -f, 0, 1, -f, f, 0, -1, f, 0, 1, -f, 0, -1, -f, 0, 1));
    let triangles = Uint16Array.of(0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 11, 10, 2, 5, 11, 4, 1, 5, 9, 7, 1, 8, 10, 7, 6, 3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 9, 8, 1, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7);
    let v = 12;
    const midCache = order ? new Map() : null; // midpoint vertices cache to avoid duplicating shared vertices

    function addMidPoint(a, b) {
      const key = Math.floor((a + b) * (a + b + 1) / 2 + Math.min(a, b)); // Cantor's pairing function
      const i = midCache.get(key);
      if (i !== undefined) {
        midCache.delete(key); // midpoint is only reused once, so we delete it for performance
        return i;
      }
      midCache.set(key, v);
      vertices[3 * v + 0] = (vertices[3 * a + 0] + vertices[3 * b + 0]) * 0.5;
      vertices[3 * v + 1] = (vertices[3 * a + 1] + vertices[3 * b + 1]) * 0.5;
      vertices[3 * v + 2] = (vertices[3 * a + 2] + vertices[3 * b + 2]) * 0.5;
      return v++;
    }
    let trianglesPrev = triangles;
    const IndexArray = order > 5 ? Uint32Array : Uint16Array;
    for (let i = 0; i < order; i++) {
      // repeatedly subdivide each triangle into 4 triangles
      const prevLen = trianglesPrev.length;
      triangles = new IndexArray(prevLen * 4);
      for (let k = 0; k < prevLen; k += 3) {
        const v1 = trianglesPrev[k + 0];
        const v2 = trianglesPrev[k + 1];
        const v3 = trianglesPrev[k + 2];
        const a = addMidPoint(v1, v2);
        const b = addMidPoint(v2, v3);
        const c = addMidPoint(v3, v1);
        let t = k * 4;
        triangles[t++] = v1;
        triangles[t++] = a;
        triangles[t++] = c;
        triangles[t++] = v2;
        triangles[t++] = b;
        triangles[t++] = a;
        triangles[t++] = v3;
        triangles[t++] = c;
        triangles[t++] = b;
        triangles[t++] = a;
        triangles[t++] = b;
        triangles[t++] = c;
      }
      trianglesPrev = triangles;
    }

    // normalize vertices
    for (let i = 0; i < numVertices * 3; i += 3) {
      const v1 = vertices[i + 0];
      const v2 = vertices[i + 1];
      const v3 = vertices[i + 2];
      const m = 1 / Math.sqrt(v1 * v1 + v2 * v2 + v3 * v3);
      vertices[i + 0] *= m;
      vertices[i + 1] *= m;
      vertices[i + 2] *= m;
    }
    if (!uvMap) return {
      vertices,
      triangles
    };

    // uv mapping
    const uv = new Float32Array((numVertices + numDuplicates) * 2);
    for (let i = 0; i < numVertices; i++) {
      uv[2 * i + 0] = Math.atan2(vertices[3 * i + 2], vertices[3 * i]) / (2 * Math.PI) + 0.5;
      uv[2 * i + 1] = Math.asin(vertices[3 * i + 1]) / Math.PI + 0.5;
    }
    const duplicates = new Map();
    function addDuplicate(i, uvx, uvy, cached) {
      if (cached) {
        const dupe = duplicates.get(i);
        if (dupe !== undefined) return dupe;
      }
      vertices[3 * v + 0] = vertices[3 * i + 0];
      vertices[3 * v + 1] = vertices[3 * i + 1];
      vertices[3 * v + 2] = vertices[3 * i + 2];
      uv[2 * v + 0] = uvx;
      uv[2 * v + 1] = uvy;
      if (cached) duplicates.set(i, v);
      return v++;
    }
    for (let i = 0; i < triangles.length; i += 3) {
      const a = triangles[i + 0];
      const b = triangles[i + 1];
      const c = triangles[i + 2];
      let ax = uv[2 * a];
      let bx = uv[2 * b];
      let cx = uv[2 * c];
      const ay = uv[2 * a + 1];
      const by = uv[2 * b + 1];
      const cy = uv[2 * c + 1];

      // uv fixing code; don't ask me how I got here
      if (bx - ax >= 0.5 && ay !== 1) bx -= 1;
      if (cx - bx > 0.5) cx -= 1;
      if (ax > 0.5 && ax - cx > 0.5 || ax === 1 && cy === 0) ax -= 1;
      if (bx > 0.5 && bx - ax > 0.5) bx -= 1;
      if (ay === 0 || ay === 1) {
        ax = (bx + cx) / 2;
        if (ay === bx) uv[2 * a] = ax;else triangles[i + 0] = addDuplicate(a, ax, ay, false);
      } else if (by === 0 || by === 1) {
        bx = (ax + cx) / 2;
        if (by === ax) uv[2 * b] = bx;else triangles[i + 1] = addDuplicate(b, bx, by, false);
      } else if (cy === 0 || cy === 1) {
        cx = (ax + bx) / 2;
        if (cy === ax) uv[2 * c] = cx;else triangles[i + 2] = addDuplicate(c, cx, cy, false);
      }
      if (ax !== uv[2 * a] && ay !== 0 && ay !== 1) triangles[i + 0] = addDuplicate(a, ax, ay, true);
      if (bx !== uv[2 * b] && by !== 0 && by !== 1) triangles[i + 1] = addDuplicate(b, bx, by, true);
      if (cx !== uv[2 * c] && cy !== 0 && cy !== 1) triangles[i + 2] = addDuplicate(c, cx, cy, true);
    }
    return {
      vertices,
      triangles,
      uv
    };
  }

  const ARRAY_TYPES = [Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array];

  /** @typedef {Int8ArrayConstructor | Uint8ArrayConstructor | Uint8ClampedArrayConstructor | Int16ArrayConstructor | Uint16ArrayConstructor | Int32ArrayConstructor | Uint32ArrayConstructor | Float32ArrayConstructor | Float64ArrayConstructor} TypedArrayConstructor */

  const VERSION = 1; // serialized format version
  const HEADER_SIZE = 8;
  class KDBush {
    /**
     * Creates an index from raw `ArrayBuffer` data.
     * @param {ArrayBuffer} data
     */
    static from(data) {
      if (!(data instanceof ArrayBuffer)) {
        throw new Error('Data must be an instance of ArrayBuffer.');
      }
      const [magic, versionAndType] = new Uint8Array(data, 0, 2);
      if (magic !== 0xdb) {
        throw new Error('Data does not appear to be in a KDBush format.');
      }
      const version = versionAndType >> 4;
      if (version !== VERSION) {
        throw new Error(`Got v${version} data when expected v${VERSION}.`);
      }
      const ArrayType = ARRAY_TYPES[versionAndType & 0x0f];
      if (!ArrayType) {
        throw new Error('Unrecognized array type.');
      }
      const [nodeSize] = new Uint16Array(data, 2, 1);
      const [numItems] = new Uint32Array(data, 4, 1);
      return new KDBush(numItems, nodeSize, ArrayType, data);
    }

    /**
     * Creates an index that will hold a given number of items.
     * @param {number} numItems
     * @param {number} [nodeSize=64] Size of the KD-tree node (64 by default).
     * @param {TypedArrayConstructor} [ArrayType=Float64Array] The array type used for coordinates storage (`Float64Array` by default).
     * @param {ArrayBuffer} [data] (For internal use only)
     */
    constructor(numItems, nodeSize = 64, ArrayType = Float64Array, data) {
      if (isNaN(numItems) || numItems < 0) throw new Error(`Unpexpected numItems value: ${numItems}.`);
      this.numItems = +numItems;
      this.nodeSize = Math.min(Math.max(+nodeSize, 2), 65535);
      this.ArrayType = ArrayType;
      this.IndexArrayType = numItems < 65536 ? Uint16Array : Uint32Array;
      const arrayTypeIndex = ARRAY_TYPES.indexOf(this.ArrayType);
      const coordsByteSize = numItems * 2 * this.ArrayType.BYTES_PER_ELEMENT;
      const idsByteSize = numItems * this.IndexArrayType.BYTES_PER_ELEMENT;
      const padCoords = (8 - idsByteSize % 8) % 8;
      if (arrayTypeIndex < 0) {
        throw new Error(`Unexpected typed array class: ${ArrayType}.`);
      }
      if (data && data instanceof ArrayBuffer) {
        // reconstruct an index from a buffer
        this.data = data;
        this.ids = new this.IndexArrayType(this.data, HEADER_SIZE, numItems);
        this.coords = new this.ArrayType(this.data, HEADER_SIZE + idsByteSize + padCoords, numItems * 2);
        this._pos = numItems * 2;
        this._finished = true;
      } else {
        // initialize a new index
        this.data = new ArrayBuffer(HEADER_SIZE + coordsByteSize + idsByteSize + padCoords);
        this.ids = new this.IndexArrayType(this.data, HEADER_SIZE, numItems);
        this.coords = new this.ArrayType(this.data, HEADER_SIZE + idsByteSize + padCoords, numItems * 2);
        this._pos = 0;
        this._finished = false;

        // set header
        new Uint8Array(this.data, 0, 2).set([0xdb, (VERSION << 4) + arrayTypeIndex]);
        new Uint16Array(this.data, 2, 1)[0] = nodeSize;
        new Uint32Array(this.data, 4, 1)[0] = numItems;
      }
    }

    /**
     * Add a point to the index.
     * @param {number} x
     * @param {number} y
     * @returns {number} An incremental index associated with the added item (starting from `0`).
     */
    add(x, y) {
      const index = this._pos >> 1;
      this.ids[index] = index;
      this.coords[this._pos++] = x;
      this.coords[this._pos++] = y;
      return index;
    }

    /**
     * Perform indexing of the added points.
     */
    finish() {
      const numAdded = this._pos >> 1;
      if (numAdded !== this.numItems) {
        throw new Error(`Added ${numAdded} items when expected ${this.numItems}.`);
      }
      // kd-sort both arrays for efficient search
      sort(this.ids, this.coords, this.nodeSize, 0, this.numItems - 1, 0);
      this._finished = true;
      return this;
    }

    /**
     * Search the index for items within a given bounding box.
     * @param {number} minX
     * @param {number} minY
     * @param {number} maxX
     * @param {number} maxY
     * @returns {number[]} An array of indices correponding to the found items.
     */
    range(minX, minY, maxX, maxY) {
      if (!this._finished) throw new Error('Data not yet indexed - call index.finish().');
      const {
        ids,
        coords,
        nodeSize
      } = this;
      const stack = [0, ids.length - 1, 0];
      const result = [];

      // recursively search for items in range in the kd-sorted arrays
      while (stack.length) {
        const axis = stack.pop() || 0;
        const right = stack.pop() || 0;
        const left = stack.pop() || 0;

        // if we reached "tree node", search linearly
        if (right - left <= nodeSize) {
          for (let i = left; i <= right; i++) {
            const x = coords[2 * i];
            const y = coords[2 * i + 1];
            if (x >= minX && x <= maxX && y >= minY && y <= maxY) result.push(ids[i]);
          }
          continue;
        }

        // otherwise find the middle index
        const m = left + right >> 1;

        // include the middle item if it's in range
        const x = coords[2 * m];
        const y = coords[2 * m + 1];
        if (x >= minX && x <= maxX && y >= minY && y <= maxY) result.push(ids[m]);

        // queue search in halves that intersect the query
        if (axis === 0 ? minX <= x : minY <= y) {
          stack.push(left);
          stack.push(m - 1);
          stack.push(1 - axis);
        }
        if (axis === 0 ? maxX >= x : maxY >= y) {
          stack.push(m + 1);
          stack.push(right);
          stack.push(1 - axis);
        }
      }
      return result;
    }

    /**
     * Search the index for items within a given radius.
     * @param {number} qx
     * @param {number} qy
     * @param {number} r Query radius.
     * @returns {number[]} An array of indices correponding to the found items.
     */
    within(qx, qy, r) {
      if (!this._finished) throw new Error('Data not yet indexed - call index.finish().');
      const {
        ids,
        coords,
        nodeSize
      } = this;
      const stack = [0, ids.length - 1, 0];
      const result = [];
      const r2 = r * r;

      // recursively search for items within radius in the kd-sorted arrays
      while (stack.length) {
        const axis = stack.pop() || 0;
        const right = stack.pop() || 0;
        const left = stack.pop() || 0;

        // if we reached "tree node", search linearly
        if (right - left <= nodeSize) {
          for (let i = left; i <= right; i++) {
            if (sqDist(coords[2 * i], coords[2 * i + 1], qx, qy) <= r2) result.push(ids[i]);
          }
          continue;
        }

        // otherwise find the middle index
        const m = left + right >> 1;

        // include the middle item if it's in range
        const x = coords[2 * m];
        const y = coords[2 * m + 1];
        if (sqDist(x, y, qx, qy) <= r2) result.push(ids[m]);

        // queue search in halves that intersect the query
        if (axis === 0 ? qx - r <= x : qy - r <= y) {
          stack.push(left);
          stack.push(m - 1);
          stack.push(1 - axis);
        }
        if (axis === 0 ? qx + r >= x : qy + r >= y) {
          stack.push(m + 1);
          stack.push(right);
          stack.push(1 - axis);
        }
      }
      return result;
    }
  }

  /**
   * @param {Uint16Array | Uint32Array} ids
   * @param {InstanceType<TypedArrayConstructor>} coords
   * @param {number} nodeSize
   * @param {number} left
   * @param {number} right
   * @param {number} axis
   */
  function sort(ids, coords, nodeSize, left, right, axis) {
    if (right - left <= nodeSize) return;
    const m = left + right >> 1; // middle index

    // sort ids and coords around the middle index so that the halves lie
    // either left/right or top/bottom correspondingly (taking turns)
    select(ids, coords, m, left, right, axis);

    // recursively kd-sort first half and second half on the opposite axis
    sort(ids, coords, nodeSize, left, m - 1, 1 - axis);
    sort(ids, coords, nodeSize, m + 1, right, 1 - axis);
  }

  /**
   * Custom Floyd-Rivest selection algorithm: sort ids and coords so that
   * [left..k-1] items are smaller than k-th item (on either x or y axis)
   * @param {Uint16Array | Uint32Array} ids
   * @param {InstanceType<TypedArrayConstructor>} coords
   * @param {number} k
   * @param {number} left
   * @param {number} right
   * @param {number} axis
   */
  function select(ids, coords, k, left, right, axis) {
    while (right > left) {
      if (right - left > 600) {
        const n = right - left + 1;
        const m = k - left + 1;
        const z = Math.log(n);
        const s = 0.5 * Math.exp(2 * z / 3);
        const sd = 0.5 * Math.sqrt(z * s * (n - s) / n) * (m - n / 2 < 0 ? -1 : 1);
        const newLeft = Math.max(left, Math.floor(k - m * s / n + sd));
        const newRight = Math.min(right, Math.floor(k + (n - m) * s / n + sd));
        select(ids, coords, k, newLeft, newRight, axis);
      }
      const t = coords[2 * k + axis];
      let i = left;
      let j = right;
      swapItem(ids, coords, left, k);
      if (coords[2 * right + axis] > t) swapItem(ids, coords, left, right);
      while (i < j) {
        swapItem(ids, coords, i, j);
        i++;
        j--;
        while (coords[2 * i + axis] < t) i++;
        while (coords[2 * j + axis] > t) j--;
      }
      if (coords[2 * left + axis] === t) swapItem(ids, coords, left, j);else {
        j++;
        swapItem(ids, coords, j, right);
      }
      if (j <= k) left = j + 1;
      if (k <= j) right = j - 1;
    }
  }

  /**
   * @param {Uint16Array | Uint32Array} ids
   * @param {InstanceType<TypedArrayConstructor>} coords
   * @param {number} i
   * @param {number} j
   */
  function swapItem(ids, coords, i, j) {
    swap(ids, i, j);
    swap(coords, 2 * i, 2 * j);
    swap(coords, 2 * i + 1, 2 * j + 1);
  }

  /**
   * @param {InstanceType<TypedArrayConstructor>} arr
   * @param {number} i
   * @param {number} j
   */
  function swap(arr, i, j) {
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }

  /**
   * @param {number} ax
   * @param {number} ay
   * @param {number} bx
   * @param {number} by
   */
  function sqDist(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  }

  class TinyQueue {
    constructor(data = [], compare = defaultCompare) {
      this.data = data;
      this.length = this.data.length;
      this.compare = compare;
      if (this.length > 0) {
        for (let i = (this.length >> 1) - 1; i >= 0; i--) this._down(i);
      }
    }
    push(item) {
      this.data.push(item);
      this.length++;
      this._up(this.length - 1);
    }
    pop() {
      if (this.length === 0) return undefined;
      const top = this.data[0];
      const bottom = this.data.pop();
      this.length--;
      if (this.length > 0) {
        this.data[0] = bottom;
        this._down(0);
      }
      return top;
    }
    peek() {
      return this.data[0];
    }
    _up(pos) {
      const {
        data,
        compare
      } = this;
      const item = data[pos];
      while (pos > 0) {
        const parent = pos - 1 >> 1;
        const current = data[parent];
        if (compare(item, current) >= 0) break;
        data[pos] = current;
        pos = parent;
      }
      data[pos] = item;
    }
    _down(pos) {
      const {
        data,
        compare
      } = this;
      const halfLength = this.length >> 1;
      const item = data[pos];
      while (pos < halfLength) {
        let left = (pos << 1) + 1;
        let best = data[left];
        const right = left + 1;
        if (right < this.length && compare(data[right], best) < 0) {
          left = right;
          best = data[right];
        }
        if (compare(best, item) >= 0) break;
        data[pos] = best;
        pos = left;
      }
      data[pos] = item;
    }
  }
  function defaultCompare(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
  }

  const earthRadius = 6371;
  const rad = Math.PI / 180;
  function around(index, lng, lat, maxResults = Infinity, maxDistance = Infinity, predicate) {
    let maxHaverSinDist = 1;
    const result = [];
    if (maxResults === undefined) maxResults = Infinity;
    if (maxDistance !== undefined) maxHaverSinDist = haverSin(maxDistance / earthRadius);

    // a distance-sorted priority queue that will contain both points and kd-tree nodes
    const q = new TinyQueue([], compareDist);

    // an object that represents the top kd-tree node (the whole Earth)
    let node = {
      left: 0,
      // left index in the kd-tree array
      right: index.ids.length - 1,
      // right index
      axis: 0,
      // will hold the lower bound of children's distances to the query point
      minLng: -180,
      // bounding box of the node
      minLat: -90,
      maxLng: 180,
      maxLat: 90
    };
    const cosLat = Math.cos(lat * rad);
    while (node) {
      const right = node.right;
      const left = node.left;
      if (right - left <= index.nodeSize) {
        // leaf node

        // add all points of the leaf node to the queue
        for (let i = left; i <= right; i++) {
          const id = index.ids[i];
          {
            const dist = haverSinDist(lng, lat, index.coords[2 * i], index.coords[2 * i + 1], cosLat);
            q.push({
              id,
              dist
            });
          }
        }
      } else {
        // not a leaf node (has child nodes)

        const m = left + right >> 1; // middle index
        const midLng = index.coords[2 * m];
        const midLat = index.coords[2 * m + 1];

        // add middle point to the queue
        const id = index.ids[m];
        {
          const dist = haverSinDist(lng, lat, midLng, midLat, cosLat);
          q.push({
            id,
            dist
          });
        }
        const nextAxis = (node.axis + 1) % 2;

        // first half of the node
        const leftNode = {
          left,
          right: m - 1,
          axis: nextAxis,
          minLng: node.minLng,
          minLat: node.minLat,
          maxLng: node.axis === 0 ? midLng : node.maxLng,
          maxLat: node.axis === 1 ? midLat : node.maxLat,
          dist: 0
        };
        // second half of the node
        const rightNode = {
          left: m + 1,
          right,
          axis: nextAxis,
          minLng: node.axis === 0 ? midLng : node.minLng,
          minLat: node.axis === 1 ? midLat : node.minLat,
          maxLng: node.maxLng,
          maxLat: node.maxLat,
          dist: 0
        };
        leftNode.dist = boxDist(lng, lat, cosLat, leftNode);
        rightNode.dist = boxDist(lng, lat, cosLat, rightNode);

        // add child nodes to the queue
        q.push(leftNode);
        q.push(rightNode);
      }

      // fetch closest points from the queue; they're guaranteed to be closer
      // than all remaining points (both individual and those in kd-tree nodes),
      // since each node's distance is a lower bound of distances to its children
      while (q.length && q.peek().id != null) {
        const candidate = q.pop();
        if (candidate.dist > maxHaverSinDist) return result;
        result.push(candidate.id);
        if (result.length === maxResults) return result;
      }

      // the next closest kd-tree node
      node = q.pop();
    }
    return result;
  }

  // lower bound for distance from a location to points inside a bounding box
  function boxDist(lng, lat, cosLat, node) {
    const minLng = node.minLng;
    const maxLng = node.maxLng;
    const minLat = node.minLat;
    const maxLat = node.maxLat;

    // query point is between minimum and maximum longitudes
    if (lng >= minLng && lng <= maxLng) {
      if (lat < minLat) return haverSin((lat - minLat) * rad);
      if (lat > maxLat) return haverSin((lat - maxLat) * rad);
      return 0;
    }

    // query point is west or east of the bounding box;
    // calculate the extremum for great circle distance from query point to the closest longitude;
    const haverSinDLng = Math.min(haverSin((lng - minLng) * rad), haverSin((lng - maxLng) * rad));
    const extremumLat = vertexLat(lat, haverSinDLng);

    // if extremum is inside the box, return the distance to it
    if (extremumLat > minLat && extremumLat < maxLat) {
      return haverSinDistPartial(haverSinDLng, cosLat, lat, extremumLat);
    }
    // otherwise return the distan e to one of the bbox corners (whichever is closest)
    return Math.min(haverSinDistPartial(haverSinDLng, cosLat, lat, minLat), haverSinDistPartial(haverSinDLng, cosLat, lat, maxLat));
  }
  function compareDist(a, b) {
    return a.dist - b.dist;
  }
  function haverSin(theta) {
    const s = Math.sin(theta / 2);
    return s * s;
  }
  function haverSinDistPartial(haverSinDLng, cosLat1, lat1, lat2) {
    return cosLat1 * Math.cos(lat2 * rad) * haverSinDLng + haverSin((lat1 - lat2) * rad);
  }
  function haverSinDist(lng1, lat1, lng2, lat2, cosLat1) {
    const haverSinDLng = haverSin((lng1 - lng2) * rad);
    return haverSinDistPartial(haverSinDLng, cosLat1, lat1, lat2);
  }
  function vertexLat(lat, haverSinDLng) {
    const cosDLng = 1 - 2 * haverSinDLng;
    if (cosDLng <= 0) return lat > 0 ? 90 : -90;
    return Math.atan(Math.tan(lat * rad) / cosDLng) / rad;
  }

  const GLOBAL_POSITIONS_AT_ZOOM_CACHE = new Map();
  const GLOBAL_INDEX_AT_ZOOM_CACHE = new Map();
  function getViewportGridPositions(viewport, zoomOffset = 0) {
      let positions;
      if (isViewportGlobe(viewport)) {
          const viewportGlobeCenter = getViewportGlobeCenter(viewport);
          const viewportGlobeRadius = getViewportGlobeRadius(viewport);
          const gridZoom = Math.floor(getViewportZoom(viewport) + zoomOffset + 1);
          positions = generateGlobeGrid(viewportGlobeCenter, viewportGlobeRadius, gridZoom);
      }
      else if (isViewportMercator(viewport)) {
          const viewportBounds = getViewportBounds(viewport);
          const gridZoom = Math.floor(getViewportZoom(viewport) + zoomOffset);
          positions = generateGrid(viewportBounds, gridZoom);
      }
      else {
          throw new Error('Invalid state');
      }
      return positions;
  }
  function generateGlobeGrid(center, radius, zoom) {
      // icomesh performance
      // order 0 - 0.03 ms
      // order 1 - 0.40 ms
      // order 2 - 0.16 ms
      // order 3 - 0.59 ms
      // order 4 - 2.35 ms
      // order 5 - 7.27 ms
      // order 6 - 29.68 ms
      // order 7 - 66.05 ms
      // order 8 - 127.02 ms
      // order 9 - 555.85 ms
      // order 10 - 2460.47 ms
      // TODO: generate local icomesh
      const MAX_ICOMESH_ZOOM = 7;
      zoom = Math.min(Math.max(zoom - 2, 0), MAX_ICOMESH_ZOOM);
      const globalPositions = GLOBAL_POSITIONS_AT_ZOOM_CACHE.get(zoom) ?? (() => {
          const { uv } = icomesh(zoom, true);
          const globalPositions = [];
          for (let i = 0; i < uv.length; i += 2) {
              const uvX = uv[i];
              const uvY = uv[i + 1];
              // avoid duplicate grid points at the antimeridian
              if (uvX === 0) {
                  continue;
              }
              // avoid invalid grid points at the poles
              if (uvY <= 0 || uvY >= 1) {
                  continue;
              }
              const positionX = uvX * 360 - 180;
              const positionY = uvY * 180 - 90;
              globalPositions.push([positionX, positionY]);
          }
          // add simple grid points at poles
          globalPositions.push([0, -90]);
          globalPositions.push([0, 90]);
          return globalPositions;
      })();
      const globalIndex = GLOBAL_INDEX_AT_ZOOM_CACHE.get(zoom) ?? (() => {
          const globalIndex = new KDBush(globalPositions.length, undefined, Float32Array);
          for (let i = 0; i < globalPositions.length; i++) {
              const position = globalPositions[i];
              globalIndex.add(position[0], position[1]);
          }
          globalIndex.finish();
          return globalIndex;
      })();
      const ids = around(globalIndex, center[0], center[1], undefined, radius / 1000);
      const positions = ids.map(i => globalPositions[i]);
      return positions;
  }
  function generateGrid(bounds, zoom) {
      const mercator = new SphericalMercator({ size: 1, antimeridian: true });
      const gridBounds = [...mercator.px([bounds[0], bounds[1]], zoom), ...mercator.px([bounds[2], bounds[3]], zoom)];
      [gridBounds[1], gridBounds[3]] = [gridBounds[3], gridBounds[1]];
      const size = 2 ** zoom;
      const lngCount = gridBounds[2] - gridBounds[0] + 1;
      const latCount = gridBounds[3] - gridBounds[1] + 1;
      const positions = [];
      for (let y = 0; y < latCount; y++) {
          for (let x = 0; x < lngCount; x++) {
              const i = gridBounds[0] + x;
              const j = gridBounds[1] + y + (i % 2 === 1 ? 0.5 : 0); // triangle grid
              const point = [i, j];
              // avoid duplicate grid points at the antimeridian
              if (point[0] === 0) {
                  continue;
              }
              // avoid invalid grid points at the poles
              if (point[1] <= 0 || point[1] >= size) {
                  continue;
              }
              const position = mercator.ll([point[0], point[1]], zoom);
              position[0] = wrapLongitude(position[0]);
              positions.push(position);
          }
      }
      return positions;
  }

  var img$1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAFtGlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4KPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNS41LjAiPgogPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIgogICAgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIgogICAgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIgogICAgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIgogICAgeG1sbnM6ZXhpZj0iaHR0cDovL25zLmFkb2JlLmNvbS9leGlmLzEuMC8iCiAgICB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyIKICAgIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIgogICAgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIKICAgeG1wOkNyZWF0ZURhdGU9IjIwMjMtMDMtMTBUMTQ6NDE6MjYrMDEwMCIKICAgeG1wOk1vZGlmeURhdGU9IjIwMjQtMDItMTFUMjM6Mzc6NTErMDE6MDAiCiAgIHhtcDpNZXRhZGF0YURhdGU9IjIwMjQtMDItMTFUMjM6Mzc6NTErMDE6MDAiCiAgIHBob3Rvc2hvcDpEYXRlQ3JlYXRlZD0iMjAyMy0wMy0xMFQxNDo0MToyNiswMTAwIgogICBwaG90b3Nob3A6Q29sb3JNb2RlPSIzIgogICBwaG90b3Nob3A6SUNDUHJvZmlsZT0ic1JHQiBJRUM2MTk2Ni0yLjEi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";

  var arrowMapping = {
  	"0": {
  	x: 0,
  	y: 0,
  	width: 100,
  	height: 100,
  	mask: true
  }
  };

  var img = "data:image/png;base64,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YOCvs1WZAAECBAgQIECAAAECBAhsJmDg34zehQkQIECAAAECBAgQIECAQJ2Agb/OVmUCBAgQIECAAAECBAgQILCZgIF/M3oXJkCAAAECBAgQIECAAAECdQIG/jpblQkQIECAAAECBAgQIECAwGYCBv7N6F2YAAECBAgQIECAAAECBAjUCRj462xVJkCAAAECBAgQIECAAAECmwkY+Dejd2ECBAgQIECAAAECBAgQIFAnYOCvs1WZAAECBAgQIECAAAECBAhsJmDg34zehQkQIECAAAECBAgQIECAQJ2Agb/OVmUCBAgQIECAAAECBAgQILCZgIF/M3oXJkCAAAECBAgQIECAAAECdQIG/jpblQkQIECAAAECBAgQIECAwGYCBv7N6F2YAAECBAgQIECAAAECBAjUCRj462xVJkCAAAECBAgQIECAAAECmwkY+Dejd2ECBAgQIECAAAECBAgQIFAnYOCvs1WZAAECBAgQIECAAAECBAhsJmDg34zehQkQIECAAAECBAgQIECAQJ2Agb/OVmUCBAgQIECAAAECBAgQILCZgIF/M3oXJkCAAAECBAgQIECAAAECdQIG/jpblQkQIECAAAECBAgQIECAwGYCBv7N6F2YAAECBAgQIECAAAECBAjUCRj462xVJkCAAAECBAgQIECAAAECmwkY+Dejd2ECBAgQIECAAAECBAgQIFAnYOCvs1WZAAECBAgQIECAAAECBAhsJmDg34zehQkQIECAAAECBAgQIECAQJ2Agb/OVmUCBAgQIECAAAECBAgQILCZgIF/M3oXJkCAAAECBAgQIECAAAECdQIG/jpblQkQIECAAAECBAgQIECAwGYCBv7N6F2YAAECBAgQIECAAAECBAjUCRj462xVJkCAAAECBAgQIECAAAECmwkY+Dejd2ECBAgQIECAAAECBAgQIFAnYOCvs1WZAAECBAgQIECAAAECBAhsJmDg34zehQkQIECAAAECBAgQIECAQJ2Agb/OVmUCBAgQIECAAAECBAgQILCZgIF/M3oXJkCAAAECBAgQIECAAAECdQIG/jpblQkQIECAAAECBAgQIECAwGYCBv7N6F2YAAECBAgQIECAAAECBAjUCRj462xVJkCAAAECBAgQIECAAAECmwkY+Dejd2ECBAgQIECAAAECBAgQIFAnYOCvs1WZAAECBAgQIECAAAECBAhsJmDg34zehQkQIECAAAECBAgQIECAQJ2Agb/OVmUCBAgQIECAAAECBAgQILCZgIF/M3oXJkCAAAECBAgQIECAAAECdQIG/jpblQkQIECAAAECBAgQIECAwGYCBv7N6F2YAAECBAgQIECAAAECBAjUCRj462xVJkCAAAECBAgQIECAAAECmwkY+Dejd2ECBAgQIECAAAECBAgQIFAnYOCvs1WZAAECBAgQIECAAAECBAhsJmDg34zehQkQIECAAAECBAgQIECAQJ2Agb/OVmUCBAgQIECAAAECBAgQILCZgIF/M3oXJkCAAAECBAgQIECAAAECdQIG/jpblQkQIECAAAECBAgQIECAwGYCBv7N6F2YAAECBAgQIECAAAECBAjUCRj462xVJkCAAAECBAgQIECAAAECmwkY+Dejd2ECBAgQIECAAAECBAgQIFAnYOCvs1WZAAECBAgQIECAAAECBAhsJmDg34zehQkQIECAAAECBAgQIECAQJ2Agb/OVmUCBAgQIECAAAECBAgQILCZgIF/M3oXJkCAAAECBAgQIECAAAECdQIG/jpblQkQIECAAAECBAgQIECAwGYCBv7N6F2YAAECBAgQIECAAAECBAjUCRj462xVJkCAAAECBAgQIECAAAECmwkY+Dejd2ECBAgQIECAAAECBAgQIFAnYOCvs1WZAAECBAgQIECAAAECBAhsJmDg34zehQkQIECAAAECBAgQIECAQJ2Agb/OVmUCBAgQIECAAAECBAgQILCZgIF/M3oXJkCAAAECBAgQIECAAAECdQIG/jpblQkQIECAAAECBAgQIECAwGYCBv7N6F2YAAECBAgQIECAAAECBAjUCRj462xVJkCAAAECBAgQIECAAAECmwkY+Dejd2ECBAgQIECAAAECBAgQIFAnYODPs/2hiHgur9ziSk9GxMuLX+UFownI6Wgdb3O/ctpm30ZbtZyO1vE29yunbfZttFXLaWHHDfx5uFsFdRryn46It/O2olLHAnLacXM72pqcdtTMjrcipx03t6OtyWlHzex4K3Ja2FwDfx7u2kGdBvxp0Heqn9fDESrJ6Qhdbn+Pctp+D0fYgZyO0OX29yin7fdwhB3IaWGXDfx5uGsG1al+Xt9GqySno3W8zf3KaZt9G23Vcjpax9vcr5y22bfRVi2nhR038OfhrhFUp/p5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AQIECBBIEDDwJyAa+PMQVSoXODRInbqoU/3ylrjAAQEDv1gQIECAAAECBBIEDPwJiAb+PESVygXmDvxO9ctb4QInBAz84kGAAAECBAgQSBAw8CcgGvjzEFUqF5gz8DvVL2+DC5wRMPCLCAECBAgQIEAgQcDAn4Bo4M9DVKlc4NTA71S/nN8FZgoY+GdCeRoBAgQIECBA4JSAgT8vH96g5lmqVCdwbOB3ql9nrvJyAffT5WZeQYAAAQIECBD4gICBPy8U3qDmWapUJ3Aop69GxGN1l1SZwGIB99PFZF5AgAABAgQIEPiggIE/LxXeoOZZqlQnIKd1tirnCchpnqVKBAgQIECAwMACBv685nuDmmepUp2AnNbZqpwnIKd5lioRIECAAAECAwsY+POa7w1qnqVKdQJyWmercp6AnOZZqkSAAAECBAgMLGDgz2u+N6h5lirVCchpna3KeQJymmepEgECBAgQIDCwgIE/r/neoOZZqlQnIKd1tirnCchpnqVKBAgQIECAwMACBv685nuDmmepUp2AnNbZqpwnIKd5lioRIECAAAECAwsY+POa7w1qnqVKdQJyWmercp6AnOZZqkSAAAECBAgMLGDgz2u+N6h5lirVCchpna3KeQJymmepEgECBAgQIDCwgIE/r/neoOZZqlQnIKd1tirnCchpnqVKBAgQIECAwMACBv685nuDmmepUp2AnNbZqpwnIKd5lioRIECAAAECAwsY+POa7w1qnqVKdQJyWmercp6AnOZZqkSAAAECBAgMLGDgz2u+N6h5lirVCchpna3KeQJymmepEgECBAgQIDCwgIE/r/neoOZZqlQnIKd1tirnCchpnqVKBAgQIECAwMACBv685nuDmmepUp2AnNbZqpwnIKd5lioRIECAAAECAwsY+Aduvq0TIECAAAECBAgQIECAQL8CBv5+e2tnBAgQIECAAAECBAgQIDCwgIF/4ObbOgECBAgQIECAAAECBAj0K2Dg77e3dkaAAAECBAgQIECAAAECAwsY+Aduvq0TIECAAAECBAgQIECAQL8CBv5+e2tnBAgQIECAAAECBAgQIDCwgIF/4ObbOgECBAgQIECAAAECBAj0K2Dg77e3dkaAAAECBAgQIECAAAECAwsY+Aduvq0TIECAAAECBAgQIECAQL8CBv5+e2tnBAgQIECAAAECBAgQIDCwgIF/4ObbOgECBAgQIECAAAECBAj0K2Dg77e3dkaAAAECBAgQIECAAAECAwsY+Aduvq0TIECAAAECBAgQIECAQL8CBv5+e2tnBAgQIECAAAECBAgQIDCwgIF/4ObbOgECBAgQIECAAAECBAj0K2Dg77e3dkaAAAECBAgQIECAAAECAwsY+Aduvq0TIECAAAECBAgQIECAQL8CBv5+e2tnBAgQIECAAAECBAgQIDCwgIF/4ObbOgECBAgQIECAAAECBAj0K2Dg77e3dkaAAAECBAgQIECAAAECAwsY+Aduvq0TIECAAAECBAgQIECAQL8CBv5+e2tnBAgQIECAAAECBAgQIDCwgIF/4ObbOgECBAgQIECAAAECBAj0K2Dg77e3dkaAAAECBAgQIECAAAECAwsY+Aduvq0TIECAAAECBAgQIECAQL8CBv5+e2tnBAgQIECAAAECBAgQIPD/t1/HBAAAAAjC+re2hyyC8yIsIPjD55tOgAABAgQIECBAgAABAr8Cgv/3W8sIECBAgAABAgQIECBAICwg+MPnm06AAAECBAgQIECAAAECvwKC//dbywgQIECAAAECBAgQIEAgLCD4w+ebToAAAQIECBAgQIAAAQK/AoL/91vLCBAgQIAAAQIECBAgQCAsIPjD55tOgAABAgQIECBAgAABAr8Cgv/3W8sIECBAgAABAgQIECBAICwg+MPnm06AAAECBAgQIECAAAECvwKC//dbywgQIECAAAECBAgQIEAgLCD4w+ebToAAAQIECBAgQIAAAQK/AgOYR34g/YMI8gAAAABJRU5ErkJggg==";

  var windBarbMapping = {
  	"0": {
  	x: 0,
  	y: 0,
  	width: 170,
  	height: 170,
  	anchorX: 85,
  	anchorY: 133,
  	mask: true
  },
  	"1": {
  	x: 170,
  	y: 0,
  	width: 170,
  	height: 170,
  	anchorX: 85,
  	anchorY: 133,
  	mask: true
  },
  	"2": {
  	x: 340,
  	y: 0,
  	width: 170,
  	height: 170,
  	anchorX: 85,
  	anchorY: 133,
  	mask: true
  },
  	"3": {
  	x: 510,
  	y: 0,
  	width: 170,
  	height: 170,
  	anchorX: 85,
  	anchorY: 133,
  	mask: true
  },
  	"4": {
  	x: 680,
  	y: 0,
  	width: 170,
  	height: 170,
  	anchorX: 85,
  	anchorY: 133,
  	mask: true
  },
  	"5": {
  	x: 850,
  	y: 0,
  	width: 170,
  	height: 170,
  	anchorX: 85,
  	anchorY: 133,
  	mask: true
  },
  	"6": {
  	x: 0,
  	y: 170,
  	width: 170,
  	height: 170,
  	anchorX: 85,
  	anchorY: 133,
  	mask: true
  },
  	"7": {
  	x: 170,
  	y: 170,
  	width: 170,
  	height: 170,
  	anchorX: 85,
  	anchorY: 133,
  	mask: true
  },
  	"8": {
  	x: 340,
  	y: 170,
  	width: 170,
  	height: 170,
  	anchorX: 85,
  	anchorY: 133,
  	mask: true
  },
  	"9": {
  	x: 510,
  	y: 170,
  	width: 170,
  	height: 170,
  	anchorX: 85,
  	anchorY: 133,
  	mask: true
  },
  	"10": {
  	x: 680,
  	y: 170,
  	width: 170,
  	height: 170,
  	anchorX: 85,
  	anchorY: 133,
  	mask: true
  },
  	"11": {
  	x: 850,
  	y: 170,
  	width: 170,
  	height: 170,
  	anchorX: 85,
  	anchorY: 133,
  	mask: true
  },
  	"12": {
  	x: 0,
  	y: 340,
  	width: 170,
  	height: 170,
  	anchorX: 85,
  	anchorY: 133,
  	mask: true
  },
  	"13": {
  	x: 170,
  	y: 340,
  	width: 170,
  	height: 170,
  	anchorX: 85,
  	anchorY: 133,
  	mask: true
  },
  	"14": {
  	x: 340,
  	y: 340,
  	width: 170,
  	height: 170,
  	anchorX: 85,
  	anchorY: 133,
  	mask: true
  },
  	"15": {
  	x: 510,
  	y: 340,
  	width: 170,
  	height: 170,
  	anchorX: 85,
  	anchorY: 133,
  	mask: true
  },
  	"16": {
  	x: 680,
  	y: 340,
  	width: 170,
  	height: 170,
  	anchorX: 85,
  	anchorY: 133,
  	mask: true
  },
  	"17": {
  	x: 850,
  	y: 340,
  	width: 170,
  	height: 170,
  	anchorX: 85,
  	anchorY: 133,
  	mask: true
  },
  	"18": {
  	x: 0,
  	y: 510,
  	width: 170,
  	height: 170,
  	anchorX: 85,
  	anchorY: 133,
  	mask: true
  },
  	"19": {
  	x: 170,
  	y: 510,
  	width: 170,
  	height: 170,
  	anchorX: 85,
  	anchorY: 133,
  	mask: true
  },
  	"20": {
  	x: 340,
  	y: 510,
  	width: 170,
  	height: 170,
  	anchorX: 85,
  	anchorY: 133,
  	mask: true
  }
  };

  const GridStyle = {
      VALUE: 'VALUE',
      ARROW: 'ARROW',
      WIND_BARB: 'WIND_BARB',
  };
  const GRID_ICON_STYLES = new Map([
      [GridStyle.ARROW, {
              iconAtlas: img$1,
              iconMapping: arrowMapping,
          }],
      [GridStyle.WIND_BARB, {
              iconAtlas: img,
              iconMapping: windBarbMapping,
              iconBounds: [0, 100 * 0.51444], // 100 kts to m/s
          }],
  ]);

  const defaultProps$3 = {
      image: { type: 'object', value: null }, // object instead of image to allow reading raw data
      image2: { type: 'object', value: null }, // object instead of image to allow reading raw data
      imageSmoothing: { type: 'number', value: 0 },
      imageInterpolation: { type: 'object', value: ImageInterpolation.CUBIC },
      imageWeight: { type: 'number', value: 0 },
      imageType: { type: 'object', value: ImageType.SCALAR },
      imageUnscale: { type: 'array', value: null },
      imageMinValue: { type: 'object', value: null },
      imageMaxValue: { type: 'object', value: null },
      bounds: { type: 'array', value: [-180, -90, 180, 90], compare: true },
      minZoom: { type: 'object', value: null },
      maxZoom: { type: 'object', value: null },
      style: { type: 'object', value: GridStyle.VALUE },
      density: { type: 'number', value: 0 },
      unitFormat: { type: 'object', value: null },
      textFormatFunction: { type: 'function', value: DEFAULT_TEXT_FORMAT_FUNCTION },
      textFontFamily: { type: 'object', value: DEFAULT_TEXT_FONT_FAMILY },
      textSize: { type: 'number', value: DEFAULT_TEXT_SIZE },
      textColor: { type: 'color', value: DEFAULT_TEXT_COLOR },
      textOutlineWidth: { type: 'number', value: DEFAULT_TEXT_OUTLINE_WIDTH },
      textOutlineColor: { type: 'color', value: DEFAULT_TEXT_OUTLINE_COLOR },
      iconBounds: { type: 'array', value: null },
      iconSize: { type: 'object', value: DEFAULT_ICON_SIZE$1 },
      iconColor: { type: 'color', value: DEFAULT_ICON_COLOR },
      palette: { type: 'object', value: null },
  };
  // see https://observablehq.com/@cguastini/signed-distance-fields-wind-barbs-and-webgl
  class GridCompositeLayer extends core.CompositeLayer {
      renderLayers() {
          const { viewport } = this.context;
          const { props, visiblePoints } = this.state;
          if (!props || !visiblePoints) {
              return [];
          }
          const { style, unitFormat, textFormatFunction, textFontFamily, textSize, textColor, textOutlineWidth, textOutlineColor, iconSize, iconColor } = ensureDefaultProps(props, defaultProps$3);
          const { paletteScale } = this.state;
          if (GRID_ICON_STYLES.has(style)) {
              const { iconStyle, iconAtlasTexture } = this.state;
              if (!iconStyle || !iconAtlasTexture) {
                  return [];
              }
              const iconCount = Object.keys(iconStyle.iconMapping).length;
              const iconBounds = props.iconBounds ?? iconStyle.iconBounds ?? [0, 0];
              const iconBoundsDelta = iconBounds[1] - iconBounds[0];
              const iconBoundsRatio = (value) => (value - iconBounds[0]) / iconBoundsDelta;
              const iconSizeDelta = Array.isArray(iconSize) ? iconSize[1] - iconSize[0] : 0;
              return [
                  new layers.IconLayer(this.getSubLayerProps({
                      id: 'icon',
                      data: visiblePoints,
                      getPosition: d => d.geometry.coordinates,
                      getIcon: d => `${Math.min(Math.max(Math.floor(iconBoundsRatio(d.properties.value) * iconCount), 0), iconCount - 1)}`,
                      getSize: d => Array.isArray(iconSize) ? iconSize[0] + (iconBoundsRatio(d.properties.value) * iconSizeDelta) : iconSize,
                      getColor: d => paletteScale ? paletteColorToGl(paletteScale(d.properties.value).rgba()) : iconColor,
                      getAngle: d => getViewportAngle(viewport, d.properties.direction ? 360 - d.properties.direction : 0),
                      iconAtlas: iconAtlasTexture,
                      iconMapping: iconStyle.iconMapping,
                      billboard: false,
                      parameters: {
                          cullMode: 'front', // enable culling to avoid rendering on both sides of the globe; front-face culling because it seems deck.gl uses a wrong winding order and setting frontFace: 'cw' throws "GL_INVALID_ENUM: Enum 0x0000 is currently not supported."
                          depthCompare: 'always', // disable depth test to avoid conflict with Maplibre globe depth buffer, see https://github.com/visgl/deck.gl/issues/9357
                          ...this.props.parameters,
                      },
                  })),
              ];
          }
          else {
              return [
                  new layers.TextLayer(this.getSubLayerProps({
                      id: 'text',
                      data: visiblePoints,
                      getPosition: d => d.geometry.coordinates,
                      getText: d => textFormatFunction(d.properties.value, unitFormat),
                      getSize: textSize,
                      getColor: d => paletteScale ? paletteColorToGl(paletteScale(d.properties.value).rgba()) : textColor,
                      getAngle: getViewportAngle(viewport, 0),
                      outlineWidth: textOutlineWidth,
                      outlineColor: textOutlineColor,
                      fontFamily: textFontFamily,
                      fontSettings: { sdf: true },
                      billboard: false,
                      parameters: {
                          cullMode: 'front', // enable culling to avoid rendering on both sides of the globe; front-face culling because it seems deck.gl uses a wrong winding order and setting frontFace: 'cw' throws "GL_INVALID_ENUM: Enum 0x0000 is currently not supported."
                          depthCompare: 'always', // disable depth test to avoid conflict with Maplibre globe depth buffer, see https://github.com/visgl/deck.gl/issues/9357
                          ...this.props.parameters,
                      },
                  })),
              ];
          }
      }
      shouldUpdateState(params) {
          return super.shouldUpdateState(params) || params.changeFlags.viewportChanged;
      }
      updateState(params) {
          const { image, image2, imageSmoothing, imageInterpolation, imageWeight, imageType, imageUnscale, imageMinValue, imageMaxValue, minZoom, maxZoom, style, density, unitFormat, textFormatFunction, textFontFamily, textSize, textColor, textOutlineWidth, textOutlineColor, iconSize, iconColor, palette, visible } = params.props;
          super.updateState(params);
          if (!visible) {
              this.setState({
                  points: undefined,
                  visiblePoints: undefined,
              });
              return;
          }
          if (!this.state.iconStyle ||
              style !== params.oldProps.style) {
              this._updateIconStyle();
          }
          if (density !== params.oldProps.density ||
              params.changeFlags.viewportChanged) {
              this._updatePositions();
          }
          if (image !== params.oldProps.image ||
              image2 !== params.oldProps.image2 ||
              imageSmoothing !== params.oldProps.imageSmoothing ||
              imageInterpolation !== params.oldProps.imageInterpolation ||
              imageWeight !== params.oldProps.imageWeight ||
              imageType !== params.oldProps.imageType ||
              imageUnscale !== params.oldProps.imageUnscale ||
              imageMinValue !== params.oldProps.imageMinValue ||
              imageMaxValue !== params.oldProps.imageMaxValue ||
              visible !== params.oldProps.visible) {
              this._updateFeatures();
          }
          if (minZoom !== params.oldProps.minZoom ||
              maxZoom !== params.oldProps.maxZoom ||
              params.changeFlags.viewportChanged) {
              this._updateVisibleFeatures();
          }
          if (palette !== params.oldProps.palette) {
              this._updatePalette();
          }
          if (unitFormat !== params.oldProps.unitFormat ||
              textFormatFunction !== params.oldProps.textFormatFunction ||
              textFontFamily !== params.oldProps.textFontFamily ||
              textSize !== params.oldProps.textSize ||
              textColor !== params.oldProps.textColor ||
              textOutlineWidth !== params.oldProps.textOutlineWidth ||
              textOutlineColor !== params.oldProps.textOutlineColor ||
              iconSize !== params.oldProps.iconSize ||
              iconColor !== params.oldProps.iconColor) {
              this._redrawVisibleFeatures();
          }
          this.setState({ props: params.props });
      }
      async _updateIconStyle() {
          const { device } = this.context;
          const { style } = ensureDefaultProps(this.props, defaultProps$3);
          const iconStyle = GRID_ICON_STYLES.get(style);
          if (!iconStyle) {
              this.setState({
                  iconStyle: undefined,
                  iconAtlasTexture: undefined,
              });
              return;
          }
          this.setState({ iconStyle });
          const iconAtlasTexture = createTextureCached(device, await loadTextureData(iconStyle.iconAtlas));
          this.setState({ iconAtlasTexture });
      }
      _updatePositions() {
          const { viewport } = this.context;
          const { density } = ensureDefaultProps(this.props, defaultProps$3);
          const positions = getViewportGridPositions(viewport, density + 3);
          this.setState({ positions });
          this._updateFeatures();
      }
      _updateFeatures() {
          const { image, image2, imageSmoothing, imageInterpolation, imageWeight, imageType, imageUnscale, imageMinValue, imageMaxValue, bounds } = ensureDefaultProps(this.props, defaultProps$3);
          const { positions } = this.state;
          if (!image || !positions) {
              return;
          }
          const imageProperties = { image, image2, imageSmoothing, imageInterpolation, imageWeight, imageType, imageUnscale, imageMinValue, imageMaxValue };
          const points = getRasterPoints(imageProperties, bounds, positions).features.filter(d => !isNaN(d.properties.value));
          this.setState({ points });
          this._updateVisibleFeatures();
      }
      _updateVisibleFeatures() {
          const { viewport } = this.context;
          const { minZoom, maxZoom } = ensureDefaultProps(this.props, defaultProps$3);
          const { points } = this.state;
          if (!points) {
              return;
          }
          let visiblePoints;
          if (isViewportInZoomBounds(viewport, minZoom, maxZoom)) {
              visiblePoints = points;
          }
          else {
              visiblePoints = [];
          }
          this.setState({ visiblePoints });
      }
      _updatePalette() {
          const { palette } = ensureDefaultProps(this.props, defaultProps$3);
          if (!palette) {
              this.setState({ paletteScale: undefined });
              this._redrawVisibleFeatures();
              return;
          }
          const paletteScale = parsePalette(palette);
          this.setState({ paletteScale });
          this._redrawVisibleFeatures();
      }
      _redrawVisibleFeatures() {
          this.setState({ visiblePoints: Array.isArray(this.state.visiblePoints) ? Array.from(this.state.visiblePoints) : this.state.visiblePoints });
      }
  }
  GridCompositeLayer.layerName = 'GridCompositeLayer';
  GridCompositeLayer.defaultProps = defaultProps$3;

  const defaultProps$2 = {
      ...GridCompositeLayer.defaultProps,
  };
  class GridLayer extends core.CompositeLayer {
      renderLayers() {
          const { props } = this.state;
          if (!props) {
              return [];
          }
          return [
              new GridCompositeLayer(this.props, this.getSubLayerProps({
                  id: 'composite',
              })),
          ];
      }
      updateState(params) {
          const { image, imageUnscale } = params.props;
          super.updateState(params);
          if (image && imageUnscale && !(image.data instanceof Uint8Array || image.data instanceof Uint8ClampedArray)) {
              throw new Error('imageUnscale can be applied to Uint8 data only');
          }
          this.setState({ props: params.props });
      }
  }
  GridLayer.layerName = 'GridLayer';
  GridLayer.defaultProps = defaultProps$2;

  // eslint-disable
      const sourceCode$1 = "uniform particleUniforms{float viewportGlobe;vec2 viewportGlobeCenter;float viewportGlobeRadius;vec4 viewportBounds;float viewportZoomChangeFactor;float numParticles;float maxAge;float speedFactor;float time;float seed;}particle;";
      const tokens = {};

  function getUniforms(props = {}) {
      return {
          [tokens.viewportGlobe]: props.viewportGlobe ? 1 : 0,
          [tokens.viewportGlobeCenter]: props.viewportGlobeCenter ?? [0, 0],
          [tokens.viewportGlobeRadius]: props.viewportGlobeRadius ?? 0,
          [tokens.viewportBounds]: props.viewportBounds ?? [0, 0, 0, 0],
          [tokens.viewportZoomChangeFactor]: props.viewportZoomChangeFactor ?? 0,
          [tokens.numParticles]: props.numParticles,
          [tokens.maxAge]: props.maxAge,
          [tokens.speedFactor]: props.speedFactor,
          [tokens.time]: props.time,
          [tokens.seed]: props.seed,
      };
  }
  const particleModule = {
      name: 'particle',
      vs: sourceCode$1,
      fs: sourceCode$1,
      uniformTypes: {
          [tokens.viewportGlobe]: 'f32',
          [tokens.viewportGlobeCenter]: 'vec2<f32>',
          [tokens.viewportGlobeRadius]: 'f32',
          [tokens.viewportBounds]: 'vec4<f32>',
          [tokens.viewportZoomChangeFactor]: 'f32',
          [tokens.numParticles]: 'f32',
          [tokens.maxAge]: 'f32',
          [tokens.speedFactor]: 'f32',
          [tokens.time]: 'f32',
          [tokens.seed]: 'f32',
      },
      getUniforms,
  };

  // eslint-disable
      const sourceCode = "#version 300 es\n#define SHADER_NAME  particle-line-layer-update-vertex-shader\n#ifdef GL_ES\nprecision highp float;\n#endif\nvec4 getPixel(sampler2D image,vec2 imageDownscaleResolution,vec2 iuv,vec2 offset){vec2 uv=(iuv+offset+0.5)/imageDownscaleResolution;return texture(image,uv);}const vec4 BS_A=vec4(3.,-6.,0.,4.)/6.;const vec4 BS_B=vec4(-1.,6.,-12.,8.)/6.;vec4 powers(float x){return vec4(x*x*x,x*x,x,1.);}vec4 spline(vec4 c0,vec4 c1,vec4 c2,vec4 c3,float a){vec4 color=c0*dot(BS_B,powers(a+1.))+c1*dot(BS_A,powers(a))+c2*dot(BS_A,powers(1.-a))+c3*dot(BS_B,powers(2.-a));color.a=(c0.a>0.&&c1.a>0.&&c2.a>0.&&c3.a>0.)?max(max(max(c0.a,c1.a),c2.a),c3.a):0.;return color;}vec4 getPixelCubic(sampler2D image,vec2 imageDownscaleResolution,vec2 uv){vec2 tuv=uv*imageDownscaleResolution-0.5;vec2 iuv=floor(tuv);vec2 fuv=fract(tuv);return spline(spline(getPixel(image,imageDownscaleResolution,iuv,vec2(-1,-1)),getPixel(image,imageDownscaleResolution,iuv,vec2(0,-1)),getPixel(image,imageDownscaleResolution,iuv,vec2(1,-1)),getPixel(image,imageDownscaleResolution,iuv,vec2(2,-1)),fuv.x),spline(getPixel(image,imageDownscaleResolution,iuv,vec2(-1,0)),getPixel(image,imageDownscaleResolution,iuv,vec2(0,0)),getPixel(image,imageDownscaleResolution,iuv,vec2(1,0)),getPixel(image,imageDownscaleResolution,iuv,vec2(2,0)),fuv.x),spline(getPixel(image,imageDownscaleResolution,iuv,vec2(-1,1)),getPixel(image,imageDownscaleResolution,iuv,vec2(0,1)),getPixel(image,imageDownscaleResolution,iuv,vec2(1,1)),getPixel(image,imageDownscaleResolution,iuv,vec2(2,1)),fuv.x),spline(getPixel(image,imageDownscaleResolution,iuv,vec2(-1,2)),getPixel(image,imageDownscaleResolution,iuv,vec2(0,2)),getPixel(image,imageDownscaleResolution,iuv,vec2(1,2)),getPixel(image,imageDownscaleResolution,iuv,vec2(2,2)),fuv.x),fuv.y);}vec4 getPixelLinear(sampler2D image,vec2 imageDownscaleResolution,vec2 uv){vec2 tuv=uv*imageDownscaleResolution-0.5;vec2 iuv=floor(tuv);vec2 fuv=fract(tuv);return mix(mix(getPixel(image,imageDownscaleResolution,iuv,vec2(0,0)),getPixel(image,imageDownscaleResolution,iuv,vec2(1,0)),fuv.x),mix(getPixel(image,imageDownscaleResolution,iuv,vec2(0,1)),getPixel(image,imageDownscaleResolution,iuv,vec2(1,1)),fuv.x),fuv.y);}vec4 getPixelNearest(sampler2D image,vec2 imageDownscaleResolution,vec2 uv){vec2 tuv=uv*imageDownscaleResolution-0.5;vec2 iuv=floor(tuv+0.5);return getPixel(image,imageDownscaleResolution,iuv,vec2(0,0));}vec4 getPixelFilter(sampler2D image,vec2 imageDownscaleResolution,float imageInterpolation,vec2 uv){if(imageInterpolation==2.){return getPixelCubic(image,imageDownscaleResolution,uv);}if(imageInterpolation==1.){return getPixelLinear(image,imageDownscaleResolution,uv);}else{return getPixelNearest(image,imageDownscaleResolution,uv);}}vec4 getPixelInterpolate(sampler2D image,sampler2D image2,vec2 imageDownscaleResolution,float imageInterpolation,float imageWeight,bool isRepeatBounds,vec2 uv){vec2 uvWithOffset;uvWithOffset.x=isRepeatBounds?uv.x+0.5/imageDownscaleResolution.x:mix(0.+0.5/imageDownscaleResolution.x,1.-0.5/imageDownscaleResolution.x,uv.x);uvWithOffset.y=mix(0.+0.5/imageDownscaleResolution.y,1.-0.5/imageDownscaleResolution.y,uv.y);if(imageWeight>0.){vec4 pixel=getPixelFilter(image,imageDownscaleResolution,imageInterpolation,uvWithOffset);vec4 pixel2=getPixelFilter(image2,imageDownscaleResolution,imageInterpolation,uvWithOffset);return mix(pixel,pixel2,imageWeight);}else{return getPixelFilter(image,imageDownscaleResolution,imageInterpolation,uvWithOffset);}}vec4 getPixelSmoothInterpolate(sampler2D image,sampler2D image2,vec2 imageResolution,float imageSmoothing,float imageInterpolation,float imageWeight,bool isRepeatBounds,vec2 uv){float imageDownscaleResolutionFactor=1.+max(0.,imageSmoothing);vec2 imageDownscaleResolution=imageResolution/imageDownscaleResolutionFactor;return getPixelInterpolate(image,image2,imageDownscaleResolution,imageInterpolation,imageWeight,isRepeatBounds,uv);}float atan2(float y,float x){return x==0.?sign(y)*_PI/2.:atan(y,x);}bool isNaN(float value){uint valueUint=floatBitsToUint(value);return(valueUint&0x7fffffffu)>0x7f800000u;}bool hasPixelValue(vec4 pixel,vec2 imageUnscale){if(imageUnscale[0]<imageUnscale[1]){return pixel.a>=1.;}else{return!isNaN(pixel.x);}}float getPixelScalarValue(vec4 pixel,float imageType,vec2 imageUnscale){if(imageType==1.){return 0.;}else{if(imageUnscale[0]<imageUnscale[1]){return mix(imageUnscale[0],imageUnscale[1],pixel.x);}else{return pixel.x;}}}vec2 getPixelVectorValue(vec4 pixel,float imageType,vec2 imageUnscale){if(imageType==1.){if(imageUnscale[0]<imageUnscale[1]){return mix(vec2(imageUnscale[0]),vec2(imageUnscale[1]),pixel.xy);}else{return pixel.xy;}}else{return vec2(0.);}}float getPixelMagnitudeValue(vec4 pixel,float imageType,vec2 imageUnscale){if(imageType==1.){vec2 value=getPixelVectorValue(pixel,imageType,imageUnscale);return length(value);}else{return getPixelScalarValue(pixel,imageType,imageUnscale);}}float getPixelDirectionValue(vec4 pixel,float imageType,vec2 imageUnscale){if(imageType==1.){vec2 value=getPixelVectorValue(pixel,imageType,imageUnscale);return mod((360.-(atan2(value.y,value.x)/_PI*180.+180.))-270.,360.)/360.;}else{return 0.;}}in vec3 sourcePosition;in vec4 sourceColor;out vec3 targetPosition;out vec4 targetColor;const float DROP_POSITION_Z=-1.;const vec4 HIDE_COLOR=vec4(0);const float _EARTH_RADIUS=6370972.;vec2 destinationPoint(vec2 from,float dist,float bearing){float d=dist/_EARTH_RADIUS;float r=radians(bearing);float y1=radians(from.y);float x1=radians(from.x);float siny2=sin(y1)*cos(d)+cos(y1)*sin(d)*cos(r);float y2=asin(siny2);float y=sin(r)*sin(d)*cos(y1);float x=cos(d)-sin(y1)*siny2;float x2=x1+atan2(y,x);float lat=degrees(y2);float lon=degrees(x2);return vec2(lon,lat);}float wrapLongitude(float lng){float wrappedLng=mod(lng+180.,360.)-180.;return wrappedLng;}float wrapLongitude(float lng,float minLng){float wrappedLng=wrapLongitude(lng);if(wrappedLng<minLng){wrappedLng+=360.;}return wrappedLng;}float randFloat(vec2 seed){return fract(sin(dot(seed.xy,vec2(12.9898,78.233)))*43758.5453);}vec2 randPoint(vec2 seed){return vec2(randFloat(seed+1.3),randFloat(seed+2.1));}vec2 randPointToPosition(vec2 point){if(particle.viewportGlobe==1.){point.x+=0.0001;point.x=sqrt(point.x);float dist=point.x*particle.viewportGlobeRadius;float bearing=point.y*360.;return destinationPoint(particle.viewportGlobeCenter,dist,bearing);}else{point.y=smoothstep(0.,1.,point.y);vec2 viewportBoundsMin=particle.viewportBounds.xy;vec2 viewportBoundsMax=particle.viewportBounds.zw;return mix(viewportBoundsMin,viewportBoundsMax,point);}}vec2 movePositionBySpeed(vec2 position,vec2 speed){float distortion=cos(radians(position.y));vec2 offset;if(particle.viewportGlobe==1.){offset=vec2(speed.x/distortion,speed.y);}else{offset=vec2(speed.x,speed.y*distortion);}return position+offset;}bool isPositionInBounds(vec2 position,vec4 bounds){vec2 boundsMin=bounds.xy;vec2 boundsMax=bounds.zw;float lng=wrapLongitude(position.x,boundsMin.x);float lat=position.y;return(boundsMin.x<=lng&&lng<=boundsMax.x&&boundsMin.y<=lat&&lat<=boundsMax.y);}void main(){float particleIndex=mod(float(gl_VertexID),particle.numParticles);float particleAge=floor(float(gl_VertexID)/particle.numParticles);if(particleAge>0.){return;}if(sourcePosition.z==DROP_POSITION_Z){vec2 particleSeed=vec2(particleIndex*particle.seed/particle.numParticles);vec2 point=randPoint(particleSeed);vec2 position=randPointToPosition(point);targetPosition.xy=position;targetPosition.x=wrapLongitude(targetPosition.x);targetColor=HIDE_COLOR;return;}if(particle.viewportZoomChangeFactor>1.&&mod(particleIndex,particle.viewportZoomChangeFactor)>=1.){targetPosition.xy=sourcePosition.xy;targetPosition.z=DROP_POSITION_Z;targetColor=HIDE_COLOR;return;}if(abs(mod(particleIndex,particle.maxAge+2.)-mod(particle.time,particle.maxAge+2.))<1.){targetPosition.xy=sourcePosition.xy;targetPosition.z=DROP_POSITION_Z;targetColor=HIDE_COLOR;return;}if(!isPositionInBounds(sourcePosition.xy,bitmap2.bounds)){targetPosition.xy=sourcePosition.xy;targetColor=HIDE_COLOR;return;}vec2 uv=getUV(sourcePosition.xy);vec4 pixel=getPixelSmoothInterpolate(imageTexture,imageTexture2,raster.imageResolution,raster.imageSmoothing,raster.imageInterpolation,raster.imageWeight,bitmap2.isRepeatBounds,uv);if(!hasPixelValue(pixel,raster.imageUnscale)){targetPosition.xy=sourcePosition.xy;targetColor=HIDE_COLOR;return;}float value=getPixelMagnitudeValue(pixel,raster.imageType,raster.imageUnscale);if((!isNaN(raster.imageMinValue)&&value<raster.imageMinValue)||(!isNaN(raster.imageMaxValue)&&value>raster.imageMaxValue)){targetPosition.xy=sourcePosition.xy;targetColor=HIDE_COLOR;return;}vec2 speed=getPixelVectorValue(pixel,raster.imageType,raster.imageUnscale)*particle.speedFactor;targetPosition.xy=movePositionBySpeed(sourcePosition.xy,speed);targetPosition.x=wrapLongitude(targetPosition.x);targetColor=sourceColor;targetColor=applyPalette(paletteTexture,palette.paletteBounds,palette.paletteColor,value);}";

  const FPS$1 = 30;
  const SOURCE_POSITION = 'sourcePosition';
  const TARGET_POSITION = 'targetPosition';
  const SOURCE_COLOR = 'sourceColor';
  const TARGET_COLOR = 'targetColor';
  const defaultProps$1 = {
      imageTexture: { type: 'object', value: null },
      imageTexture2: { type: 'object', value: null },
      imageSmoothing: { type: 'number', value: 0 },
      imageInterpolation: { type: 'object', value: ImageInterpolation.CUBIC },
      imageWeight: { type: 'number', value: 0 },
      imageType: { type: 'object', value: ImageType.VECTOR },
      imageUnscale: { type: 'array', value: null },
      imageMinValue: { type: 'object', value: null },
      imageMaxValue: { type: 'object', value: null },
      bounds: { type: 'array', value: [-180, -90, 180, 90], compare: true },
      minZoom: { type: 'object', value: null },
      maxZoom: { type: 'object', value: 15 }, // drop rendering artifacts in high zoom levels due to a low precision
      palette: { type: 'object', value: null },
      color: { type: 'color', value: DEFAULT_LINE_COLOR },
      numParticles: { type: 'number', min: 1, max: 1000000, value: 5000 },
      maxAge: { type: 'number', min: 1, max: 255, value: 10 },
      speedFactor: { type: 'number', min: 0, max: 50, value: 1 },
      width: { type: 'number', value: DEFAULT_LINE_WIDTH },
      animate: true,
      wrapLongitude: true,
  };
  class ParticleLineLayer extends layers.LineLayer {
      getShaders() {
          const parentShaders = super.getShaders();
          return {
              ...parentShaders,
              inject: {
                  ...parentShaders.inject,
                  'vs:#decl': (parentShaders.inject?.['vs:#decl'] || '') + `
          in float instanceOpacities;
          out float drop;
          const float DROP_POSITION_Z = -1.;
        `,
                  'vs:#main-start': (parentShaders.inject?.['vs:#main-start'] || '') + `
          drop = float(instanceSourcePositions.z == DROP_POSITION_Z || instanceTargetPositions.z == DROP_POSITION_Z);
        `,
                  'vs:DECKGL_FILTER_COLOR': (parentShaders.inject?.['vs:DECKGL_FILTER_COLOR'] || '') + `
          color.a = color.a * instanceOpacities;
        `,
                  'fs:#decl': (parentShaders.inject?.['fs:#decl'] || '') + `
          in float drop;
        `,
                  'fs:#main-start': (parentShaders.inject?.['fs:#main-start'] || '') + `
          if (drop > 0.5) discard;
        `,
              },
          };
      }
      initializeState() {
          super.initializeState();
          const attributeManager = this.getAttributeManager();
          attributeManager.remove(['instanceSourcePositions', 'instanceTargetPositions', 'instanceColors', 'instanceWidths']);
          attributeManager.addInstanced({
              instanceSourcePositions: {
                  size: 3,
                  type: 'float32',
                  noAlloc: true,
              },
              instanceTargetPositions: {
                  size: 3,
                  type: 'float32',
                  noAlloc: true,
              },
              instanceColors: {
                  size: 4,
                  type: 'float32', // unorm8?
                  noAlloc: true,
              },
              instanceOpacities: {
                  size: 1,
                  type: 'float32',
                  noAlloc: true,
              },
          });
      }
      updateState(params) {
          const { imageType, numParticles, maxAge, width, palette, visible } = params.props;
          super.updateState(params);
          if (!visible) {
              this._deleteTransformFeedback();
              return;
          }
          if (imageType !== ImageType.VECTOR || !numParticles || !maxAge || !width) {
              this._deleteTransformFeedback();
              return;
          }
          if (imageType !== params.oldProps.imageType ||
              numParticles !== params.oldProps.numParticles ||
              maxAge !== params.oldProps.maxAge ||
              width !== params.oldProps.width ||
              visible !== params.oldProps.visible) {
              this._setupTransformFeedback();
          }
          if (palette !== params.oldProps.palette) {
              this._updatePalette();
          }
      }
      finalizeState(context) {
          this._deleteTransformFeedback();
          super.finalizeState(context);
      }
      draw(opts) {
          const { initialized } = this.state;
          if (!initialized) {
              return;
          }
          const { viewport } = this.context;
          const { model } = this.state;
          const { minZoom, maxZoom, width, animate } = ensureDefaultProps(this.props, defaultProps$1);
          const { sourcePositions, targetPositions, sourceColors, opacities, transform } = this.state;
          if (!sourcePositions || !targetPositions || !sourceColors || !opacities || !transform) {
              return;
          }
          if (model && isViewportInZoomBounds(viewport, minZoom, maxZoom)) {
              model.setAttributes({
                  instanceSourcePositions: sourcePositions,
                  instanceTargetPositions: targetPositions,
                  instanceColors: sourceColors,
                  instanceOpacities: opacities,
              });
              model.setConstantAttributes({
                  instanceSourcePositions64Low: new Float32Array([0, 0, 0]),
                  instanceTargetPositions64Low: new Float32Array([0, 0, 0]),
                  instanceWidths: new Float32Array([width]),
              });
              model.setParameters({
                  ...model.parameters,
                  cullMode: 'front', // enable culling to avoid rendering on both sides of the globe; front-face culling because it seems deck.gl uses a wrong winding order and setting frontFace: 'cw' throws "GL_INVALID_ENUM: Enum 0x0000 is currently not supported."
                  ...this.props.parameters,
              });
              super.draw(opts);
              if (animate) {
                  this.step();
              }
          }
      }
      _setupTransformFeedback() {
          const { device } = this.context;
          const { initialized } = this.state;
          if (initialized) {
              this._deleteTransformFeedback();
          }
          const { numParticles, maxAge } = ensureDefaultProps(this.props, defaultProps$1);
          // sourcePositions/targetPositions buffer layout:
          // |          age0             |          age1             |          age2             |...|          age(N-1)         |
          // |pos0,pos1,pos2,...,pos(N-1)|pos0,pos1,pos2,...,pos(N-1)|pos0,pos1,pos2,...,pos(N-1)|...|pos0,pos1,pos2,...,pos(N-1)|
          const numInstances = numParticles * maxAge;
          const numAgedInstances = numParticles * (maxAge - 1);
          const sourcePositions = device.createBuffer(new Float32Array(numInstances * 3));
          const targetPositions = device.createBuffer(new Float32Array(numInstances * 3));
          const sourceColors = device.createBuffer(new Float32Array(numInstances * 4));
          const targetColors = device.createBuffer(new Float32Array(numInstances * 4));
          const opacities = device.createBuffer(new Float32Array(new Array(numInstances).fill(undefined).map((_, i) => {
              const particleAge = Math.floor(i / numParticles);
              return 1 - particleAge / maxAge;
          })));
          // setup transform feedback for particles age0
          const transform = new engine.BufferTransform(device, {
              vs: sourceCode,
              modules: [bitmapModule, rasterModule, paletteModule, particleModule],
              vertexCount: numParticles,
              attributes: {
                  [SOURCE_POSITION]: sourcePositions,
                  [SOURCE_COLOR]: sourceColors,
              },
              bufferLayout: [
                  { name: SOURCE_POSITION, format: 'float32x3' },
                  { name: SOURCE_COLOR, format: 'float32x4' }, // unorm8x4?
              ],
              feedbackBuffers: {
                  [TARGET_POSITION]: targetPositions,
                  [TARGET_COLOR]: targetColors,
              },
              varyings: [TARGET_POSITION, TARGET_COLOR],
          });
          this.setState({
              initialized: true,
              numInstances,
              numAgedInstances,
              sourcePositions,
              targetPositions,
              sourceColors,
              targetColors,
              opacities,
              transform,
              previousViewportZoom: 0,
              previousTime: 0,
          });
      }
      _runTransformFeedback() {
          const { initialized } = this.state;
          if (!initialized) {
              return;
          }
          const { device, viewport, timeline } = this.context;
          const { imageTexture, imageTexture2, imageSmoothing, imageInterpolation, imageWeight, imageType, imageUnscale, imageMinValue, imageMaxValue, bounds, color, numParticles, maxAge, speedFactor } = ensureDefaultProps(this.props, defaultProps$1);
          const { paletteTexture, paletteBounds, numAgedInstances, sourcePositions, targetPositions, sourceColors, targetColors, transform, previousViewportZoom, previousTime } = this.state;
          if (!imageTexture || typeof numAgedInstances !== 'number' || !sourcePositions || !targetPositions || !sourceColors || !targetColors || !transform) {
              return;
          }
          const time = timeline.getTime();
          if (typeof previousTime === 'number' && time < previousTime + 1000 / FPS$1) {
              return;
          }
          // viewport
          const viewportGlobe = isViewportGlobe(viewport);
          const viewportGlobeCenter = isViewportGlobe(viewport) ? getViewportGlobeCenter(viewport) : undefined;
          const viewportGlobeRadius = isViewportGlobe(viewport) ? getViewportGlobeRadius(viewport) : undefined;
          const viewportBounds = isViewportMercator(viewport) ? getViewportBounds(viewport) : undefined;
          const viewportZoomChangeFactor = 2 ** ((typeof previousViewportZoom === 'number' ? previousViewportZoom - getViewportZoom(viewport) : 0) * 4);
          // speed factor for current zoom level
          const currentSpeedFactor = speedFactor / 2 ** (getViewportZoom(viewport) + 7);
          // update particle positions and colors age0
          transform.model.shaderInputs.setProps({
              [bitmapModule.name]: {
                  viewportGlobe, bounds, _imageCoordinateSystem: core.COORDINATE_SYSTEM.LNGLAT,
              },
              [rasterModule.name]: {
                  imageTexture: imageTexture ?? createEmptyTextureCached(device),
                  imageTexture2: imageTexture2 ?? createEmptyTextureCached(device),
                  imageSmoothing, imageInterpolation, imageWeight, imageType, imageUnscale, imageMinValue, imageMaxValue,
              },
              [paletteModule.name]: {
                  paletteTexture: paletteTexture ?? createEmptyTextureCached(device),
                  paletteBounds, paletteColor: color,
              },
              [particleModule.name]: {
                  viewportGlobe, viewportGlobeCenter, viewportGlobeRadius, viewportBounds, viewportZoomChangeFactor,
                  numParticles, maxAge, speedFactor: currentSpeedFactor,
                  time, seed: Math.random(),
              },
          });
          transform.run({
              clearColor: false,
              clearDepth: false,
              clearStencil: false,
              depthReadOnly: true,
              stencilReadOnly: true,
          });
          const commandEncoder = device.createCommandEncoder();
          // update particle positions age1-age(N-1)
          // copy age0-age(N-2) sourcePositions to age1-age(N-1) targetPositions
          commandEncoder.copyBufferToBuffer({
              sourceBuffer: sourcePositions,
              sourceOffset: 0,
              destinationBuffer: targetPositions,
              destinationOffset: numParticles * 4 * 3,
              size: numAgedInstances * 4 * 3,
          });
          // update particle colors age1-age(N-1)
          // copy age0-age(N-2) colors to age1-age(N-1) colors
          // needs a duplicate copy buffer, because read and write regions overlap
          commandEncoder.copyBufferToBuffer({
              sourceBuffer: sourceColors,
              sourceOffset: 0,
              destinationBuffer: targetColors,
              destinationOffset: numParticles * 4 * 4,
              size: numAgedInstances * 4 * 4,
          });
          commandEncoder.finish();
          commandEncoder.destroy();
          this._swapTransformFeedback();
          // debug logging position buffer content
          // console.log(new Float32Array(sourcePositions.readSyncWebGL().slice(0, 4 * 4 * 3).buffer), new Float32Array(targetPositions.readSyncWebGL().slice(0, 4 * 4 * 3).buffer), sourceColors.readSyncWebGL().slice(0, 4 * 4 * 1));
          this.state.previousViewportZoom = getViewportZoom(viewport);
          this.state.previousTime = time;
      }
      // see https://github.com/visgl/luma.gl/pull/1883
      _swapTransformFeedback() {
          const { sourcePositions, targetPositions, sourceColors, targetColors, transform } = this.state;
          if (!sourcePositions || !targetPositions || !sourceColors || !targetColors || !transform) {
              return;
          }
          this.state.sourcePositions = targetPositions;
          this.state.targetPositions = sourcePositions;
          this.state.sourceColors = targetColors;
          this.state.targetColors = sourceColors;
          transform.model.setAttributes({
              [SOURCE_POSITION]: targetPositions,
              [SOURCE_COLOR]: targetColors,
          });
          transform.transformFeedback.setBuffers({
              [TARGET_POSITION]: sourcePositions,
              [TARGET_COLOR]: sourceColors,
          });
      }
      _resetTransformFeedback() {
          const { initialized } = this.state;
          if (!initialized) {
              return;
          }
          const { numInstances, sourcePositions, targetPositions, sourceColors, targetColors } = this.state;
          if (typeof numInstances !== 'number' || !sourcePositions || !targetPositions || !sourceColors || !targetColors) {
              return;
          }
          sourcePositions.write(new Float32Array(numInstances * 3));
          targetPositions.write(new Float32Array(numInstances * 3));
          sourceColors.write(new Float32Array(numInstances * 4));
          targetColors.write(new Float32Array(numInstances * 4));
      }
      _deleteTransformFeedback() {
          const { initialized } = this.state;
          if (!initialized) {
              return;
          }
          const { sourcePositions, targetPositions, sourceColors, targetColors, opacities, transform } = this.state;
          if (!sourcePositions || !targetPositions || !sourceColors || !targetColors || !opacities || !transform) {
              return;
          }
          sourcePositions.destroy();
          targetPositions.destroy();
          sourceColors.destroy();
          targetColors.destroy();
          opacities.destroy();
          transform.destroy();
          this.setState({
              initialized: false,
              sourcePositions: undefined,
              targetPositions: undefined,
              sourceColors: undefined,
              targetColors: undefined,
              opacities: undefined,
              transform: undefined,
          });
      }
      _updatePalette() {
          const { device } = this.context;
          const { palette } = ensureDefaultProps(this.props, defaultProps$1);
          if (!palette) {
              this.setState({ paletteTexture: undefined, paletteBounds: undefined });
              return;
          }
          const paletteScale = parsePalette(palette);
          const { paletteBounds, paletteTexture } = createPaletteTexture(device, paletteScale);
          this.setState({ paletteTexture, paletteBounds });
      }
      step() {
          this._runTransformFeedback();
          this.setNeedsRedraw();
      }
      clear() {
          this._resetTransformFeedback();
          this.setNeedsRedraw();
      }
  }
  ParticleLineLayer.layerName = 'ParticleLineLayer';
  ParticleLineLayer.defaultProps = defaultProps$1;

  const defaultProps = {
      ...ParticleLineLayer.defaultProps,
      imageTexture: undefined,
      imageTexture2: undefined,
      image: { type: 'object', value: null }, // object instead of image to allow reading raw data
      image2: { type: 'object', value: null }, // object instead of image to allow reading raw data
  };
  class ParticleLayer extends core.CompositeLayer {
      renderLayers() {
          const { device } = this.context;
          const { props, imageTexture, imageTexture2 } = this.state;
          if (!props || !imageTexture) {
              return [];
          }
          return [
              new ParticleLineLayer(this.props, this.getSubLayerProps({
                  ...{
                      id: 'line',
                      data: [],
                      imageTexture,
                      imageTexture2,
                  },
                  image: createEmptyTextureCached(device),
                  image2: createEmptyTextureCached(device),
              })),
          ];
      }
      updateState(params) {
          const { image, image2, imageUnscale, bounds } = params.props;
          super.updateState(params);
          if (image && imageUnscale && !(image.data instanceof Uint8Array || image.data instanceof Uint8ClampedArray)) {
              throw new Error('imageUnscale can be applied to Uint8 data only');
          }
          if (image !== params.oldProps.image || image2 !== params.oldProps.image2) {
              const { device } = this.context;
              const { image, image2 } = this.props;
              const imageTexture = image ? createTextureCached(device, image, isRepeatBounds(bounds)) : null;
              const imageTexture2 = image2 ? createTextureCached(device, image2, isRepeatBounds(bounds)) : null;
              this.setState({ imageTexture, imageTexture2 });
          }
          this.setState({ props: params.props });
      }
  }
  ParticleLayer.layerName = 'ParticleLayer';
  ParticleLayer.defaultProps = defaultProps;

  class Control {
      addTo(target) {
          target.appendChild(this.onAdd());
      }
      prependTo(target) {
          target.prepend(this.onAdd());
      }
      remove() {
          this.onRemove();
      }
      updateConfig(config) {
          this.setConfig({ ...this.getConfig(), ...config });
      }
  }

  function styleInject(css, ref) {
    if (ref === void 0) ref = {};
    var insertAt = ref.insertAt;
    if (!css || typeof document === 'undefined') {
      return;
    }
    var head = document.head || document.getElementsByTagName('head')[0];
    var style = document.createElement('style');
    style.type = 'text/css';
    if (insertAt === 'top') {
      if (head.firstChild) {
        head.insertBefore(style, head.firstChild);
      } else {
        head.appendChild(style);
      }
    } else {
      head.appendChild(style);
    }
    if (style.styleSheet) {
      style.styleSheet.cssText = css;
    } else {
      style.appendChild(document.createTextNode(css));
    }
  }

  var css_248z$4 = ".weatherlayers-legend-control {\n  margin: 10px;\n  pointer-events: auto; /* force controls to be clickable when added as MapLibre/Mapbox control */\n}\n.weatherlayers-legend-control > div {\n  display: inline-block;\n  background: rgba(255, 255, 255, 0.5);\n  width: 100%;\n  font-family: 'Helvetica Neue', Arial, Helvetica, sans-serif;\n  font-size: 12px;\n  line-height: 14px;\n  color: rgba(0, 0, 0, 0.75);\n}\n.weatherlayers-legend-control header, .weatherlayers-legend-control main {\n  margin: 5px 10px;\n}\n.weatherlayers-legend-control header {\n  font-weight: bold;\n}\n.weatherlayers-legend-control__legend {\n  width: 100%;\n  margin-top: 5px;\n  vertical-align: middle;\n}";
  styleInject(css_248z$4);

  const DEFAULT_WIDTH$1 = 300;
  const DEFAULT_TICKS_COUNT = 6;
  const CONTROL_CLASS$4 = 'weatherlayers-legend-control';
  const TEXT_CLASS = `${CONTROL_CLASS$4}__text`;
  class LegendControl extends Control {
      constructor(config = {}) {
          super();
          this._container = undefined;
          this._config = config;
      }
      onAdd() {
          this._container = document.createElement('div');
          this._container.classList.add(CONTROL_CLASS$4);
          this.setConfig(this._config);
          return this._container;
      }
      onRemove() {
          if (this._container && this._container.parentNode) {
              this._container.parentNode.removeChild(this._container);
              this._container = undefined;
          }
      }
      getConfig() {
          return { ...this._config };
      }
      setConfig(config) {
          if (!this._container) {
              return;
          }
          // validate config
          if (!config.title || !config.unitFormat || !config.palette) {
              return;
          }
          // prevent update if no config changed
          if (this._container.children.length > 0 &&
              this._config.width === config.width &&
              this._config.ticksCount === config.ticksCount &&
              this._config.title === config.title &&
              this._config.unitFormat === config.unitFormat &&
              this._config.palette === config.palette) {
              return;
          }
          this._config = config;
          const width = this._config.width ?? DEFAULT_WIDTH$1;
          const ticksCount = this._config.ticksCount ?? DEFAULT_TICKS_COUNT;
          const title = this._config.title;
          const unitFormat = this._config.unitFormat;
          const palette = this._config.palette;
          const paletteScale = parsePalette(palette);
          const paletteDomain = paletteScale.domain();
          const paletteBounds = [paletteDomain[0], paletteDomain[paletteDomain.length - 1]];
          const paletteCanvas = colorRampCanvas(paletteScale);
          const paletteCanvasDataUrl = paletteCanvas.toDataURL();
          this._container.innerHTML = '';
          this._container.style.width = `${width}px`;
          const div = document.createElement('div');
          this._container.appendChild(div);
          const header = document.createElement('header');
          div.appendChild(header);
          const text = document.createElement('span');
          text.classList.add(TEXT_CLASS);
          text.innerHTML = `${title} [${formatUnit(unitFormat)}]`;
          header.appendChild(text);
          const main = document.createElement('main');
          div.appendChild(main);
          const xmlns = 'http://www.w3.org/2000/svg';
          const svg = document.createElementNS(xmlns, 'svg');
          svg.setAttribute('height', '24px');
          svg.setAttribute('class', 'weatherlayers-legend-control__legend');
          main.appendChild(svg);
          const image = document.createElementNS(xmlns, 'image');
          image.setAttribute('href', paletteCanvasDataUrl);
          image.setAttribute('width', '100%');
          image.setAttribute('height', '5');
          image.setAttribute('preserveAspectRatio', 'none');
          svg.appendChild(image);
          const delta = (paletteBounds[1] - paletteBounds[0]) / (ticksCount - 1);
          for (let i = 0; i < ticksCount; i++) {
              const value = paletteBounds[0] + i * delta;
              const formattedValue = formatValue(value, unitFormat);
              const tick = document.createElementNS(xmlns, 'g');
              tick.style.transform = `translate(${(value - paletteBounds[0]) / (paletteBounds[1] - paletteBounds[0]) * 100}%, 0)`;
              svg.appendChild(tick);
              const tickLine = document.createElementNS(xmlns, 'line');
              tickLine.setAttribute('y1', '0');
              tickLine.setAttribute('y2', '10');
              tickLine.style.stroke = 'currentColor';
              if (i === 0) {
                  tickLine.style.transform = 'translate(0.5px, 0)';
              }
              else if (i === ticksCount - 1) {
                  tickLine.style.transform = 'translate(-0.5px, 0)';
              }
              tick.appendChild(tickLine);
              const tickValue = document.createElementNS(xmlns, 'text');
              tickValue.innerHTML = formattedValue;
              tickValue.setAttribute('x', '0');
              tickValue.setAttribute('y', '22');
              if (i === 0) {
                  tickValue.style.textAnchor = 'start';
              }
              else if (i === ticksCount - 1) {
                  tickValue.style.textAnchor = 'end';
              }
              else {
                  tickValue.style.textAnchor = 'middle';
              }
              tick.appendChild(tickValue);
          }
      }
  }

  var css_248z$3 = ".weatherlayers-tooltip-control {\n  margin: 10px;\n  pointer-events: auto; /* force controls to be clickable when added as MapLibre/Mapbox control */\n}\n.weatherlayers-tooltip-control > div {\n  display: inline-flex;\n  align-items: center;\n  background: rgba(255, 255, 255, 0.5);\n  padding: 0 5px;\n  font-family: 'Helvetica Neue', Arial, Helvetica, sans-serif;\n  font-size: 12px;\n  line-height: 20px;\n  color: rgba(0, 0, 0, 0.75);\n  white-space: nowrap;\n}\n\n.weatherlayers-tooltip-control.follow-cursor {\n  position: absolute;\n  margin: 0;\n  pointer-events: none;\n  z-index: 1; /** same z-index as .deck-tooltip */\n}\n.weatherlayers-tooltip-control.follow-cursor > div {\n  position: absolute;\n}\n.leaflet-map-pane .weatherlayers-tooltip-control.follow-cursor {\n  z-index: 101; /** higher z-index for Leaflet, because .leaflet-map-pane canvas z-index is 100 */\n}\n.weatherlayers-tooltip-control.follow-cursor::before {\n  content: '';\n  position: absolute;\n  width: 0;\n  height: 0;\n}\n.weatherlayers-tooltip-control.follow-cursor[data-follow-cursor-placement=BOTTOM]::before {\n  top: -5px;\n  left: calc(50% - 5px);\n  border-left: 5px solid transparent;\n  border-right: 5px solid transparent;\n  border-bottom: 5px solid rgba(255, 255, 255, 0.5); /* same color as background */\n}\n.weatherlayers-tooltip-control.follow-cursor[data-follow-cursor-placement=TOP]::before {\n  top: 0;\n  left: calc(50% - 5px);\n  border-left: 5px solid transparent;\n  border-right: 5px solid transparent;\n  border-top: 5px solid rgba(255, 255, 255, 0.5); /* same color as background */\n}\n.weatherlayers-tooltip-control.follow-cursor[data-follow-cursor-placement=RIGHT]::before {\n  top: calc(50% - 5px);\n  left: -5px;\n  border-top: 5px solid transparent;\n  border-bottom: 5px solid transparent;\n  border-right: 5px solid rgba(255, 255, 255, 0.5); /* same color as background */\n}\n.weatherlayers-tooltip-control.follow-cursor[data-follow-cursor-placement=LEFT]::before {\n  top: calc(50% - 5px);\n  left: 0;\n  border-top: 5px solid transparent;\n  border-bottom: 5px solid transparent;\n  border-left: 5px solid rgba(255, 255, 255, 0.5); /* same color as background */\n}\n\n.weatherlayers-tooltip-control .weatherlayers-tooltip-control__direction {\n  display: inline-flex;\n  align-items: center;\n  margin-left: 4px;\n}\n.weatherlayers-tooltip-control .weatherlayers-tooltip-control__direction-icon {\n  display: inline-block;\n  width: 20px;\n  height: 20px;\n  vertical-align: middle;\n  background: no-repeat center / contain;\n  background-image: url('data:image/svg+xml;charset=utf-8,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22utf-8%22%3F%3E%0A%3C!--%20Generator%3A%20Adobe%20Illustrator%2022.0.1%2C%20SVG%20Export%20Plug-In%20.%20SVG%20Version%3A%206.00%20Build%200)%20%20--%3E%0A%3Csvg%20version%3D%221.1%22%20id%3D%22Layer_1%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%20x%3D%220px%22%20y%3D%220px%22%0A%09%20viewBox%3D%220%200%2030%2030%22%20style%3D%22enable-background%3Anew%200%200%2030%2030%3B%22%20xml%3Aspace%3D%22preserve%22%3E%0A%3Cpath%20d%3D%22M3.74%2C14.5c0-2.04%2C0.51-3.93%2C1.52-5.66s2.38-3.1%2C4.11-4.11s3.61-1.51%2C5.64-1.51c1.52%2C0%2C2.98%2C0.3%2C4.37%2C0.89%0A%09s2.58%2C1.4%2C3.59%2C2.4s1.81%2C2.2%2C2.4%2C3.6s0.89%2C2.85%2C0.89%2C4.39c0%2C1.52-0.3%2C2.98-0.89%2C4.37s-1.4%2C2.59-2.4%2C3.59s-2.2%2C1.8-3.59%2C2.39%0A%09s-2.84%2C0.89-4.37%2C0.89c-1.53%2C0-3-0.3-4.39-0.89s-2.59-1.4-3.6-2.4s-1.8-2.2-2.4-3.58S3.74%2C16.03%2C3.74%2C14.5z%20M6.22%2C14.5%0A%09c0%2C2.37%2C0.86%2C4.43%2C2.59%2C6.18c1.73%2C1.73%2C3.79%2C2.59%2C6.2%2C2.59c1.58%2C0%2C3.05-0.39%2C4.39-1.18s2.42-1.85%2C3.21-3.2s1.19-2.81%2C1.19-4.39%0A%09s-0.4-3.05-1.19-4.4s-1.86-2.42-3.21-3.21s-2.81-1.18-4.39-1.18s-3.05%2C0.39-4.39%2C1.18S8.2%2C8.75%2C7.4%2C10.1S6.22%2C12.92%2C6.22%2C14.5z%0A%09%20M11.11%2C20.35l3.75-13.11c0.01-0.1%2C0.06-0.15%2C0.15-0.15s0.14%2C0.05%2C0.15%2C0.15l3.74%2C13.11c0.04%2C0.11%2C0.03%2C0.19-0.02%2C0.25%0A%09s-0.13%2C0.06-0.24%2C0l-3.47-1.3c-0.1-0.04-0.2-0.04-0.29%2C0l-3.5%2C1.3c-0.1%2C0.06-0.17%2C0.06-0.21%2C0S11.09%2C20.45%2C11.11%2C20.35z%22%2F%3E%0A%3C%2Fsvg%3E');\n  opacity: 0.75; /* same opacity as text */\n}\n.weatherlayers-tooltip-control .weatherlayers-tooltip-control__direction-text {\n  margin-left: 2px;\n}\n\n.weatherlayers-tooltip-control:not(.has-value) {\n  display: none;\n}\n.weatherlayers-tooltip-control:not(.has-direction) .weatherlayers-tooltip-control__direction {\n  display: none;\n}";
  styleInject(css_248z$3);

  const CONTROL_CLASS$3 = 'weatherlayers-tooltip-control';
  const VALUE_CLASS = `${CONTROL_CLASS$3}__value`;
  const DIRECTION_CLASS = `${CONTROL_CLASS$3}__direction`;
  const DIRECTION_ICON_CLASS = `${CONTROL_CLASS$3}__direction-icon`;
  const DIRECTION_TEXT_CLASS = `${CONTROL_CLASS$3}__direction-text`;
  const FOLLOW_CURSOR_CLASS = 'follow-cursor';
  const FOLLOW_CURSOR_PLACEMENT_ATTRIBUTE = 'data-follow-cursor-placement';
  const HAS_VALUE_CLASS = 'has-value';
  const HAS_DIRECTION_CLASS = 'has-direction';
  class TooltipControl extends Control {
      constructor(config = {}) {
          super();
          this._container = undefined;
          this._value = undefined;
          this._direction = undefined;
          this._directionIcon = undefined;
          this._directionText = undefined;
          this._config = config;
      }
      onAdd() {
          this._container = document.createElement('div');
          this._container.classList.add(CONTROL_CLASS$3);
          this.setConfig(this._config);
          return this._container;
      }
      onRemove() {
          if (this._container && this._container.parentNode) {
              this._container.parentNode.removeChild(this._container);
              this._container = undefined;
          }
      }
      getConfig() {
          return { ...this._config };
      }
      setConfig(config) {
          if (!this._container) {
              return;
          }
          // validate config
          if (!config.unitFormat) {
              return;
          }
          // prevent update if no config changed
          if (this._container.children.length > 0 &&
              this._config.directionType === config.directionType &&
              this._config.directionFormat === config.directionFormat &&
              this._config.unitFormat === config.unitFormat &&
              this._config.followCursor === config.followCursor &&
              this._config.followCursorOffset === config.followCursorOffset &&
              this._config.followCursorPlacement === config.followCursorPlacement) {
              return;
          }
          this._config = config;
          this._container.innerHTML = '';
          const div = document.createElement('div');
          this._container.appendChild(div);
          this._value = document.createElement('span');
          this._value.classList.add(VALUE_CLASS);
          div.appendChild(this._value);
          this._direction = document.createElement('span');
          this._direction.classList.add(DIRECTION_CLASS);
          div.appendChild(this._direction);
          this._directionIcon = document.createElement('span');
          this._directionIcon.classList.add(DIRECTION_ICON_CLASS);
          this._direction.appendChild(this._directionIcon);
          this._directionText = document.createElement('span');
          this._directionText.classList.add(DIRECTION_TEXT_CLASS);
          this._direction.appendChild(this._directionText);
      }
      update(rasterPointProperties) {
          if (!this._container || !this._value || !this._directionIcon || !this._directionText) {
              return;
          }
          const { value, direction } = rasterPointProperties ?? {};
          this._container.classList.toggle(FOLLOW_CURSOR_CLASS, this._config.followCursor ?? false);
          this._container.setAttribute(FOLLOW_CURSOR_PLACEMENT_ATTRIBUTE, this._config.followCursorPlacement ?? Placement.BOTTOM);
          this._container.classList.toggle(HAS_VALUE_CLASS, typeof value !== 'undefined');
          this._container.classList.toggle(HAS_DIRECTION_CLASS, typeof direction !== 'undefined');
          if (typeof value !== 'undefined') {
              this._value.innerHTML = formatValueWithUnit(value, this._config.unitFormat);
          }
          else {
              this._value.innerHTML = '';
          }
          if (typeof direction !== 'undefined') {
              this._directionIcon.style.transform = `rotate(${(direction + 180) % 360}deg)`;
              this._directionText.innerHTML = formatDirection(direction, this._config.directionType ?? DirectionType.INWARD, this._config.directionFormat ?? DirectionFormat.VALUE);
          }
          else {
              this._directionIcon.style.transform = '';
              this._directionText.innerHTML = '';
          }
      }
      updatePickingInfo(pickingInfo) {
          if (!this._container || !this._value || !this._direction) {
              return;
          }
          if (!pickingInfo) {
              this.update(undefined);
              return;
          }
          this.update(pickingInfo.raster);
          const hasDirection = typeof pickingInfo.raster?.direction !== 'undefined';
          const div = this._container.firstChild;
          if (this._config.followCursor) {
              const divBounds = div.getBoundingClientRect();
              const valueBounds = this._value.getBoundingClientRect();
              // update position
              const followCursorOffset = this._config.followCursorOffset ?? 16;
              const followCursorPlacement = this._config.followCursorPlacement ?? Placement.BOTTOM;
              let containerX = pickingInfo.x;
              let containerY = pickingInfo.y;
              if (followCursorPlacement === Placement.BOTTOM) {
                  containerY += followCursorOffset;
              }
              else if (followCursorPlacement === Placement.TOP) {
                  containerY -= followCursorOffset;
              }
              else if (followCursorPlacement === Placement.RIGHT) {
                  containerX += followCursorOffset;
              }
              else if (followCursorPlacement === Placement.LEFT) {
                  containerX -= followCursorOffset;
              }
              else {
                  throw new Error(`Invalid placement ${followCursorPlacement}`);
              }
              this._container.style.left = `${containerX}px`;
              this._container.style.top = `${containerY}px`;
              if (followCursorPlacement === Placement.BOTTOM || followCursorPlacement === Placement.TOP) {
                  const divPaddingLeft = parseFloat(window.getComputedStyle(div).paddingLeft);
                  const directionMarginLeft = parseFloat(window.getComputedStyle(this._direction).marginLeft);
                  const divX = -(divPaddingLeft + (hasDirection ? valueBounds.width + directionMarginLeft : valueBounds.width / 2));
                  div.style.left = `${divX}px`;
              }
              if (followCursorPlacement === Placement.RIGHT || followCursorPlacement === Placement.LEFT) {
                  const divY = -divBounds.height / 2;
                  div.style.top = `${divY}px`;
              }
              if (followCursorPlacement === Placement.TOP) {
                  const divY = -divBounds.height;
                  div.style.top = `${divY}px`;
              }
              if (followCursorPlacement === Placement.LEFT) {
                  const divX = -divBounds.width;
                  div.style.left = `${divX}px`;
              }
              // hide on panning
              document.addEventListener('mousedown', () => this.update(undefined), { once: true });
          }
          else {
              this._container.style.left = '';
              this._container.style.top = '';
              div.style.left = '';
              div.style.top = '';
          }
      }
  }

  var css_248z$2 = ".weatherlayers-timeline-control {\n  margin: 10px;\n  pointer-events: auto; /* force controls to be clickable when added as MapLibre/Mapbox control */\n}\n.weatherlayers-timeline-control > div {\n  display: inline-block;\n  background: rgba(255, 255, 255, 0.5);\n  width: 100%;\n  font-family: 'Helvetica Neue', Arial, Helvetica, sans-serif;\n  font-size: 12px;\n  line-height: 14px;\n  color: rgba(0, 0, 0, 0.75);\n}\n.weatherlayers-timeline-control header, .weatherlayers-timeline-control main, .weatherlayers-timeline-control footer {\n  margin: 5px 10px;\n  text-align: center;\n}\n.weatherlayers-timeline-control header {\n  font-weight: bold;\n}\n.weatherlayers-timeline-control footer {\n  display: flex;\n  gap: 10px;\n}\n.weatherlayers-timeline-control__progress-input {\n  width: 100%;\n  margin: 0;\n  margin-top: -2px;\n  margin-bottom: 2px;\n  vertical-align: middle;\n}\n.weatherlayers-timeline-control__start-datetime, .weatherlayers-timeline-control__end-datetime {\n  flex: 0 0;\n}\n.weatherlayers-timeline-control__buttons {\n  flex: 1 0;\n}\n.weatherlayers-timeline-control__start-datetime {\n  text-align: left;\n}\n.weatherlayers-timeline-control__end-datetime {\n  text-align: right;\n}\n.weatherlayers-timeline-control__button {\n  display: inline-block;\n  width: 16px;\n  height: 16px;\n  vertical-align: middle;\n  background: no-repeat center / contain;\n}\n.weatherlayers-timeline-control__button + .weatherlayers-timeline-control__button {\n  margin-left: 5px;\n}\n.weatherlayers-timeline-control__play-button {\n  background-image: url('data:image/svg+xml;charset=utf-8,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22utf-8%22%3F%3E%0A%3Csvg%20width%3D%221792%22%20height%3D%221792%22%20viewBox%3D%220%200%201792%201792%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M1576%20927l-1328%20738q-23%2013-39.5%203t-16.5-36v-1472q0-26%2016.5-36t39.5%203l1328%20738q23%2013%2023%2031t-23%2031z%22%2F%3E%3C%2Fsvg%3E');\n}\n.weatherlayers-timeline-control__pause-button {\n  background-image: url('data:image/svg+xml;charset=utf-8,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22utf-8%22%3F%3E%0A%3Csvg%20width%3D%221792%22%20height%3D%221792%22%20viewBox%3D%220%200%201792%201792%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M1664%20192v1408q0%2026-19%2045t-45%2019h-512q-26%200-45-19t-19-45v-1408q0-26%2019-45t45-19h512q26%200%2045%2019t19%2045zm-896%200v1408q0%2026-19%2045t-45%2019h-512q-26%200-45-19t-19-45v-1408q0-26%2019-45t45-19h512q26%200%2045%2019t19%2045z%22%2F%3E%3C%2Fsvg%3E');\n}\n.weatherlayers-timeline-control__step-backward-button {\n  background-image: url('data:image/svg+xml;charset=utf-8,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22utf-8%22%3F%3E%0A%3Csvg%20width%3D%221792%22%20height%3D%221792%22%20viewBox%3D%220%200%201792%201792%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M1363%20141q19-19%2032-13t13%2032v1472q0%2026-13%2032t-32-13l-710-710q-9-9-13-19v678q0%2026-19%2045t-45%2019h-128q-26%200-45-19t-19-45v-1408q0-26%2019-45t45-19h128q26%200%2045%2019t19%2045v678q4-10%2013-19z%22%2F%3E%3C%2Fsvg%3E');\n}\n.weatherlayers-timeline-control__step-forward-button {\n  background-image: url('data:image/svg+xml;charset=utf-8,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22utf-8%22%3F%3E%0A%3Csvg%20width%3D%221792%22%20height%3D%221792%22%20viewBox%3D%220%200%201792%201792%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M429%201651q-19%2019-32%2013t-13-32v-1472q0-26%2013-32t32%2013l710%20710q9%209%2013%2019v-678q0-26%2019-45t45-19h128q26%200%2045%2019t19%2045v1408q0%2026-19%2045t-45%2019h-128q-26%200-45-19t-19-45v-678q-4%2010-13%2019z%22%2F%3E%3C%2Fsvg%3E');\n}\n\n.weatherlayers-timeline-control__loader {\n  display: block;\n  margin-top: 2px;\n}\n.weatherlayers-timeline-control__loader-icon {\n  display: inline-block;\n  width: 16px;\n  height: 16px;\n  vertical-align: middle;\n  background: no-repeat center / contain;\n  background-image: url('data:image/svg+xml;charset=utf-8,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22utf-8%22%3F%3E%0A%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%20style%3D%22margin%3A%20auto%3B%20background%3A%20none%3B%20display%3A%20block%3B%20shape-rendering%3A%20auto%3B%22%20width%3D%2216px%22%20height%3D%2216px%22%20viewBox%3D%220%200%20100%20100%22%20preserveAspectRatio%3D%22xMidYMid%22%3E%0A%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20fill%3D%22none%22%20stroke%3D%22rgba(0%2C%200%2C%200%2C%200.4)%22%20stroke-width%3D%2210%22%20r%3D%2225%22%20stroke-dasharray%3D%22117.80972450961724%2041.269908169872416%22%3E%0A%20%20%3CanimateTransform%20attributeName%3D%22transform%22%20type%3D%22rotate%22%20repeatCount%3D%22indefinite%22%20dur%3D%221s%22%20values%3D%220%2050%2050%3B360%2050%2050%22%20keyTimes%3D%220%3B1%22%3E%3C%2FanimateTransform%3E%0A%3C%2Fcircle%3E%0A%3C!--%20%5Bldio%5D%20generated%20by%20https%3A%2F%2Floading.io%2F%20--%3E%3C%2Fsvg%3E');\n}\n.weatherlayers-timeline-control__loader-text {\n  vertical-align: middle;\n  color: rgba(0, 0, 0, 0.4);\n  margin-left: 2px;\n}\n\n.weatherlayers-timeline-control.loading * {\n  pointer-events: none;\n}\n.weatherlayers-timeline-control.running .weatherlayers-timeline-control__play-button {\n  display: none;\n}\n.weatherlayers-timeline-control:not(.running) .weatherlayers-timeline-control__pause-button {\n  display: none;\n}\n.weatherlayers-timeline-control:not(.loading) .weatherlayers-timeline-control__loader {\n  visibility: hidden;\n}";
  styleInject(css_248z$2);

  const DEFAULT_WIDTH = 300;
  const FPS = 15;
  const STEP = 1;
  const STEP_INTERPOLATE = 0.25;
  const CONTROL_CLASS$2 = 'weatherlayers-timeline-control';
  const CURRENT_DATETIME_CLASS = `${CONTROL_CLASS$2}__current-datetime`;
  const PROGRESS_INPUT_CLASS = `${CONTROL_CLASS$2}__progress-input`;
  const START_DATETIME_CLASS = `${CONTROL_CLASS$2}__start-datetime`;
  const BUTTONS_CLASS = `${CONTROL_CLASS$2}__buttons`;
  const END_DATETIME_CLASS = `${CONTROL_CLASS$2}__end-datetime`;
  const BUTTON_CLASS = `${CONTROL_CLASS$2}__button`;
  const STEP_BACKWARD_BUTTON_CLASS = `${CONTROL_CLASS$2}__step-backward-button`;
  const PLAY_BUTTON_CLASS = `${CONTROL_CLASS$2}__play-button`;
  const PAUSE_BUTTON_CLASS = `${CONTROL_CLASS$2}__pause-button`;
  const STEP_FORWARD_BUTTON_CLASS = `${CONTROL_CLASS$2}__step-forward-button`;
  const LOADER_CLASS = `${CONTROL_CLASS$2}__loader`;
  const LOADER_ICON_CLASS = `${CONTROL_CLASS$2}__loader-icon`;
  const LOADER_TEXT_CLASS = `${CONTROL_CLASS$2}__loader-text`;
  const LOADING_CLASS = 'loading';
  const RUNNING_CLASS = 'running';
  class TimelineControl extends Control {
      constructor(config = {}) {
          super();
          this._container = undefined;
          this._currentDatetime = undefined;
          this._progressInput = undefined;
          this._loaderText = undefined;
          this._loading = false;
          this._config = config;
          this._animation = new Animation({
              onUpdate: () => this._animationUpdated(),
              fps: this._config.fps ?? FPS,
          });
      }
      onAdd() {
          this._container = document.createElement('div');
          this._container.classList.add(CONTROL_CLASS$2);
          this.setConfig(this._config);
          return this._container;
      }
      onRemove() {
          if (this._container && this._container.parentNode) {
              this._container.parentNode.removeChild(this._container);
              this._container = undefined;
              this._currentDatetime = undefined;
              this._progressInput = undefined;
          }
      }
      get loading() {
          return this._loading;
      }
      get running() {
          return this._running;
      }
      get _running() {
          return this._animation.running;
      }
      async toggle(running = !this._running) {
          if (running) {
              return await this.start();
          }
          else {
              return this.pause();
          }
      }
      async start() {
          if (!this._container || this._loading || this._running) {
              return;
          }
          await this._preload(this._config.datetimes);
          this._animation.start();
          this._container.classList.add(RUNNING_CLASS);
          this._updateProgress();
      }
      pause() {
          if (!this._container || this._loading || !this._running) {
              return;
          }
          this._animation.stop();
          this._container.classList.remove(RUNNING_CLASS);
          this._updateProgress();
      }
      stop() {
          if (!this._container || !this._progressInput || this._loading || !this._running) {
              return;
          }
          this._animation.stop();
          this._container.classList.remove(RUNNING_CLASS);
          this._progressInput.valueAsNumber = 0;
          this._updateProgress();
      }
      reset() {
          if (!this._progressInput || this._loading || this._running) {
              return;
          }
          this._progressInput.valueAsNumber = 0;
          this._updateProgress();
      }
      async stepBackward() {
          if (!this._progressInput || this._loading || this._running) {
              return;
          }
          if (this._progressInput.value !== this._progressInput.min) {
              this._progressInput.stepDown();
          }
          else {
              this._progressInput.value = this._progressInput.max;
          }
          await this._preload(this._startEndDatetimes);
          this._updateProgress();
      }
      async stepForward() {
          if (!this._progressInput || this._loading || this._running) {
              return;
          }
          if (this._progressInput.value !== this._progressInput.max) {
              this._progressInput.stepUp();
          }
          else {
              this._progressInput.value = this._progressInput.min;
          }
          await this._preload(this._startEndDatetimes);
          this._updateProgress();
      }
      get _startEndDatetimes() {
          if (!this._progressInput) {
              return [];
          }
          const startDatetime = this._config.datetimes[Math.floor(this._progressInput.valueAsNumber)];
          const endDatetime = this._config.datetimes[Math.ceil(this._progressInput.valueAsNumber)];
          if (startDatetime === endDatetime) {
              return [startDatetime];
          }
          else {
              return [startDatetime, endDatetime];
          }
      }
      _updateProgress() {
          if (!this._progressInput || !this._currentDatetime) {
              return;
          }
          const startDatetime = this._config.datetimes[Math.floor(this._progressInput.valueAsNumber)];
          const endDatetime = this._config.datetimes[Math.ceil(this._progressInput.valueAsNumber)];
          const ratio = this._progressInput.valueAsNumber % 1;
          const datetime = interpolateDatetime(startDatetime, endDatetime, ratio);
          this._config.datetime = datetime;
          const datetimeFormatFunction = this._config.datetimeFormatFunction ?? formatDatetime;
          this._currentDatetime.innerHTML = datetimeFormatFunction(datetime);
          if (this._config.onUpdate) {
              this._config.onUpdate(datetime);
          }
      }
      async _progressInputClicked() {
          if (this._loading || this._running) {
              return;
          }
          await this._preload(this._startEndDatetimes);
          this._updateProgress();
      }
      _animationUpdated() {
          if (!this._progressInput || this._loading || !this._running) {
              return;
          }
          if (this._progressInput.value !== this._progressInput.max) {
              this._progressInput.stepUp();
          }
          else {
              this._progressInput.value = this._progressInput.min;
          }
          this._updateProgress();
      }
      async _preload(datetimes) {
          if (!this._container || !this._loaderText || !this._config.onPreload) {
              return;
          }
          this._loading = true;
          this._container.classList.add(LOADING_CLASS);
          const promises = this._config.onPreload(datetimes);
          if (Array.isArray(promises)) {
              let successCount = 0;
              const updateLoaderText = () => {
                  this._loaderText.innerHTML = `Loading... ${successCount}/${promises.length}`;
              };
              updateLoaderText();
              for (let promise of promises) {
                  promise.then(() => {
                      successCount++;
                      updateLoaderText();
                  });
              }
              await Promise.all(promises);
              this._loaderText.innerHTML = '';
          }
          else {
              this._loaderText.innerHTML = 'Loading...';
              await promises;
              this._loaderText.innerHTML = '';
          }
          this._loading = false;
          this._container.classList.remove(LOADING_CLASS);
      }
      getConfig() {
          return { ...this._config };
      }
      setConfig(config) {
          if (!this._container) {
              return;
          }
          // validate config
          if (!config.datetimes ||
              config.datetimes.length < 2 ||
              !config.datetime ||
              config.datetime < config.datetimes[0] ||
              config.datetime > config.datetimes[config.datetimes.length - 1]) {
              return;
          }
          // prevent update if no config changed
          if (this._container.children.length > 0 &&
              this._config.width === config.width &&
              this._config.datetimes.length === config.datetimes.length &&
              this._config.datetimes.every((datetime, i) => datetime === config.datetimes[i]) &&
              this._config.datetime === config.datetime &&
              this._config.datetimeInterpolate === config.datetimeInterpolate &&
              this._config.datetimeFormatFunction === config.datetimeFormatFunction &&
              this._config.onPreload === config.onPreload &&
              this._config.onUpdate === config.onUpdate) {
              return;
          }
          this._config = config;
          const width = this._config.width ?? DEFAULT_WIDTH;
          const datetimes = this._config.datetimes;
          const datetime = this._config.datetime;
          const datetimeInterpolate = this._config.datetimeInterpolate ?? false;
          const datetimeFormatFunction = this._config.datetimeFormatFunction ?? formatDatetime;
          const datetimeStartIndex = findLastIndex(datetimes, x => x <= datetime);
          if (datetimeStartIndex < 0) {
              // overflow is handled by the validation above
              throw new Error('Invalid state');
          }
          const datetimeEndIndex = datetimeStartIndex < datetimes.length - 1 ? datetimeStartIndex + 1 : null;
          const datetimeStart = datetimes[datetimeStartIndex];
          const datetimeEnd = typeof datetimeEndIndex === 'number' ? datetimes[datetimeStartIndex + 1] : null;
          const datetimeWeight = getDatetimeWeight(datetimeStart, datetimeEnd, datetime);
          const progressInputStep = datetimeInterpolate ? STEP_INTERPOLATE : STEP;
          const progressInputValue = datetimeStartIndex + Math.floor(datetimeWeight / progressInputStep) * progressInputStep;
          this._container.innerHTML = '';
          this._container.style.width = `${width}px`;
          const div = document.createElement('div');
          this._container.appendChild(div);
          const header = document.createElement('header');
          div.appendChild(header);
          this._currentDatetime = document.createElement('span');
          this._currentDatetime.classList.add(CURRENT_DATETIME_CLASS);
          this._currentDatetime.innerHTML = datetimeFormatFunction(datetime);
          header.appendChild(this._currentDatetime);
          const main = document.createElement('main');
          div.appendChild(main);
          const progressInputTicksId = `${PROGRESS_INPUT_CLASS}-ticks-${randomString()}`;
          this._progressInput = document.createElement('input');
          this._progressInput.classList.add(PROGRESS_INPUT_CLASS);
          this._progressInput.type = 'range';
          this._progressInput.min = '0';
          this._progressInput.max = `${datetimes.length - 1}`;
          this._progressInput.step = `${progressInputStep}`;
          this._progressInput.valueAsNumber = progressInputValue;
          this._progressInput.setAttribute('list', progressInputTicksId);
          this._progressInput.addEventListener('input', () => this._progressInputClicked());
          main.appendChild(this._progressInput);
          const progressInputTicks = document.createElement('datalist');
          progressInputTicks.id = progressInputTicksId;
          main.appendChild(progressInputTicks);
          for (let i = 0; i < datetimes.length; i++) {
              const progressInputTick = document.createElement('option');
              progressInputTick.innerHTML = `${i}`;
              progressInputTicks.appendChild(progressInputTick);
          }
          const footer = document.createElement('footer');
          div.appendChild(footer);
          const startDatetime = document.createElement('span');
          startDatetime.classList.add(START_DATETIME_CLASS);
          startDatetime.innerHTML = datetimeFormatFunction(datetimes[0]);
          footer.appendChild(startDatetime);
          const buttons = document.createElement('span');
          buttons.classList.add(BUTTONS_CLASS);
          footer.appendChild(buttons);
          const endDatetime = document.createElement('span');
          endDatetime.classList.add(END_DATETIME_CLASS);
          endDatetime.innerHTML = datetimeFormatFunction(datetimes[datetimes.length - 1]);
          footer.appendChild(endDatetime);
          const stepBackwardButton = document.createElement('a');
          stepBackwardButton.href = 'javascript:void(0)';
          stepBackwardButton.classList.add(BUTTON_CLASS);
          stepBackwardButton.classList.add(STEP_BACKWARD_BUTTON_CLASS);
          stepBackwardButton.addEventListener('click', () => this.stepBackward());
          buttons.appendChild(stepBackwardButton);
          const playButton = document.createElement('a');
          playButton.href = 'javascript:void(0)';
          playButton.classList.add(BUTTON_CLASS);
          playButton.classList.add(PLAY_BUTTON_CLASS);
          playButton.addEventListener('click', () => this.start());
          buttons.appendChild(playButton);
          const pauseButton = document.createElement('a');
          pauseButton.href = 'javascript:void(0)';
          pauseButton.classList.add(BUTTON_CLASS);
          pauseButton.classList.add(PAUSE_BUTTON_CLASS);
          pauseButton.addEventListener('click', () => this.pause());
          buttons.appendChild(pauseButton);
          const stepForwardButton = document.createElement('a');
          stepForwardButton.href = 'javascript:void(0)';
          stepForwardButton.classList.add(BUTTON_CLASS);
          stepForwardButton.classList.add(STEP_FORWARD_BUTTON_CLASS);
          stepForwardButton.addEventListener('click', () => this.stepForward());
          buttons.appendChild(stepForwardButton);
          const loader = document.createElement('span');
          loader.classList.add(LOADER_CLASS);
          buttons.appendChild(loader);
          const loaderIcon = document.createElement('span');
          loaderIcon.classList.add(LOADER_ICON_CLASS);
          loader.appendChild(loaderIcon);
          this._loaderText = document.createElement('span');
          this._loaderText.classList.add(LOADER_TEXT_CLASS);
          loader.appendChild(this._loaderText);
      }
  }

  var css_248z$1 = ".weatherlayers-attribution-control {\n  margin-top: 2px;\n  pointer-events: auto; /* force controls to be clickable when added as MapLibre/Mapbox control */\n}\n.weatherlayers-attribution-control > div {\n  display: inline-block;\n  background: rgba(255, 255, 255, 0.5);\n  padding: 0 5px;\n  font-family: 'Helvetica Neue', Arial, Helvetica, sans-serif;\n  font-size: 12px;\n  line-height: 20px;\n  color: rgba(0, 0, 0, 0.75);\n}\n.weatherlayers-attribution-control a {\n  color: rgba(0, 0, 0, 0.75);\n  text-decoration: none;\n}\n.weatherlayers-attribution-control a:hover {\n  text-decoration: underline;\n}";
  styleInject(css_248z$1);

  const CONTROL_CLASS$1 = 'weatherlayers-attribution-control';
  class AttributionControl extends Control {
      constructor(config = {}) {
          super();
          this._container = undefined;
          this._config = config;
      }
      onAdd() {
          this._container = document.createElement('div');
          this._container.classList.add(CONTROL_CLASS$1);
          this.setConfig(this._config);
          return this._container;
      }
      onRemove() {
          if (this._container && this._container.parentNode) {
              this._container.parentNode.removeChild(this._container);
              this._container = undefined;
          }
      }
      getConfig() {
          return { ...this._config };
      }
      setConfig(config) {
          if (!this._container) {
              return;
          }
          // validate config
          if (!config.attribution) {
              return;
          }
          // prevent update if no config changed
          if (this._container.children.length > 0 &&
              this._config.attribution === config.attribution) {
              return;
          }
          this._config = config;
          const attribution = this._config.attribution;
          this._container.innerHTML = `<div>${attribution}</div>`;
      }
  }

  var css_248z = ".weatherlayers-logo-control {\n  margin: 10px;\n  pointer-events: auto; /* force controls to be clickable when added as MapLibre/Mapbox control */\n}\n.weatherlayers-logo-control a {\n  display: inline-block;\n  width: 131px;\n  height: 23px;\n  margin: -1.5px; /* outline */\n  vertical-align: middle;\n  background: no-repeat center / contain;\n  background-image: url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20xml%3Aspace%3D%22preserve%22%20style%3D%22fill-rule%3Aevenodd%3Bclip-rule%3Aevenodd%3Bstroke-linecap%3Around%3Bstroke-linejoin%3Around%3Bstroke-miterlimit%3A2%22%20viewBox%3D%220%200%20131%2023%22%3E%3Cg%20opacity%3D%22.9%22%3E%3Cpath%20d%3D%22M27.391%2017.706h2.534l1.736-6.475h.132l1.765%206.475h2.52l2.761-10.569H36.07l-1.384%207.009h-.132l-1.75-7.009H30.65l-1.692%207.009h-.131L27.42%207.137h-2.79l2.761%2010.569Zm15.092.19c2.615%200%203.611-1.53%203.846-2.504l.022-.088-2.373.007-.015.029c-.117.213-.564.711-1.428.711-.996%200-1.597-.674-1.619-1.839h5.486v-.747c0-2.49-1.56-4.101-4.014-4.101-2.461%200-4.021%201.633-4.021%204.262v.008c0%202.644%201.56%204.262%204.116%204.262Zm-.036-6.687c.805%200%201.377.52%201.501%201.495h-3.003c.125-.96.703-1.495%201.502-1.495Zm7.028%206.622c1.04%200%201.912-.44%202.271-1.136h.139v1.011h2.549v-5.559c0-1.758-1.282-2.783-3.531-2.783-2.204%200-3.611.989-3.757%202.49l-.007.088h2.351l.014-.037c.154-.41.572-.637%201.253-.637.718%200%201.128.33%201.128.879v.637l-1.78.103c-2.102.132-3.259.988-3.259%202.468v.015c0%201.486%201.069%202.461%202.629%202.461Zm-.132-2.644v-.015c0-.484.403-.791%201.172-.842l1.37-.088v.534c0%20.703-.637%201.245-1.458%201.245-.652%200-1.084-.322-1.084-.834Zm9.944%202.534c.49%200%20.966-.044%201.237-.103v-1.853a5.19%205.19%200%200%201-.651.029c-.674%200-.982-.293-.982-.908v-3.428h1.633V9.554h-1.633V7.687h-2.6v1.867h-1.245v1.904h1.245v4.014c0%201.597.85%202.249%202.996%202.249Zm2.267-.015h2.593v-4.658c0-.938.498-1.575%201.34-1.575.879%200%201.282.557%201.282%201.546v4.687h2.593V12.44c0-1.956-.945-3.076-2.754-3.076-1.15%200-1.97.571-2.322%201.465h-.139V6.5h-2.593v11.206Zm12.719.19c2.615%200%203.611-1.53%203.846-2.504l.022-.088-2.373.007-.015.029c-.117.213-.564.711-1.428.711-.996%200-1.597-.674-1.619-1.839h5.486v-.747c0-2.49-1.56-4.101-4.014-4.101-2.461%200-4.021%201.633-4.021%204.262v.008c0%202.644%201.56%204.262%204.116%204.262Zm-.036-6.687c.805%200%201.377.52%201.501%201.495h-3.003c.125-.96.703-1.495%201.502-1.495Zm4.816%206.497h2.593v-4.314c0-1.128.71-1.78%201.926-1.78.366%200%20.74.052%201.084.139V9.562a2.733%202.733%200%200%200-.879-.132c-1.04%200-1.757.52-1.992%201.421h-.139V9.554h-2.593v8.152Zm6.443%200h7.177v-2.161h-4.489V7.137h-2.688v10.569Zm10.36.125c1.04%200%201.912-.44%202.271-1.136h.139v1.011h2.549v-5.559c0-1.758-1.282-2.783-3.53-2.783-2.205%200-3.611.989-3.758%202.49l-.007.088h2.351l.015-.037c.154-.41.571-.637%201.252-.637.718%200%201.128.33%201.128.879v.637l-1.78.103c-2.102.132-3.259.988-3.259%202.468v.015c0%201.486%201.069%202.461%202.629%202.461Zm-.131-2.644v-.015c0-.484.402-.791%201.171-.842l1.37-.088v.534c0%20.703-.637%201.245-1.457%201.245-.652%200-1.084-.322-1.084-.834Zm7.233%205.397c2.3%200%203.589-.82%204.336-3.142l2.571-7.888h-2.74l-1.45%205.911h-.154l-1.45-5.911h-2.863l2.783%208.152-.037.227c-.08.476-.527.747-1.304.747-.212%200-.424%200-.571-.007v1.904c.293.007.586.007.879.007Zm10.896-2.688c2.614%200%203.61-1.53%203.845-2.504l.022-.088-2.373.007-.015.029c-.117.213-.564.711-1.428.711-.996%200-1.597-.674-1.619-1.839h5.486v-.747c0-2.49-1.56-4.101-4.014-4.101-2.461%200-4.021%201.633-4.021%204.262v.008c0%202.644%201.56%204.262%204.117%204.262Zm-.037-6.687c.806%200%201.377.52%201.501%201.495h-3.003c.125-.96.704-1.495%201.502-1.495Zm4.816%206.497h2.593v-4.314c0-1.128.711-1.78%201.926-1.78.367%200%20.74.052%201.084.139V9.562a2.733%202.733%200%200%200-.879-.132c-1.04%200-1.757.52-1.992%201.421h-.139V9.554h-2.593v8.152Zm9.468.19c2.212%200%203.735-1.083%203.735-2.775v-.008c0-1.223-.769-1.911-2.454-2.248l-1.406-.279c-.776-.161-1.025-.373-1.025-.739v-.015c0-.454.432-.725%201.076-.725.718%200%201.121.381%201.202.718l.014.051h2.373v-.037c-.044-1.303-1.23-2.475-3.589-2.475-2.19%200-3.581%201.018-3.581%202.644v.007c0%201.245.805%202.066%202.38%202.381l1.406.278c.74.154%201.018.373%201.018.754v.008c0%20.439-.446.71-1.142.71-.754%200-1.165-.315-1.318-.732l-.015-.044h-2.52v.051c.162%201.421%201.429%202.475%203.846%202.475Z%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3A%23000%3Bstroke-opacity%3A.3%3Bstroke-width%3A3px%22%20transform%3D%22translate(-2.33)%22%2F%3E%3Cpath%20d%3D%22M27.391%2017.706h2.534l1.736-6.475h.132l1.765%206.475h2.52l2.761-10.569H36.07l-1.384%207.009h-.132l-1.75-7.009H30.65l-1.692%207.009h-.131L27.42%207.137h-2.79l2.761%2010.569Zm15.092.19c2.615%200%203.611-1.53%203.846-2.504l.022-.088-2.373.007-.015.029c-.117.213-.564.711-1.428.711-.996%200-1.597-.674-1.619-1.839h5.486v-.747c0-2.49-1.56-4.101-4.014-4.101-2.461%200-4.021%201.633-4.021%204.262v.008c0%202.644%201.56%204.262%204.116%204.262Zm-.036-6.687c.805%200%201.377.52%201.501%201.495h-3.003c.125-.96.703-1.495%201.502-1.495Zm7.028%206.622c1.04%200%201.912-.44%202.271-1.136h.139v1.011h2.549v-5.559c0-1.758-1.282-2.783-3.531-2.783-2.204%200-3.611.989-3.757%202.49l-.007.088h2.351l.014-.037c.154-.41.572-.637%201.253-.637.718%200%201.128.33%201.128.879v.637l-1.78.103c-2.102.132-3.259.988-3.259%202.468v.015c0%201.486%201.069%202.461%202.629%202.461Zm-.132-2.644v-.015c0-.484.403-.791%201.172-.842l1.37-.088v.534c0%20.703-.637%201.245-1.458%201.245-.652%200-1.084-.322-1.084-.834Zm9.944%202.534c.49%200%20.966-.044%201.237-.103v-1.853a5.19%205.19%200%200%201-.651.029c-.674%200-.982-.293-.982-.908v-3.428h1.633V9.554h-1.633V7.687h-2.6v1.867h-1.245v1.904h1.245v4.014c0%201.597.85%202.249%202.996%202.249Zm2.267-.015h2.593v-4.658c0-.938.498-1.575%201.34-1.575.879%200%201.282.557%201.282%201.546v4.687h2.593V12.44c0-1.956-.945-3.076-2.754-3.076-1.15%200-1.97.571-2.322%201.465h-.139V6.5h-2.593v11.206Zm12.719.19c2.615%200%203.611-1.53%203.846-2.504l.022-.088-2.373.007-.015.029c-.117.213-.564.711-1.428.711-.996%200-1.597-.674-1.619-1.839h5.486v-.747c0-2.49-1.56-4.101-4.014-4.101-2.461%200-4.021%201.633-4.021%204.262v.008c0%202.644%201.56%204.262%204.116%204.262Zm-.036-6.687c.805%200%201.377.52%201.501%201.495h-3.003c.125-.96.703-1.495%201.502-1.495Zm4.816%206.497h2.593v-4.314c0-1.128.71-1.78%201.926-1.78.366%200%20.74.052%201.084.139V9.562a2.733%202.733%200%200%200-.879-.132c-1.04%200-1.757.52-1.992%201.421h-.139V9.554h-2.593v8.152Zm6.443%200h7.177v-2.161h-4.489V7.137h-2.688v10.569Zm10.36.125c1.04%200%201.912-.44%202.271-1.136h.139v1.011h2.549v-5.559c0-1.758-1.282-2.783-3.53-2.783-2.205%200-3.611.989-3.758%202.49l-.007.088h2.351l.015-.037c.154-.41.571-.637%201.252-.637.718%200%201.128.33%201.128.879v.637l-1.78.103c-2.102.132-3.259.988-3.259%202.468v.015c0%201.486%201.069%202.461%202.629%202.461Zm-.131-2.644v-.015c0-.484.402-.791%201.171-.842l1.37-.088v.534c0%20.703-.637%201.245-1.457%201.245-.652%200-1.084-.322-1.084-.834Zm7.233%205.397c2.3%200%203.589-.82%204.336-3.142l2.571-7.888h-2.74l-1.45%205.911h-.154l-1.45-5.911h-2.863l2.783%208.152-.037.227c-.08.476-.527.747-1.304.747-.212%200-.424%200-.571-.007v1.904c.293.007.586.007.879.007Zm10.896-2.688c2.614%200%203.61-1.53%203.845-2.504l.022-.088-2.373.007-.015.029c-.117.213-.564.711-1.428.711-.996%200-1.597-.674-1.619-1.839h5.486v-.747c0-2.49-1.56-4.101-4.014-4.101-2.461%200-4.021%201.633-4.021%204.262v.008c0%202.644%201.56%204.262%204.117%204.262Zm-.037-6.687c.806%200%201.377.52%201.501%201.495h-3.003c.125-.96.704-1.495%201.502-1.495Zm4.816%206.497h2.593v-4.314c0-1.128.711-1.78%201.926-1.78.367%200%20.74.052%201.084.139V9.562a2.733%202.733%200%200%200-.879-.132c-1.04%200-1.757.52-1.992%201.421h-.139V9.554h-2.593v8.152Zm9.468.19c2.212%200%203.735-1.083%203.735-2.775v-.008c0-1.223-.769-1.911-2.454-2.248l-1.406-.279c-.776-.161-1.025-.373-1.025-.739v-.015c0-.454.432-.725%201.076-.725.718%200%201.121.381%201.202.718l.014.051h2.373v-.037c-.044-1.303-1.23-2.475-3.589-2.475-2.19%200-3.581%201.018-3.581%202.644v.007c0%201.245.805%202.066%202.38%202.381l1.406.278c.74.154%201.018.373%201.018.754v.008c0%20.439-.446.71-1.142.71-.754%200-1.165-.315-1.318-.732l-.015-.044h-2.52v.051c.162%201.421%201.429%202.475%203.846%202.475Z%22%20style%3D%22fill%3A%23fff%3Bfill-rule%3Anonzero%22%20transform%3D%22translate(-2.33)%22%2F%3E%3Cpath%20d%3D%22m6.107%209.12-2.749%201.193a.68.68%200%200%200-.408.628c0%20.275.16.522.407.629l2.75%201.193-2.749%201.192a.684.684%200%200%200-.408.63c0%20.275.16.521.407.628l6.213%202.696a1.103%201.103%200%200%200%20.877%200l6.212-2.695a.683.683%200%200%200%20.408-.629.682.682%200%200%200-.407-.629l-2.75-1.193%202.749-1.193a.683.683%200%200%200%20.409-.629.68.68%200%200%200-.408-.628l-2.75-1.194-1.144.497%203.054%201.326-5.736%202.488a.181.181%200%200%201-.151%200l-5.736-2.489%203.054-1.325-1.144-.496Zm9.713%205.465-5.736%202.489a.189.189%200%200%201-.151%200l-5.736-2.49%203.054-1.325%202.319%201.006a1.09%201.09%200%200%200%20.877%200l2.319-1.006%203.054%201.326Zm-2.289-7.966c-.011.04-.039.066-.083.079l-1.207.378v1.206a.122.122%200%200%201-.054.103.128.128%200%200%201-.12.016L10.86%208.03l-.744.978a.13.13%200%200%201-.107.051.134.134%200%200%201-.108-.051l-.744-.978-1.207.371c-.038.015-.078.01-.12-.016a.121.121%200%200%201-.053-.103V7.076l-1.208-.378c-.044-.013-.071-.039-.082-.079-.014-.045-.008-.083.016-.114l.744-.978-.744-.977a.121.121%200%200%201-.016-.114c.011-.04.038-.066.082-.079l1.208-.378V2.773c0-.042.017-.077.053-.103.042-.026.082-.032.12-.016l1.207.371.744-.978A.131.131%200%200%201%2010.009%202c.047%200%20.083.016.107.047l.744.978%201.207-.371c.039-.016.079-.01.12.016a.122.122%200%200%201%20.054.103v1.206l1.207.378c.044.013.072.039.083.079a.119.119%200%200%201-.017.114l-.744.977.744.978c.025.031.031.069.017.114M12.39%205.527c0-.307-.063-.601-.188-.88a2.287%202.287%200%200%200-1.269-1.21%202.422%202.422%200%200%200-.924-.18c-.323%200-.631.06-.924.18a2.284%202.284%200%200%200-1.269%201.21%202.115%202.115%200%200%200-.188.88c0%20.308.062.602.188.881a2.284%202.284%200%200%200%201.269%201.21c.293.12.601.18.924.18.322%200%20.63-.06.924-.18a2.287%202.287%200%200%200%201.269-1.21c.125-.279.188-.573.188-.881%22%20style%3D%22fill%3Anone%3Bfill-rule%3Anonzero%3Bstroke%3A%23000%3Bstroke-opacity%3A.3%3Bstroke-width%3A2.4px%22%20transform%3D%22matrix(1.25%200%200%201.25%20-2.188%20-1)%22%2F%3E%3Cpath%20d%3D%22m6.107%209.12-2.749%201.193a.68.68%200%200%200-.408.628c0%20.275.16.522.407.629l2.75%201.193-2.749%201.192a.684.684%200%200%200-.408.63c0%20.275.16.521.407.628l6.213%202.696a1.103%201.103%200%200%200%20.877%200l6.212-2.695a.683.683%200%200%200%20.408-.629.682.682%200%200%200-.407-.629l-2.75-1.193%202.749-1.193a.683.683%200%200%200%20.409-.629.68.68%200%200%200-.408-.628l-2.75-1.194-1.144.497%203.054%201.326-5.736%202.488a.181.181%200%200%201-.151%200l-5.736-2.489%203.054-1.325-1.144-.496Zm9.713%205.465-5.736%202.489a.189.189%200%200%201-.151%200l-5.736-2.49%203.054-1.325%202.319%201.006a1.09%201.09%200%200%200%20.877%200l2.319-1.006%203.054%201.326Zm-2.289-7.966c-.011.04-.039.066-.083.079l-1.207.378v1.206a.122.122%200%200%201-.054.103.128.128%200%200%201-.12.016L10.86%208.03l-.744.978a.13.13%200%200%201-.107.051.134.134%200%200%201-.108-.051l-.744-.978-1.207.371c-.038.015-.078.01-.12-.016a.121.121%200%200%201-.053-.103V7.076l-1.208-.378c-.044-.013-.071-.039-.082-.079-.014-.045-.008-.083.016-.114l.744-.978-.744-.977a.121.121%200%200%201-.016-.114c.011-.04.038-.066.082-.079l1.208-.378V2.773c0-.042.017-.077.053-.103.042-.026.082-.032.12-.016l1.207.371.744-.978A.131.131%200%200%201%2010.009%202c.047%200%20.083.016.107.047l.744.978%201.207-.371c.039-.016.079-.01.12.016a.122.122%200%200%201%20.054.103v1.206l1.207.378c.044.013.072.039.083.079a.119.119%200%200%201-.017.114l-.744.977.744.978c.025.031.031.069.017.114M12.39%205.527c0-.307-.063-.601-.188-.88a2.287%202.287%200%200%200-1.269-1.21%202.422%202.422%200%200%200-.924-.18c-.323%200-.631.06-.924.18a2.284%202.284%200%200%200-1.269%201.21%202.115%202.115%200%200%200-.188.88c0%20.308.062.602.188.881a2.284%202.284%200%200%200%201.269%201.21c.293.12.601.18.924.18.322%200%20.63-.06.924-.18a2.287%202.287%200%200%200%201.269-1.21c.125-.279.188-.573.188-.881%22%20style%3D%22fill%3A%23fff%3Bfill-rule%3Anonzero%22%20transform%3D%22matrix(1.25%200%200%201.25%20-2.188%20-1)%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E');\n}";
  styleInject(css_248z);

  const CONTROL_CLASS = 'weatherlayers-logo-control';
  class LogoControl extends Control {
      constructor(config = {}) {
          super();
          this._container = undefined;
          this._config = config;
      }
      onAdd() {
          this._container = document.createElement('div');
          this._container.classList.add(CONTROL_CLASS);
          this.setConfig(this._config);
          return this._container;
      }
      onRemove() {
          if (this._container && this._container.parentNode) {
              this._container.parentNode.removeChild(this._container);
              this._container = undefined;
          }
      }
      getConfig() {
          return { ...this._config };
      }
      setConfig(config) {
          if (!this._container) {
              return;
          }
          this._config = config;
          this._container.innerHTML = '';
          const a = document.createElement('a');
          a.href = 'https://weatherlayers.com';
          a.target = '_blank';
          a.ariaLabel = 'WeatherLayers';
          this._container.appendChild(a);
      }
  }

  exports.Animation = Animation;
  exports.AttributionControl = AttributionControl;
  exports.ContourLayer = ContourLayer;
  exports.DATETIME = DATETIME;
  exports.DEFAULT_ICON_COLOR = DEFAULT_ICON_COLOR;
  exports.DEFAULT_ICON_SIZE = DEFAULT_ICON_SIZE$1;
  exports.DEFAULT_LINE_COLOR = DEFAULT_LINE_COLOR;
  exports.DEFAULT_LINE_WIDTH = DEFAULT_LINE_WIDTH;
  exports.DEFAULT_TEXT_COLOR = DEFAULT_TEXT_COLOR;
  exports.DEFAULT_TEXT_FONT_FAMILY = DEFAULT_TEXT_FONT_FAMILY;
  exports.DEFAULT_TEXT_FORMAT_FUNCTION = DEFAULT_TEXT_FORMAT_FUNCTION;
  exports.DEFAULT_TEXT_OUTLINE_COLOR = DEFAULT_TEXT_OUTLINE_COLOR;
  exports.DEFAULT_TEXT_OUTLINE_WIDTH = DEFAULT_TEXT_OUTLINE_WIDTH;
  exports.DEFAULT_TEXT_SIZE = DEFAULT_TEXT_SIZE;
  exports.DirectionFormat = DirectionFormat;
  exports.DirectionType = DirectionType;
  exports.FrontLayer = FrontLayer;
  exports.FrontType = FrontType;
  exports.GridLayer = GridLayer;
  exports.GridStyle = GridStyle;
  exports.HighLowLayer = HighLowLayer;
  exports.ImageInterpolation = ImageInterpolation;
  exports.ImageType = ImageType;
  exports.LegendControl = LegendControl;
  exports.LogoControl = LogoControl;
  exports.ParticleLayer = ParticleLayer;
  exports.Placement = Placement;
  exports.RasterLayer = RasterLayer;
  exports.TimelineControl = TimelineControl;
  exports.TooltipControl = TooltipControl;
  exports.UnitSystem = UnitSystem;
  exports.VERSION = VERSION$1;
  exports.colorRampCanvas = colorRampCanvas;
  exports.ensureDefaultProps = ensureDefaultProps;
  exports.formatDatetime = formatDatetime;
  exports.formatDirection = formatDirection;
  exports.formatUnit = formatUnit;
  exports.formatValue = formatValue;
  exports.formatValueWithUnit = formatValueWithUnit;
  exports.getClosestEndDatetime = getClosestEndDatetime;
  exports.getClosestStartDatetime = getClosestStartDatetime;
  exports.getDatetimeWeight = getDatetimeWeight;
  exports.getRasterMagnitudeData = getRasterMagnitudeData;
  exports.getRasterPoints = getRasterPoints;
  exports.interpolateDatetime = interpolateDatetime;
  exports.loadJson = loadJson;
  exports.loadTextureData = loadTextureData;
  exports.offsetDatetime = offsetDatetime;
  exports.offsetDatetimeRange = offsetDatetimeRange;
  exports.parsePalette = parsePalette;
  exports.setLibrary = setLibrary;

}));
