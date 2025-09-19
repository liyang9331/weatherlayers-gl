<template>
  <!-- 模板：定义组件的 HTML 结构 -->
  <div class="leaflet">
    <div id="container">
      <div id="leaflet"></div>
    </div>
    <div id="top-left"></div>
    <div id="bottom-left"></div>
    <div id="bottom-right"></div>
  </div>

</template>
<script>
import { WEATHER_LAYERS_ACCESS_TOKEN } from '../libs/auth.js';
import { NO_DATA, initConfig, initGui, cssToColor, waitForDeck, isMetalWebGl2 } from '../libs/config.js';
import { BASEMAP_RASTER_STYLE_URL, BASEMAP_ATTRIBUTION,BASE_LAYERS } from '../libs/basemap.js';
import { InfoControl } from '../libs/info-control.js';
import { FpsControl } from '../libs/fps-control.js';
import datasets from "../assets/datasets.json";

// import * as WeatherLayersClient from "../libs/weatherlayers-client.js"
// import * as WeatherLayers from "../libs/weatherlayers-deck.js"
export default {
  // 组件的名称
  name: 'Leaflet',
  // 注册局部组件
  components: {},
  // 使用混入
  mixins: [],
  // props：从父组件接收的数据
  props: {},
  // 计算属性
  computed: {},
  // data：定义组件内部的响应式数据
  data() {
    return {};
  },
  // watch：用于监听数据的变化
  watch: {
    // 监听 xx 的变化
  },
  // 生命周期钩子：组件创建时调用
  created() {
    // 数据观测和事件/侦听器已经设置完成。此时可以访问 data 和 methods，但 DOM 尚未被挂载。
  },
  // 生命周期钩子：组件挂载到DOM后调用
  async mounted() {
    // 此时可以访问组件的 DOM 元素。
    this.init();
  },
  // 生命周期钩子：当数据变化导致组件重新渲染之前调用
  beforeUpdate() { },
  // 生命周期钩子：数据更新时调用
  updated() { },
  // 生命周期钩子：组件实例销毁之前调用
  beforeDestroy() {
    // 可以在此钩子中执行清理操作，如移除定时器或取消事件监听。
  },
  // 生命周期钩子：组件实例被销毁之后调用
  destroyed() {
    // 此时所有的事件监听器和子组件也已经销毁。
  },
  // methods：定义组件内部的方法
  methods: {
    async init() {
      const client = window.client = new WeatherLayersClient.Client({
        accessToken: WEATHER_LAYERS_ACCESS_TOKEN,
        datetimeInterpolate: true,
        dataFormat: "byte.png",
        url: "http://localhost:9090" // 离线服务地址

      });
      WeatherLayersClient.setLibrary('geotiff', GeoTIFF);

      // const datasets = datasets;
      const config = await initConfig({ datasets, deckgl: true, webgl2: true });
      let gui;

      // Leaflet
      const map = L.map('leaflet', {
        zoom: 5,
        zoomControl: false,
        attributionControl: false,
        center:[28.504678,103.898864],
        preferCanvas: true,  // 防止WebGL与Canvas冲突
        renderer: L.canvas({ padding: 0.5 }) // 优化渲染边界
      })
      // L.tileLayer(BASEMAP_RASTER_STYLE_URL, { maxZoom: 22 }).addTo(map);

      BASE_LAYERS["天地图影像"].addTo(map)

      // overlaid deck.gl
      const deckLayer = new DeckGlLeaflet.LeafletLayer({
        views: [
          new deck.MapView({ repeat: true }),
        ],
        layers: [],
      });
      map.addLayer(deckLayer);
      const deckgl = window.deckgl = await waitForDeck(() => deckLayer._deck);

      // info panels
      const infoControl = new InfoControl();
      infoControl.prependTo(document.getElementById('top-left'));
      deckgl.setProps({
        onViewStateChange: ({ viewState }) => infoControl.update(viewState),
      });

      // logo
      // const logoControl = new WeatherLayers.LogoControl();
      // logoControl.prependTo(document.getElementById('bottom-left'));

      // legend-图例
      const legendControl = new WeatherLayers.LegendControl();
      legendControl.prependTo(document.getElementById('bottom-left'));

      // timeline-时间轴
      const timelineControl = new WeatherLayers.TimelineControl({
        fps: 1,
        // 当时间轴需要预加载数据时（如用户拖动时间轴或播放动画）
        onPreload: datetimes => datetimes.map(datetime => client.loadDatasetData(config.dataset, datetime)),
        // 时间轴当前时间变化时（如用户点击某个时间点）
        onUpdate: datetime => {
          console.log("onUpdate datetime:", datetime);
          // config.datetime = datetime || NO_DATA;
          // update();
        },
      });
      timelineControl.prependTo(document.getElementById('bottom-left'));

      // tooltip
      const tooltipControl = new WeatherLayers.TooltipControl({ followCursor: true });
      deckgl.setProps({
        onLoad: () => deckgl.getCanvas() && tooltipControl.addTo(deckgl.getCanvas().parentElement),
        onHover: event => tooltipControl.updatePickingInfo(event),
      });
      deckgl.props.onLoad();

      // attribution
      const basemapAttributionControl = new WeatherLayers.AttributionControl({ attribution: BASEMAP_ATTRIBUTION });
      basemapAttributionControl.prependTo(document.getElementById('bottom-right'));
      const attributionControl = new WeatherLayers.AttributionControl();
      attributionControl.prependTo(document.getElementById('bottom-right'));

      // FPS meter
      const fpsControl = new FpsControl();
      fpsControl.prependTo(document.getElementById('bottom-right'));

      // config
      async function update(forceUpdateDatetime) {
        // 气象数据项名称，例如： "gfs/wind_10_m_above_ground"
        const dataset = config.dataset !== NO_DATA ? config.dataset : undefined;
        // unitSystem-单位制： METRIC（国际单位制）、 IMPERIAL（英制）、 NAUTICAL（航海单位制​​）、 METRIC_KILOMETERS（公里单位制​​）
        // console.log("unitSystem:", config.unitSystem);
        const { title, unitFormat, attribution, bounds, palette } = await client.loadDataset(dataset, { unitSystem: config.unitSystem });
        const { datetimes } = await client.loadDatasetSlice(dataset, config.datetimeRange.split('/'), { datetimeStep: config.datetimeStep });
        const datetime = config.datetime !== NO_DATA && datetimes[0] <= config.datetime && config.datetime <= datetimes[datetimes.length - 1] && !forceUpdateDatetime ? config.datetime : datetimes[0];
        const { image, image2, imageWeight, imageType, imageUnscale } = await client.loadDatasetData(dataset, datetime, { datetimeInterpolate: config.datetimeInterpolate });

        console.log(`[${dayjs().format('HH:mm:ss')}] title:`, title);
        console.log(`[${dayjs().format('HH:mm:ss')}] unitFormat:`, unitFormat);
        console.log(`[${dayjs().format('HH:mm:ss')}] attribution:`, attribution);
        console.log(`[${dayjs().format('HH:mm:ss')}] bounds:`, bounds);
        console.log(`[${dayjs().format('HH:mm:ss')}] palette:`, palette);

        console.log(image2,image)

        config.datetimes = datetimes;
        config.datetime = datetime;


        deckLayer.setProps({
          layers: [
            // 栅格图层
            new WeatherLayers.RasterLayer({
              id: 'raster',
              // data properties
              image,
              imageSmoothing: config.imageSmoothing,
              imageInterpolation: config.imageInterpolation,
              imageWeight,
              imageType,
              imageUnscale,
              imageMinValue: config.imageMinValue > 0 ? config.imageMinValue : null,
              imageMaxValue: config.imageMaxValue > 0 ? config.imageMaxValue : null,
              bounds:config.raster.bounds || bounds,
              // style properties
              visible: config.raster.visible,
              palette,
              blendMode: config.raster.blendMode,
              borderEnabled: config.raster.borderEnabled,
              borderWidth: config.raster.borderWidth,
              borderColor: cssToColor(config.raster.borderColor),
              gridEnabled: config.raster.gridEnabled,
              gridSize: config.raster.gridSize,
              gridColor: cssToColor(config.raster.gridColor),
              opacity: config.raster.opacity,
              pickable: !isMetalWebGl2(),
              extensions: [new deck.ClipExtension()],
              clipBounds: [-181, -85.051129, 181, 85.051129],
            }),
            // 等值线图层
            new WeatherLayers.ContourLayer({
              id: 'contour',
              // data properties
              image,
              imageSmoothing: config.imageSmoothing,
              imageInterpolation: config.imageInterpolation,
              imageWeight,
              imageType,
              imageUnscale,
              imageMinValue: config.imageMinValue > 0 ? config.imageMinValue : null,
              imageMaxValue: config.imageMaxValue > 0 ? config.imageMaxValue : null,
              bounds,
              // style properties
              visible: config.contour.visible,
              interval: config.contour.interval,
              majorInterval: config.contour.majorInterval,
              width: config.contour.width,
              color: cssToColor(config.contour.color),
              palette: config.contour.palette ? palette : null,
              opacity: config.contour.opacity,
              extensions: [new deck.ClipExtension()],
              clipBounds: [-181, -85.051129, 181, 85.051129],
            }),
            // 高低点图层
            new WeatherLayers.HighLowLayer({
              id: 'highLow',
              // data properties
              image,
              imageSmoothing: config.imageSmoothing,
              imageInterpolation: config.imageInterpolation,
              imageWeight,
              imageType,
              imageUnscale,
              imageMinValue: config.imageMinValue > 0 ? config.imageMinValue : null,
              imageMaxValue: config.imageMaxValue > 0 ? config.imageMaxValue : null,
              bounds,
              // style properties
              visible: config.highLow.visible && !timelineControl.running,
              unitFormat,
              radius: config.highLow.radius,
              textSize: config.highLow.textSize,
              textColor: cssToColor(config.highLow.textColor),
              textOutlineColor: cssToColor(config.highLow.textOutlineColor),
              textOutlineWidth: config.highLow.textOutlineWidth,
              palette: config.highLow.palette ? palette : null,
              opacity: config.highLow.opacity,
            }),
            // 网格图层
            new WeatherLayers.GridLayer({
              id: 'grid',
              // data properties
              image,
              imageSmoothing: config.imageSmoothing,
              imageInterpolation: config.imageInterpolation,
              imageWeight,
              imageType,
              imageUnscale,
              imageMinValue: config.imageMinValue > 0 ? config.imageMinValue : null,
              imageMaxValue: config.imageMaxValue > 0 ? config.imageMaxValue : null,
              bounds,
              // style properties
              visible: config.grid.visible,
              style: config.grid.style,
              density: config.grid.density,
              unitFormat,
              textSize: config.grid.textSize,
              textColor: cssToColor(config.grid.textColor),
              textOutlineWidth: config.grid.textOutlineWidth,
              textOutlineColor: cssToColor(config.grid.textOutlineColor),
              iconBounds: config.grid.iconBounds,
              iconSize: config.grid.style === WeatherLayers.GridStyle.ARROW ? [config.grid.iconSize / 8, config.grid.iconSize] : config.grid.iconSize,
              iconColor: cssToColor(config.grid.iconColor),
              palette: config.grid.palette ? palette : null,
              opacity: config.grid.opacity,
            }),
            // 粒子图层
            new WeatherLayers.ParticleLayer({
              id: 'particle',
              // data properties
              image,
              imageSmoothing: config.imageSmoothing,
              imageInterpolation: config.imageInterpolation,
              imageWeight,
              imageType,
              imageUnscale,
              imageMinValue: config.imageMinValue > 0 ? config.imageMinValue : null,
              imageMaxValue: config.imageMaxValue > 0 ? config.imageMaxValue : null,
              bounds:config.raster.bounds || bounds,
              // style properties
              visible: config.particle.visible,
              numParticles: config.particle.numParticles,
              maxAge: config.particle.maxAge,
              speedFactor: config.particle.speedFactor,
              width: config.particle.width,
              color: cssToColor(config.particle.color),
              palette: config.particle.palette ? palette : null,
              opacity: config.particle.opacity,
              animate: config.particle.animate,
              extensions: [new deck.ClipExtension()],
              clipBounds: [-181, -85.051129, 181, 85.051129],
              getPolygonOffset: () => [0, -1000],
            }),
          ],
        });

        legendControl.updateConfig({ title, unitFormat, palette });
        timelineControl.updateConfig({ datetimes, datetime, datetimeInterpolate: config.datetimeInterpolate });
        tooltipControl.updateConfig({
          unitFormat,
          directionType: config.tooltip.directionType,
          directionFormat: config.tooltip.directionFormat,
          followCursorOffset: config.tooltip.followCursorOffset,
          followCursorPlacement: config.tooltip.followCursorPlacement,
        });
        attributionControl.updateConfig({ attribution });

      }
      await update();

      // 初始化快捷配置面板
      gui = initGui(config, update, { deckgl, webgl2: true });
    }
  },
}
</script>
<style lang=scss scoped>
/* 样式：使用 scoped 确保样式只作用于当前组件 */
</style>