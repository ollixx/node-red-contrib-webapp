"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_switch(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-switch");
};
