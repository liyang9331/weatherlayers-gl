const { defineConfig } = require("@vue/cli-service");
module.exports = defineConfig({
  transpileDependencies: true,
  lintOnSave: false,
  devServer: {
    // host: '0.0.0.0',
    port: 3000,
    // open: true,
    proxy: {
      // "/catalog": {
      //   target: "http://localhost:9090",
      //   changeOrigin: true,
      //   logLevel: "debug", // 启用日志
      // },
      // "/palette": {
      //   target: "http://localhost:9090",
      //   changeOrigin: true,
      //   logLevel: "debug", // 启用日志
      // },
    },
  },
});
