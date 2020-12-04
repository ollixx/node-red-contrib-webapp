Vue.component('GuiRow', {
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
<div :id="model.nodeid" class="md-layout" :class="classes">
  <component 
    :is="child.type" 
    :key="child.id" 
    :model="child" 
    v-for="child in model.children"
    :parentContext="parentContext"
  ></component>
</div>
`
});

Vue.component('GuiColumn', {
  mixins: [GuiMixin],
  template:
`
<div :id="model.nodeid" class="md-layout-item" :class="classes">
  <component 
    :key="child.id" 
    :is="child.type" 
    :model="child" 
    v-for="child in model.children"
    :parentContext="parentContext"
  ></component>
</div>
`
});
