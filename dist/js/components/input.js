Vue.component('GuiInput', {
  mixins: [GuiMixin],
  mounted() {
    //console.log("parentContext", this.model.type, this.model.nodeid, this.parentContext);
  },
  computed: {
    inputLabel: function () {
      return this.resolve("inputLabel", this);
    },
    value: function () {
      return this.resolve("value", this);
    },
    binding: function () {
      return {
        mod: this.model,
        par: this.parentContext,
        pay: this.payload
      }
    }
  },
  methods: {
    checkEnter(event) {
      if (event.key == "Enter") {
        console.log("on enter", this.model.nodeid, "value", this.value, "this", this);
        this.sendMessage({
          command: "Enter",
          nodeid: this.model.nodeid,
          payload: this.value
        });
      }
    }
  },
  template:
    `
<md-field 
    :md-inline="model.inline" 
    :id="id"
    :md-clearable="model.clearable" 
    :class="model.error ? 'md-invalid' : ''" 
    :md-toggle-password="model.togglePassword"
>
  <label>{{model.inputLabel}}</label>
  <md-input v-if="model.inputType != 'textarea'"    
    :id="id" 
    v-model="binding[model.$value][model.value]"
    :placeholder="model.placeholder" 
    :type="model.inputType"  
    :disabled="model.disabled"
    :md-counter="model.counter"
    :maxLength="model.maxLength"
    @keyup.enter.native="checkEnter"
    ></md-input>
  <md-textarea v-if="model.inputType == 'textarea'" 
    :id="id"
    v-model="binding[model.$value][model.value]"
    :md-autogrow="model.autogrow" 
    :disabled="model.disabled"
    :md-counter="model.counter"
    :maxLength="model.maxLength"
    ></md-textarea>
  <span v-if="model.helperText" class="md-helper-text">{{model.helperText}}</span>
  <span v-if="model.error" class="md-error">{{model.error}}</span>
</md-field>
`
});
