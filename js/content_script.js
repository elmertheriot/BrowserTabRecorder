/* Required: js/config.js */

$(function()
{
    // Variables & Constants
    var IMAGE_CURSOR = chrome.extension.getURL("images/cursor.png")
        , IMAGE_ICON_VIDEO = chrome.extension.getURL("images/video-8x.png")
        , WIDTH_CURSOR_IMAGE = 48
        , HEIGHT_CURSOR_IMAGE = 48
        , TIME_AUTOHIDE_CONTAINER = 2000    // 2s
        , ID_THUMBNAIL_CONTAINER = 'carlin-tab-recorder'
        , CLASS_THUMBNAIL = 'carlin-tab-recorder-thumbnail'
        , CLASS_CURSOR_TRACKER = 'carlin-tab-recorder-cursor'
        , CLASS_SHOW_CONTAINER = 'show'
        , CLASS_DOWNLOAD_TARGET = 'target'
        , CLASS_BUTTON_DOWNLOAD = 'downloadButton'
        , CLASS_BUTTON_RECORD = 'recordButton'
        , CLASS_BUTTON_CLOSE = 'closeButton'
        , CLASS_CURRENTLY_RECORDING = 'recording'
        , CLASS_CURRENTLY_PROCESSING = 'processing'
        , cursorTracker = null              // Reference to cursor tracker element
        , thumbnailContainer = null         // Reference to thumbnail container
        , thumbnailHideTimer = null         // Timer handle for autohiding container
        , recording = false                 // Recording state
        , selectedThumbnail = null          // Track current live video thumbnail
    ;

    // Initialize Tab Recorder
    init();


    /////////////////////////////////////////
    // FUNCTIONS
    
    // Initialize the extension script
    function init() 
    {
        console.log('Init Tab Recorder');

        // Listener for mouse movement to show cursor for recording
        $(document).on('mousemove scroll', function (event) 
        {
            if (cursorTracker && recording) 
            {
                cursorTracker.css({
                    'top': event.pageY - WIDTH_CURSOR_IMAGE / 2,
                    'left': event.pageX - HEIGHT_CURSOR_IMAGE / 2,
                });
            }
        });

        // Listener for messages from background
        chrome.runtime.onMessage.addListener(function (message, sender, response) 
        {
            console.log('sender:', sender);
            console.log('message:', message);

            // Handle message
            switch (message.request)
            {
                case "captureTabScreenshot":
                    createThumbnailContainer();
                    createScreenshotThumbnail(message.sourceURL);
                    break;

                case "captureTabGif":
                    createThumbnailContainer();
                    createCursorTracker();
                    createGifThumbnail();
                    break;

                case "captureTabVideo":
                    createThumbnailContainer();
                    createCursorTracker();
                    createVideoThumbnail();
                    break;

                case "captureTabAudio":
                    createThumbnailContainer();
                    createAudioThumbnail();
                    break;

                case "videoRecordingStarted":
                    videoRecordingStarted(message.stream);
                    break;

                case "videoRecordingStopped":
                    videoRecordingStopped(message.sourceURL);
                    break;

                case "convertedGif":
                    convertedGif(message.sourceURL);
                    break;

                default:    // Try plugins
                    messagePlugin(message);
                    break;
            }
        });

        // Check if we were previously recording a video / audio that hasn't stopped yet.
        checkRecordingState(function (status) 
        {
            if (status && status.stream) 
            {
                createThumbnailContainer();
                createCursorTracker();
                selectedThumbnail = createVideoThumbnail();
                // TODO: Check for audio too
                videoRecordingStarted(status.stream);
            }
        });
    }

    // Try to send a message to plugins
    function messagePlugin(message)
    {
        if (TB_PLUGINS) // Check that plugins are loaded
        {
            var plugin = TB_PLUGINS[message.request];
            if (plugin) {
                plugin.content_script(message);
            }
        }
    }

    // Check recording state of background page, callback param is video stream
    function checkRecordingState(callback)
    {
        chrome.runtime.sendMessage({
            request: "videoRecordingStatus"
        }, callback);
    }

    // Create thumbnail container if it doesn't exist
    function createThumbnailContainer()
    {
        // If DNE, create it
        if (!thumbnailContainer) 
        {
            thumbnailContainer = $(document.createElement('div'))
                .attr('id', ID_THUMBNAIL_CONTAINER)
                .mouseenter(function (event) {
                    clearAutohideTimer();
                })
                .append($(document.createElement('div')).addClass('tab')
                    .mouseenter(function (event) 
                    {
                        var container = $('#' + ID_THUMBNAIL_CONTAINER);
                        if (!container.hasClass(CLASS_SHOW_CONTAINER)) {
                            container.addClass(CLASS_SHOW_CONTAINER);
                        }
                    })
                    .click(function (event) {
                        $('#' + ID_THUMBNAIL_CONTAINER).toggleClass(CLASS_SHOW_CONTAINER);
                    })
                )
                .append($(document.createElement('div')).addClass('background'));
        }


        // Add to body
        if (!thumbnailContainer.parent().length) {
            thumbnailContainer.appendTo('body');
        }

        // Animate
        if (!thumbnailContainer.hasClass(CLASS_SHOW_CONTAINER)) 
        {
            thumbnailContainer.css({ 'bottom':'-24px' })
                .animate({ 'bottom':'-12px' }, 'fast');
        }
    }

    // Create cursor tracker if it doesn't exist
    function createCursorTracker()
    {
        // Create it if it doesn't exist
        if (!cursorTracker) 
        {
            cursorTracker = $(document.createElement('div'))
                .addClass(CLASS_CURSOR_TRACKER);
        }

        // Add to body and hide
        cursorTracker.hide().appendTo('body');
    }

    // Create a container for the video
    function createVideoThumbnail()
    {
        console.log('createVideoThumbnail()');

        // Clear autohide timer, we want user to see they need to hit record
        if (thumbnailHideTimer) {
            clearTimeout(thumbnailHideTimer);
        }

        // Create video thumbnail and add to document
        var thumb = createThumbnail('video')
            .hide()
            .appendTo(thumbnailContainer)
            .slideDown('fast');

        // If container is not showing yet, show it permanently
        thumbnailContainer.addClass(CLASS_SHOW_CONTAINER);

        return thumb;
    }

    // Create a container for the video
    function createAudioThumbnail()
    {
        console.log('createAudioThumbnail()');

        // Clear autohide timer, we want user to see they need to hit record
        if (thumbnailHideTimer) {
            clearTimeout(thumbnailHideTimer);
        }

        // Create audio thumbnail and add to document
        var thumb = createThumbnail('audio')
            .hide()
            .appendTo(thumbnailContainer)
            .slideDown('fast');

        // If container is not showing yet, show it permanently
        thumbnailContainer.addClass(CLASS_SHOW_CONTAINER);

        return thumb;
    }

    // Create a container for the video
    function createGifThumbnail()
    {
        console.log('createGifThumbnail()');

        // Clear autohide timer, we want user to see they need to hit record
        if (thumbnailHideTimer) {
            clearTimeout(thumbnailHideTimer);
        }

        // Create video thumbnail and add to document
        var thumb = createThumbnail('gif')
            .hide()
            .appendTo(thumbnailContainer)
            .slideDown('fast');

        // If container is not showing yet, show it permanently
        thumbnailContainer.addClass(CLASS_SHOW_CONTAINER);

        return thumb;
    }

    // Start video recording
    function startVideoRecording($target)
    {
        console.log('startVideoRecording:', $target);

        // Track which video thumbnail is being recorded
        if ($target) {
            selectedThumbnail = $target.parents('.' + CLASS_THUMBNAIL);
        }
        
        // Adjust request based on gif vs video
        var request = (selectedThumbnail.find('img.gif').length) 
            ? 'startGifRecording' : 'startVideoRecording'

        // Tell background page to start recording
        chrome.runtime.sendMessage({ request: request });
    }

    // Video recording started
    function videoRecordingStarted(stream)
    {
        console.log('videoRecordingStarted:', stream);

        // Sanity check
        if (stream) 
        {
            // If selectedThumbnail exists, change record button
            if (selectedThumbnail) 
            {
                selectedThumbnail.find('.' + CLASS_BUTTON_RECORD)
                    .addClass(CLASS_CURRENTLY_RECORDING);
            }

            // Hide container
            thumbnailContainer.removeClass('show');

            // Show cursor tracker
            cursorTracker.fadeIn('fast');
            
            // Set recording to true
            recording = true;
        }
        else    // Error
        {
            console.log('ERROR: invalid video stream or already recording another tab!');
            alert('Unable to capture tab video feed or already recording another tab!');
        }
    }

    // Stop video recording
    function stopVideoRecording()
    {
        console.log('stopVideoRecording');

        // Hide cursor tracker
        cursorTracker.fadeOut('fast');

        // Change recording button to processing icon
        if (selectedThumbnail)
        {
            selectedThumbnail.find('.' + CLASS_BUTTON_RECORD)
                .removeClass(CLASS_CURRENTLY_RECORDING)
                .addClass(CLASS_CURRENTLY_PROCESSING);
        }

        // Adjust request based on gif vs video
        var request = (selectedThumbnail.find('img.gif').length) 
            ? 'stopGifRecording' : 'stopVideoRecording'

        // Tell background page to stop recording
        chrome.runtime.sendMessage({ request: request });
    }

    // UI changes to indicate recording is over
    function recordingStoppedInterfaceUpdate()
    {
        // Remove / hide recording button, show download button
        if (selectedThumbnail)
        {
            selectedThumbnail.find('.' + CLASS_BUTTON_RECORD)
                .fadeOut('fast', function() {
                    $(this).remove();
                });
            selectedThumbnail.find('.' + CLASS_BUTTON_DOWNLOAD)
                .fadeIn('fast');
        }

        // Set recording state to false
        recording = false;
    }

    // Video recording stopped
    function videoRecordingStopped(sourceURL)
    {
        console.log('videoRecordingStopped:', sourceURL);

        // UI changes for stopped recording
        recordingStoppedInterfaceUpdate();

        // Sanity check
        if (!sourceURL)
        {
            console.log('Error recording video file from video feed!');
            alert('Error recording video file from video feed!');

            // Clear reference to selected video thumbnail
            selectedThumbnail = null;
            return;
        }

        // Check that video thumbnail exists still
        if (!selectedThumbnail)
        {
            console.log('Could not find video element on page. Attempting to download!');
            alert('Could not find video element on page. Attempting to download!');

            // Try to download
            chrome.runtime.sendMessage({
                request: 'downloadContent',
                filename: 'screencapture - ' + formatDate(new Date()) + '.webm',
                contentURL: sourceURL,
            });

            return;
        }

        // Generate local url and set video element source to webm file
        var thumb = selectedThumbnail;
        createLocalObjectURL(sourceURL, function (url) 
        {
            thumb.find('.' + CLASS_DOWNLOAD_TARGET)
                .attr('src', url)                   
                .on('loadedmetadata', function() {
                    $(this).hover(function(event) {
                        $(this).attr('controls', true); // Show controls
                    }, function (event) {
                        $(this).attr('controls', false); // Hide controls
                    });
                })
                .on('error', function() 
                {
                    // Tell user preview not available, but can download
                    alert('Preview not available, but you can still download the video!');
                    console.log('WARNING: preview not available due to content security policy, but can still download.');

                    // Show video icon image instead
                    thumb.find('.' + CLASS_DOWNLOAD_TARGET).fadeOut('fast', function (event) {
                        $(this).remove();
                    });
                    thumb.css({
                        'background': 'url(' + IMAGE_ICON_VIDEO + ') center center no-repeat'
                    });
                });
        });
    
        // Clear reference
        selectedThumbnail = null;
    }

    // Update thumbnail with converted gif from video
    function convertedGif(sourceURL)
    {
        console.log('convertedGif:', sourceURL);

        // UI changes for stopped recording
        recordingStoppedInterfaceUpdate();

        // Sanity check
        if (!sourceURL)
        {
            console.log('Error converting video to gif!');
            alert('Error converting video to gif!');

            // Clear reference to selected video thumbnail
            selectedThumbnail = null;
            return;
        }

        // Check that video thumbnail exists still
        if (!selectedThumbnail) 
        {
            console.log('Could not find video element on page. Attempting to download!');
            alert('Could not find video element on page. Attempting to download!');

            // Try to download
            chrome.runtime.sendMessage({
                request: 'downloadContent',
                filename: 'screencapture - ' + formatDate(new Date()) + '.gif',
                contentURL: sourceURL,
            });

            return;
        }

        // Switch out video with img pointed to gif
        selectedThumbnail.find('.' + CLASS_DOWNLOAD_TARGET).attr('src', sourceURL);
        selectedThumbnail.find('.' + CLASS_BUTTON_DOWNLOAD)
            .off('click')
            .click(function (event) 
            {
                var $target = $(this).parent().find('.' + CLASS_DOWNLOAD_TARGET);

                // Sanity Check
                if (!$target.length) 
                {
                    console.log('ERROR: no target download found!');
                    alert("Couldn't find target download!");
                    return;
                }

                alert('To download the GIF, right click and select Save Image...');
            });


        // Clear reference
        selectedThumbnail = null;
    }

    // Create screenshot container element
    function createScreenshotThumbnail(srcURL)
    {
        console.log('createScreenshotThumbnail:', srcURL);

        // Create image thumbnail container
        var thumb = createThumbnail('image', srcURL)
            .hide()
            .appendTo(thumbnailContainer)
            .slideDown('fast')
            .find('.' + CLASS_BUTTON_DOWNLOAD).show();

        // If container is not showing yet, show it temporarily
        if (!thumbnailContainer.hasClass(CLASS_SHOW_CONTAINER)) 
        {
            thumbnailContainer.addClass(CLASS_SHOW_CONTAINER);
            autohideThumbnailContainer();
        }

        return thumb;
    }

    // Clear autohide timer
    function clearAutohideTimer()
    {
        // Clear autohide timer
        if (thumbnailHideTimer) 
        {
            clearTimeout(thumbnailHideTimer);
            thumbnailHideTimer = null;
        }
    }

    // Set thumbnail container for autohide, will refresh the timer if exists
    function autohideThumbnailContainer()
    {
        // Clear timer
        clearAutohideTimer();

        // Set new autohide timer
        thumbnailHideTimer = setTimeout(function() {
            thumbnailContainer.removeClass(CLASS_SHOW_CONTAINER);
        }, TIME_AUTOHIDE_CONTAINER);
    }

    // Convert date to a format that is good for downloading
    function formatDate(date)
    {
        return date.getFullYear() 
            + '.' + ('0' + (date.getMonth() + 1)).slice(-2)  
            + '.' + ('0' + date.getDate()).slice(-2)  
            + '-' + ('0' + date.getHours()).slice(-2)  
            + "_" + ('0' + date.getMinutes()).slice(-2) 
            + '_' + ('0' + date.getSeconds()).slice(-2) 
        ;
    }

    // Download and generate url for a local extension resource blob
    //  Mostly for us to get the videos across
    function createLocalObjectURL(sourceURL, callback)
    {
        console.log('createLocalObjectURL:', sourceURL);

        // Generate xhr and get url for resource
        //  Source: https://developer.chrome.com/apps/app_external
        var x = new XMLHttpRequest();
        x.open('GET', sourceURL);
        x.responseType = 'blob';
        x.onload = function() 
        {
            var url = window.URL.createObjectURL(x.response);
            console.log('localObjectURL:', url);

            callback(url);  // Callback must exist
        };
        x.send();
    }

    // Creates a thumbnail div for different types of content (image / video / audio), and returns it
    function createThumbnail(type, sourceURL)
    {
        // Create base thumbnail div
        var result = $(document.createElement('div')).addClass(CLASS_THUMBNAIL)
            .append($(document.createElement('div')).addClass('border'));
        var container = $(document.createElement('div')).addClass('container')
            .appendTo(result);

        // Add special elements based on content type
        switch (type)
        {
            case "image":
                container.css({ 'background-image': 'url(' + sourceURL + ')' })
                    .append($(document.createElement('img'))
                        .attr('title', 'screenshot - ' + formatDate(new Date()) + '.png')
                        .addClass(CLASS_DOWNLOAD_TARGET)
                        .addClass('screenshot')
                        .attr('src', sourceURL)
                    );
                break;

            case "video":
                container.append($(document.createElement('video'))
                    .attr('title', 'screencapture - ' + formatDate(new Date()) + '.webm')
                    .addClass(CLASS_DOWNLOAD_TARGET)
                    .attr('autoplay', true)
                ).append($(document.createElement('button'))    // Add record button
                    .addClass(CLASS_BUTTON_RECORD)
                    .click(function (event) 
                    {
                        if (!recording) {    // Not yet recording, start recording
                            startVideoRecording($(this));
                        } else {   // Already recording, stop recording
                            stopVideoRecording($(this));
                        }
                    })
                );
                break;

            case "audio":
                container.append($(document.createElement('audio'))
                    .attr('title', 'audiocapture - ' + formatDate(new Date()) + '.wav')
                    .addClass(CLASS_DOWNLOAD_TARGET)
                    .attr('autoplay', true)
                ).append($(document.createElement('button'))    // Add record button
                    .addClass(CLASS_BUTTON_RECORD)
                    .click(function (event) 
                    {
                        if (!recording) {    // Not yet recording, start recording
                            startAudioRecording($(this));
                            // TODO: Implement
                        } else {   // Already recording, stop recording
                            stopAudioRecording($(this));
                            // TODO: Implement
                        }
                    })
                );
                break;

            case "gif":
                container.append($(document.createElement('img'))
                    .attr('title', 'screencapture - ' + formatDate(new Date()) + '.gif')
                    .addClass(CLASS_DOWNLOAD_TARGET)
                    .addClass('gif')
                ).append($(document.createElement('button'))    // Add record button
                    .addClass(CLASS_BUTTON_RECORD)
                    .click(function (event) 
                    {
                        if (!recording) {    // Not yet recording, start recording
                            startVideoRecording($(this));
                        } else {   // Already recording, stop recording
                            stopVideoRecording($(this));
                        }
                    })
                );
                break;

            default: break;
        }

        // Add a download button
        result.append($(document.createElement('button'))
            .addClass(CLASS_BUTTON_DOWNLOAD)
            .hide()     // Hide it first, show it after recording is done
            .click(function (event) 
            {
                var $target = $(this).parent().find('.' + CLASS_DOWNLOAD_TARGET);

                // Sanity Check
                if (!$target.length) 
                {
                    console.log('ERROR: no target download found!');
                    alert("Couldn't find target download!");
                    return;
                }

                // Send message with target src and title
                chrome.runtime.sendMessage({
                    request: 'downloadContent',
                    filename: $target.attr('title'),
                    contentURL: $target.attr('src'),
                });
            })
        );

        // Add a close button
        result.append($(document.createElement('button'))
            .addClass(CLASS_BUTTON_CLOSE)
            .text('X')
            .click(function (event) 
            {
                // Confirm delete
                if (!confirm('Are you sure you want to delete this?')) {
                    return;
                }

                var $this = $(this);

                // Stop video recording if needed
                if (recording) 
                {
                    if ($this.sibling('.recordButton').hasClass(CLASS_CURRENTLY_RECORDING))
                    {
                        console.log('closing currently recording video!');
                        stopVideoRecording();
                    }
                }

                // Clean up object url memory
                var url = $this.find('.' + CLASS_DOWNLOAD_TARGET).attr('src');
                if (url) {
                    window.URL.revokeObjectURL(url);
                }
                
                // Remove element
                $this.parent().slideUp('fast', function() 
                {
                    // Delete entire thumbnail
                    $(this).remove();

                    // If there are no more thumbnails, hide container
                    if (!$('div.' + CLASS_THUMBNAIL).length) {
                        thumbnailContainer.removeClass(CLASS_SHOW_CONTAINER).detach();
                    }
                });
            })
        );

        // Return the result
        return result;
    }

});
