"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_component_definition(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-component-definition");
};
