"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_button(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-button");
};
