"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_component_instance(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-component-instance");
};
