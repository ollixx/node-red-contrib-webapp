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
        clss.push("md-icon-button");
      }
      if (this.model.size) {
        clss.push("md-size-" + this.model.size);
      }
      if (this.model.hide === true) {
        clss.push("md-hide");
      }
      if (this.model.gutter) {
        clss.push("md-gutter");
      }
      // console.log("classes", this.model.nodeid, this.model.type, clss.join(" "));
      return clss.join(" ");
    },
    id: function () {
      return (this.model.type + "-" + (this.model.name || this.model.nodeid)).toLowerCase().replaceAll(" ", "-")
    }
  },
  methods: {
    addClass: function (cls) {
      this.clsStore.push(cls);
    },
    sendMessage: function (msg) {
      Vue.send(msg);
    },
    getModel: function () {
      // return the complete state of the app
      return this.$store.state
    },
    resolve: function (typedPropName, component) {
      let model = component.model;
      if (model["$" + typedPropName]) {
        // Properties prefixed with "$" have to be expanded, as they are a jsonata expression.
        // Those properties relate to either the component's PARent, PAYload or MODel,
        //  i.e. the component's inner state. 
        switch (model["$" + typedPropName]) {
          case "pay":
            try {
              // console.log("resolve", model.nodeid, "PAY", typedPropName, "context", component.context, "model", model)
              return jsonata(model[typedPropName]).evaluate(component.context);
            } catch (err) {
              console.error("jsonata error", err)
              return null
            }
          case "par":
            try {
              // console.log("resolve", model.nodeid, "PAR", typedPropName, "parentContext", component.parentContext, "model", model)
              return jsonata(model[typedPropName]).evaluate(component.parentContext);
            } catch (err) {
              console.error("jsonata error", err)
              return null
            }
          case "ctx":
            try {
              console.log("resolve", model.nodeid, "ctx", typedPropName, "context", component.context, "model", model)
              return jsonata(model[typedPropName]).evaluate(component.context);
            } catch (err) {
              console.error("jsonata error", err)
              return null
            }
          case "mod":
            try {
              // console.log("resolve", model.nodeid, "MOD", typedPropName, model)
              return jsonata(model[typedPropName]).evaluate(model);
            } catch (err) {
              console.error("jsonata error", err)
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
