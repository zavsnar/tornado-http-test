// Copyright 2009 FriendFeed
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.

$(document).ready(function() {
    if (!window.console) window.console = {};
    if (!window.console.log) window.console.log = function() {};

    $("#entryform").live("submit", function() {
        newEntry($(this));
        return false;
    });
    $("#entryform").live("keypress", function(e) {
        // Press key Enter
        if (e.keyCode == 13) {
            newEntry($(this));
            return false;
        }
    });
    $("#entry").select();
    updater.poll();
});

// Common functions
function newEntry(form) {
    var entry = form.formToDict();
    var submit_btn = form.find("input[type=submit]");
    submit_btn.disable();
    $.postJSON("/set", entry, function(response) {
        form.find("input[type=text]").val("");
        $("#entry").select();
        submit_btn.enable();
    });
}

jQuery.postJSON = function(url, args, callback) {
    $.ajax({url: url, data: $.param(args), dataType: "text", type: "POST",
            success: function(response) {
        if (callback) callback(eval(response));
    }, error: function(response) {
        console.log("ERROR:", response)
    }});
};

jQuery.fn.formToDict = function() {
    var fields = this.serializeArray();
    var json = {}
    for (var i = 0; i < fields.length; i++) {
        json[fields[i].name] = fields[i].value;
    }
    if (json.next) delete json.next;
    return json;
};

jQuery.fn.disable = function() {
    this.enable(false);
    return this;
};

jQuery.fn.enable = function(opt_enable) {
    if (arguments.length && !opt_enable) {
        this.attr("disabled", "disabled");
    } else {
        this.removeAttr("disabled");
    }
    return this;
};
// End common functions


var updater = {
    errorSleepTime: 500,
    cursor: null,

    poll: function() {
        $.ajax({url: "/update", type: "POST", dataType: "text",
            success: updater.onSuccess,
            error: updater.onError});
    },

    onSuccess: function(response) {
        try {
            updater.newEntry(eval("(" + response + ")"));
        } catch (e) {
            updater.onError();
            return;
        }
        updater.errorSleepTime = 500;
        window.setTimeout(updater.poll, 0);
    },

    onError: function(response) {
        updater.errorSleepTime *= 2;
        console.log("Poll error; sleeping for", updater.errorSleepTime, "ms");
        window.setTimeout(updater.poll, updater.errorSleepTime);
    },

    newEntry: function(response) {
        updater.showEntry(response);
    },

    showEntry: function(entry) {
        var existing = $("#" + entry.key);
        if (existing.length > 0) {
            existing.find('span').text(entry.value)
            return
        };
        var node = $(entry.html);
        node.hide();
        $("#inbox").append(node);
        node.slideDown();
    }
};
