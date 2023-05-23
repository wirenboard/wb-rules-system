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
    config["convert"] = function (value) {
      return value;
    };
  }

  if (!config.hasOwnProperty("from") || config.hasOwnProperty("to")) {
    throw Error("bindControls() requires 'from' and 'to' parameters");
  }

  dev[config.to] = config.convert(dev[config.from]);

  return defineRule({
    whenChanged: config.from,
    then: function (value) {
      dev[config.to] = config.convert(value);
    },
  });
};

// Thermal control device:

function _defineThermalControlDevice(config, setpointMin, setpointMax) {
  return defineVirtualDevice(config.devName, {
    title: config.devTitle,
    cells: {
      devEnabled: {
        title: "Enable",
        type: "switch",
        value: 1,
        readonly: false,
        order: 1,
      },
      temperature: {
        title: "Temperature",
        type: "value",
        readonly: true,
        value: 0,
        order: 20,
      },
      setpoint: {
        title: "Setpoint",
        type: "range",
        readonly: false,
        value: "23.0",
        order: 30,
        max: setpointMax,
        min: setpointMin,
      },
      devState: {
        title: "State",
        type: "text",
        readonly: true,
        value: "OFF",
        order: 40,
      },
    },
  });
}

/**
 * Creates thermal control virtual device.
 *
 * @constructor
 *
 * @param {Object} config - Configurtaion of this countdown switch.
 * @param {string} [config.devName] - Name for a virtual device (should be valid MQTT subtopic).
 * @param {string} [config.devTitle] - Title for the timer's virtual device (any Unicode string).
 * @param {string[]} [config.modes] - List of allowed modes. May be "heating" and "cooling".
 * @param {string} [config.temperatureSource] - Source of temperature, must be valid MQTT subtopic.
 * @param {string} [config.heatingChannel] - Source of switch of real heating device, must be valid MQTT subtopic.
 * @param {string} [config.coolingChannel] - Source of switch of real cooling device, must be valid MQTT subtopic.
 * @param {Object} [config.setpointrange] - Range of thermal setpoint.
 * @param {float} [config.hysteresis] - Value of thermal hysteresis.
 * @example
 *
 * var libtherm = require("thermalcontrol");
 *
 * config = ({
 *     devName: "climate_kitchen",
 *     devTitle: "Температура на кухне",
 *     modes: ["heating", "cooling"]
 *     },
 *     temperatureSource: "wb-w1/somesensor",
 *     heatingChannel: "wb-gpio/EXT2_R3A1",
 *     coolingChannel: "wb-gpio/EXT2_R3A2",
 *     setpointrange: {
 *         "min": 6,
 *         "max": 35
 *     },
 *     hysteresis: 1
 * });
 *
 *
 * var climate_in_kitchen = new libtherm.ThermalControlDevice(config);
 *
 */

exports.ThermalControlDevice = function (config) {
  if (config.hasOwnProperty("hysteresis") && config.hysteresis < 0) {
    throw new Error("Hysteresis can not be negative");
  }

  var setpointMin = 5.0;
  var setpointMax = 35.0;

  if (config.hasOwnProperty("setpointrange")) {
    if (!isNaN(parseFloat(config.setpointrange.min))) {
      setpointMin = parseFloat(config.setpointrange.min);
    } else {
      throw new Error(
        "Problem with setpoint min value (",
        parseFloat(config.setpointrange.min),
        ")"
      );
    }
    if (!isNaN(parseFloat(config.setpointrange.max))) {
      setpointMax = parseFloat(config.setpointrange.max);
    } else {
      throw new Error(
        "Problem with setpoint max value (",
        parseFloat(config.setpointrange.max),
        ")"
      );
    }
  }

  if (setpointMin >= setpointMax) {
    throw new Error("Maximal setpoint value must be greater than minimal");
  }

  devName = config.devName;
  heatingChannel = config.heatingChannel;
  coolingChannel = config.coolingChannel;
  hysteresis = parseFloat(config.hysteresis);

  log.debug(
    "New thermal control device:\
    \nName: {}\
    \nTitle: {},\
    \nTemperature source: {}\
    \nHeating switch control: {}\
    \nCooling switch control: {}\
    \nModes: {}\
    \nSetpoint range: [min : {}, max : {}]\
    \nHysteresis: {}.".format(
      config.devName,
      config.devTitle,
      config.temperatureSource,
      config.heatingChannel,
      config.coolingChannel,
      JSON.stringify(config.modes, null, 0),
      setpointMin,
      setpointMax,
      config.hysteresis
    )
  );

  this._device = _defineThermalControlDevice(config, setpointMin, setpointMax);

  this._regulationRule = defineRule({
    whenChanged: devName + "/temperature",
    then: function () {
      setpoint = dev[devName]["setpoint"];
      temperature = dev[devName]["temperature"];
      heat = dev[heatingChannel];
      cool = dev[coolingChannel];
      // thermostat core
      if (temperature < setpoint) {
        cool = false;
        if (temperature < setpoint - hysteresis) {
          heat = true;
        }
      }
      if (temperature > setpoint) {
        heat = false;
        if (temperature > setpoint + hysteresis) {
          cool = true;
        }
      }
      //
      if (dev[devName]["devEnabled"]) {
        heat = heat && config.modes.indexOf("heating") !== -1;
        cool = cool && config.modes.indexOf("cooling") !== -1;
        dev[heatingChannel] = heat;
        dev[coolingChannel] = cool;
        if (heat) {
          dev[devName]["devState"] = "HEATING";
        } else if (cool) {
          dev[devName]["devState"] = "COOLING";
        } else {
          dev[devName]["devState"] = "OFF";
        }
      }
    }.bind(this),
  });

  this._temperatureUpdateRule = defineRule({
    whenChanged: config.temperatureSource,
    then: function () {
      dev[devName]["temperature"] = parseFloat(dev[config.temperatureSource]);
    }.bind(this),
  });

  this._enableSwitchRule = defineRule({
    whenChanged: devName + "/devEnabled",
    then: function (value) {
      if (value) {
        dev[devName]["devState"] = "OFF";
        log.debug("Thermostat {} ENABLED now".format(config.devTitle));
        enableRule(this._regulationRule);
        runRule(this._regulationRule);
      } else {
        disableRule(this._regulationRule);
        dev[devName]["devState"] = "DISABLED";
        dev[heatingChannel] = false;
        dev[coolingChannel] = false;
        log.debug("Thermostat {} disabled now".format(config.devTitle));
      }
    }.bind(this),
  });

  this._setpointControl = defineRule({
    whenChanged: devName + "/setpoint",
    then: function () {
      setpoint = dev[devName]["setpoint"];
      if (setpoint > setpointMax) {
        dev[devName]["setpoint"] = setpointMax;
        log.error(
          "You tried to set setpoint ({})\
          greater than maximum setting ({}})".format(setpoint, setpointMax)
        );
      }
      if (setpoint < setpointMin) {
        dev[devName]["setpoint"] = setpointMin;
        log.error(
          "You tried to set setpoint ({})\
          lower than maximum setting ({}})".format(setpoint, setpointMin)
        );
      }
      runRule(this._regulationRule);
    }.bind(this),
  });

  runRule(this._setpointControl);
};
