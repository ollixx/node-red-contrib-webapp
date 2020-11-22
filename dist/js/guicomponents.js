// define a mixin object
var GuiMixin = {
  props: ['model'],
  data: function() {
    return {
      clsStore: []
    }
  },
  computed: {
    classes: function() {
      let clss = [];
      if (this.clsStore) {
        this.clsStore.forEach(element => {
          clss.push(element);
        });;
      }
      if (this.model.transparent || (this.model.color && this.model.color == "transparent")) {
        clss.push("md-transparent");
      }
      if (this.model.primary || (this.model.color && this.model.color == "primary")) {
        clss.push("md-primary");
      }
      if (this.model.accent || (this.model.color && this.model.color == "accent")) {
        clss.push("md-accent");
      }
      if (this.model.raised) {
        clss.push("md-raised");
      }
      if (this.model.dense) {
        clss.push("md-dense");
      }
      if (this.model.elevation) {
        if (this.model.elevation != "default")
        clss.push("md-elevation-" + this.model.elevation);
      }
      if (this.model.small || (this.model.size && this.model.size == "small")) {
        clss.push("md-small");
      }
      if (this.model.large || (this.model.size && this.model.size == "large")) {
        clss.push("md-large");
      }
      console.log("classes", clss.join(" "));
      return clss.join(" ");
    },
  },
  methods: {
    addClass: function(cls) {
      this.clsStore.push(cls);
    },
    sendMessage: function (msg) {
      Vue.send(msg);
    }
  }
}

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
      <pre>{{model}}</pre>
    </div>
`
});

Vue.component('GuiApp', {
  mixins: [GuiMixin],
  computed: {
    toolbarChildren: function () {
      let tbChildren = [];
      for (let ch of this.model.children) {
        if (ch.slot && ch.slot === "toolbar") {
          tbChildren.push(ch);
        }
      }
      return tbChildren;
    },
    drawerChildren: function () {
      let drChildren = [];
      for (let ch of this.model.children) {
        if (ch.slot && ch.slot === "drawer") {
          drChildren.push(ch);
        }
      }
      return drChildren;
    },
    contentChildren: function () {
      let cntChildren = [];
      for (let ch of this.model.children) {
        if (!ch.slot || ch.slot === "content") {
          cntChildren.push(ch);
        }
      }
      return cntChildren;
    },
  },
  template:
    `
    <div class="page-container" :id="model.nodeid">
      <md-app md-waterfall md-mode="fixed">
        <md-app-toolbar class="md-primary">
          <component
            v-for="child in toolbarChildren"
            v-bind:is="child.type"
            :key="child.id"
            :model="child"
          ></component>
        </md-app-toolbar>
        <md-app-drawer md-permanent="clipped">
          <component
            v-for="child in drawerChildren"
            v-bind:is="child.type"
            :key="child.id"
            :model="child"
          ></component>
        </md-app-drawer>
        <md-app-content>
          <component
            v-for="child in contentChildren"
            v-bind:is="child.type"
            :key="child.id"
            :model="child"
          ></component>
          <div v-if="contentChildren.length == 0">nix</div>
        </md-app-content>
      </md-app>
    </div>
  `

});

Vue.component('GuiToolbar', {
  mixins: [GuiMixin],
  template:
    `
<md-app-toolbar class="md-primary" :id="model.nodeid">
  <span class="md-title">{{ model.payload }}</span>
</md-app-toolbar>
`
});

Vue.component('GuiHtml', {
  mixins: [GuiMixin],
  props: ["overload"],
  computed: {
    payload: function() {
      console.log("content", this.overload, this.model.payload)
      if (this.overload) {
        return this.overload
      } else {
        return this.model.payload;
      }
    }
  },
  template:
    `
<div v-html="payload" :id="model.nodeid" :class="classes"></div>
`
});

Vue.component('GuiAvatar', {
  mixins: [GuiMixin],
  mounted: function() {
    if (this.model.avatarIcon) this.addClass("md-avatar-icon");
    console.log("avatar icon", this.model.avatarIcon);
  },
  template:
    `
<md-avatar :class="classes" :id="model.nodeid">
  <component
  v-for="child in model.children"
  :key="child.id"
  :is="child.type"
  :model="child"
  ></component>
  <span v-if="model.children.length == 0">{{model.payload}}</span>
</md-avatar>
`
});

Vue.component('GuiIcon', {
  mixins: [GuiMixin],
  template:
    `
<md-icon>{{ model.payload }}</md-icon>
`
});

Vue.component('GuiButton', {
  mixins: [GuiMixin],
  methods: {
    onClick() {
      console.log("clicking", this.model.nodeid);
      this.sendMessage({
        command: "Click",
        nodeid: this.model.nodeid,
      });
    },
  },
  template:
`
<md-button v-on:click="onClick" :id="model.nodeid" :class="classes" :md-ripple="model.ripple">
  <component
    v-for="child in model.children"
    :key="child.id"
    :is="child.type"
    :model="child"
  ></component>
  {{ model.payload }}
</md-button>
`
});

Vue.component('GuiContent', {
  mixins: [GuiMixin],
  props: ["overload"],
  computed: {
    payload: function() {
      console.log("content", this.overload, this.model.payload)
      if (this.overload) {
        return this.overload
      } else {
        return this.model.payload;
      }
    }
  },
  template:
`
<md-content :id="model.nodeid" :class="classes" :disabled="model.disabled" :md-ripple="model.ripple">{{ payload }}</md-content>
`
});

Vue.component('GuiList', {
  mixins: [GuiMixin],
  computed: {
    list: function() {
      if (this.model.payload) {
        if (Array.isArray(this.model.payload)) {
          console.log("list is array");
          return this.model.payload;
        } else if (typeOf(this.model.payload) == "object") {
          console.log("list is object");
          return this.model.payload;
        } else {
          console.log("list is single");
          return [this.model.payload];
        }
      } else {
        return [];
      }
    }
  },
  template:
`
<md-list :id="model.nodeid" :class="classes">
  <md-list-item v-for="entry in list">
    <component
      v-for="child in model.children"
      :key="child.id"
      :is="child.type"
      :model="child"
      :overload="entry"
    >
    </component>
  </md-list-item>
</md-list>
`
});

Vue.component('GuiLayout', {
  mixins: [GuiMixin],
  methods: {
    slot: function(name) {
      let children = [];
      for (let ch of this.model.children) {
        if (ch.slot && ch.slot == name) {
          children.push(ch);
        }
      }
      return children;
    }
  },
  template:
`
<div class="md-layout" :id="model.nodeid">
  <div :class="column.class" v-for="column in model.columns">
    <component :key="child.id" :is="child.type" :model="child" v-for="child in slot(column.name)"></component>
  </div>
</div>
`
});
