Vue.component('GuiDebug', {
  mixins: [GuiMixin],
  data: function() {
    return {
      visible: false
    }
  },
  template:
`
<div>
  <md-switch v-model="visible">Model</md-switch>
  <pre v-if="visible">{{getModel()}}</pre>
</div>
`
});
