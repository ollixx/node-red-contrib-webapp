"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_accordion_section(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-accordion-section");
};
