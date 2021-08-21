Vue.component('GuiApp', {
  mixins: [GuiMixin],
  data: () => ({
    menuVisible: false,
  }),
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
    mode: function () {
      if (this.model.mode) {
        switch(this.model.mode) {
          case "fixed":
          case "fixed-last": 
          case "reveal":
          case "flexible":
          case "overlap":
            // console.log("mode", this.model.mode)
            return this.model.mode;
          default:
            // console.log("mode", this.model.mode)
            return "";
        }
      }
    },
  },
  template:
    `
    <div class="page-container" :id="id">
      <md-app :md-mode="mode" :md-waterfall="model.waterfall" :md-scrollbar="model.scrollbar" style="max-height: 800px;" >
        <md-app-toolbar class="md-primary">
          <md-button v-if="model.expand == 'expand'" class="md-icon-button" @click="menuVisible = !menuVisible">
            <md-icon>menu</md-icon>
          </md-button>
          <component
            v-for="child in toolbarChildren"
            v-bind:is="child.type"
            :key="child.id"
            :model="child"
            :parentContext="parentContext"
          ></component>
        </md-app-toolbar>
        <md-app-drawer :md-permanent="model.expand != 'expand' ? model.permanent : null" :md-active.sync="menuVisible">
          <component
            v-for="child in drawerChildren"
            v-bind:is="child.type"
            :key="child.id"
            :model="child"
            :parentContext="parentContext"
          ></component>
        </md-app-drawer>
        <md-app-content>
          <component
            v-for="child in contentChildren"
            v-bind:is="child.type"
            :key="child.id"
            :model="child"
            :parentContext="parentContext"
          ></component>
          <div v-if="contentChildren.length == 0">nix</div>
        </md-app-content>
      </md-app>
    </div>
  `
});
