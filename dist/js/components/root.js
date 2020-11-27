Vue.component('GuiRoot', {
  mixins: [GuiMixin],
  template:
    `
    <div id="root">
      <component
        v-for="child in model.children"
        :key="child.id"
        :is="child.type"
        :model="child"
      ></component>
    </div>
`
});
