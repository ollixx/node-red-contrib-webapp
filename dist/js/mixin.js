
// define a mixin object
var GuiMixin = {
  props: ['model', 'context', 'parentcontext', "extraClasses"],
  data: function () {
    return {
      clsStore: [],
    }
  },
  computed: {
    classes: function () {
      let clss = [];
      if (this.clsStore) {
        this.clsStore.forEach(element => {
          clss.push(element);
        });;
      }
      if (this.extraClasses) {
        this.extraClasses.forEach(element => {
          clss.push(element);
        });;
      }
      if (this.model.transparent || (this.model.color && this.model.color == "transparent")) {
        clss.push("md-transparent");
      }
      if (this.model.primary || (this.model.color && this.model.color == "primary")) {
        clss.push("md-primary");
      }
      if (this.model.accent || (this.model.color && this.model.color == "accent")) {
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
      if (this.model.small || (this.model.size && this.model.size == "small")) {
        clss.push("md-small");
      }
      if (this.model.large || (this.model.size && this.model.size == "large")) {
        clss.push("md-large");
      }
      if (this.model.scrollbar) {
        clss.push("md-scrollbar");
      }
      if (this.model.icon) {
        clss.push("md-avatar-icon");
      }
      if (this.model.size) {
        clss.push("md-size-" + this.model.size);
      }
      if (this.model.gutter) {
        clss.push("md-gutter");
      }
      // console.log("classes", clss.join(" "));
      return clss.join(" ");
    },
    payload: function () {
      if (this.model.$payload) {
        switch (this.model.$payload) {
          case "pay":
            // console.log("pay", this.model.payload, this.context)
            return jsonata(this.model.payload).evaluate(this.context);
          case "par":
            // console.log("par", this.model.payload, this.parentcontext)
            return jsonata(this.model.payload).evaluate(this.parentcontext);
          case "mod":
            return jsonata(this.model.payload).evaluate(this.model);
        }
      } else {
        return this.model.payload;
      }
    },
  },
  methods: {
    addClass: function (cls) {
      this.clsStore.push(cls);
    },
    sendMessage: function (msg) {
      Vue.send(msg);
    },
    getModel: function () {
      return Vue.model;
    }
  }
}
