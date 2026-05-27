"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_navigation(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-navigation");
};
