defineVirtualDevice("network", {
    title:"Network",
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
    _system_update_ip("Ethernet IP", "eth0");
    _system_update_ip("Ethernet 2 IP", "eth1");
    _system_update_ip("Wi-Fi IP", "wlan0");
    _system_update_ip("Wi-Fi 2 IP", "wlan1");
    _system_update_ip("GPRS IP", "ppp0");
};

_system_update_ip_all();
setInterval(_system_update_ip_all, 60000);
