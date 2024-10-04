var checkAddress = '1.1.1.1';

defineVirtualDevice('network', {
  /*
  While editing cell names, mind compatibility with existing homeui dashboards!
  */
  title: { en: 'Network', ru: 'Сеть' },
  cells: {
    'Active Connections': {
      title: { en: 'Active Connections', ru: 'Активные соединения' },
      type: 'text',
      value: '',
      order: 1,
    },
    'Default Interface': {
      title: { en: 'Default Interface', ru: 'Интерфейс по умолчанию' },
      type: 'text',
      value: '',
      order: 2,
    },
    'Internet Connection': {
      title: { en: 'Internet Connection', ru: 'Интернет соединение' },
      type: 'text',
      value: '',
      order: 3,
    },
    'Ethernet IP': {
      title: { en: 'Ethernet 1 IP', ru: 'Ethernet 1 IP' },
      type: 'text',
      value: '',
      order: 4,
    },
    'Ethernet IP Online Status': {
      title: { en: 'Ethernet 1 Internet Access', ru: 'Ethernet 1 Доступ к интернету' },
      type: 'switch',
      value: false,
      readonly: true,
      order: 5,
    },
    'Ethernet IP Connection Enabled': {
      title: { en: 'Ethernet 1 Enabled', ru: 'Ethernet 1 Включен' },
      type: 'switch',
      value: false,
      readonly: true,
      order: 6,
    },
    'Ethernet 2 IP': {
      type: 'text',
      value: '',
      order: 7,
    },
    'Ethernet 2 IP Online Status': {
      title: { en: 'Ethernet 2 Internet Access', ru: 'Ethernet 2 Доступ к интернету' },
      type: 'switch',
      value: false,
      readonly: true,
      order: 8,
    },
    'Ethernet 2 IP Connection Enabled': {
      title: { en: 'Ethernet 2 Enabled', ru: 'Ethernet 2 Включен' },
      type: 'switch',
      value: false,
      readonly: true,
      order: 9,
    },
    'Wi-Fi IP': {
      title: { en: 'Wi-Fi 1 IP', ru: 'Wi-Fi 1 IP' },
      type: 'text',
      value: '',
      order: 10,
    },
    'Wi-Fi IP Online Status': {
      title: { en: 'Wi-Fi 1 Internet Access', ru: 'Wi-Fi 1 Доступ к интернету' },
      type: 'switch',
      value: false,
      readonly: true,
      order: 11,
    },
    'Wi-Fi IP Connection Enabled': {
      title: { en: 'Wi-Fi 1 Enabled', ru: 'Wi-Fi 1 Включен' },
      type: 'switch',
      value: false,
      readonly: true,
      order: 12,
    },
    'Wi-Fi 2 IP': {
      title: { en: 'Wi-Fi 2 IP', ru: 'Wi-Fi 2 IP' },
      type: 'text',
      value: '',
      order: 13,
    },
    'Wi-Fi 2 IP Online Status': {
      title: { en: 'Wi-Fi 2 Internet Access', ru: 'Wi-Fi 2 Доступ к интернету' },
      type: 'switch',
      value: false,
      readonly: true,
      order: 14,
    },
    'Wi-Fi 2 IP Connection Enabled': {
      title: { en: 'Wi-Fi 2 Enabled', ru: 'Wi-Fi 2 Включен' },
      type: 'switch',
      value: false,
      readonly: true,
      order: 15,
    },
    'GPRS IP': {
      type: 'text',
      value: '',
      order: 16,
    },
    'GPRS IP Online Status': {
      title: { en: 'GPRS IP Internet Access', ru: 'GPRS IP Доступ к интернету' },
      type: 'switch',
      value: false,
      readonly: true,
      order: 17,
    },
    'GPRS IP Connection Enabled': {
      title: { en: 'GPRS IP Enabled', ru: 'GPRS IP Включен' },
      type: 'switch',
      value: false,
      readonly: true,
      order: 18,
    },
  },
});

function _system_update_ip(name, iface) {
  runShellCommand(
    "ip -o -4 addr show {} 2>/dev/null | awk -F ' *|/' '{print $4}' | sort | uniq".format(iface),
    {
      captureOutput: true,
      exitCallback: function (exitCode, capturedOutput) {
        dev.network[name] = capturedOutput;
      },
    }
  );
  runShellCommand('ping -q -W1 -c3 -I {} {} 2>/dev/null'.format(iface, checkAddress), {
    captureOutput: false,
    exitCallback: function (exitCode) {
      dev.network[name + ' Online Status'] = exitCode === 0;
    },
  });
  runShellCommand("ip link show {} 2>/dev/null | awk '{for (i=1; i<=NF; i++) if ($i == \"state\") print $(i+1)}'".format(iface), {
    captureOutput: true,
    exitCallback: function (exitCode, capturedOutput) {
      dev.network[name + ' Connection Enabled'] = capturedOutput.trim() === "UP";
    },
  });
}

function _current_active_connection() {
  runShellCommand("ip route get {} 2>/dev/null | grep -oP 'dev\\s+\\K[^ ]+'".format(checkAddress), {
    captureOutput: true,
    exitCallback: function (exitCode, capturedOutput) {
      dev.network['Default Interface'] = exitCode === 0 ? capturedOutput.trim() : '';
    },
  });

  runShellCommand('nmcli -t -f DEVICE,NAME c s -a 2>/dev/null', {
    captureOutput: true,
    exitCallback: function (exitCode, capturedOutput) {
      if (exitCode != 0) {
        dev.network['Active Connections'] = '';
        dev.network['Internet Connection'] = '';
        return;
      }
      var lines = capturedOutput.split('\n');
      var active_connections = [];
      for (var i = 0; i < lines.length - 1; i++) {
        var dev_name = lines[i].split(':')[0].trim();
        var con_name = lines[i].split(':')[1].trim();
        active_connections.push(con_name);
        if (dev_name === dev.network['Default Interface']) {
          dev.network['Internet Connection'] = con_name;
        }
      }
      dev.network['Active Connections'] = JSON.stringify(active_connections.sort());
    },
  });
}

function _system_update_ip_all() {
  _system_update_ip('Ethernet IP', 'eth0');
  _system_update_ip('Ethernet 2 IP', 'eth1');
  _system_update_ip('Wi-Fi IP', 'wlan0');
  _system_update_ip('Wi-Fi 2 IP', 'wlan1');
  _system_update_ip('GPRS IP', 'ppp0');
  _current_active_connection();
}

_system_update_ip_all();
setInterval(_system_update_ip_all, 60000);
