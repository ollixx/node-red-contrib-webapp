Vue.component('GuiHtml', {
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
<div v-html="payload" :id="model.nodeid" :class="classes"></div>
`
});
