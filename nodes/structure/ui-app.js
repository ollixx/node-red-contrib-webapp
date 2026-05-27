"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_app(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-app");
};
