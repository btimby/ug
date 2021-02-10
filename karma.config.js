module.exports = function(config) {
  config.set({
    basePath: '.',
    frameworks: ['browserify', 'mocha', 'chai'],
    files: [
      'tests/browser/**/test_*.js',
      'tests/test_*.js',
    ],
    preprocessors: {
      'tests/browser/**/test_*.js': ['browserify'],
      'tests/test_*.js': ['browserify'],
    },
    reporters: ['coverage', 'progress'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    browsers: [
      'ChromeHeadless',
      'Firefox',
    ],
    autoWatch: false,
    concurrency: Infinity,
    customLaunchers: {
      FirefoxHeadless: {
        base: 'Firefox',
        flags: ['-headless'],
        displayName: 'FirefoxHeadless',
      },
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox'],
        displayName: 'ChromeHeadlessNoSandbox',
      },
    },
    browserify: {
      debug: true,
    },
    coverageReporter: {
      dir: '.coverage',
      type: 'html'
    }
  });
};
