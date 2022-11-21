defineVirtualDevice("power_status", {
  title: "Power status", //

  cells: {
    'working on battery': {
      type: "switch",
      value: false,
      readonly: true
    },
    'Vin': {
      type: "voltage",
      value: 0
    }
  }
});

defineRule("_system_track_vin", {
  whenChanged: ["wb-adc/Vin", "power_status/working on battery"],
  then: function () {
    if (dev["power_status"]["working on battery"]) {
      dev["power_status"]["Vin"] = 0;
    } else {
      dev["power_status"]["Vin"] = dev["wb-adc"]["Vin"];
    }
  }
});

/* Power status reporting for Wiren Board 5.x is based on
    1) Vin value (normally above 7V)
    2) Battery present status
    3) Battery charging status
*/

spawn('bash', ['-c', '. /etc/wb_env.sh && wb_source of && of_machine_match "contactless,imx28-wirenboard50"'], {
  captureOutput: false,
  exitCallback: function (exitCode, capturedOutput) {
    if (exitCode == 0) {
      defineRule("_system_wb5_track_power_status", {
        whenChanged: [
          function () { // get power status
            // we don't expect the voltage to go up and down
            //  around the threshold, so no hysteresis here
            return dev["wb-gpio/BATTERY_PRESENT"] && !dev["wb-gpio/BATTERY_CHARGING"]
              && (dev["wb-adc/Vin"] < 5.0);
          }
        ],
        then: function (newValue, devName, cellName) {
          dev["power_status/working on battery"] = newValue;
        }
      });
    }
  }
});
