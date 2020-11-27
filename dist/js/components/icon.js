Vue.component('GuiIcon', {
  mixins: [GuiMixin],
  template:
    `
<md-icon>{{ model.payload }}</md-icon>
`
});
