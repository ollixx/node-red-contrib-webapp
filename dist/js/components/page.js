Vue.component('GuiPageView', {
  mixins: [GuiMixin],
  data: () => ({}),
  computed: {},
  template:
    `<div :id="id"><router-view/></div>`
});

let GuiPage = Vue.component('GuiPage', {
  mixins: [GuiMixin],
  data: () => ({
    payload: {}
  }),
  computed: {},
  template:
`
  <div :id="id">
    <component
      v-for="child in model.children"
      :key="child.id"
      :is="child.type"
      :model="child"
      :parentContext="payload"
    ></component>
  </div>
`
});
