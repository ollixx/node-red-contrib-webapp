"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_container(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-container");
};
