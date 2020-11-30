Vue.component('GuiHtml', {
  mixins: [GuiMixin],
  computed: {
    tag: function() {
      return this.model.tag || "div";
    }
  },
  template:
`
<component :is="tag" v-html="payload" :id="model.nodeid" :class="classes"></component>
`
});
