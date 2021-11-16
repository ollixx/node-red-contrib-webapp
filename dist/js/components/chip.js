Vue.component('GuiChip', {
  mixins: [GuiMixin],
  computed: {
    payload: function () {
      return this.resolve("payload", this);
    }
  },
  template:
    `
<md-chip :id="id" :class="classes" :md-deletable="model.deletable" :md-clickable="model.clickable" :md-disabled="model.disabled">
  {{payload}}
</md-avatar>
`
});
