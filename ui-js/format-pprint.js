
/**
 * Render the pretty-print box output generated by OCaml's Format module
 * (https://caml.inria.fr/pub/docs/manual-ocaml/libref/Format.html)
 */
class FormatPrettyPrint {

    // Simplifier to the "rich" format coq uses.
    richpp2HTML(msg) {

        // Elements are ...
        if (msg.constructor !== Array) {
            return msg;
        }

        var ret;
        var tag, ct, id, att, m;
        [tag, ct] = msg;

        switch (tag) {

        // Element(tag_of_element, att (single string), list of xml)
        case "Element":
            [id, att, m] = ct;
            let imm = m.map(this.richpp2HTML, this);
            ret = "".concat(...imm);
            ret = `<span class="${id}">` + ret + `</span>`;
            break;

        // PCData contains a string
        case "PCData":
            ret = ct;
            break;

        default:
            ret = msg;
        }
        return ret;
    }

    /**
     * Formats a pretty-printed element to be displayed in an HTML document.
     * @param {array} pp a serialized Pp element
     */
    pp2DOM(pp) {
        if (pp.constructor !== Array) {
            throw new Error("malformed Pp element: " + pp);
        }

        var [tag, ct] = pp;

        switch (tag) {

        // ["Pp_glue", [...elements]]
        case "Pp_glue":
            return ct.map(x => this.pp2DOM(x));

        // ["Pp_string", string]
        case "Pp_string":
            return $(document.createTextNode(ct));

        // ["Pp_box", ["Pp_vbox"/"Pp_hvbox"/"Pp_hovbox", _], content]
        case "Pp_box":
            let mode = ct[0] == 'Pp_vbox' ? 'vertical' : 'horizontal';
            return this.adjustBox(
                $('<div>').addClass('Pp_box').attr('data-mode', mode)
                    .append(this.pp2DOM(pp[2])));

        // ["Pp_tag", tag, content]
        case "Pp_tag":
            return $('<span>').addClass(ct).append(this.pp2DOM(pp[2]));

        // ["Pp_force_newline"]
        case "Pp_force_newline":
            return $('<br/>').addClass('Pp_force_newline');

        // ["Pp_print_break", nspaces, indent-offset]
        case "Pp_print_break":
            return $('<span>').addClass('Pp_break').attr('data-break', pp.slice(1))
                .text(" ");

        case "Pp_empty":
            return $([]);

        default:
            console.warn("unhandled Format case", msg);
            return $([]);
        }
    }

    pp2HTML(msg, state) {

        // Elements are ...
        if (msg.constructor !== Array) {
            return msg;
        }

        state = state || {breakMode: 'horizontal'};

        var ret;
        var tag, ct;
        [tag, ct] = msg;

        switch (tag) {

        // Element(tag_of_element, att (single string), list of xml)

        // ["Pp_glue", [...elements]]
        case "Pp_glue":
            let imm = ct.map(x => this.pp2HTML(x, state));
            ret = "".concat(...imm);
            break;

        // ["Pp_string", string]
        case "Pp_string":
            if (ct.match(/^={4}=*$/)) {
                ret = "<hr/>";
                state.breakMode = 'skip-vertical';
            }
            else if (state.breakMode === 'vertical' && ct.match(/^\ +$/)) {
                ret = "";
                state.margin = ct;
            }
            else
                ret = ct;
            break;

        // ["Pp_box", ["Pp_vbox"/"Pp_hvbox"/"Pp_hovbox", _], content]
        case "Pp_box":
            var vmode = state.breakMode,
                margin = state.margin ? state.margin.length : 0;

            state.margin = null;

            switch(msg[1][0]) {
            case "Pp_vbox":
                state.breakMode = 'vertical';
                break;
            default:
                state.breakMode = 'horizontal';
            }

            ret = `<div class="Pp_box" data-mode="${state.breakMode}" data-margin="${margin}">` +
                  this.pp2HTML(msg[2], state) +
                  '</div>';
            state.breakMode = vmode;
            break;

        // ["Pp_tag", tag, content]
        case "Pp_tag":
            ret = this.pp2HTML(msg[2], state);
            ret = `<span class="${msg[1]}">` + ret + `</span>`;
            break;

        case "Pp_force_newline":
            ret = "<br/>";
            state.margin = null;
            break;

        // ["Pp_print_break", nspaces, indent-offset]
        case "Pp_print_break":
            ret = "";
            state.margin = null;
            if (state.breakMode === 'vertical'|| (msg[1] == 0 && msg[2] > 0 /* XXX need to count columns etc. */)) {
                ret = "<br/>";
            } else if (state.breakMode === 'horizontal') {
                ret = `<span class="Pp_break" data-break="${msg.slice(1)}"> </span>`;
            } else if (state.breakMode === 'skip-vertical') {
                state.breakMode = 'vertical';
            }
            break;
        
        case "Pp_empty":
            ret = "";
            break;

        default:
            console.warn("unhandled Format case", msg);
            ret = msg;
        }
        return ret;
    }

    pp2Text(msg, state) {

        // Elements are ...
        if (!Array.isArray(msg)) {
            return msg;
        }

        state = state || {breakMode: 'horizontal'};

        var ret;
        var tag, ct;
        [tag, ct] = msg;

        switch (tag) {

        // Element(tag_of_element, att (single string), list of xml)

        // ["Pp_glue", [...elements]]
        case "Pp_glue":
            let imm = ct.map(x => this.pp2Text(x, state));
            ret = "".concat(...imm);
            break;

        // ["Pp_string", string]
        case "Pp_string":
            if (state.breakMode === 'vertical' && ct.match(/^\ +$/)) {
                ret = "";
                state.margin = ct;
            }
            else
                ret = ct;
            break;

        // ["Pp_box", ["Pp_vbox"/"Pp_hvbox"/"Pp_hovbox", _], content]
        case "Pp_box":
            var vmode = state.breakMode,
                margin = state.margin ? state.margin.length : 0;

            state.margin = null;

            switch(msg[1][0]) {
            case "Pp_vbox":
                state.breakMode = 'vertical';
                break;
            default:
                state.breakMode = 'horizontal';
            }

            ret = this.pp2Text(msg[2], state);  /* TODO indent according to margin */
            state.breakMode = vmode;
            break;

        // ["Pp_tag", tag, content]
        case "Pp_tag":
            ret = this.pp2Text(msg[2], state);
            break;

        case "Pp_force_newline":
            ret = "\n";
            state.margin = null;
            break;

        // ["Pp_print_break", nspaces, indent-offset]
        case "Pp_print_break":
            ret = "";
            state.margin = null;
            if (state.breakMode === 'vertical'|| (msg[1] == 0 && msg[2] > 0 /* XXX need to count columns etc. */)) {
                ret = "\n";
            } else if (state.breakMode === 'horizontal') {
                ret = " ";
            } else if (state.breakMode === 'skip-vertical') {
                state.breakMode = 'vertical';
            }
            break;
        
        case "Pp_empty":
            ret = "";
            break;

        default:
            console.warn("unhandled Format case", msg);
            ret = msg;
        }
        return ret;
    }

    /**
     * Formats the current proof state.
     * @param {object} goals a record of proof goals 
     *                       ({goals, stack, shelf, given_up})
     */
    goals2DOM(goals) {
        if (goals.goals.length == 0) {
            return $(document.createTextNode("No more goals"));
        } 
        else {
            let ngoals = goals.goals.length;
            let head = $('<p>').addClass('num-goals')
                .text(ngoals === 1 ? `1 goal.` : `${ngoals} goals`);

            let focused_goal = this.goal2DOM(goals.goals[0]);

            let pending_goals = goals.goals.slice(1).map((goal, i) =>
                $('<div>').addClass('coq-subgoal-pending')
                    .append($('<label>').text(i + 2))
                    .append(this.pp2DOM(goal.ty)));

            return $('<div>').append(head, focused_goal, pending_goals);
        }
    }

    /**
     * Formats a single, focused goal.
     * Shows an environment containing hypothesis and goal type.
     * @param {object} goal current goal record ({name, hyp, ty})
     */
    goal2DOM(goal) {
        let hyps = goal.hyp.reverse().map(h => 
            $('<div>').addClass('coq-hypothesis')
                .append($('<label>').text(h[0]))
                .append(this.pp2DOM(h[2])));
        let ty = this.pp2DOM(goal.ty);
        return $('<div>').addClass('coq-env').append(hyps, $('<hr/>'), ty);
    }

    adjustBox(jdom) {
        let mode = jdom.attr('data-mode');

        if (mode == 'vertical') {
            for (let el of jdom.children('.Pp_break')) {
                $(el).replaceWith($('<br/>'));
            }
        }

        return jdom;
    }

    adjustBreaks(jdom) {
        var width = jdom.width(),
            hboxes = jdom.add(jdom.find('.Pp_box[data-mode="horizontal"]'));

        for (let el of hboxes) {
            let hbox = $(el),
                brks = hbox.children('.Pp_break');
            var prev = null;
            for (let brk of brks) {
                if (prev && $(brk).position().left >= width) {
                  prev.html("<br/>");
                }
                prev = $(brk);
            }
            if (prev && hbox.position().left + hbox.width() > width)
                prev.html("<br/>");
        }

        if (jdom.children().length == 0)
            jdom.addClass("text-only");
    }

}



if (typeof module !== 'undefined')
    module.exports = {FormatPrettyPrint}

// Local Variables:
// js-indent-level: 4
// End:
