Vue.component('GuiToolbar', {
  mixins: [GuiMixin],
  template:
    `
<md-toolbar :id="id" :class="classes">
  <span class="md-title">{{ model.payload }}</span>
</md-toolbar>
`
});
