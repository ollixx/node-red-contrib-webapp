Vue.component('GuiSelect', {
  mixins: [GuiMixin],
  computed: {
    payload: function() {
      return this.resolve("payload", this);
    },
    label: function() {
      return this.resolve("label", this);
    },
    options: function() {
      return this.resolve("options", this);
    },
    binding: function() {
      return {
        mod: this.model,
        par: this.parentContext,
        pay: this.payload
      }
    }
  },
  mounted() {
    console.log("parentContext", this.model.type, this.model.nodeid, this.parentContext);
  },
  template:
`
<md-field>
  <label :for="model.nodeid">{{label}}</label>
  <md-select v-model="binding[model.$payload][model.payload]" :id="model.nodeid" :md-dense="model.dense" :multiple="model.multiple">
    <md-option :value="option.value" v-for="option in options" :disabled="option.disabled">{{option.label}}</md-option>
  </md-select>
</md-field>
`
});
