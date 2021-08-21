Vue.component('GuiForm', {
  mixins: [GuiMixin],
  computed: {
    payload: function() {
      return this.resolve("payload", this);
    }
  },
  mounted() {
    // console.log("parentContext", this.model.type, this.model.nodeid, this.parentContext);
  },
  template:
`
<form :id="id" novalidate :class="classes" class="md-layout" @submit.prevent="validateUser">
  <component
    v-for="child in model.children"
    :key="child.id"
    :is="child.type"
    :model="child"
    :parentContext="payload"
  ></component>
</form>
`
});
