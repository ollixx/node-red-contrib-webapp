Vue.component('GuiList', {
  mixins: [GuiMixin],
  computed: {
    list: function() {
      return this.resolve("payload", this);
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
            key,
            index
          });
        }
      }
      return hndls;
    }
  },
  template:
`
<md-list :id="id" :class="classes">
  <template v-for="entry, key, index in list">
  <md-list-item v-on="handlers(entry, key, index)">
    <component
        v-for="child in model.children"
        :key="child.id"
        :is="child.type"
        :model="child"
        :context="entry"
        :parentcontext="list"
        :class="slotClass(child)"
      >
      </component>
    </md-list-item>
  </template>
</md-list>
`
});
