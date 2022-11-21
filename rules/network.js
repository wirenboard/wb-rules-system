defineVirtualDevice("network", {
  title: "Network",
  cells: {
    "Ethernet IP": {
      type: "text",
      value: ""
    },
    "Ethernet 2 IP": {
      type: "text",
      value: ""
    },
    "Wi-Fi IP": {
      type: "text",
      value: false
    },
    "Wi-Fi 2 IP": {
      type: "text",
      value: false
    },
    "GPRS IP": {
      type: "text",
      value: ""
    },
    "Ethernet IP Online Status": {
      type: "switch",
      value: false,
      readonly: true
    },
    "Ethernet 2 IP Online Status": {
      type: "switch",
      value: false,
      readonly: true
    },
    "Wi-Fi IP Online Status": {
      type: "switch",
      value: false,
      readonly: true
    },
    "Wi-Fi 2 IP Online Status": {
      type: "switch",
      value: false,
      readonly: true
    },
    "GPRS IP Online Status": {
      type: "switch",
      value: false,
      readonly: true
    },
    "Default Interface": {
      type: "text",
      value: ""
    }
  }
});

function _system_update_ip(name, iface) {
  runShellCommand('ip addr show ' + iface + ' | grep \"inet\\b\" | awk \'{print $2}\' | cut -d/ -f1', {
    captureOutput: true,
    exitCallback: function (exitCode, capturedOutput) {
      dev.network[name] = capturedOutput;
    }
  });
  runShellCommand('ping -q -W1 -c3 -I ' + iface + ' 1.1.1.1', {
    captureOutput: false,
    exitCallback: function (exitCode) {
      dev.network[name + ' Online Status'] = exitCode === 0;
    }
  });
};

function _current_active_connection() {
  runShellCommand('ip route get 1.1.1.1 | grep -oP \'dev\\s+\\K[^ ]+\'', {
    captureOutput: true,
    exitCallback: function (exitCode, capturedOutput) {
      dev.network["Default Interface"] = capturedOutput;
    }
  });
};

function _system_update_ip_all() {
  _system_update_ip("Ethernet IP", "eth0");
  _system_update_ip("Ethernet 2 IP", "eth1");
  _system_update_ip("Wi-Fi IP", "wlan0");
  _system_update_ip("Wi-Fi 2 IP", "wlan1");
  _system_update_ip("GPRS IP", "ppp0");
  _current_active_connection();
};

_system_update_ip_all();
setInterval(_system_update_ip_all, 60000);
