Vue.component('GuiAvatar', {
  mixins: [GuiMixin],
  computed: {
    payload: function() {
      return this.resolve("payload", this);
    }
  },
  mounted: function() {
    if (this.model.avatarIcon) this.addClass("md-avatar-icon");
    // console.log("avatar icon", this.model.avatarIcon);
  },
  template:
    `
<md-avatar :class="classes" :id="model.nodeid">
  <component
  v-for="child in model.children"
  :key="child.id"
  :is="child.type"
  :model="child"
  :class="classes"
  :parentContext="parentContext"
  ></component>
  {{model.children && model.children.length > 0 ? "": payload}}
</md-avatar>
`
});
