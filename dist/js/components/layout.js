Vue.component('GuiLayout', {
  mixins: [GuiMixin],
  methods: {
    slot: function(name) {
      let children = [];
      for (let ch of this.model.children) {
        if (ch.slot && ch.slot == name) {
          children.push(ch);
        }
      }
      return children;
    }
  },
  template:
`
<div class="md-layout" :id="model.nodeid">
  <div :class="column.class" v-for="column in model.columns">
    <component :key="child.id" :is="child.type" :model="child" v-for="child in slot(column.name)"></component>
  </div>
</div>
`
});
