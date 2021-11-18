Vue.component('GuiSelect', {
  mixins: [GuiMixin],
  computed: {
    payload: function () {
      return this.resolve("payload", this);
    },
    label: function () {
      return this.resolve("label", this);
    },
    options: function () {
      return this.resolve("options", this);
    },
    binding: function () {
      return {
        mod: this.model,
        par: this.parentContext,
        pay: this.payload
      }
    },
    current: function () {
      let cur = this.binding[this.model.$payload][this.model.payload];
      return cur;
    }
  },
  mounted() {
    // console.log("parentContext", this.model.type, this.model.nodeid, this.parentContext);
  },
  watch: {
    "current": function (newValue, oldValue) {
      if (newValue != oldValue && oldValue !== undefined) {
        console.log("changed from", oldValue, "to", newValue)
        this.sendMessage({
          command: "Change",
          nodeid: this.model.nodeid,
          payload: {
            option: Array.isArray(this.options) ? this.options.find(option => option.value == this.current) : undefined
          }
        });
      }
    }
  },
  template:
    `
<md-field>
  <label :for="id">{{label}}</label>
  <md-select v-model="binding[model.$payload][model.payload]" :id="id" :md-dense="model.dense" :multiple="model.multiple">
      <md-option v-for="option in options" :key="option.value" v-if="!option.htmlLabel" :value="option.value" :id="option.value" :disabled="option.disabled"> {{option.label}} </md-option>
  </md-select>
</md-field>
`
});
