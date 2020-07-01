defineVirtualDevice("freeDiskSpace", {
  title: "Disk Space",
  cells: 
  {
    'Avaliable_kB': 
    {
    type: "text",
    value: "0"
    },
    'Used_kB':
    {
    type: "text",
    value: "0"
    },
    'Use percent':
    {
    type: "text",
    value: "99"
    },
  }
});

function updateFreeDiskSpace() {
  runShellCommand("df -k /mnt/data | tail -1", {
    captureOutput: true,
    exitCallback: function (exitCode, capturedOutput) {
      var CapturedSeparated = capturedOutput.split(/\s+/);
      log.info("CapturedSeparated ",CapturedSeparated);
      dev["freeDiskSpace"]["Avaliable_kB"] = CapturedSeparated[3]; //Avaliable
      dev["freeDiskSpace"]["Used_kB"] = CapturedSeparated[2]; //Used
      dev["freeDiskSpace"]["Use percent"] = CapturedSeparated[4].replace("%", ""); //Use percent
    }
  });
};

updateFreeDiskSpace();
setInterval(updateFreeDiskSpace, 140000);



