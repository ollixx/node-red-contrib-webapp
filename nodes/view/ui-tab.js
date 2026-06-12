"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_tab(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-tab");
};
