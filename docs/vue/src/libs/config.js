import { Pane } from './tweakpane@4.0.0.js';
import i18n from "./i18n.json";
import * as WeatherLayers from "./weatherlayers-deck.js"
export const NO_DATA = 'no data';

// 默认渲染的气象数据【要素+级别】
const DEFAULT_DATASET = 'gfs/wind_10_m_above_ground';

// 等值线图层默认配置
const CONTOUR_LAYER_DATASET_CONFIG = {
  'gfs/temperature_2_m_above_ground': { interval: 2, majorInterval: 10 },
  'gfs/apparent_temperature_2m_above_ground': { interval: 2, majorInterval: 10 },
  'gfs/pressure_mean_sea_level': { interval: 2, majorInterval: 10 },
  'ecmwf_ifs/temperature_2_m_above_ground': { interval: 2, majorInterval: 10 },
  'ecmwf_ifs/pressure_mean_sea_level': { interval: 2, majorInterval: 10 },
  'ecmwf_aifs/temperature_2_m_above_ground': { interval: 2, majorInterval: 10 },
  'ecmwf_aifs/pressure_mean_sea_level': { interval: 2, majorInterval: 10 },
};
// 高低点图层默认配置
const HIGH_LOW_LAYER_DATASET_CONFIG = {
  'gfs/pressure_mean_sea_level': { radius: 2000 },
  'ecmwf_ifs/pressure_mean_sea_level': { radius: 2000 },
  'ecmwf_aifs/pressure_mean_sea_level': { radius: 2000 },
  'meteofrance_arpege/pressure_mean_sea_level': { radius: 2000 },
  'meteofrance_arpege_eu/pressure_mean_sea_level': { radius: 2000 },
  'meteofrance_arome/pressure_mean_sea_level': { radius: 2000 },
  'meteofrance_arome_hd/pressure_mean_sea_level': { radius: 2000 },
};
// 网格图层默认配置
const GRID_LAYER_DATASET_CONFIG = {
  'gfs/wind_10m_above_ground': { style: WeatherLayers.GridStyle.WIND_BARB, iconBounds: [0, 100 * 0.51444] }, // 100 kts to m/s
  'gfs/wind_100m_above_ground': { style: WeatherLayers.GridStyle.WIND_BARB, iconBounds: [0, 100 * 0.51444] }, // 100 kts to m/s
  'gfs/wind_tropopause': { style: WeatherLayers.GridStyle.WIND_BARB, iconBounds: [0, 100 * 0.51444] }, // 100 kts to m/s
  'gfs/wind_gust_surface': { style: WeatherLayers.GridStyle.WIND_BARB, iconBounds: [0, 100 * 0.51444] }, // 100 kts to m/s
  'gfs/temperature_2_m_above_ground': { style: WeatherLayers.GridStyle.VALUE },
  'gfs/apparent_temperature_2m_above_ground': { style: WeatherLayers.GridStyle.VALUE },
  'gfswave/waves': { style: WeatherLayers.GridStyle.ARROW, iconBounds: [0, 35] },
  'gfswave/swell': { style: WeatherLayers.GridStyle.ARROW, iconBounds: [0, 35] },
  'gfswave/swell2': { style: WeatherLayers.GridStyle.ARROW, iconBounds: [0, 35] },
  'gfswave/swell3': { style: WeatherLayers.GridStyle.ARROW, iconBounds: [0, 35] },
  'ecmwf_ifs/wind_10m_above_ground': { style: WeatherLayers.GridStyle.WIND_BARB, iconBounds: [0, 100 * 0.51444] }, // 100 kts to m/s
  'ecmwf_ifs/wind_100m_above_ground': { style: WeatherLayers.GridStyle.WIND_BARB, iconBounds: [0, 100 * 0.51444] }, // 100 kts to m/s
  'ecmwf_ifs/wind_gust_surface': { style: WeatherLayers.GridStyle.WIND_BARB, iconBounds: [0, 100 * 0.51444] }, // 100 kts to m/s
  'ecmwf_ifs/temperature_2_m_above_ground': { style: WeatherLayers.GridStyle.VALUE },
  'ecmwf_aifs/wind_10m_above_ground': { style: WeatherLayers.GridStyle.WIND_BARB, iconBounds: [0, 100 * 0.51444] }, // 100 kts to m/s
  'ecmwf_aifs/wind_100m_above_ground': { style: WeatherLayers.GridStyle.WIND_BARB, iconBounds: [0, 100 * 0.51444] }, // 100 kts to m/s
  'ecmwf_aifs/temperature_2_m_above_ground': { style: WeatherLayers.GridStyle.VALUE },
};
// 粒子图层默认配置
const PARTICLE_LAYER_DATASET_CONFIG = {
  'gfs/wind_10_m_above_ground': { speedFactor: 10, width: 2 },
  'gfs/wind_100m_above_ground': { speedFactor: 3, width: 2 },
  'gfs/wind_tropopause': { speedFactor: 3, width: 2 },
  'gfs/wind_gust_surface': { speedFactor: 3, width: 2 },
  'gfswave/waves': { speedFactor: 2, width: 5 },
  'gfswave/swell': { speedFactor: 2, width: 5 },
  'gfswave/swell2': { speedFactor: 2, width: 5 },
  'gfswave/swell3': { speedFactor: 2, width: 5 },
  'ecmwf_ifs/wind_10m_above_ground': { speedFactor: 3, width: 2 },
  'ecmwf_ifs/wind_100m_above_ground': { speedFactor: 3, width: 2 },
  'ecmwf_ifs/wind_gust_surface': { speedFactor: 3, width: 2 },
  'ecmwf_aifs/wind_10m_above_ground': { speedFactor: 3, width: 2 },
  'ecmwf_aifs/wind_100m_above_ground': { speedFactor: 3, width: 2 },
};
// 顶部工具栏默认配置
const TOOLTIP_CONTROL_DATASET_CONFIG = {
  'gfs/wind_10m_above_ground': { directionType: WeatherLayers.DirectionType.INWARD },
  'gfs/wind_100m_above_ground': { directionType: WeatherLayers.DirectionType.INWARD },
  'gfs/wind_tropopause': { directionType: WeatherLayers.DirectionType.INWARD },
  'gfs/wind_gust_surface': { directionType: WeatherLayers.DirectionType.INWARD },
  'gfswave/waves': { directionType: WeatherLayers.DirectionType.INWARD },
  'gfswave/swell': { directionType: WeatherLayers.DirectionType.INWARD },
  'gfswave/swell2': { directionType: WeatherLayers.DirectionType.INWARD },
  'gfswave/swell3': { directionType: WeatherLayers.DirectionType.INWARD },
  'ecmwf_ifs/wind_10m_above_ground': { directionType: WeatherLayers.DirectionType.INWARD },
  'ecmwf_ifs/wind_100m_above_ground': { directionType: WeatherLayers.DirectionType.INWARD },
  'ecmwf_ifs/wind_gust_surface': { directionType: WeatherLayers.DirectionType.INWARD },
  'ecmwf_aifs/wind_10m_above_ground': { directionType: WeatherLayers.DirectionType.INWARD },
  'ecmwf_aifs/wind_100m_above_ground': { directionType: WeatherLayers.DirectionType.INWARD },
};


function beijingToUTC(dateStr) {
  // 解析日期（格式：YYYYMMDD）
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);

  // 创建北京时间（UTC+8）的 Date 对象
  const beijingDate = new Date(`${year}-${month}-${day}T06:00:00+08:00`);

  // 转换为 UTC 时间
  return {
    utcISOString: beijingDate.toISOString(),          // "2025-09-15T16:00:00.000Z"
    utcLocalString: beijingDate.toUTCString(),         // "Tue, 15 Sep 2025 16:00:00 GMT"
    utcComponents: {                                   // 获取 UTC 的各个部分
      year: beijingDate.getUTCFullYear(),
      month: beijingDate.getUTCMonth() + 1,
      day: beijingDate.getUTCDate(),
      hours: beijingDate.getUTCHours(),
    },
  };
}

//  ​​UTC 时间（协调世界时）
// const CURRENT_DATETIME = new Date().toISOString();
const CURRENT_DATETIME = beijingToUTC("20240916").utcISOString
// 北京时间（东八区）​
// const BEIJING_CURRENT_DATETIME = new Date(new Date().getTime() + 8 * 60 * 60 * 1000);
// const BEIJING_CURRENT_DATETIME = 
// console.log(beijingToUTC("20240916").utcISOString);
// console.log('当前UTC时间:', CURRENT_DATETIME);
// console.log('当前北京时间:', BEIJING_CURRENT_DATETIME);

export async function initConfig({ datasets, deckgl, webgl2, globe } = {}) {
  const urlConfig = new URLSearchParams(location.hash.substring(1));

  const config = {
    datasets: datasets ?? [],
    dataset: urlConfig.get('dataset') ?? DEFAULT_DATASET,
    datetimeRange: WeatherLayers.offsetDatetimeRange(CURRENT_DATETIME, 0, 30).join('/'),
    datetimeStep: 1,
    datetimes: [],
    datetime: NO_DATA,
    ...(deckgl ? {
      datetimeInterpolate: true,
    } : {}),

    imageSmoothing: 0,
    imageInterpolation: deckgl ? WeatherLayers.ImageInterpolation.CUBIC : WeatherLayers.ImageInterpolation.NEAREST,
    imageMinValue: 0, // dataset-specific
    imageMaxValue: 0, // dataset-specific
    unitSystem: WeatherLayers.UnitSystem.METRIC,

    ...(globe ? {
      rotate: false,
    } : {}),
    // 栅格图层
    raster: {
      bounds:[97.08571, 25.725649, 108.91841, 35.063576],
      visible: true,
      borderEnabled: false,
      borderWidth: 1,
      borderColor: colorToCss(WeatherLayers.DEFAULT_LINE_COLOR),
      gridEnabled: false,
      gridSize: 1,
      gridColor: colorToCss(WeatherLayers.DEFAULT_LINE_COLOR),
      opacity: 0.5,
      blendMode:"screen"
    },
     // 等值线图层
    contour: {
      visible: false,
      interval: 2, // dataset-specific
      majorInterval: 10, // dataset-specific
      width: WeatherLayers.DEFAULT_LINE_WIDTH,
      color: colorToCss(WeatherLayers.DEFAULT_LINE_COLOR),
      palette: false,
      // text config is used for labels in standalone demos
      textFontFamily: WeatherLayers.DEFAULT_TEXT_FONT_FAMILY,
      textSize: WeatherLayers.DEFAULT_TEXT_SIZE,
      textColor: colorToCss(WeatherLayers.DEFAULT_TEXT_COLOR),
      textOutlineWidth: WeatherLayers.DEFAULT_TEXT_OUTLINE_WIDTH,
      textOutlineColor: colorToCss(WeatherLayers.DEFAULT_TEXT_OUTLINE_COLOR),
      opacity: 0.2,
    },
    // 高低压符号图层
    highLow: {
      visible: false,
      radius: 2000, // dataset-specific
      textFontFamily: WeatherLayers.DEFAULT_TEXT_FONT_FAMILY,
      textSize: WeatherLayers.DEFAULT_TEXT_SIZE,
      textColor: colorToCss(WeatherLayers.DEFAULT_TEXT_COLOR),
      textOutlineWidth: WeatherLayers.DEFAULT_TEXT_OUTLINE_WIDTH,
      textOutlineColor: colorToCss(WeatherLayers.DEFAULT_TEXT_OUTLINE_COLOR),
      palette: false,
      opacity: 0.2,
    },
    // 网格图层（仅 deck.gl 支持）
    ...(deckgl ? {
      grid: {
        visible: false,
        style: WeatherLayers.GridStyle.VALUE, // dataset-specific
        density: 0,
        textFontFamily: WeatherLayers.DEFAULT_TEXT_FONT_FAMILY,
        textSize: WeatherLayers.DEFAULT_TEXT_SIZE,
        textColor: colorToCss(WeatherLayers.DEFAULT_TEXT_COLOR),
        textOutlineWidth: WeatherLayers.DEFAULT_TEXT_OUTLINE_WIDTH,
        textOutlineColor: colorToCss(WeatherLayers.DEFAULT_TEXT_OUTLINE_COLOR),
        iconBounds: null, // dataset-specific
        iconSize: WeatherLayers.DEFAULT_ICON_SIZE,
        iconColor: colorToCss(WeatherLayers.DEFAULT_ICON_COLOR),
        palette: false,
        opacity: 0.2,
      },
    } : {}),
    // 粒子图层（仅 WebGL2 支持）
    ...(webgl2 ? {
      particle: {
        visible: true,
        bounds:[97.08571, 25.725649, 108.91841, 35.063576],
        numParticles: 10000,
        maxAge: 15, // 最大寿命
        speedFactor: 10, // 速度因子
        width: 2, // 宽度
        color: colorToCss(WeatherLayers.DEFAULT_LINE_COLOR),
        palette: false,
        opacity: 0.3,
        animate: true,
      },
    } : {}),
    tooltip: {
      directionType: WeatherLayers.DirectionType.INWARD, // dataset-specific
      directionFormat: WeatherLayers.DirectionFormat.CARDINAL3,
      followCursorOffset: 16,
      followCursorPlacement: WeatherLayers.Placement.BOTTOM,
    },
  };

  loadUrlConfig(config, { deckgl, webgl2 });

  return config;
}

function getOptions(options) {
  return options.map(x => ({ value: x, text: `${x}` }));
}

function getDatetimeRangeOptions(options) {
  return options.map(x => ({ value: WeatherLayers.offsetDatetimeRange(CURRENT_DATETIME, 0, x * 24).join('/'), text: `${x} day${x > 1 ? 's' : ''}` }));
}

function getHourOptions(options) {
  return options.map(x => ({ value: x, text: `${x} hour${x > 1 ? 's' : ''}` }));
}

function getDatetimeOptions(datetimes) {
  return datetimes.map(x => ({ value: x, text: WeatherLayers.formatDatetime(x) }));
}

function loadUrlConfig(config, { deckgl, webgl2 } = {}) {
  const urlConfig = new URLSearchParams(location.hash.substring(1));

  config.raster.enabled = urlConfig.has('raster') ? urlConfig.get('raster') === 'true' : true;

  config.contour.enabled = urlConfig.has('contour') ? urlConfig.get('contour') === 'true' : !!CONTOUR_LAYER_DATASET_CONFIG[config.dataset];
  config.contour.interval = CONTOUR_LAYER_DATASET_CONFIG[config.dataset]?.interval || 2;
  config.contour.majorInterval = CONTOUR_LAYER_DATASET_CONFIG[config.dataset]?.majorInterval || 10;

  config.highLow.enabled = urlConfig.has('highLow') ? urlConfig.get('highLow') === 'true' : !!HIGH_LOW_LAYER_DATASET_CONFIG[config.dataset];
  config.highLow.radius = HIGH_LOW_LAYER_DATASET_CONFIG[config.dataset]?.radius || 2000;

  if (deckgl) {
    config.grid.enabled = urlConfig.has('grid') ? urlConfig.get('grid') === 'true' : !!GRID_LAYER_DATASET_CONFIG[config.dataset];
    config.grid.style = GRID_LAYER_DATASET_CONFIG[config.dataset]?.style || WeatherLayers.GridStyle.VALUE;
    config.grid.iconBounds = GRID_LAYER_DATASET_CONFIG[config.dataset]?.iconBounds || null;
  }

  if (webgl2) {
    config.particle.enabled = urlConfig.has('particle') ? urlConfig.get('particle') === 'true' : !!PARTICLE_LAYER_DATASET_CONFIG[config.dataset];
    config.particle.speedFactor = PARTICLE_LAYER_DATASET_CONFIG[config.dataset]?.speedFactor || 0;
    config.particle.width = PARTICLE_LAYER_DATASET_CONFIG[config.dataset]?.width || 0;
  }

  config.tooltip.directionType = TOOLTIP_CONTROL_DATASET_CONFIG[config.dataset]?.directionType || WeatherLayers.DirectionType.INWARD;
}

function updateUrlConfig(config, { deckgl, webgl2 } = {}) {
  const urlConfig = new URLSearchParams();
  if (config.dataset !== DEFAULT_DATASET) {
    urlConfig.set('dataset', config.dataset);
  }
  if (config.raster.enabled !== true) {
    urlConfig.set('raster', config.raster.enabled);
  }
  if (config.contour.enabled !== !!CONTOUR_LAYER_DATASET_CONFIG[config.dataset]) {
    urlConfig.set('contour', config.contour.enabled);
  }
  if (config.highLow.enabled !== !!HIGH_LOW_LAYER_DATASET_CONFIG[config.dataset]) {
    urlConfig.set('highLow', config.highLow.enabled);
  }
  if (deckgl) {
    if (config.grid.enabled !== !!GRID_LAYER_DATASET_CONFIG[config.dataset]) {
      urlConfig.set('grid', config.grid.enabled);
    }
  }
  if (webgl2) {
    if (config.particle.enabled !== !!PARTICLE_LAYER_DATASET_CONFIG[config.dataset]) {
      urlConfig.set('particle', config.particle.enabled);
    }
  }
  window.history.replaceState(null, null, '#' + urlConfig.toString());
}

function debounce(callback, wait) {
  let timeoutId = null;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      callback.apply(null, args);
    }, wait);
  };
}

// 初始化快捷配置界面
export function initGui(config, update, { deckgl, webgl2, globe } = {}) {
  const originalUpdate = update;
  update = debounce(() => { updateUrlConfig(config, { deckgl, webgl2 }); originalUpdate() }, 100);
  const updateLast = event => event.last && update();

  const gui = new Pane();

  let datetime;
  const updateDatetimes = async () => {
    // force update dataset
    await originalUpdate(true);
    loadUrlConfig(config, { deckgl, webgl2 });
    updateUrlConfig(config, { deckgl, webgl2 });

    // update datetimes
    datetime.dispose();
    datetime = gui.addBinding(config, 'datetime', { options: getDatetimeOptions([NO_DATA, ...config.datetimes]), index: 3 }).on('change', update);
    gui.refresh();

    // force update datetime
    originalUpdate(true);
  };

  gui.addBinding(config, 'dataset', { label:i18n['dataset'],options: getOptions([NO_DATA, ...config.datasets]) }).on('change', updateDatetimes);
  gui.addBinding(config, 'datetimeRange', { label:i18n['datetimeRange'],options: getDatetimeRangeOptions([1, 2, 5, 10, 16]) }).on('change', updateDatetimes);
  gui.addBinding(config, 'datetimeStep', { label:i18n['datetimeStep'],options: getHourOptions([1, 3, 6, 12, 24]) }).on('change', updateDatetimes);
  datetime = gui.addBinding(config, 'datetime', {label:i18n['datetime'], options: getDatetimeOptions([NO_DATA, ...config.datetimes]) }).on('change', update);
  if (deckgl) {
    gui.addBinding(config, 'datetimeInterpolate',{label:i18n['datetimeInterpolate'],}).on('change', update);
  }

  gui.addBinding(config, 'imageSmoothing', {label:i18n['imageSmoothing'], min: 0, max: 10, step: 1 }).on('change', update);
  gui.addBinding(config, 'imageInterpolation', {label:i18n['imageInterpolation'], options: getOptions(Object.values(WeatherLayers.ImageInterpolation)) }).on('change', update);
  gui.addBinding(config, 'imageMinValue', {label:i18n['imageMinValue'], min: 0, max: 1100, step: 0.1 }).on('change', update);
  gui.addBinding(config, 'imageMaxValue', {label:i18n['imageMaxValue'], min: 0, max: 1100, step: 0.1 }).on('change', update);
  gui.addBinding(config, 'unitSystem', {label:i18n['unitSystem'], options: getOptions(Object.values(WeatherLayers.UnitSystem)) }).on('change', update);

  if (globe) {
    gui.addBinding(config, 'rotate',{label:i18n['rotate'], }).on('change', update);
  }

  gui.addButton({ title: i18n['Demo'] }).on('click', () => location.href = 'https://weatherlayers.com/demo.html');
  gui.addButton({ title: i18n['Integrations'] }).on('click', () => location.href = 'https://weatherlayers.com/integrations.html');
  gui.addButton({ title: i18n['Docs'] }).on('click', () => location.href = 'https://docs.weatherlayers.com/');

  const raster = gui.addFolder({ title: i18n['Raster layer'], expanded: true });
  raster.addBinding(config.raster,'enabled',{ label:i18n['enabled']}).on('change', update);
  raster.addBinding(config.raster, 'borderEnabled',{label:i18n['borderEnabled']}).on('change', update);
  raster.addBinding(config.raster, 'borderWidth', {label:i18n['borderWidth'], min: 0.5, max: 10, step: 0.5 }).on('change', update);
  raster.addBinding(config.raster, 'borderColor',{label:i18n['borderColor']}).on('change', update);
  raster.addBinding(config.raster, 'gridEnabled',{label:i18n['gridEnabled']}).on('change', update);
  raster.addBinding(config.raster, 'gridSize', {label:i18n['gridSize'], min: 0.5, max: 10, step: 0.5 }).on('change', update);
  raster.addBinding(config.raster, 'gridColor',{label:i18n['gridColor']}).on('change', update);
  raster.addBinding(config.raster, 'opacity', {label:i18n['opacity'], min: 0, max: 1, step: 0.01 }).on('change', update);

  const contour = gui.addFolder({ title: i18n['Contour layer'], expanded: true });
  contour.addBinding(config.contour,"enabled",{label:i18n['enabled']}).on('change', update);
  contour.addBinding(config.contour, 'interval', {label:i18n['interval'], min: 0, max: 1000, step: 1 }).on('change', update);
  contour.addBinding(config.contour, 'majorInterval', {label:i18n['majorInterval'], min: 0, max: 1000, step: 1 }).on('change', update);
  contour.addBinding(config.contour, 'width', {label:i18n['width'], min: 0.5, max: 10, step: 0.5 }).on('change', update);
  contour.addBinding(config.contour, 'color',{label:i18n['color'],}).on('change', update);
  contour.addBinding(config.contour, 'palette',{label:i18n['palette'],}).on('change', update);
  contour.addBinding(config.contour, 'opacity', {label:i18n['opacity'], min: 0, max: 1, step: 0.01 }).on('change', update);

  const highLow = gui.addFolder({ title: i18n['HighLow layer'], expanded: true });
  highLow.addBinding(config.highLow,"enabled",{label:i18n['enabled']}).on('change', update);
  highLow.addBinding(config.highLow, 'radius', {label:i18n['radius'], min: 0, max: 5 * 1000, step: 1 }).on('change', updateLast);
  highLow.addBinding(config.highLow, 'textSize', {label:i18n['textSize'], min: 1, max: 20, step: 1 }).on('change', update);
  highLow.addBinding(config.highLow, 'textColor',{label:i18n['textColor'],}).on('change', update);
  highLow.addBinding(config.highLow, 'textOutlineWidth', {label:i18n['textOutlineWidth'], min: 0, max: 1, step: 0.1 }).on('change', update);
  highLow.addBinding(config.highLow, 'textOutlineColor',{label:i18n['textOutlineColor'],}).on('change', update);
  highLow.addBinding(config.highLow, 'palette',{label:i18n['palette'],}).on('change', update);
  highLow.addBinding(config.highLow, 'opacity', {label:i18n['opacity'], min: 0, max: 1, step: 0.01 }).on('change', update);

  if (deckgl) {
    const grid = gui.addFolder({ title: i18n['Grid layer'], expanded: true });
    grid.addBinding(config.grid,"enabled",{label:i18n['enabled']}).on('change', update);
    grid.addBinding(config.grid, 'style', {label:i18n['style'], options: getOptions(Object.values(WeatherLayers.GridStyle)) }).on('change', update);
    grid.addBinding(config.grid, 'density', {label:i18n['density'], min: -2, max: 2, step: 1 }).on('change', update);
    grid.addBinding(config.grid, 'textSize', {label:i18n['textSize'], min: 1, max: 20, step: 1 }).on('change', update);
    grid.addBinding(config.grid, 'textColor',{label:i18n['textColor']}).on('change', update);
    grid.addBinding(config.grid, 'textOutlineWidth', {label:i18n['textOutlineWidth'], min: 0, max: 1, step: 0.1 }).on('change', update);
    grid.addBinding(config.grid, 'textOutlineColor',{label:i18n['textOutlineColor']}).on('change', update);
    grid.addBinding(config.grid, 'iconSize', {label:i18n['iconSize'], min: 0, max: 100, step: 1 }).on('change', update);
    grid.addBinding(config.grid, 'iconColor',{label:i18n['iconColor']}).on('change', update);
    grid.addBinding(config.grid, 'palette',{label:i18n['palette']}).on('change', update);
    grid.addBinding(config.grid, 'opacity', {label:i18n['opacity'], min: 0, max: 1, step: 0.01 }).on('change', update);
  }

  if (webgl2) {
    const particle = gui.addFolder({ title: 'Particle layer', expanded: true });
    particle.addBinding(config.particle,"enabled",{label:i18n['enabled']}).on('change', update);
    particle.addBinding(config.particle, 'numParticles', {label:i18n['numParticles'], min: 0, max: 100000, step: 1 }).on('change', updateLast);
    particle.addBinding(config.particle, 'maxAge', {label:i18n['maxAge'], min: 0, max: 255, step: 1 }).on('change', updateLast);
    particle.addBinding(config.particle, 'speedFactor', {label:i18n['speedFactor'], min: 0, max: 50, step: 0.1 }).on('change', update);
    particle.addBinding(config.particle, 'color',{label:i18n['color']}).on('change', update);
    particle.addBinding(config.particle, 'palette',{label:i18n['palette']}).on('change', update);
    particle.addBinding(config.particle, 'width', {label:i18n['width'], min: 0.5, max: 10, step: 0.5 }).on('change', update);
    particle.addBinding(config.particle, 'opacity', {label:i18n['opacity'], min: 0, max: 1, step: 0.01 }).on('change', update);
    particle.addBinding(config.particle, 'animate',{label:i18n['animate']}).on('change', update);
    particle.addButton({ title: i18n['Step'] }).on('click', () => deckgl.layerManager.getLayers({ layerIds: ['particle-line'] })[0]?.step());
    particle.addButton({ title: i18n['Clear'] }).on('click', () => deckgl.layerManager.getLayers({ layerIds: ['particle-line'] })[0]?.clear());
  }

  const tooltip = gui.addFolder({ title: i18n['Tooltip control'], expanded: true });
  tooltip.addBinding(config.tooltip, 'directionType', {label:i18n['directionType'], options: getOptions(Object.values(WeatherLayers.DirectionType)) }).on('change', update);
  tooltip.addBinding(config.tooltip, 'directionFormat', {label:i18n['directionFormat'], options: getOptions(Object.values(WeatherLayers.DirectionFormat)) }).on('change', update);
  tooltip.addBinding(config.tooltip, 'followCursorOffset', {label:i18n['followCursorOffset'], min: 0, max: 50, step: 1 }).on('change', update);
  tooltip.addBinding(config.tooltip, 'followCursorPlacement', {label:i18n['followCursorPlacement'], options: getOptions(Object.values(WeatherLayers.Placement)) }).on('change', update);

  return gui;
}

function componentToHex(value) {
  return value.toString(16).padStart(2, '0');
}

function colorToCss(color) {
  return `#${componentToHex(color[0])}${componentToHex(color[1])}${componentToHex(color[2])}${componentToHex(typeof color[3] === 'number' ? color[3] : 255)}`;
}

export function cssToColor(color) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
  if (!result) {
    throw new Error('Invalid argument');
  }
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
    parseInt(result[4], 16)
   ];
}

export function cssToRgba(color) {
  const rgba = cssToColor(color);
  return `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${rgba[3] / 255})`;
}

export function waitForDeck(getDeck) {
  return new Promise(resolve => {
    function wait() {
      const deck = getDeck();
      if (deck && deck.getCanvas()) {
        resolve(deck);
      } else {
        setTimeout(wait, 100);
      }
    }
    wait();
  });
}

export function isMetalWebGl2() {
  // iOS 15+
  return navigator.maxTouchPoints && navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome');
}