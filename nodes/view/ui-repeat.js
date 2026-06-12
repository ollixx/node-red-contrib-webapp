"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_repeat(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-repeat");
};
