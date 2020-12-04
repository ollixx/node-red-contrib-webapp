Vue.component('GuiIcon', {
  mixins: [GuiMixin],
  computed: {
    payload: function() {
      return this.resolve("payload", this);
    }
  },
  template:
    `
<md-icon :class="classes">{{ payload }}</md-icon>
`
});
