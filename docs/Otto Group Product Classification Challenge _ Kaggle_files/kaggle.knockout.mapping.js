/// <reference path="typings/knockout/knockout.d.ts"/>
/// <reference path="typings/knockout.mapping/knockout.mapping.d.ts"/>
var Kaggle;
(function (Kaggle) {
    var Mapping;
    (function (Mapping) {
        // Regex derived from http://stackoverflow.com/a/3143231/1869
        var iso8601DateRegex = /^(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+)|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d)|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d)$/;
        // DTOs send dates as strings, but we'd like to convert them to real Date objects:
        function remapDates(jsObject) {
            for (var propName in jsObject) {
                if (jsObject.hasOwnProperty(propName)) {
                    var val = jsObject[propName];
                    if (val !== null) {
                        var valType = typeof (val);
                        if (valType === "string") {
                            if (iso8601DateRegex.test(val)) {
                                var newDate = new Date(val);
                                jsObject[propName] = newDate;
                            }
                        }
                        else if (valType === "object") {
                            // recursively examine:
                            remapDates(val);
                        }
                    }
                }
            }
            return jsObject;
        }
        function fromJS(jsObject) {
            var otherArgs = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                otherArgs[_i - 1] = arguments[_i];
            }
            var remappedObject = remapDates(jsObject);
            var newArgs = otherArgs;
            newArgs.unshift(remappedObject);
            return ko.mapping.fromJS.apply(null, newArgs);
        }
        Mapping.fromJS = fromJS;
    })(Mapping = Kaggle.Mapping || (Kaggle.Mapping = {}));
})(Kaggle || (Kaggle = {}));
//# sourceMappingURL=kaggle.knockout.mapping.js.map