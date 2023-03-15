/**
 * Creates unidirectional bind between two controls.
 * It means that values from the first control will be
 * copied to the second each time first one is changed.
 *
 * @param {Object} config - Configuration of this bind.
 * @param {string} config.from - Control to copy values from.
 * @param {string} config.to - Control to copy values to.
 * @param {function} [config.convert] - Optional function to convert values between 'from' and 'to'.
 */
exports.bindControls = function (config) {
  if (!config.hasOwnProperty("convert")) {
    config["convert"] = function(value) { return value; };
  }

  if (!config.hasOwnProperty("from") || config.hasOwnProperty("to")) {
      throw Error("bindControls() requires 'from' and 'to' parameters");
  }
  
  dev[config.to] = config.convert(dev[config.from]);
  
  return defineRule({
    whenChanged: config.from,
    then: function(value) {
      dev[config.to] = config.convert(value);
    }
  });
  
};

function _defineCountdownDevice(name, title) {
  return defineVirtualDevice(name, {
  	title: title,
    cells: {
      countdown: {
        title: "Countdown",
        type: "value",
        readonly: true,
        value: 0,
        order: 20
      },
      active: {
        title: "Active",
        type: "switch",
        readonly: true,
        value: false,
        order: 30
      },
      start: {
        title: "Start",
        type: "pushbutton",
        order: 40
      },
      cancel: {
        title: "Cancel",
        type: "pushbutton",
        order: 50
      }
    }
  });
}


/**
 * Creates countdown timer switch.
 *
 * @constructor
 *
 * @param {string} name - Name for a virtual device (should be valid MQTT subtopic).
 * @param {Object} config - Configurtaion of this countdown switch.
 * @param {string} [config.title] - Title for the timer's virtual device (any Unicode string).
 * @param {number} [config.defaultTimeout] - Default timeout for this timer in seconds,
 *   applied when start() called without an argument or when triggered from MQTT pushbutton.
 * @param {string} [config.control] - Path to a control which should be activated with timer.
 * @param {bool} [config.invert] - Invert bound control value
 *   (deactivate control when timer is active).
 *
 * @example
 * var lib = require("integration");
 *
 * var timer = new lib.CountdownTimerSwitch("wet_clean_timer", {
 *   title: "Влажная уборка 💦",
 *   defaultTimeout: 15 * 60  // 15 minutes
 * });
 *
 * defineRule({
 *   whenChanged: ["flood_sensor/flood", "wet_clean_timer/active"],
 *   then: function() {
 *     if (dev["wet_clean_timer/active"] === true) {
 *       // wet cleanup mode, do not trigger the alarm
 *       dev["alarms/flood"] = false;
 *     } else {
 *       // no wet cleanup, trigger the alarm if flood is detected
 *       dev["alarms/flood"] = dev["flood_sensor/flood"];
 *     }
 *   }
 * });
 */
exports.CountdownTimerSwitch = function(name, config) {
  if (config.hasOwnProperty("defaultTimeout") && config.defaultTimeout <= 0) {
    throw new Error("defaultTimeout must be greater than 0");
  }

  // приватные атрибуты и методы начинаются с _ и не должны использоваться снаружи
  this._countdown = 0;
  this._timer = null;
  
  this._device = _defineCountdownDevice(name, config.title || "Countdown timer " + name);
  
  this._startRule = defineRule({
    whenChanged: name + "/start",
    then: function() {
      this.start();
    }.bind(this)
  });
  
  this._cancelRule = defineRule({
    whenChanged: name + "/cancel",
    then: function() {
      this.cancel();
    }.bind(this)
  });
  
  this._disableCallback = function() {   
    dev[name]["active"] = false;
    dev[name]["countdown"] = 0;
    clearInterval(this._timer);
    this._timer = null;
  }.bind(this);
  
  if (config.hasOwnProperty("control")) {
    if (config.invert) {
      exports.bindControls({from: name + "/active", to: config.control, convert: function(v) {return !v;}});
    } else {
	  exports.bindControls({from: name + "/active", to: config.control});
    }
  }
  
  // публичные атрибуты и методы
  this.start = function(timeout) {
    if (this._timer !== null) {
      throw Error("timer is already started");
    }
    
    if (timeout === undefined) {
      if (config.defaultTimeout == undefined) {
        throw new Error("timeout need to be set either implicitly or via defaultTimeout");
      }
      timeout = config.defaultTimeout;
    }
    this._countdown = timeout;
    
    this._timer = setInterval(function() {
      this._countdown--;
      dev[name]["countdown"] = this._countdown;
      
      if (this._countdown === 0) {
      	this._disableCallback();
      }
    }.bind(this), 1000);
    
    dev[name]["active"] = true;
    dev[name]["countdown"] = this._countdown;
  }.bind(this);
  
  this.cancel = function() {
	if (this._timer !== null) {
      this._disableCallback();
    }
  }.bind(this);

  // this вернётся из этой функции по умолчанию, если вызвать её с new (как конструктор)
};
