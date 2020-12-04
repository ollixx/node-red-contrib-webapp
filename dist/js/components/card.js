Vue.component('GuiCard', {
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
<md-card :id="model.nodeid" :class="classes" :style="model.css">
  <md-card-header>
    <component 
      :key="child.id" 
      :is="child.type" 
      :model="child" 
      v-for="child in slot('header')"
      :parentContext="parentContext"
    ></component>
  </md-card-header>
  <md-card-content>
    <component 
      :key="child.id" 
      :is="child.type" 
      :model="child" 
      v-for="child in slot('content')"
      :parentContext="parentContext"
    ></component>
  </md-card-content>
  <md-card-actions>
    <component 
      :key="child.id" 
      :is="child.type" 
      :model="child" 
      v-for="child in slot('actions')"
      :parentContext="parentContext"
    ></component>
  </md-card-actions>
</md-card>
`
});
