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
        this.pageInfo = {};
        this.selectedTab = "aws";
        this.isLoading = false;
        this.edges = {aws:[],azure:[]};
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
        if (this.edges[name] && this.edges[name].length > 0) {
            dispatcher.trigger("showCards", this.edges[name]);
            return;
        }

        let that = this;
        let vm = VMs.vmClause(name);
        let vmQuery = "{ " + vm.clause + " (first:10) { edges { node { host, name, region, publicIps, privateIps, image, state} }, pageInfo { endCursor, hasNextPage } } }";
        Api.post(vmQuery).then((res) => {
            this.pageInfo[name] = res.data[vm.clause].pageInfo;
            this.edges[name].push(...res.data[vm.clause].edges);
            dispatcher.trigger("showCards", this.edges[name]);
        });

        $(".drawer-main-content").off('scroll').on('scroll', function(e) {
            if(!that.isLoading && (($(window).scrollTop() + $(window).height()) >= $(document).height())) {
                that.loadVMs(name, true);
            }
        });
    }

    updateCard(card, node) {
        let value = true;
        let updateClause = card.type === "aws" ? "updateAws" : "updateAzure";
        let action = ["start","stop","shutdown"].includes(card.action) ? "state" : card.action;
        let vmMutation = "mutation($cardAction:String!,$value:String!,$host:String!,$action:String!) { " + updateClause + 
            "(host:$host, action:$action, actionDetail: $cardAction, value: $value) { " + card.type + " { " + action + " } } }";
        var variables = {};
        variables.cardAction = card.action;
        variables.action = action;
        variables.host = node.host;
        variables.value = value;

        Api.post(vmMutation, variables).then((res) => {
            dispatcher.trigger("reRenderCard" + node.host, Object.assign(node, res.data[card.type === "aws" ? "updateAws" : "updateAzure"][card.type]));
        });
    }

    loadVMs(name, nextPage=false) {
        let vm = VMs.vmClause(name);
        if (nextPage && !this.pageInfo[name].hasNextPage) return;
        
        this.isLoading = true;
        let afterClause = nextPage && this.pageInfo[name] && this.pageInfo[name].hasNextPage ?
            "after: \"" + this.pageInfo[name].endCursor + "\"":
            "";
        let vmQuery = "{ " + vm.clause + " (first: 10 " + afterClause + ")" +
            " { edges { cursor, node { host, name, region, publicIps, privateIps, image, state} }, " +
            " pageInfo { endCursor, hasNextPage } } }";

        Api.post(vmQuery).then((res) => {
            this.pageInfo[name] = res.data[vm.clause].pageInfo;
            this.edges[name].push(...res.data[vm.clause].edges);
            dispatcher.trigger("showCards", this.edges[name]);
            this.isLoading = false;
        });
    }
}