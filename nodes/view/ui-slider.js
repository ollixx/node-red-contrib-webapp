"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_slider(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-slider");
};
