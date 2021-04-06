var systemCells = {
  "Current uptime": {
    type: "text",
    value: "0"
  },
  "Firmware version": {
    type: "text",
    value: "0"
  },
  "Short SN": {
    type: "text",
    value: ""
  },
  "DTS Version": {
    type: "text",
    value: ""
  },
  "Release branch": {
    type: "text",
    value: ""
  },
  "Release version": {
    type: "text",
    value: ""
  },
  "Reboot": {
    type: "pushbutton"
  }
};



function _system_update_uptime() {
  runShellCommand('awk \'{print int($1/86400)\"d \"int(($1%86400)/3600)\"h \"int(($1%3600)/60)\"m\"}\' /proc/uptime', {
    captureOutput: true,
    exitCallback: function (exitCode, capturedOutput) {
      dev.system["Current uptime"] = capturedOutput;
    }
  });
};

spawn('sh', ['-c', '[ -d /proc/device-tree/wirenboard ]'], {
  captureOutput: true,
  exitCallback: function (exitCode, capturedOutput) {
    var hasWirenboardNode =  (exitCode == 0);

    initSystemDevice(hasWirenboardNode);
  }
});


function fillWirenboardNodeProperty(controlName, propertyName) {
  spawn('cat', ['/proc/device-tree/wirenboard/' + propertyName], {
    captureOutput: true,
    exitCallback: function (exitCode, capturedOutput) {
      if (exitCode == 0) {
        dev.system[controlName] = capturedOutput;
      }
    }
  });
}



function initSystemDevice(hasWirenboardNode) {
  if (hasWirenboardNode) {
    systemCells["HW Revision"] = {type: "text", value: ""};
    systemCells["Batch No"] = {type: "text", value: ""};
    systemCells["Manufacturing Date"] = {type: "text", value: ""};
    systemCells["Temperature Grade"] = {type: "text", value: ""};
  }


  defineVirtualDevice("system", {
    title:"System",
    cells: systemCells
  });

  if (hasWirenboardNode) {
    fillWirenboardNodeProperty("HW Revision", "board-revision");
    fillWirenboardNodeProperty("Batch No", "batch-no");
    fillWirenboardNodeProperty("Manufacturing Date", "date");
    fillWirenboardNodeProperty("Temperature Grade", "temperature/grade");
  }

  _system_update_uptime();
  setInterval(_system_update_uptime, 60000);

  spawn('cat', ['/etc/wb-fw-version'], {
    captureOutput: true,
    exitCallback: function (exitCode, capturedOutput) {
      dev.system["Firmware version"] = capturedOutput;
    }
  });

  spawn('cat', ['/var/lib/wirenboard/short_sn.conf'], {
    captureOutput: true,
    exitCallback: function (exitCode, capturedOutput) {
      dev.system["Short SN"] = capturedOutput;
    }
  });

  spawn('sh', ['-c', '. /etc/wb_env.sh && echo $WB_VERSION'], {
    captureOutput: true,
    exitCallback: function (exitCode, capturedOutput) {
      dev.system["DTS Version"] = capturedOutput;
    }
  });

  spawn('sh', ['-c', '. /etc/wb-release && echo $RELEASE_NAME'], {
    captureOutput: true,
    exitCallback: function (exitCode, capturedOutput) {
      dev.system["Release version"] = capturedOutput;
    }
  });

  spawn('tail', [ '-1', '/etc/apt/sources.list.d/wirenboard.list'], {
    captureOutput: true,
    exitCallback: function (exitCode, capturedOutput) {
      if (exitCode === 0) {
        dev.system["Release branch"] = capturedOutput.split(' ')[2];
      }
    }
  });

  defineRule("_system_reboot", {
    whenChanged: [ "system/Reboot" ],
    then: function(newValue, devName, cellName) {
      runShellCommand("reboot &");
    }
  });
};
