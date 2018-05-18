defineVirtualDevice("network", {
    title:"Network",
    cells: {
        "Ethernet IP": {
            type: "text",
            value: ""
        },
        "Wi-Fi IP": {
            type: "text",
            value: false
        },
        "GPRS IP": {
            type: "text",
            value: ""
        }
    }
});



function _system_update_ip(name, iface) {
   runShellCommand('ip addr show ' + iface + ' | grep \"inet\\b\" | awk \'{print $2}\' | cut -d/ -f1',{      
      captureOutput: true,
      exitCallback: function (exitCode, capturedOutput) {
        dev.network[name] = capturedOutput;
      }
  });
};


function _system_update_ip_all() {
    _system_update_ip("Ethernet IP 0", "eth0");
    _system_update_ip("Ethernet IP 1", "eth1");
    _system_update_ip("Wi-Fi IP 0", "wlan0");
    _system_update_ip("Wi-Fi IP 1", "wlan1");
    _system_update_ip("GPRS IP", "ppp0");
};

_system_update_ip_all();
setInterval(_system_update_ip_all, 60000);
