import Backbone from "backbone";
import Tabs from "../dumb-views/tabs";
import Card from "../dumb-views/card";
import template from "../templates/vms.hbs";
import Api from "../util/api";
import $ from "jquery";
import dispatcher from "../util/dispatcher";

export default class VMs extends Backbone.View {
    constructor() {
        super();
        this.tabsView = new Tabs({
            triggerName: "vmTabSelected",
            tabs: ["AWS", "Azure"]
        });
        dispatcher.on("vmTabSelected", this.tabSelected, this);
        dispatcher.on("cardAction", this.updateCard, this);
    }

    static vmClause(vmkind) {
        switch (vmkind) {
            case "aws":
                return {
                    clause: "allAwss",
                    title: "AWS"
                };
            case "azure":
                return {
                    clause: "allAzures",
                    title: "Azure"
                };
            default:
            return {
                clause: "allAwss",
                title: "AWS"
            };
        }
    }

    render() {
        this.$el.html(template());
        this.tabsView.setElement("#vmTabs").render();
        this.tabSelected("aws");
    }

    tabSelected(name) {
        let vm = VMs.vmClause(name);
        let vmQuery = { "query" :"{ " + vm.clause + " { edges { node { host, name, region, publicIps, privateIps, image, state} } } }"};
        Api.post(vmQuery).then((res) => {
            dispatcher.trigger("showCards", res.data[vm.clause].edges);
        });
    }

    updateCard(card, node) {
        let value = true;
        let updateClause = card.type === "aws" ? "updateAws" : "updateAzure";
        let action = ["start","stop","shutdown"].includes(card.action) ? "state" : card.action;
        let vmMutation = { "query": "mutation { " + updateClause + 
            "(host:\"" + node.host + "\", action:\"" + action + 
            "\", actionDetail:\"" + card.action + "\", value:\"" + value + 
            "\") { " + card.type + " { " + action + " } } }" };
        
        Api.post(vmMutation).then((res) => {
            dispatcher.trigger("reRenderCard" + node.host, Object.assign(node, res.data[card.type === "aws" ? "updateAws" : "updateAzure"][card.type]));
        });
    }
}