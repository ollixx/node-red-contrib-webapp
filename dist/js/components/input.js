Vue.component('GuiInput', {
  mixins: [GuiMixin],
  template:
`
<md-field 
    :md-inline="model.inline" 
    :id="model.nodeid" 
    :md-clearable="model.clearable" 
    :class="model.error ? 'md-invalid' : ''" 
    :md-toggle-password="model.togglePassword"
>
  <label>{{model.inputLabel}}</label>
  <md-input v-if="model.inputType != 'textarea'"    
    :id="model.id" 
    v-model="model.value"
    :placeholder="model.placeholder" 
    :type="model.inputType"  
    :disabled="model.disabled"
    :md-counter="model.counter"
    :maxLength="model.maxLength"
    ></md-input>
  <md-textarea v-if="model.inputType == 'textarea'" 
    :id="model.id" 
    v-model="model.value" 
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
