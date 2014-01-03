/** @jsx React.DOM */

require.config({
    baseUrl: '/static/components/',
    urlArgs: "d=" + parseInt(Config.cache_buster, 10),
    paths: {
        "bootstrap": "bootstrap/dist/js/bootstrap.min",
        "history": "history.js/scripts/bundled/html4%2Bhtml5/native.history",
        "jquery": "jquery/jquery",
        "react": "react/react.min",
        "router": "routerjs/Router",
        "linear-partition": "linear-partition/linear_partition",

        // Angular deps for uploader. To be refactored to React
        "angular": "angular/angular.min",
        "jquery-serialize-object": "jquery-serialize-object/jquery.serialize-object.compiled",
        "dirname": "phpjs/functions/filesystem/dirname",
        "number_format": "phpjs/functions/strings/number_format",
        "underscore": "underscore/underscore",

        // App
        "gallery": "/static/js/gallery",
        "uploader": "/static/js/uploader"
    },
    shim: {
        'angular': {
            exports: 'angular'
        },
        'bootstrap': {
            deps: ['jquery']
        },
        'dirname': {
            exports: 'dirname'
        },
        'jquery-serialize-object': {
            deps: ['jquery']
        },
        'linear-partition': {
            exports: 'linear_partition'
        },
        'number_format': {
            exports: 'number_format'
        },
        'router': {
            exports: 'window.Router'
        },
        'underscore': {
            exports: '_'
        },
    }
});

// Defer loading angular
// http://code.angularjs.org/1.2.1/docs/guide/bootstrap#overview_deferred-bootstrap
window.name = "NG_DEFER_BOOTSTRAP!";

require(['jquery', 'router', 'history'], function ($,  Router) {
    var router = new Router();

    // Uploader
    router.route('/upload/:id', function(id) {
        require(['uploader'], function () {
            // Resume bootstrapping
            // http://code.angularjs.org/1.2.1/docs/guide/bootstrap#overview_deferred-bootstrap
            angular.resumeBootstrap();
        })
    });

    // Index
    router.route('/', function() {
        require(["react", "gallery"], function(React, GalleryList) {
            React.renderComponent(
                <GalleryList
                    url="/rest/gallery/"
                    viewportWidth={$('#app').width()}
                    windowHeight={$(window).height()} />,
                document.getElementById('app')
            );
        });
    });

    // Start the router
    router.start(window.location.pathname);
})
