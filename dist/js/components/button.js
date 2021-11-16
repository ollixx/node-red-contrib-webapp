Vue.component('GuiButton', {
  mixins: [GuiMixin],
  methods: {
    onClick() {
      let action = this.resolve("action", this);
      console.log("clicking", this.model.nodeid, "action", action, "this", this);
      this.sendMessage({
        command: "Click",
        nodeid: this.model.nodeid,
        payload: action
      });
    },
  },
  template:
    `
<md-button :id="id" v-on:click="onClick" :class="classes" :md-ripple="model.ripple">
  <component
    v-for="child in model.children"
    :key="child.id"
    :is="child.type"
    :model="child"
    :parentContext="parentContext"
    ></component>
  {{ model.payload }}
</md-button>
`
});
