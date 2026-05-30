"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_datepicker(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-datepicker");
};
