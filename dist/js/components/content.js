Vue.component('GuiContent', {
  mixins: [GuiMixin],
  props: ["overload"],
  computed: {
    payload: function() {
      console.log("content", this.overload, this.model.payload)
      if (this.overload) {
        return this.overload
      } else {
        return this.model.payload;
      }
    }
  },
  template:
`
<md-content :id="model.nodeid" :class="classes" :disabled="model.disabled" :md-ripple="model.ripple">{{ payload }}</md-content>
`
});
