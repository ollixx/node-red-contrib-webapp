var GuiRoot = Vue.component('GuiRoot', {
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
      <div v-if="model.children === undefined || model.children.length == 0">
      <span class="md-display-3">{{model.name}}</span>
      <div class="md-body-2">This is an empty node-red webapp</div>
      <span class="md-body-1">Add GUI widgets to the webapp node</span>
      <div>
    </div>
`
});
