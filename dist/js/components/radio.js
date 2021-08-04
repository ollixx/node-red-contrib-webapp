Vue.component('GuiRadio', {
  mixins: [GuiMixin],
  computed: {
    payload: function() {
      return this.resolve("payload", this);
    },
    value: function() {
      return this.resolve("value", this);
    },
    label: function() {
      return this.resolve("label", this);
    },
    binding: function() {
      return {
        mod: this.model,
        par: this.parentContext,
        pay: this.payload
      }
    }
  },
  template:
`
<md-radio v-model="binding[model.$payload][model.payload]" :value="value" :class="classes">{{label}}</md-radio>
`
});