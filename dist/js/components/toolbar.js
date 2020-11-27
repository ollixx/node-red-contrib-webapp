Vue.component('GuiToolbar', {
  mixins: [GuiMixin],
  template:
    `
<md-app-toolbar :class="classes" :id="model.nodeid">
  <span class="md-title">{{ model.payload }}</span>
</md-app-toolbar>
`
});
