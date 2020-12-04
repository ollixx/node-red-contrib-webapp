Vue.component('GuiHtml', {
  mixins: [GuiMixin],
  computed: {
    tag: function() {
      return this.model.tag || "div";
    },
    payload: function() {
      return this.resolve("payload", this);
    }
  },
  mounted() {
    console.log("parentContext", this.model.type, this.model.nodeid, this.parentContext);
  },
  template:
`
<component :is="tag" v-html="payload" :id="model.nodeid" :class="classes"></component>
`
});
