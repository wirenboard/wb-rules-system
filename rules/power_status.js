var battery = 0;

defineVirtualDevice("power_status", {
  title: "Power status", //

  cells: {
    'working on battery' : {
        type : "switch",
        value : false,
        readonly : true
    },
    'Vin' : {
        type : "voltage",
        value : 0
    }


  }
});


defineRule("_system_track_bat", {
    whenChanged: "wb-adc/BAT",
    then: function () {
        battery = dev["wb-adc"]["BAT"]
    }
});

defineRule("_system_track_vin", {
    whenChanged: "wb-adc/Vin",
    then: function() {
        if (dev["wb-adc"]["Vin"] < battery ) {
            dev["power_status"]["Vin"] = 0;
        } else {
            dev["power_status"]["Vin"] = battery ;
        }
    }
});



defineRule("_system_dc_on", {
  asSoonAs: function () {
    return  dev["wb-adc"]["Vin"] > battery;
  },
  then: function () {
    dev["power_status"]["working on battery"] = false;
  }
});

defineRule("_system_dc_off", {
  asSoonAs: function () {
    return  dev["wb-adc"]["Vin"] <= battery;
  },
  then: function () {
    dev["power_status"]["working on battery"] = true;
  }
});

