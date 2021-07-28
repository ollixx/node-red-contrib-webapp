Vue.component('GuiDialog', {
  mixins: [GuiMixin],
  computed: {
    title: function() {
      return this.resolve("title", this);
    },
  },
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
<md-dialog :md-active="!model.hide" md-backdrop="true" md-close-on-esc="true" md-click-outside-to-close="true" md-fullscreen="true">
  <md-dialog-title>{{model.title}}</md-dialog-title>
  
  <component
    :key="child.id" 
    :is="child.type" 
    :model="child" 
    v-for="child in slot('content')"
    :parentContext="parentContext"
  ></component>

  <md-dialog-actions>
    <component
      :key="child.id" 
      :is="child.type" 
      :model="child" 
      v-for="child in slot('actions')"
      :parentContext="parentContext"
    ></component>
  </md-dialog-actions>
</md-dialog>
`
});
