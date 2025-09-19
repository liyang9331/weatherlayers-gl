<template>
  <div class="relative w-full h-full">
    <!-- <LeafletCloud /> -->
    <leafletOffline />
  </div>
</template>

<script>
import LeafletCloud from './components/leaflet-cloud.vue';
import leafletOffline from './components/leaflet-offline.vue';
export default {
  name: 'App',

  components: {
    LeafletCloud,
    leafletOffline
  },

  data() {
    return {
    };
  }
};
</script>

<style scoped>
.relative {
  position: relative;
}

.w-full {
  width: 100%;
}

.h-full {
  height: 100%;
}
</style>