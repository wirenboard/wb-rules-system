function _str_split_space(s) {
  var index = s.indexOf(' ');
  return (index == -1) ? [s] : [s.slice(0, index), s.slice(index + 1)];
}

var nodeInfo = {};

runShellCommand('set /proc/device-tree/wirenboard/hwmon-nodes/*/*; [ -e "$1" ] || shift; for i; do echo -n $i; echo \' \'`cat $i`; done', {
  captureOutput: true,
  exitCallback: function (code, output) {
    if (code != 0) return;

    var strList = output.split('\n');

    for (var i = 0; i < strList.length; ++i) {
      var strParts = _str_split_space(strList[i]);
      
      if (strParts.length == 2) {
        var path = strParts[0];
        var contents = strParts[1];

        var match = path.match(/\/([^\/]*)\/([^\/]*)$/);
        var nodeName = match[1];
        var propName = match[2];

        if (!nodeInfo[nodeName]) nodeInfo[nodeName] = {};

        nodeInfo[nodeName][propName] = contents;
      }
    }

    var controls = {};

    for (var nodeName in nodeInfo) {
      if (nodeInfo.hasOwnProperty(nodeName)) {
        var node = nodeInfo[nodeName]['title'];
        controls[node] = {type: 'temperature', value: 0.0};
      }
    }

    if (Object.keys(controls).length != 0) {
      defineVirtualDevice('hwmon', {
        title: {en: 'Hardware monitor', ru: 'Статус оборудования'},
        cells: controls,
      });

      initHwmonSysfs();
    }
  }
});

var sysfsMapping = {};

function initHwmonSysfs() {
  // map hwmonN sysfs directory and hwmon-nodes channels

  runShellCommand("for i in /sys/class/hwmon/hwmon*/name /sys/class/hwmon/hwmon*/of_node/name; do echo -n $i; echo ' '`cat $i`; done", {
    captureOutput: true,
    exitCallback: function (code, output) {
      var strList = output.split('\n');

      for (var i = 0; i < strList.length; ++i) {
        var strParts = _str_split_space(strList[i]);

        if (strParts.length == 2) {
          var path = strParts[0];
          var node = strParts[1];

          sysfsMapping[node] = path.match(/^(\/sys\/class\/hwmon\/hwmon[^\/]+)\//)[1];
        }
      }

      initReadRules();
    }
  });
}

function readChannel(path, controlName) {
  runShellCommand('cat ' + path, {
    captureOutput: true,
    exitCallback: function (code, output) {
      if (code) return;
      dev.hwmon[controlName] = parseFloat((parseInt(output) * 0.001).toFixed(3));
    }
  });
}

function initReadRules() {
  for (var nodeName in nodeInfo) {
    if (nodeInfo.hasOwnProperty(nodeName)) {
      var node = nodeInfo[nodeName];
      var sysfsDirPath = sysfsMapping[node['hwmon-node-name']];

      if (sysfsDirPath) {
        var path = sysfsDirPath + '/' + node['hwmon-channel'] + '_input';
        var controlName = node['title'];

        readChannel(path, controlName);

        (function (path, controlName) {
          setInterval(function () {
            readChannel(path, controlName);
          }, 10000);
        })(path, controlName);
      }
    }
  }
}