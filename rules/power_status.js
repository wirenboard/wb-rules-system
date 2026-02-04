defineVirtualDevice('power_status', {
  title: { en: 'Power status', ru: 'Статус питания' },

  cells: {
    'working on battery': {
      title: { en: 'Working on battery', ru: 'Работа от батареи' },
      type: 'switch',
      value: false,
      readonly: true,
    },
    Vin: {
      title: { en: 'Input voltage', ru: 'Входное напряжение' },
      type: 'voltage',
      value: 0,
    },
  },
});

function updateData(){
  if (dev['power_status']['working on battery']) {
    dev['power_status']['Vin'] = 0;
  } else {
    dev['power_status']['Vin'] = dev['wb-adc']['Vin'];
  }
}

defineRule('_system_track_vin', {
  whenChanged: ['wb-adc/Vin', 'power_status/working on battery'],
  then: updateData,
});

defineRule({
  asSoonAs: function() {
    return dev['wb-adc']['Vin'] !== null;
  },
  then: updateData,
});
