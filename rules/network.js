var checkAddress = '1.1.1.1';

// While editing cell names, mind compatibility with existing homeui dashboards!

defineVirtualDevice('network', {
	title: {en: 'Network', ru: 'Сеть'},
	cells: {
		'Active Connections': {title: {en: 'Active Connections', ru: 'Активные соединения'}, type: 'text', value: '', order: 1},
		'Default Interface': {title: {en: 'Default Interface', ru: 'Интерфейс по умолчанию'}, type: 'text', value: '', order: 2},

		'Ethernet IP': {type: 'text', value: '', order: 4},
		'Ethernet 2 IP': {type: 'text', value: '', order: 6},
		'Wi-Fi IP': {type: 'text', value: '', order: 8},
		'Wi-Fi 2 IP': {type: 'text', value: '', order: 10},
		'GPRS IP': {type: 'text', value: '', order: 12},

		'Ethernet IP Online Status': {title: {en: 'Ethernet IP Online Status', ru: 'Ethernet IP статус'}, type: 'switch', value: false, readonly: true, order: 7},
		'Ethernet 2 IP Online Status': {title: {en: 'Ethernet 2 IP Online Status', ru: 'Ethernet 2 IP статус'}, type: 'switch', value: false, readonly: true, order: 9},
		'Internet Connection': {title: {en: 'Internet Connection', ru: 'Интернет соединение'}, type: 'text', value: '', order: 3},
		'Wi-Fi IP Online Status': {title: {en: 'Wi-Fi IP Online Status', ru: 'Wi-Fi IP статус'}, type: 'switch', value: false, readonly: true, order: 9},
		'Wi-Fi 2 IP Online Status': {title: {en: 'Wi-Fi 2 IP Online Status', ru: 'Wi-Fi 2 IP статус'}, type: 'switch', value: false, readonly: true, order: 11},
		'GPRS IP Online Status': {title: {en: 'GPRS IP Online Status', ru: 'GPRS IP статус'}, type: 'switch', value: false, readonly: true, order: 13}
	}
});

function _system_update_ip(name, iface) {
	runShellCommand("ip -o -4 addr show {} 2>/dev/null | awk -F ' *|/' '{print $4}' | sort | uniq".format(iface), {
		captureOutput: true,
		exitCallback: function (code, output) {
			dev.network[name] = output;
		}
	});

	runShellCommand('ping -q -W1 -c3 -I {} {} 2>/dev/null'.format(iface, checkAddress), {
		captureOutput: false,
		exitCallback: function (code) {
			dev.network['{} Online Status'.format(name)] = !code;
		}
	});
}

function _current_active_connection() {
	runShellCommand("ip route get {} 2>/dev/null | grep -oP 'dev\\s+\\K[^ ]+'".format(checkAddress), {
		captureOutput: true,
		exitCallback: function (code, output) {
			dev.network['Default Interface'] = !code ? output.trim() : '';
		}
	});

	runShellCommand('nmcli -t -f DEVICE,NAME c s -a 2>/dev/null', {
		captureOutput: true,
		exitCallback: function (code, output) {
			if (code !== 0) {
				dev.network['Active Connections'] = '';
				dev.network['Internet Connection'] = '';

				return;
			}

			var lines = output.split('\n');
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
		}
	});
}

(function _system_update_ip_all() {
	_system_update_ip('Ethernet IP', 'eth0');
	_system_update_ip('Ethernet 2 IP', 'eth1');
	_system_update_ip('Wi-Fi IP', 'wlan0');
	_system_update_ip('Wi-Fi 2 IP', 'wlan1');
	_system_update_ip('GPRS IP', 'ppp0');

	_current_active_connection();

	setTimeout(_system_update_ip_all, 60 * 1000);
})();