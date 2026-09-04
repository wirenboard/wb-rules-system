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
        dev.network[name] = capturedOutput.trim();
      },
    }
  );
  runShellCommand('ping -q -W1 -c3 -I {} {} 2>/dev/null'.format(iface, checkAddress), {
    captureOutput: false,
    exitCallback: function (exitCode) {
      dev.network[name + ' Online Status'] = exitCode === 0;
    },
  });
  // ppp and other point-to-point interfaces stay at "state UNKNOWN" while running,
  // so look at the LOWER_UP flag instead: it is set exactly when the link is up
  runShellCommand(
    "ip link show {} 2>/dev/null | head -n1 | grep -qE '<[^>]*(,|<)LOWER_UP(,|>)'".format(iface),
    {
      captureOutput: false,
      exitCallback: function (exitCode) {
        dev.network[name + ' Connection Enabled'] = exitCode === 0;
      },
    }
  );
}

function _current_active_connection() {
  runShellCommand("ip route get {} 2>/dev/null | grep -oP 'dev\\s+\\K[^ ]+'".format(checkAddress), {
    captureOutput: true,
    exitCallback: function (exitCode, capturedOutput) {
      var default_interface = exitCode === 0 ? capturedOutput.trim() : '';
      dev.network['Default Interface'] = default_interface;
      // the connection list is read here, not in parallel,
      // so that it always sees the interface resolved above
      _update_active_connections(default_interface);
    },
  });
}

function _update_active_connections(default_interface) {
  runShellCommand('nmcli -t -f NAME,UUID c s -a 2>/dev/null', {
    captureOutput: true,
    exitCallback: function (exitCode, capturedOutput) {
      if (exitCode != 0) {
        dev.network['Active Connections'] = '';
        dev.network['Internet Connection'] = '';
        return;
      }
      var lines = capturedOutput.split('\n');
      var connections = [];
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line === '') {
          continue;
        }
        // nmcli escapes colons inside a name, the uuid never has any: split at the last one
        var separator = line.lastIndexOf(':');
        connections.push({ name: line.slice(0, separator).trim(), uuid: line.slice(separator + 1).trim() });
      }
      var names = [];
      for (var j = 0; j < connections.length; j++) {
        names.push(connections[j].name);
      }
      dev.network['Active Connections'] = JSON.stringify(names.sort());
      _update_internet_connection(connections, default_interface);
    },
  });
}

function _update_internet_connection(connections, default_interface) {
  if (default_interface === '' || connections.length === 0) {
    dev.network['Internet Connection'] = '';
    return;
  }
  // NetworkManager reports the modem port (ttyUSB1) as the device of a GSM connection
  // while the routes live on ppp0, so match by the interface carrying the IP configuration
  var pending = connections.length;
  var found = '';
  for (var i = 0; i < connections.length; i++) {
    (function (connection) {
      runShellCommand("nmcli -t -f GENERAL.IP-IFACE c s {} 2>/dev/null".format(connection.uuid), {
        captureOutput: true,
        exitCallback: function (exitCode, capturedOutput) {
          var ip_iface = capturedOutput.split(':')[1];
          if (exitCode === 0 && ip_iface !== undefined && ip_iface.trim() === default_interface) {
            found = connection.name;
          }
          pending -= 1;
          if (pending === 0) {
            dev.network['Internet Connection'] = found;
          }
        },
      });
    })(connections[i]);
  }
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
