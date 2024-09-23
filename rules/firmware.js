function publishFitFileInfo(filePath, presentTopic, compatibilityTopic) {
  runShellCommand('test -f {}'.format(filePath), {
    exitCallback: function (exitCode) {
      if (exitCode != 0) {
        publish(presentTopic, 'false', 0, true);
        return;
      }
      publish(presentTopic, 'true', 0, true);
      runShellCommand('FIT={} wb-fw-compatible'.format(filePath), {
        captureOutput: true,
        exitCallback: function (exitCode, capturedOutput) {
          if (exitCode != 0) return;
          publish(compatibilityTopic, capturedOutput.trim(), 0, true);
        }
      });
    }
  });
}

publishFitFileInfo(
  '/mnt/data/.wb-restore/factoryreset.fit',
  '/firmware/fits/factoryreset/present',
  '/firmware/fits/factoryreset/compatibility'
);

publishFitFileInfo(
  '/mnt/data/.wb-restore/factoryreset.original.fit',
  '/firmware/fits/factoryreset-original/present',
  '/firmware/fits/factoryreset-original/compatibility'
);

publish('/firmware/status', 'IDLE', 0, true);
