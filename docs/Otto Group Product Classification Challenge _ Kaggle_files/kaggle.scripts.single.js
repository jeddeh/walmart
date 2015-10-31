/// <reference path="typings/jquery/jquery.d.ts"/>
/// <reference path="typings/knockout/knockout.d.ts"/>
/// <reference path="typings/knockout.mapping/knockout.mapping.d.ts"/>
/// <reference path="typings/signalr.d.ts"/>
/// <reference path="kaggle.scripts.dtos.d.ts"/>
/// <reference path="kaggle.scripts.signalr.d.ts"/>
/// <reference path="kaggle.scripts.timer.ts"/>
var Kaggle;
(function (Kaggle) {
    var Scripts;
    (function (Scripts) {
        var outputFilesMappingCallback = function (options) {
            var d = options.data;
            var extension = d.fileType.toLowerCase();
            d.isImage = [".png", ".jpg", ".jpeg", ".gif"].indexOf(extension) > -1;
            // TODO: have better detection logic
            d.isCompetitionSubmission = (extension === ".csv") || (extension === ".gz");
            d.fileLinesUrl = d.fileLinesUrlTemplate.replace('{linesToSend}', d.linesToSend);
            d.csvHeaderIsValid = d.csvHeaderValidationErrors === '';
            return d;
        };
        var versionHistoryMappingCallback = function (options) {
            // The way we've set up the ko.forEach in the view makes it more
            // convenient to have an ObservableArray of objects as opposed to
            // an ObservableArray of Observables.
            var d = options.data;
            d.lastRunTime = new Date(d.lastRunTime);
            return d;
        };
        Scripts.scriptVersionPropertyMappings = {
            'outputFiles': {
                create: outputFilesMappingCallback,
                update: outputFilesMappingCallback
            },
            'versionHistory': {
                create: versionHistoryMappingCallback,
                update: versionHistoryMappingCallback
            }
        };
        var ShowSingleScriptViewModel = (function () {
            function ShowSingleScriptViewModel(currentUserInfo, urls, scriptProject, script, scriptVersion) {
                var _this = this;
                this.currentUserInfo = currentUserInfo;
                this.urls = urls;
                this.scriptProject = scriptProject;
                this.script = script;
                this.scriptVersion = scriptVersion;
                this.consoleThrottleMs = 750;
                this.appendConsoleBuffer = "";
                this.prependConsoleBuffer = "";
                this.versionHistoryNames = ko.computed(function () {
                    return _this.scriptVersion.versionHistory().map(function (v) { return "Version " + v.versionNumber; });
                });
                this.isReloadingPage = ko.observable(false);
                this.showVoters = ko.observable(false);
                this.toggleShowVoters = function () {
                    _this.showVoters(!_this.showVoters());
                };
                this.showOptions = ko.observable(false);
                this.toggleShowOptions = function () {
                    _this.showOptions(!_this.showOptions());
                };
                this.showRunInfo = ko.observable(false);
                this.toggleShowRunInfo = function () {
                    _this.showRunInfo(!_this.showRunInfo());
                };
                this.showScriptBlurb = ko.observable(false);
                this.toggleShowScriptBlurb = function () {
                    _this.showScriptBlurb(!_this.showScriptBlurb());
                };
                this.showShareOptions = ko.observable(false);
                this.toggleShowShareOptions = function () {
                    _this.showShareOptions(!_this.showShareOptions());
                    $('[name="ShareLink"]').select();
                };
                this.lastRunTime = ko.observable(this.scriptVersion.lastRunTime());
                this.titleEditState = ko.observable("fixed");
                this.startEditingTitle = function () {
                    this.titleEditState("editing");
                };
                this.stopEditingTitle = function () {
                    if (this.titleHasError() || this.scriptVersion.title() === "") {
                        this.shouldDisplayTitleWarningHighlight(true);
                        return;
                    }
                    this.shouldDisplayTitleWarningHighlight(false);
                    this.titleEditState("fixed");
                };
                this.isEditingTitle = ko.computed(function () {
                    return _this.titleEditState ? _this.titleEditState() === "editing" : false;
                });
                this.htmlOutput = ko.computed(function () {
                    var resultsList = _this.scriptVersion.outputFiles().filter(function (file) { return file.fileName === "__results__.html"; });
                    if (resultsList.length > 0) {
                        return resultsList;
                    }
                    return _this.scriptVersion.outputFiles().filter(function (file) { return file.fileName === "__output__.html"; });
                });
                this.hasNotBeenSaved = ko.computed(function () { return !_this.script.scriptHasBeenSaved(); });
                this.availableLanguagesNamesToAceNames = ko.computed(function () {
                    var result = {};
                    var languages = _this.scriptProject.availableLanguagesWithTemplates();
                    var numLanguages = languages.length;
                    for (var i = 0; i < numLanguages; i++) {
                        result[languages[i].languageName()] = languages[i].aceLanguageName();
                    }
                    return result;
                });
                this.availableLanguageNames = ko.computed(function () {
                    return Object.keys(_this.availableLanguagesNamesToAceNames());
                });
                this.canChooseLanguage = ko.computed(function () {
                    return _this.availableLanguageNames().length > 1;
                });
                this.titleSlug = ko.computed(function () {
                    var lowerTitle = _this.scriptVersion.title().toLowerCase().replace(/[^\w ]+/g, "").replace(/ +/g, "-").replace(/^-/, "").replace(/-$/, "").substr(0, 100);
                    if (lowerTitle.length <= 70) {
                        return lowerTitle;
                    }
                    var dashInFinalPortion = lowerTitle.indexOf("-", 70);
                    if (dashInFinalPortion === -1) {
                        return lowerTitle;
                    }
                    return lowerTitle.substr(0, dashInFinalPortion - 1);
                });
                this.titleTooShort = ko.computed(function () { return _this.titleSlug().length < 5; });
                this.titleTooLong = ko.computed(function () { return _this.scriptVersion.title().length > 40; });
                this.slugExists = ko.computed(function () { return _this.scriptProject.existingScriptSlugs ? _this.scriptProject.existingScriptSlugs.indexOf(_this.titleSlug()) !== -1 : false; });
                this.titleHasErrorImmediate = ko.computed(function () {
                    return (_this.scriptVersion.title() !== "") && (_this.titleTooShort() || _this.titleTooLong() || (_this.script.isNew() && _this.slugExists()));
                });
                // Note: "throttle" was deprecated in favour of "rateLimit" in KO 3.1.0, so this will need
                //       to be changed if/when we upgrade 
                this.titleHasError = ko.computed(function () { return _this.titleHasErrorImmediate(); }).extend({ throttle: 500 });
                this.titleErrorText = ko.computed(function () {
                    if (_this.titleTooShort()) {
                        return "Title should have at least 5 alphanumeric characters.";
                    }
                    if (_this.titleTooLong()) {
                        return "Title should be less than 40 characters";
                    }
                    if (_this.slugExists()) {
                        return "An existing script already uses a similar title.";
                    }
                    return "";
                });
                this.shouldDisplayTitleWarningHighlight = ko.observable(false);
                this.needsToInputTitle = ko.computed(function () { return _this.shouldDisplayTitleWarningHighlight() && (_this.titleHasError() || _this.scriptVersion.title() === ""); });
                this.titleInputClass = ko.computed(function () { return _this.needsToInputTitle() ? "pleaseEnterTitle" : ""; });
                this.getIsStatus = function (statusName) {
                    return ko.computed(function () { return _this.scriptVersion.workerStatus ? _this.scriptVersion.workerStatus() === statusName : false; });
                };
                this.isQueued = this.getIsStatus("queued");
                this.isRunning = this.getIsStatus("running");
                this.isSuccessful = this.getIsStatus("complete");
                this.hasBackendError = this.getIsStatus("error");
                this.hasTips = ko.computed(function () { return _this.scriptVersion.tips().length > 0; });
                this.longTitleStyle = ko.computed(function () {
                    if (_this.scriptVersion.title().length < 22) {
                        return "";
                    }
                    if (_this.scriptVersion.title().length < 33) {
                        return "medium-script-title";
                    }
                    return "long-script-title";
                });
                this.busyStatus = ko.computed(function () { return _this.isQueued() ? "queued" : "running"; });
                this.runTimerDisplay = ko.observable("");
                this.runTimer = new Kaggle.Scripts.Timer();
                this.queuedTimerDisplay = ko.observable("");
                this.queuedTimer = new Kaggle.Scripts.Timer();
                this.isBusy = ko.computed(function () { return _this.isQueued() || _this.isRunning(); });
                this.errorDisplayText = ko.computed(function () {
                    if (!_this.scriptVersion.runInfo || !_this.scriptVersion.runInfo.failureMessage || !_this.scriptVersion.runInfo.failureMessage()) {
                        if (_this.hasBackendError()) {
                            // Ideally we shouldn't reach this state, but it's confusing to see an empty error div 
                            return "An error has occurred.";
                        }
                        return "";
                    }
                    else {
                        return _this.scriptVersion.runInfo.failureMessage();
                    }
                });
                this.saveButtonClass = ko.computed(function () {
                    if (!_this.script.currentUserCanEdit()) {
                        return "disabled";
                    }
                    if (_this.hasBackendError()) {
                        return "fail";
                    }
                    if (!_this.script.scriptHasBeenSaved()) {
                        return "";
                    }
                    if (_this.isBusy()) {
                        // TODO: Change class/style based on queued vs. running? 
                        return "processing";
                    }
                    return "success";
                });
                this.outputReady = ko.computed(function () { return !_this.isBusy() && _this.script.scriptHasBeenSaved(); });
                // "You can't save" is communicated by greying out the button, not hiding it
                this.showSave = ko.computed(function () { return !_this.isBusy(); });
                this.callbackUrlBase = ko.observable(this.urls.versionStatus);
                this.callbackUrl = ko.computed(function () {
                    var existingStatus = _this.scriptVersion.workerStatus ? _this.scriptVersion.workerStatus() : "new";
                    return _this.callbackUrlBase() + "?id=" + _this.scriptVersion.id() + "&existingStatus=" + existingStatus;
                });
                this.activeTab = ko.observable("");
                this.activeAnchor = ko.observable("");
                this.showResultsTab = ko.computed(function () { return _this.activeTab() === "results"; });
                this.showResultsTabNav = ko.computed(function () { return _this.activeTab() === "results" && _this.activeAnchor() === "."; });
                this.showNotebookTab = ko.computed(function () { return _this.activeTab() === "results" && _this.activeAnchor() === "notebook"; });
                this.showCodeTab = ko.computed(function () { return _this.activeTab() === "results" && _this.activeAnchor() === "code"; });
                this.showFilesTab = ko.computed(function () { return _this.activeTab() === "results" && _this.activeAnchor() === "files"; });
                this.showLogTab = ko.computed(function () { return _this.activeTab() === "results" && _this.activeAnchor() === "log"; });
                this.showRunInfoTab = ko.computed(function () { return _this.activeTab() === "runInfo"; });
                this.showVersionsTab = ko.computed(function () { return _this.activeTab() === "versions"; });
                this.showDiscussionTab = ko.computed(function () { return _this.activeTab() === "results" && _this.activeAnchor() === "discussion"; });
                this.showAdminTab = ko.computed(function () { return _this.activeTab() === "admin"; });
                // Votes:
                this.undisplayedVotes = ko.computed(function () { return _this.script.voters ? _this.script.totalVotes() - _this.script.voters().length : 0; });
                this.lastClickedVoteButtonTime = new Date();
                this.newForkUrl = ko.computed(function () { return _this.urls.newFork + "/" + _this.scriptVersion.id(); });
                this.newNotebookForkUrl = ko.computed(function () { return _this.urls.convertToNotebook + "/" + _this.scriptVersion.id(); });
                this.htmlOutputFileUrl = ko.computed(function () { return _this.htmlOutput().length >= 1 ? _this.htmlOutput()[0].fileUrl : null; });
                this.outputFilesToHide = ["__results__.html", "__output__.html", "custom.css"];
                this.outputFilesToDisplay = ko.computed(function () { return _this.scriptVersion.outputFiles().filter(function (f) { return _this.outputFilesToHide.indexOf(f.fileName) === -1; }); });
                this.numberOfOutputFiles = ko.computed(function () { return _this.outputFilesToDisplay().length; });
                this.hasOutputFiles = ko.computed(function () { return _this.numberOfOutputFiles() > 0; });
                this.forkList = ko.observableArray([]);
                this.hasPopulatedForkList = ko.observable(false);
                this.isPopulatingForkList = ko.observable(false);
                this.showForks = ko.observable(false);
                this.toggleShowForks = function () {
                    if (!_this.hasPopulatedForkList()) {
                        _this.isPopulatingForkList(true);
                    }
                    _this.showForks(!_this.showForks());
                };
                this.hasLogMetadata = ko.computed(function () {
                    if (_this.isBusy()) {
                        return true;
                    }
                    else {
                        return _this.scriptVersion.hasLogMetadata();
                    }
                });
                this.queuedTimer.setDisplayCallback(this.queuedTimerDisplay);
                this.runTimer.setDisplayCallback(this.runTimerDisplay);
                if (!this.script.scriptHasBeenSaved()) {
                    this.startEditingTitle();
                }
                try {
                    this.streamingOutput = $.connection.scriptOutputHub;
                }
                catch (e) {
                    // Fallback for CI testing
                    this.streamingOutput = { 'client': {} };
                }
                this.script.isLanguageTemplate.subscribe(function (setAsTemplate) {
                    if (_this.script.isNew()) {
                        return;
                    }
                    $.ajax({
                        type: "POST",
                        url: _this.urls.toggleLanguageTemplate,
                        data: {
                            isTemplate: setAsTemplate
                        }
                    });
                });
                if (!this.scriptVersion.workerStatus) {
                    this.scriptVersion.workerStatus = ko.observable("");
                }
                this.scriptVersion.workerStatus.subscribe(function (newStatus) {
                    if (newStatus === "queued") {
                        if (!_this.queuedTimer.isRunning()) {
                            _this.queuedTimer.startTimer();
                        }
                        if (_this.runTimer.isRunning()) {
                            _this.runTimer.setToZero();
                        }
                    }
                    else if (newStatus === "running") {
                        if (_this.queuedTimer.isRunning()) {
                            _this.queuedTimer.stopTimer();
                        }
                        if (!_this.runTimer.isRunning()) {
                            _this.runTimer.startTimer();
                        }
                    }
                    else if (newStatus === "cancelRequested") {
                        _this.runTimer.stopTimer();
                        _this.queuedTimer.stopTimer();
                    }
                    else {
                        _this.runTimer.stopTimer();
                        _this.queuedTimer.stopTimer();
                    }
                });
                var vHistory = this.scriptVersion.versionHistory();
                var currentVersionNumber = 0;
                for (var i = 0; i < vHistory.length; i++) {
                    if (vHistory[i].id === this.scriptVersion.id()) {
                        currentVersionNumber = vHistory[i].versionNumber;
                        break;
                    }
                }
                this.thisVersionName = ko.observable("Version " + currentVersionNumber);
                // This method will be called by the web server when the script worker
                // delivers a line of stdout
                this.streamingOutput.client.scriptStdOut = function (message) { return _this.appendConsoleOutput(message); };
                // For delivering any buffered output generated prior to this page being rendered:
                this.streamingOutput.client.scriptStdOutTop = function (message) { return _this.prependConsoleOutput(message); };
                if (this.hasLogMetadata() && !this.isBusy()) {
                    this.appendConsoleOutput(this.scriptVersion.consoleOutput());
                }
                this.hasStartedStreaming = ko.observable(false);
                this.shouldStopStreaming = false;
                this.streamingHubReady = false;
                this.shouldShowResultsSpinner = ko.computed(function () { return _this.isBusy() && _this.scriptVersion.languageName() === "IPython Notebook HTML"; });
                this.isPopulatingForkList.subscribe(function (newStateIsTrue) {
                    if (newStateIsTrue) {
                        $.get(_this.urls.forkChildren, function (data) {
                            _this.isPopulatingForkList(false);
                            Kaggle.Mapping.fromJS(data, {}, _this.forkList);
                            _this.hasPopulatedForkList(true);
                        });
                    }
                });
                if (this.isBusy()) {
                    this.startStreaming();
                    if (this.scriptVersion.workerStatus() === "queued") {
                        this.queuedTimer.startTimerFrom(this.scriptVersion.lastQueuedTime());
                    }
                    else {
                        this.runTimer.startTimerFrom(this.lastRunTime());
                    }
                    this.pollScriptStatus();
                }
                $(window).scroll(function () {
                    var currentPosition = $(window).scrollTop();
                    var insideAnchor = false;
                    $("[data-anchor]:not([data-anchor='.']):visible").each(function (index, element) {
                        insideAnchor = _this.checkScrollingInsideElement(element, currentPosition);
                        return !insideAnchor;
                    });
                    if (!insideAnchor) {
                        _this.activeAnchor(".");
                        _this.setRoute(_this.activeTab());
                    }
                });
            }
            ShowSingleScriptViewModel.prototype.checkScrollingInsideElement = function (element, currentPosition) {
                var subTabPosition = $(element).offset();
                var tab = $(element).attr("data-tab");
                var anchor = $(element).attr("data-anchor");
                var route = $(element).attr("data-route");
                if (subTabPosition == null) {
                    return false;
                }
                if (subTabPosition.top + $(element).height() > currentPosition && subTabPosition.top - currentPosition < 100) {
                    this.setRoute(route);
                    this.activeAnchor(anchor);
                    return true;
                }
                return false;
            };
            ShowSingleScriptViewModel.prototype.clearConsoleOutput = function () {
                clearTimeout(this.appendConsoleTimeout);
                this.appendConsoleBuffer = "";
                clearTimeout(this.prependConsoleTimeout);
                this.prependConsoleBuffer = "";
                $("#sv-log-md-inner").empty();
            };
            ShowSingleScriptViewModel.prototype.replaceConsoleOutput = function (newContents) {
                this.clearConsoleOutput();
                this.appendConsoleBuffer = this.getLogMarkup(newContents);
                this.appendConsoleBufferNow();
            };
            ShowSingleScriptViewModel.prototype.appendConsoleOutput = function (message) {
                this.appendConsoleBuffer += this.getLogMarkup(message);
                var now = +new Date;
                if (this.lastConsoleEditTime && (now - this.lastConsoleEditTime) < this.consoleThrottleMs) {
                    clearTimeout(this.appendConsoleTimeout);
                    this.appendConsoleTimeout = setTimeout(this.appendConsoleBufferNow, this.consoleThrottleMs);
                }
                else {
                    this.appendConsoleBufferNow();
                }
            };
            ShowSingleScriptViewModel.prototype.appendConsoleBufferNow = function () {
                $("#sv-log-md-inner").append(this.appendConsoleBuffer);
                this.lastConsoleEditTime = +new Date;
                this.appendConsoleTimeout = 0;
                this.appendConsoleBuffer = "";
            };
            ShowSingleScriptViewModel.prototype.prependConsoleOutput = function (message) {
                this.prependConsoleBuffer += this.getLogMarkup(message);
                var now = +new Date;
                if (this.lastConsoleEditTime && (now - this.lastConsoleEditTime) < this.consoleThrottleMs) {
                    clearTimeout(this.prependConsoleTimeout);
                    this.prependConsoleTimeout = setTimeout(this.appendConsoleBufferNow, this.consoleThrottleMs);
                }
                else {
                    this.prependConsoleBufferNow();
                }
            };
            ShowSingleScriptViewModel.prototype.prependConsoleBufferNow = function () {
                $("#sv-log-md-inner").prepend(this.prependConsoleBuffer);
                this.lastConsoleEditTime = +new Date;
                this.prependConsoleTimeout = 0;
                this.prependConsoleBuffer = "";
            };
            ShowSingleScriptViewModel.prototype.splitJsonArray = function (rawContent) {
                // A state machine that does a basic split of the provided string,
                // without too many assumptions about its JSON-validity.
                var output = [];
                var previousCharacter = '';
                var lineStart = 0;
                var insideLineNow = false;
                var insideQuoteNow = false;
                for (var i = 0; i < rawContent.length; i++) {
                    if (!insideLineNow && rawContent.charAt(i) === '{') {
                        insideLineNow = true;
                        lineStart = i;
                    }
                    else if (insideLineNow) {
                        if (insideQuoteNow) {
                            if (rawContent.charAt(i) === '"' && previousCharacter !== '\\') {
                                insideQuoteNow = false;
                            }
                        }
                        else {
                            if (rawContent.charAt(i) === '}') {
                                insideLineNow = false;
                                output.push(rawContent.substr(lineStart, i - lineStart + 1));
                            }
                            else if (rawContent.charAt(i) === '"') {
                                insideQuoteNow = true;
                            }
                        }
                    }
                    previousCharacter = rawContent.charAt(i);
                }
                return output;
            };
            ShowSingleScriptViewModel.prototype.getLogMarkup = function (rawContent) {
                var output = "";
                this.splitJsonArray(rawContent).forEach(function (s) {
                    var dataStart = s.indexOf("\"data\":\"") + 8;
                    if (s.charAt(dataStart) === '"') {
                        output += "<div class='sv-stdout-text'></div>\n";
                    }
                    else {
                        var dataLength = s.substr(dataStart).search(/[^\\]"/) + 1;
                        var data = s.substr(dataStart, dataLength);
                        var dataStr = data;
                        try {
                            dataStr = JSON.parse('"' + data + '"');
                        }
                        catch (e) {
                            console.warn("Invalid JSON: " + data);
                        }
                        var stream = s.substr(s.indexOf("\"stream_name\":\"") + 15, 6);
                        if (stream === "stdout") {
                            output += "<div class='sv-stdout-text'>" + dataStr + "</div>\n";
                        }
                        else {
                            output += "<div class='sv-stderr-text'>" + dataStr + "</div>\n";
                        }
                    }
                });
                return output;
            };
            ShowSingleScriptViewModel.prototype.switchToVersionNumber = function (newVersionId) {
                if (this.scriptVersion.id() === newVersionId) {
                    return;
                }
                // TODO: Ajaxify this via viewModel.scriptVersion and kaggle.mapping.fromjs.
                // Requires a new JSON action route
                this.isReloadingPage(true);
                window.location.href = location.protocol + "//" + document.domain + "/sv/" + newVersionId;
            };
            ShowSingleScriptViewModel.prototype.startStreaming = function () {
                var _this = this;
                if (this.hasStartedStreaming()) {
                    return;
                }
                this.hasStartedStreaming(true);
                this.streamingHubReady = false;
                $.connection.hub.start().done(function () {
                    if (_this.shouldStopStreaming) {
                        $.connection.hub.stop();
                        _this.shouldStopStreaming = false;
                        _this.hasStartedStreaming(false);
                    }
                    else {
                        _this.clearConsoleOutput();
                        _this.streamingOutput.server.followScriptVersion(_this.scriptVersion.id());
                        _this.streamingHubReady = true;
                    }
                });
            };
            ShowSingleScriptViewModel.prototype.stopStreaming = function () {
                this.hasStartedStreaming(false);
                if (this.streamingHubReady) {
                    this.streamingOutput.server.unfollowScriptVersion(this.scriptVersion.id());
                    $.connection.hub.stop();
                }
                else {
                    this.shouldStopStreaming = true;
                }
            };
            ShowSingleScriptViewModel.prototype.resizeIFrame = function (obj) {
                obj.style.height = obj.contentWindow.document.body.scrollHeight + 'px';
            };
            // Diff:
            ShowSingleScriptViewModel.prototype.updateDiffSelectors = function () {
                $("input[name=rightScriptVersion]:first").prop("checked", true);
                $("input[name=leftScriptVersion]:eq(1)").prop("checked", true);
            };
            ShowSingleScriptViewModel.prototype.pollScriptStatus = function () {
                var _this = this;
                $.ajax({
                    url: this.callbackUrl(),
                    success: function (data) {
                        var oldStatus = _this.scriptVersion.workerStatus();
                        _this.scriptVersion.workerStatus(data.status);
                        if (data.status === "complete" || data.status === "error") {
                            ko.mapping.fromJS(data, Scripts.scriptVersionPropertyMappings, _this.scriptVersion);
                            _this.shouldDisplayTitleWarningHighlight(false);
                            _this.activateMostRelevantTab();
                            _this.runTimer.stopTimer();
                            _this.queuedTimer.stopTimer();
                            _this.stopStreaming();
                            _this.replaceConsoleOutput(_this.scriptVersion.consoleOutput());
                            _this.updateDiffSelectors();
                            _this.datatableCallback();
                        }
                        else if (_this.isQueued() || _this.isRunning()) {
                            if (_this.scriptVersion.workerStatus() !== oldStatus) {
                                _this.lastRunTime(new Date());
                                // Knockout's update magic fails at this point, so we implement
                                // this: http://stackoverflow.com/a/16635485
                                ko.cleanNode(document.getElementById("time-ago-bit"));
                                ko.applyBindings(_this, document.getElementById("time-ago-bit"));
                            }
                            _this.pollScriptStatus();
                        }
                    },
                    dataType: "json"
                });
            };
            ShowSingleScriptViewModel.prototype.rerun = function () {
                var _this = this;
                $.ajax({
                    url: this.urls.rerunVersion,
                    type: "POST",
                    dataType: "json",
                    data: {
                        id: this.scriptVersion.id()
                    },
                    success: function (data) {
                        _this.scriptVersion.workerStatus(data.status);
                        if (data.status === "queued") {
                            _this.script.id(data.scriptId); // Update scriptId, to cover cases where we just submitted a new script
                            _this.scriptVersion.id(data.versionId);
                            history.replaceState({}, '', data.newUrl);
                            _this.scriptVersion.lastQueuedTime(new Date());
                            _this.script.scriptHasBeenSaved(true);
                            _this.startStreaming();
                            _this.pollScriptStatus();
                        }
                        else {
                            _this.runTimer.stopTimer();
                            _this.queuedTimer.stopTimer();
                            alert(data.message);
                        }
                    }
                });
            };
            ShowSingleScriptViewModel.prototype.activateTab = function (tab, anchor) {
                var previousTab = this.activeTab();
                this.activeTab(tab);
                if (tab === "results") {
                    this.fixDatatableWidthCallback();
                }
                var route = anchor === "." ? tab : anchor;
                // Let scroll detection update URL and active anchor if on the same tab
                if (tab !== previousTab) {
                    this.activeAnchor(anchor);
                    this.setRoute(route);
                }
                var scrollTo = anchor === "." ? 0 : $("[data-tab=\"" + tab + "\"][data-anchor=\"" + anchor + "\"]").offset().top;
                var speed = previousTab === tab ? 200 : 0;
                $("html, body").animate({ scrollTop: scrollTo }, speed);
            };
            ShowSingleScriptViewModel.prototype.setRoute = function (route) {
                history.replaceState({}, "", this.urls.script + (route !== "results" ? "/" + route : ""));
            };
            ShowSingleScriptViewModel.prototype.setActiveTab = function (data, event) {
                var tab = event.target.attributes['data-for-tab'].value;
                var anchorAttribute = event.target.attributes['data-for-anchor'];
                var anchor = anchorAttribute ? anchorAttribute.value : "";
                this.activateTab(tab, anchor);
            };
            ShowSingleScriptViewModel.prototype.activateMostRelevantTab = function () {
                this.activateTab("results", "");
            };
            ShowSingleScriptViewModel.prototype.voteButtonClicked = function () {
                var _this = this;
                var msSinceLastClick = new Date().getTime() - this.lastClickedVoteButtonTime.getTime();
                if (msSinceLastClick < 1500) {
                    return;
                }
                this.lastClickedVoteButtonTime = new Date();
                if (this.script.currentUserHasVotedForThisScript()) {
                    $.ajax({
                        url: this.urls.deleteVote + "?id=" + this.script.id(),
                        type: "DELETE",
                        success: function () {
                            _this.script.currentUserHasVotedForThisScript(false);
                            _this.script.totalVotes(_this.script.totalVotes() - 1);
                            var voters = _this.script.voters();
                            var thisUserIndex = voters.map(function (v) { return v.userId(); }).indexOf(_this.currentUserInfo.userId());
                            if (thisUserIndex >= 0) {
                                voters.splice(thisUserIndex, 1);
                                _this.script.voters(voters);
                            }
                        },
                        error: function (jqXHR, textStatus, errorThrown) {
                            // TODO: add a slick error display
                            alert("Sorry, an error occurred. Please reload the page.");
                        }
                    });
                }
                else {
                    $.ajax({
                        url: this.urls.postVote + "?id=" + this.script.id(),
                        type: "POST",
                        success: function () {
                            _this.script.currentUserHasVotedForThisScript(true);
                            _this.script.totalVotes(_this.script.totalVotes() + 1);
                            _this.script.voters.unshift(_this.currentUserInfo);
                        },
                        error: function (jqXHR, textStatus, errorThrown) {
                            alert("Sorry, an error occurred. Please reload the page.");
                        }
                    });
                }
            };
            ShowSingleScriptViewModel.prototype.toggleScriptIsHidden = function () {
                this.isReloadingPage(true);
                $.ajax({
                    url: this.urls.toggleScriptIsHidden + "?isHidden=" + !this.script.isHidden() + "&id=" + this.script.id(),
                    type: "POST",
                    success: function () {
                        location.reload();
                    },
                    error: function (jqXHR, textStatus, errorThrown) {
                        alert("Sorry, an error occurred. Please reload the page.");
                    }
                });
            };
            ShowSingleScriptViewModel.prototype.setDatatableCallback = function (callback) {
                this.datatableCallback = callback;
            };
            ShowSingleScriptViewModel.prototype.setFixDatatableWidthCallback = function (callback) {
                this.fixDatatableWidthCallback = callback;
            };
            ShowSingleScriptViewModel.prototype.loadCsv = function (table, callback) {
                var _this = this;
                // Sanity check to make sure we don't try to process non-CSVs
                var url = $(table).attr("data-src");
                if (url.toLowerCase().indexOf(".csv") === -1) {
                    return;
                }
                var previewMaxLineCount = parseInt($(table).attr("data-lines"));
                $.getJSON(url, function (data) {
                    var csvHtml = _this.twoDimensionalArrayToTable(data.data);
                    var note = $(table).siblings(".script-output-csv-note");
                    if (data.data.length < previewMaxLineCount && !data.exceededMaxSize) {
                        note.text("* " + (data.data.length - 1) + " rows of data.");
                    }
                    else {
                        note.text("* This is a preview of the first " + (data.data.length - 1) + " rows" + (data.exceededMaxSize ? " (" + data.maxKBytesToReturn + "k)" : "") + " of data.");
                    }
                    table.innerHTML = csvHtml.innerHTML;
                    callback();
                });
            };
            ShowSingleScriptViewModel.prototype.twoDimensionalArrayToTable = function (array) {
                var table = document.createElement("table");
                if (array.length > 0) {
                    var thead = document.createElement("thead");
                    var headerRow = document.createElement("tr");
                    for (var j = 0; j < array[0].length; j++) {
                        var headerCell = document.createElement("th");
                        headerCell.textContent = array[0][j];
                        headerRow.appendChild(headerCell);
                    }
                    thead.appendChild(headerRow);
                    table.appendChild(thead);
                }
                var tbody = document.createElement("tbody");
                for (var i = 1; i < array.length; i++) {
                    var row = document.createElement("tr");
                    for (var j = 0; j < array[i].length; j++) {
                        var cell = document.createElement("td");
                        cell.textContent = array[i][j];
                        row.appendChild(cell);
                    }
                    tbody.appendChild(row);
                }
                table.appendChild(tbody);
                return table;
            };
            return ShowSingleScriptViewModel;
        })();
        Scripts.ShowSingleScriptViewModel = ShowSingleScriptViewModel;
    })(Scripts = Kaggle.Scripts || (Kaggle.Scripts = {}));
})(Kaggle || (Kaggle = {}));
//# sourceMappingURL=kaggle.scripts.single.js.map