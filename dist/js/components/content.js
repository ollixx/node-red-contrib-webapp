Vue.component('GuiContent', {
  mixins: [GuiMixin],
  props: ["overload"],
  computed: {
    payload: function() {
      return this.resolve("payload", this);
    }
  },
  template:
`
<md-content :id="model.nodeid" :class="classes" :disabled="model.disabled" :md-ripple="model.ripple">{{ payload }}</md-content>
`
});
