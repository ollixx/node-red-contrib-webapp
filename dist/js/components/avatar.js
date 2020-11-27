Vue.component('GuiAvatar', {
  mixins: [GuiMixin],
  mounted: function() {
    if (this.model.avatarIcon) this.addClass("md-avatar-icon");
    console.log("avatar icon", this.model.avatarIcon);
  },
  template:
    `
<md-avatar :class="classes" :id="model.nodeid">
  <component
  v-for="child in model.children"
  :key="child.id"
  :is="child.type"
  :model="child"
  ></component>
  <span v-if="model.children.length == 0">{{model.payload}}</span>
</md-avatar>
`
});
