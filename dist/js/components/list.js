Vue.component('GuiList', {
  mixins: [GuiMixin],
  computed: {
    list: function() {
      if (this.model.payload) {
        if (Array.isArray(this.model.payload)) {
          console.log("list is array");
          return this.model.payload;
        } else if (typeof(this.model.payload) == "object") {
          console.log("list is object");
          return this.model.payload;
        } else {
          console.log("list is single");
          return [this.model.payload];
        }
      } else {
        return [];
      }
    },
  },
  methods: {
    slotClass: function(child) {
      if (child && child.slot) {
        switch(child.slot) {
          case "text":
            return "md-list-item-text";
          case "action":
            return "md-list-action";
          }
      }
      return "";
    }
  },
  template:
`
<md-list :id="model.nodeid" :class="classes">
  <template v-for="entry, key, index in list">
    <md-subheader v-if="index == 0 || key == 0">Todo: Subheader</md-subheader>
    <md-list-item>
      <component
        v-for="child in model.children"
        :key="child.id"
        :is="child.type"
        :model="child"
        :overload="entry"
        :class="slotClass(child)"
      >
      </component>
    </md-list-item>
    <md-divider v-if="index !== list.length - 1"></md-divider>
  </template>
</md-list>
`
});
