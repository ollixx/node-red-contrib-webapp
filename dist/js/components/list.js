Vue.component('GuiList', {
  mixins: [GuiMixin],
  computed: {
    list: function () {
      return this.resolve("payload", this);;
    }
  },
  methods: {
    slotClass: function (child) {
      if (child && child.slot) {
        switch (child.slot) {
          case "text":
            return "md-list-item-text";
          case "action":
            return "md-list-action";
        }
      }
      return "";
    },
    handlers: function (entry, key, index) {
      let component = this;
      let hndls = {};
      if (component.model.action == "button") {
        hndls.click = function () {
          component.sendMessage({
            command: "Click",
            nodeid: component.model.nodeid,
            type: component.model.type,
            payload: entry,
            listkey: this.listkey
          });
        }
      }
      return hndls;
    }
  },
  props: ["key", "listkey"],
  template:
    `
<md-list :id="id" :class="classes" :md-dense="model.dense">
  <template v-for="entry, key, index in list">
  <md-list-item v-on="handlers(entry, key, index)">
    <component
        v-for="child in model.children"
        :key="child.id"
        :is="child.type"
        :model="child"
        :context="entry"
        :parentContext="list"
        :class="slotClass(child) + (child.type == 'GuiButton' ? ' md-list-action' : '')"
        :listKey="key"
      >
    </component>
  </md-list-item>
  </template>
</md-list>
`
});
