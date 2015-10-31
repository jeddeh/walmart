// Utility class for displaying elapsed times, used in the SingleScript view
var Kaggle;
(function (Kaggle) {
    var Scripts;
    (function (Scripts) {
        var Timer = (function () {
            function Timer() {
                this.clear();
            }
            Timer.prototype.clear = function () {
                this.stopTimer();
                this.timerStart = null;
                this.timerEnd = null;
                if (this.displayCallback) {
                    this.displayCallback("");
                }
            };
            Timer.prototype.setStartTime = function (newStartTime) {
                if (newStartTime === void 0) { newStartTime = null; }
                if (newStartTime) {
                    this.timerStart = newStartTime;
                }
                else {
                    // function has been called without an argument
                    this.timerStart = new Date();
                }
            };
            Timer.prototype.getElapsedTimeString = function () {
                if (!this.timerStart) {
                    return "";
                }
                var timerEnd = this.timerEnd;
                if (!this.paused) {
                    timerEnd = new Date();
                }
                var totalMilliseconds = timerEnd.getTime() - this.timerStart.getTime();
                var totalSeconds = totalMilliseconds / 1000;
                var hours = Math.floor(totalSeconds / 3600);
                var mins = Math.floor(totalSeconds / 60) % 60;
                var secs = Math.floor(totalSeconds) % 60;
                var secsString = (secs < 10 ? "0" : "") + secs;
                if (totalSeconds < (60 * 60)) {
                    return (mins + ":" + secsString);
                }
                var minString = (mins < 10 ? "0" : "") + mins;
                return (hours + ":" + minString + ":" + secsString);
            };
            Timer.prototype.startTimer = function () {
                this.startTimerFrom(new Date());
            };
            Timer.prototype.startTimerFrom = function (newStartTime) {
                if (!this.displayCallback) {
                    console.warn("scriptTimer: starting timer without callback");
                }
                this.setStartTime(newStartTime);
                var t = this;
                this.timerIntervalId = window.setInterval(function () { return t.updateTimer(); }, 100);
                this.paused = false;
            };
            Timer.prototype.setToZero = function () {
                this.stopTimer();
                this.timerStart = this.timerEnd;
                this.updateTimer();
            };
            Timer.prototype.updateTimer = function () {
                if (this.displayCallback) {
                    this.displayCallback(this.getElapsedTimeString());
                }
            };
            Timer.prototype.stopTimer = function () {
                if (this.timerIntervalId >= 0) {
                    window.clearInterval(this.timerIntervalId);
                }
                this.timerIntervalId = -1;
                this.paused = true;
                this.timerEnd = new Date();
            };
            Timer.prototype.setDisplayCallback = function (callback) {
                this.displayCallback = callback;
            };
            Timer.prototype.isRunning = function () {
                return !this.paused;
            };
            return Timer;
        })();
        Scripts.Timer = Timer;
    })(Scripts = Kaggle.Scripts || (Kaggle.Scripts = {}));
})(Kaggle || (Kaggle = {}));
//# sourceMappingURL=kaggle.scripts.timer.js.map