Vue.component('GuiRoot', {
  mixins: [GuiMixin],
  watch: {
    model: {
        immediate: true,
        deep: true,
        handler(model) {
            document.title = model.name;
        }
    },
  },
  template:
    `
    <div :id="id">
      <component
        v-for="child in model.children"
        :key="child.id"
        :is="child.type"
        :model="child"
        :parentContext="{}"
      ></component>
    </div>
`
});
