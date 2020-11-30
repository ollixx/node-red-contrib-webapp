Vue.component('GuiToolbar', {
  mixins: [GuiMixin],
  template:
    `
<md-toolbar :class="classes" :id="model.nodeid">
  <span class="md-title">{{ model.payload }}</span>
</md-toolbar>
`
});
