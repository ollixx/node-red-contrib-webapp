Vue.component('GuiIcon', {
  mixins: [GuiMixin],
  template:
    `
<md-icon :class="classes">{{ payload }}</md-icon>
`
});
