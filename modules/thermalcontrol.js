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

function _defineThermalControlDevice(config, setpointDefault) {
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
        type: "value",
        readonly: false,
        value: setpointDefault,
        order: 30,
      },
      devState: {
        title: "State",
        type: "text",
        readonly: true,
        value: "DISABLED",
        order: 40,
      },
      hysteresis: {
        title: "Hysteresis",
        type: "value",
        readonly: true,
        value: 0,
        order: 90,
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
 * @param {Object} [config.setpoint] - Range and default value of thermal setpoint.
 * @param {float} [config.hysteresis] - Value of thermal hysteresis.
 * @param {boolean} [config.debug] - Allow logging.
 * @example
 *
 * var libtherm = require("thermalcontrol");
 *
 * config = ({
 *     devName: "climate_kitchen",
 *     devTitle: "Температура на кухне",
 *     modes: ["heating", "cooling"],
 *     temperatureSource: "wb-w1/somesensor",
 *     heatingChannel: "wb-gpio/EXT2_R3A1",
 *     coolingChannel: "wb-gpio/EXT2_R3A2",
 *     setpoint: {
 *         "min": 6,
 *         "max": 35,
 *         "default": 23
 *     },
 *     hysteresis: 1,
 *     degug: true
 * });
 *
 *
 * var climate_in_kitchen = new libtherm.ThermalControlDevice(config);
 *
 */

exports.ThermalControlDevice = function (config) {
  if (!config.hasOwnProperty("devName")) {
    throw new Error("There are no device ID in config!");
  }
  if (!config.hasOwnProperty("temperatureSource")) {
    throw new Error(
      "{}:[There are no temperature source in config!]".format(
        format(config.devName)
      )
    );
  }
  devName = config.devName;

  if (config.hasOwnProperty("hysteresis") && config.hysteresis < 0) {
    throw new Error(
      "{}:[Hysteresis can not be negative]".format(format(config.devName))
    );
  }
  heatingChannel = "";
  heatingChannelPresent = false;
  if (config.hasOwnProperty("heatingChannel")) {
    heatingChannel = config.heatingChannel;
    heatingChannelPresent = true;
  }
  coolingChannel = "";
  coolingChannelPresent = false;
  if (config.hasOwnProperty("coolingChannel")) {
    coolingChannel = config.coolingChannel;
    coolingChannelPresent = true;
  }

  hysteresis = 1.0;

  if (!isNaN(parseFloat(config.hysteresis))) {
    hysteresis = parseFloat(config.hysteresis);
  }

  var setpointMin = 5.0;
  var setpointMax = 35.0;
  var setpointDefault = 23.0;

  if (config.hasOwnProperty("setpoint")) {
    if (!isNaN(parseFloat(config.setpoint.min))) {
      setpointMin = parseFloat(config.setpoint.min);
    } else {
      throw new Error("{}:[Problem with setpoint: bad min value ({})]").format(
        config.devName,
        parseFloat(config.setpoint.min)
      );
    }
    if (!isNaN(parseFloat(config.setpoint.max))) {
      setpointMax = parseFloat(config.setpoint.max);
    } else {
      throw new Error("{}:[Problem with setpoint: bad max value ({})]").format(
        config.devName,
        parseFloat(config.setpoint.max)
      );
    }
    if (!isNaN(parseFloat(config.setpoint.default))) {
      setpointDefault = parseFloat(config.setpoint.default);
    } else {
      throw new Error(
        "{}:[Problem with setpoint: bad default value ({})]"
      ).format(config.devName, parseFloat(config.setpoint.default));
    }
  }

  if (setpointMin >= setpointMax) {
    throw new Error("Maximal setpoint value must be greater than minimal");
  }
  if (setpointDefault > setpointMax || setpointDefault < setpointMin) {
    throw new Error(
      "Default setpoint value must be greater than minimal and smaller than maximal"
    );
  }

  if (config.debug)
    log.debug(
      "New thermal control device:\
    \n{\
    \nName: {}\
    \nTitle: {},\
    \nTemperature source: {}\
    \nHeating switch control: {}\
    \nCooling switch control: {}\
    \nModes: {}\
    \nSetpoint: [min : {}, max : {}, default : {}]\
    \nHysteresis: {}\
    \n}".format(
        devName,
        config.devTitle,
        config.temperatureSource,
        heatingChannel,
        coolingChannel,
        JSON.stringify(config.modes, null, 0),
        setpointMin,
        setpointMax,
        setpointDefault,
        hysteresis
      )
    );

  this._device = _defineThermalControlDevice(config, setpointDefault);
  dev[devName]["hysteresis"] = hysteresis;
  if (isNaN(parseFloat(dev[devName]["setpoint"]))){
    dev[devName]["setpoint"] = setpointDefault;
  }

  this._regulationRule = defineRule({
    whenChanged: devName + "/temperature",
    then: function () {
      setpoint = dev[devName]["setpoint"];
      temperature = dev[devName]["temperature"];
      heat = dev[devName]["devState"] == "HEATING";
      cool = dev[devName]["devState"] == "COOLING";
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
        if (config.hasOwnProperty("modes")) {
          heat = heat && config.modes.indexOf("heating") !== -1;
          cool = cool && config.modes.indexOf("cooling") !== -1;
        }
        if (heatingChannelPresent) dev[heatingChannel] = heat;
        if (coolingChannelPresent) dev[coolingChannel] = cool;
        if (heat) {
          dev[devName]["devState"] = "HEATING";
        } else if (cool) {
          dev[devName]["devState"] = "COOLING";
        } else {
          dev[devName]["devState"] = "DISABLED";
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
        dev[devName]["devState"] = "DISABLED";
        if (config.debug)
          log.debug("{}:[Thermostat ENABLED now]".format(devName));
        enableRule(this._regulationRule);
        runRule(this._regulationRule);
      } else {
        disableRule(this._regulationRule);
        dev[devName]["devState"] = "DISABLED";
        if (heatingChannelPresent) dev[heatingChannel] = false;
        if (coolingChannelPresent) dev[coolingChannel] = false;
        if (config.debug)
          log.debug("{}:[Thermostat disabled now]".format(devName));
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
          "{}:[You tried to set setpoint ({})\
          greater than maximum setting ({}})]".format(
            devName,
            setpoint,
            setpointMax
          )
        );
      }
      if (setpoint < setpointMin) {
        dev[devName]["setpoint"] = setpointMin;
        log.error(
          "{}:[You tried to set setpoint ({})\
          lower than maximum setting ({}})]".format(
            devName,
            setpoint,
            setpointMin
          )
        );
      }
      runRule(this._regulationRule);
    }.bind(this),
  });

  runRule(this._setpointControl);
};
