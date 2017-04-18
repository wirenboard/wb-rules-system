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
   runShellCommand('ifconfig ' + iface + ' | awk -F \' *|:\' \'/inet addr/{print $4}\'',{
      captureOutput: true,
      exitCallback: function (exitCode, capturedOutput) {
        dev.network[name] = capturedOutput;
      }
  });
};


function _system_update_ip_all() {
    _system_update_ip("Ethernet IP", "eth0");
    _system_update_ip("Wi-Fi IP", "wlan0");
    _system_update_ip("GPRS IP", "ppp0");
};

_system_update_ip_all();
setInterval(_system_update_ip_all, 60000);
