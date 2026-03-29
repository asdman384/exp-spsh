module.exports = function(config) {
    config.set({
        frameworks: ['jasmine', '@angular-devkit/build-angular'],
        browsers: ['ChromeHeadless'],
        singleRun: true,
    });
};