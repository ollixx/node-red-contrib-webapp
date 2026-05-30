"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_radio(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-radio");
};
