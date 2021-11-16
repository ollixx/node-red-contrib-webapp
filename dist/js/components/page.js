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
  computed: {
    rerenderKey: function () {
      return this.getModel().rerenderKey
    }
  },
  watch: {
    rerenderKey() {
      this.sendMessage({
        command: "Page",
        nodeid: this.model.nodeid,
        payload: this.model.name
      });
    },
  },
  beforeMount: function () {
    this.sendMessage({
      command: "Page",
      nodeid: this.model.nodeid,
      payload: this.model.name
    });
  },
  template:
    `
  <div :id="id" :re="rerenderKey">
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
