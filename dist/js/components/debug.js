Vue.component('GuiDebug', {
  mixins: [GuiMixin],
  data: function() {
    return {
      visible: false,
    }
  },
  methods: {
    props: function(obj) {
      return Object.keys(obj);
    },
    group: function(obj) {
      return typeof(obj) =='object'
    }
  },
  template:
`
<div>
  <md-switch v-model="visible">Model</md-switch>
  <pre v-if="false && visible">{{getModel()}}</pre>

  <component is="tree" :model="getModel()" v-if="visible"></component>
</div>
`
});

Vue.component('tree', {
  mixins: [GuiMixin],
  data: function() {
    return {
      openlist: {}
    }
  },
  methods: {
    props: function(obj) {
      return Object.keys(obj);
    },
    group: function(obj) {
      return typeof(obj) =='object'
    },
    open: function(name) {
      if (!this.openlist.hasOwnProperty(name)) {
        this.openlist[name] = false;
      }
      return this.openlist[name];
    }
  },
  template:
`
<md-list :md-expand-single="true" class="md-dense">
  <md-list-item :md-expand="group(child)" :md-expanded.sync="open(key)" v-for="child, key in model">
    <span class="md-list-item-text">{{key}} {{group(child) ? "" : ":" + child}}</span>
    <component is="tree" slot="md-expand" v-if="group(child)" :model="child">
    </component>
  </md-list-item>
</md-list>
`
});