Vue.component('GuiButton', {
  mixins: [GuiMixin],
  methods: {
    onClick() {
      console.log("clicking", this.model.nodeid);
      this.sendMessage({
        command: "Click",
        nodeid: this.model.nodeid,
      });
    },
  },
  template:
`
<md-button v-on:click="onClick" :id="model.nodeid" :class="classes" :md-ripple="model.ripple">
  <component
    v-for="child in model.children"
    :key="child.id"
    :is="child.type"
    :model="child"
  ></component>
  {{ model.payload }}
</md-button>
`
});
