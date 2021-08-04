// define a mixin object
var GuiMixin = {
  props: ['model', 'context', 'parentContext', "extraClasses"],
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
      if (this.model.hide) {
        clss.push("md-hide");
      }
      if (this.model.gutter) {
        clss.push("md-gutter");
      }
      // console.log("classes", clss.join(" "));
      return clss.join(" ");
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
    },
    resolve: function (typedPropName, component) {
      let model = component.model;
      if (model["$" + typedPropName]) {
        switch (model["$" + typedPropName]) {
          case "pay":
            try {
              return jsonata(model[typedPropName]).evaluate(component.context);
            } catch (err) {
              console.log("jsonata error", err)
              return null
            }
          case "par":
            try {
              return jsonata(model[typedPropName]).evaluate(component.parentContext);
            } catch (err) {
              console.log("jsonata error", err)
              return null
            }
          case "mod":
            try {
              return jsonata(model[typedPropName]).evaluate(model);
            } catch (err) {
              console.log("jsonata error", err)
              return null
            }
        }
      } else {
        return model[typedPropName];
      }
    },
    errorCaptured(err, vm, info) {
      console.log(`cat EC: ${err.toString()}\ninfo: ${info}`);
      return false;
    },
    renderError(h, err) {
      return h('pre', { style: { color: 'red' } }, err.stack)
    }
  }
}
