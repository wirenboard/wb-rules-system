function _str_split_space(s) {
  var index = s.indexOf(' ');
  if (index == -1) {
    return [s];
  } else {
    return [s.slice(0, index), s.slice(index + 1)];
  }
}

function createControlOrSetValue(vdevObj, controlName, controlDesc, initialValue) {
  if (!vdevObj.isControlExists(controlName)) {
    var desc = Object(controlDesc);
    desc.value = initialValue;
    vdevObj.addControl(controlName, desc);
  }

  vdevObj.getControl(controlName).setValue({ value: initialValue });
}

var nodeInfo = {};
var translations = {
  'Battery Temperature': 'Температура батареи',
  'Board Temperature': 'Температура платы',
  'CPU Temperature': 'Температура процессора',
  'GPU Temperature': 'Температура графического процессора'
};

runShellCommand(
  'test -d /sys/class/power_supply/wbec-battery',
  {
    captureOutput: false,
    exitCallback: function (exitCode) {
      if (exitCode != 0) return;
      nodeInfo['wbec-battery'] = {
        'title': 'Battery Temperature',
        'hwmon-channel': 'temp1',
        'hwmon-node-name': 'wbec-battery'
      }
    }
  }
)

runShellCommand(
  'set /proc/device-tree/wirenboard/hwmon-nodes/*/*; [ -e "$1" ] || shift; for i; do echo -n $i; echo \' \'`cat $i`; done',
  {
    captureOutput: true,
    exitCallback: function (exitCode, capturedOutput) {
      if (exitCode != 0) return;
      var strList = capturedOutput.split('\n');
      for (var i = 0; i < strList.length; ++i) {
        var strParts = _str_split_space(strList[i]);
        if (strParts.length == 2) {
          var path = strParts[0];
          var contents = strParts[1];

          var match = path.match(/\/([^\/]*)\/([^\/]*)$/);
          var nodeName = match[1];
          var propName = match[2];
          if (!nodeInfo[nodeName]) {
            nodeInfo[nodeName] = {};
          }

          nodeInfo[nodeName][propName] = contents;
        }
      }

      /** @type {ControlsSpec} */
      var cells = {};
      for (var nodeKey in nodeInfo) {
        if (nodeInfo.hasOwnProperty(nodeKey)) {
          var node = nodeInfo[nodeKey];
          var title = node['title']
          cells[title] = { type: 'temperature', value: 0.0 };
          if (translations[title]) {
            cells[title]['title'] = { en: title, ru: translations[title] }
          }
        }
      }

      if (Object.keys(cells).length != 0) {
        defineVirtualDevice('hwmon', {
          title: { en: 'HW Monitor', ru: 'HW монитор' },
          cells: cells,
        });

        initHwmonSysfs();
      }
    },
  }
);

var sysfsMapping = {};
function initHwmonSysfs() {
  // map hwmonN sysfs directory and hwmon-nodes channels
  runShellCommand(
    "for i in /sys/class/hwmon/hwmon*/name /sys/class/hwmon/hwmon*/of_node/name; do echo -n $i; echo ' '`cat $i`; done",
    {
      captureOutput: true,
      exitCallback: function (exitCode, capturedOutput) {
        var strList = capturedOutput.split('\n');
        for (var i = 0; i < strList.length; ++i) {
          var strParts = _str_split_space(strList[i]);
          if (strParts.length == 2) {
            var path = strParts[0];
            var sysfsDirPath = path.match(/^(\/sys\/class\/hwmon\/hwmon[^\/]+)\//)[1];
            var nodeName = strParts[1];
            sysfsMapping[nodeName] = sysfsDirPath;
          }
        }

        initReadRules();
      },
    }
  );
}

function readChannel(path, sysfsPath, controlName) {
  var isOnlinePath = sysfsPath + '/device/online';
  // not all hwmons support device/online => treating as online by default
  runShellCommand('cat ' + isOnlinePath + ' 2>/dev/null || echo "1"', {
    captureOutput: true,
    exitCallback: function (exitCode, capturedOutput) {
      var vdev = getDevice('hwmon');
      if (capturedOutput.trim() == '1') {
        runShellCommand('cat ' + path, {
          captureOutput: true,
          exitCallback: function (exitCode, capturedOutput) {
            if (exitCode == 0) {
              createControlOrSetValue(vdev, controlName, { type: 'temperature', title: controlName }, parseFloat((parseInt(capturedOutput) * 0.001).toFixed(3)));
            }
          },
        });
      } else {
        if (vdev && vdev.isControlExists(controlName)) {
          vdev.removeControl(controlName);
        }
      }
    },
  });
}

function initReadRules() {
  for (var nodeKey in nodeInfo) {
    if (nodeInfo.hasOwnProperty(nodeKey)) {
      var node = nodeInfo[nodeKey];

      var sysfsDirPath = sysfsMapping[node['hwmon-node-name']];
      if (sysfsDirPath) {
        var path = sysfsDirPath + '/' + node['hwmon-channel'] + '_input';
        var controlName = node['title'];

        readChannel(path, sysfsDirPath, controlName);
        (function (path, sysfsDirPath, controlName) {
          setInterval(function () {
            readChannel(path, sysfsDirPath, controlName);
          }, 10000);
        })(path, sysfsDirPath, controlName);
      }
    }
  }
}
