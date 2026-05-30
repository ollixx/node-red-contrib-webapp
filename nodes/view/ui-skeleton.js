"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_skeleton(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-skeleton");
};
