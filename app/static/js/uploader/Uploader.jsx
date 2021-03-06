define('uploader',
[
    "jquery",
    "angular",
    "underscore",
    "number_format",
    "dirname",
    "jquery-serialize-object",
    "bootstrap",
    "jpegmeta"
], function(
    $,
    angular,
    _,
    number_format,
    dirname
) {
    'use strict';

    // Declare app level module
    angular.module('uploaderApp', ['uploaderApp.controllers', 'uploaderApp.directives', 'uploaderApp.services']);

    /* Directives */
    angular.module('uploaderApp.directives', []).
        directive('fileChange', [function() {
            // Add a directive so we can trigger change events on file inputs
            // Retrieved on 2013-07-28 from http://jsfiddle.net/neilsarkar/vQzKJ/
            return {
                link: function(scope, element, attrs) {
                    element[0].onchange = function() {
                        scope[attrs.fileChange](element[0]);
                    };
                }
            };
        }
    ]);

    /* Services */
    var files = [];
    angular.module('uploaderApp.services', []).
        factory('notify', ['$window', function($window) {
            return function($scope, file) {
                getImageAttributes(file, function (file) {
                    // Tell the backend this file has been uploaded
                    $scope.uploadQueue.add(file);
                });
            };
        }
    ]);

    function getImageAttributes(file, callback) {
        // Get the width, height and aspect ratio of the image
        var image = new Image();
        image.onload = function() {
            file.width = this.width;
            file.height = this.height;
            file.aspect_ratio = (this.width / this.height);

            callback(file);
        };
        image.onerror = function() {
            file.width = null;
            file.height = null;
            file.aspect_ratio = null;

            callback(file);
        };

        var url = window.URL || window.webkitURL;
        image.src = url.createObjectURL(file);
    }

    /* Controllers */

    /**
     * The uploader controller
     *
     * @param Scope $scope The Angular.js scope
     */
    angular.module('uploaderApp.controllers', [])
        .controller('UploaderCtrl', ['$scope', 'notify', function($scope, $uploadCompleteCallback) {

        // Start watching for files which have finished uploading
        $scope.uploadQueue = new UploadQueue($scope);

        // Initialize our variables
        $scope.files = [];

        // Fit the input box the same size as its button
        var inputFile = $('.input-file');
        $(inputFile).css({
            height: $(inputFile).parent().css('height'),
            width: $(inputFile).parent().css('width'),
            marginTop: '-' + $(inputFile).parent().css('paddingTop'),
            marginLeft: '-' + $(inputFile).parent().css('paddingLeft')
        });
        $(inputFile).attr('multiple', 'multiple');

        /**
         * Get the total number of bytes to upload
         *
         * @return integer
         */
        $scope.getBytesTotal = function () {
            var bytesTotal = 0;
            for (var i=0; i < $scope.files.length; i++) {
                if ($scope.files[i].isTooBig) {
                    continue;
                }

                bytesTotal += $scope.files[i].size;
            }

            return bytesTotal;
        };

        /**
         * Get the total number of bytes uploaded
         *
         * @return integer
         */
        $scope.getBytesUploaded = function () {
            var bytesUploaded = 0;
            for (var i=0; i < $scope.files.length; i++) {
                if ($scope.files[i].bytesUploaded !== undefined) {
                    bytesUploaded += $scope.files[i].bytesUploaded;
                }
            }

            return bytesUploaded;
        };

        /**
         * Return the upload progress as a percentage
         *
         * @return integer
         */
        $scope.getUploadProgress = function () {
            var bytesTotal = $scope.getBytesTotal();
            var bytesUploaded = $scope.getBytesUploaded();

            return (bytesUploaded / bytesTotal) * 100;
        };

        /**
         * Get the number of files left to upload
         *
         * @return integer
         */
        $scope.getFilesToUpload = function () {
            return _.filter($scope.files, function (file) {
                return !file.isUploaded && !file.isUploadError && !file.isTooBig;
            }).length;
        };

        /**
         * Add one or more files to the upload queue
         *
         * @param DOM element The file upload element
         */
        $scope.addFiles = function(element) {
            if ($scope.getUploadProgress() > 0) {
                // Clear previously uploaded files
                $scope.files = [];
            }

            $scope.$apply(function() {
                // Add the files to the list
                for (var i=0; i < element.files.length; i++) {
                    var file = element.files[i];
                    if (file.size > Config.max_upload_size) {
                        file.isTooBig = true;
                    } else {
                        file.isTooBig = false;
                    }
                    file.sizeFormatted = number_format(file.size);
                    file.progress = 0;
                    file.url = null;
                    file.isUploaded = false;
                    file.isUploadError = false;

                    // Get the EXIF information for this file
                    var fileReader = new FileReader();
                    fileReader.onloadend = function () {
                        var dateCreated;
                        try {
                            var meta = new JpegMeta.JpegFile(this.result, this.file.name);
                            dateCreated = meta.exif.DateTimeOriginal.value;
                        } catch (exception) {
                            console.log("No EXIF info found in this file");
                            dateCreated = null;
                        }

                        // Add the created date to this file in the scope
                        for (var i in this.$scope.files) {
                            if (this.$scope.files[i].name == this.file.name) {
                                this.$scope.files[i].created = dateCreated;
                                break;
                            }
                        }
                    };

                    fileReader.file = file;
                    fileReader.$scope = $scope;
                    fileReader.readAsBinaryString(file);

                    $scope.files.push(file);
                }

                $scope.files = _.uniq($scope.files);
            });
        };

        /**
         * Clear all files from the upload queue
         */
        $scope.clearFiles = function () {
            // Abort any pending uploads
            for (var i=0; i < $scope.files.length; i++) {
                if ($scope.files[i].xhr !== undefined) {
                    $scope.files[i].xhr.abort();
                }
            }

            $scope.files = [];
        };

        /**
         * Remove a single file from the upload queue
         *
         * @param File file The file to remove
         */
        $scope.removeFile = function (file) {
            if (file.xhr !== undefined) {
                file.xhr.abort();
            }

            $scope.files = _.without($scope.files, file);
        };

        /**
         * Upload the files in the queue
         *
         * @params Event $event The DOM event
         */
        $scope.uploadFiles = function ($event) {
            $event.preventDefault();

            // Get the form data as a key => value array
            var formObject = $('.form-upload').serializeObject();
            var formUrl = $('.form-upload').attr('action');
            var formMethod = $('.form-upload').attr('method');

            for (var i=0; i < $scope.files.length; i++) {
                var file = $scope.files[i];

                // Don't upload the same file twice
                if (file.isUploaded === true) {
                    continue;
                }

                // Don't upload files which exceed the max upload size
                if (file.isTooBig === true) {
                    continue;
                }

                var u = new Uploader($scope, $uploadCompleteCallback, file, formObject, formUrl, formMethod);
                u.send();
            }
        };
    }]);

    /**
     * The upload queue class
     */
    function UploadQueue($scope) {
        this.$scope = $scope;
        this.queue = [];
        this.sending = false;
        this.interval = 1000; // milliseconds

        setInterval(this.watch.bind(this), this.interval);
    }

    UploadQueue.prototype.watch = function () {
        // Only send one at a time
        if (this.sending) {
            return;
        }

        // Send the next photo in the queue
        if (this.queue.length > 0) {
            this.sending = true;
            this.photo = this.queue.shift();
            var matches = this.photo.name.match(/^(.+?)\.([a-z]*)/i, '');
            var fileName = matches[1];
            var fileExt = matches[2];
            var data = {
                name: fileName,
                ext: fileExt,
                aspect_ratio: this.photo.aspect_ratio,
                gallery_id: Config.gallery_id,
                created: this.photo.created
            };

            $.post('/rest/photo/', data, function (result) {
                this.sending = false;

                // Start polling for the thumbnail
                this.pollThumbnailUrl(this.photo);
            }.bind(this));
        }
    };

    UploadQueue.prototype.add = function (photo) {
        this.queue.push(photo);
    };

    /**
     * Start polling the thumbnail url to see if it has been created yet.
     *
     * Once the thumbnail has been created, update angular.js with the url to the
     * thumbnail so it can be added to the view template.
     *
     * @param object photo The photo
     */
    UploadQueue.prototype.pollThumbnailUrl = function (photo) {
        var matches = photo.name.match(/^(.+?)\.([a-z]*)/i, '');
        var fileName = matches[1];
        var fileExt = matches[2];

        var photoUrl = photo.url.replace('.' + fileExt, '_thumb.jpg');

        $.ajax({
            url: photoUrl,
            type: 'HEAD',
            error: function() {
                // 403/404'd, so we haven't found the thumbnail yet, keep waiting
                setTimeout(this.pollThumbnailUrl.bind(this, photo), 1000);
            }.bind(this),
            success: function() {
                // Found the thumbnail, update the page!
                this.$scope.$apply(function() {
                    photo.imgUrl = photoUrl;
                }.bind(this));
            }.bind(this)
        });
    };

    /**
     * The uploader class
     *
     * @param Scope $scope The Angular.js scope
     * @param function $uploadCompleteCallback The upload complete callback function
     * @param File file The file to upload
     * @param object formObject The form fields in a key => value object
     * @param string formUrl The url to upload the file to
     * @param string formMethod The form method
     */
    function Uploader($scope, $uploadCompleteCallback, file, formObject, formUrl, formMethod) {
        this.file = file;
        this.formObject = formObject;
        this.formUrl = formUrl;
        this.formMethod = formMethod;
        this.$scope = $scope;
        this.$uploadCompleteCallback = $uploadCompleteCallback;
    }

    /**
     * Upload the file
     */
    Uploader.prototype.send = function () {
        var $this = this;
        var xhr = new XMLHttpRequest();
        this.file.xhr = xhr;

        /**
         * Update the upload progress for this file
         *
         * @param Event e The event
         */
        var uploadProgress = function(e) {
            var percent = Math.round((e.loaded / e.total) * 100);
            $this.$scope.$apply(function() {
                $this.file.bytesUploaded = e.loaded;
                $this.file.progress = percent;
            });
        };
        xhr.upload.addEventListener("progress", uploadProgress, false);

        /**
         * Triggered when the upload is complete
         *
         * @param Event e The event
         */
        var uploadComplete = function(e) {
            if (e.target.status == 201) {
                // Extract the path to the file
                var imagePath = $(e.target.responseXML).find('Key').text();
                var folder;
                if (imagePath.match(/\//)) {
                    folder = dirname(imagePath);
                } else {
                    folder = '';
                }

                var url = $(e.target.responseXML).find('Location').text();

                $this.$scope.$apply(function() {
                    $this.file.isUploaded = true;
                    $this.file.url = url;
                    $this.file.folder = folder;

                    // Trigger the upload complete callback
                    $this.$uploadCompleteCallback($this.$scope, $this.file);
                });
            } else {
                $this.$scope.$apply(function() {
                    $this.file.isUploadError = true;
                });
            }
        };
        xhr.addEventListener("load", uploadComplete, false);

        // Assemble the form data
        var form = new FormData();
        for (var j in this.formObject) {
            form.append(j, this.formObject[j]);
        }
        form.append('file', this.file);

        // Super cEvin Attack Mode Go!
        xhr.open(this.formMethod, this.formUrl, true);
        xhr.send(form);
    };
});
