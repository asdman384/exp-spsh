module.exports = function(config) {
    config.set({
        frameworks: ['jasmine', '@angular-devkit/build-angular'],
        browsers: ['Chrome'],
        singleRun: true,
    });
};